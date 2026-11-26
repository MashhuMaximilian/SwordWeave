import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { capabilityPrimitiveRoleEnum, effectConditions, effectEffects } from "@/db/schema";
import { attachmentMemberDetails } from "@/lib/character/attachable-container";
import { loadCreationCapabilityPrimitives, maxCreationCapabilityMembers } from "@/lib/character/creation-capability";
import { withDraftExecution } from "@/lib/character/workspace/draft-scope";
import { loadWorkspaceNodes, type LoadedNode } from "@/lib/character/workspace/load-nodes";
import type { EntityKey, WorkspaceGraph } from "@/lib/character/workspace/model";
import { createWorkspaceEntity } from "@/lib/character/workspace/save-entity";
import { visibleDefinitionKeys } from "@/lib/publishing/definition-visibility";
import { canonicalJsonStringify } from "@/lib/publishing/hash-content";
import { dependencyReferences, readDependencyPins } from "@/lib/versions/dependency-pins";
import { authoredCapabilityFields, authoredEffectFields, authoredHeritageFields, authoredItemFields, pinnedRef, type PinnedRef } from "./draft";
import { digestJson } from "./operation-policy";
import { OperationBlockError } from "./operations";

const supportedMemberships = {
  primitive: [],
  effect: ["primitive"],
  capability: ["primitive", "effect"],
  heritage: ["primitive", "capability"],
  item: ["primitive", "capability", "effect"],
} as const satisfies Record<PinnedRef["kind"], readonly PinnedRef["kind"][]>;
const maxNodes = 64;
const member = z.strictObject({
  pin: pinnedRef,
  role: z.enum(capabilityPrimitiveRoleEnum.enumValues).optional(),
  quantity: z.number().int().min(1).max(2147483647).optional(),
});
const requiredMembers = z.array(member).min(1).max(maxCreationCapabilityMembers);
const optionalMembers = z.array(member).max(maxCreationCapabilityMembers).default([]);
export const composedPieceSchemas = [
  z.strictObject({ kind: z.literal("capability"), fields: authoredCapabilityFields, members: requiredMembers }),
  z.strictObject({ kind: z.literal("effect"), fields: authoredEffectFields, members: requiredMembers }),
  z.strictObject({ kind: z.literal("heritage"), fields: authoredHeritageFields, members: optionalMembers }),
  z.strictObject({ kind: z.literal("item"), fields: authoredItemFields, members: optionalMembers }),
] as const;
type ComposedPiece = z.output<(typeof composedPieceSchemas)[number]>;
type PieceMember = z.output<typeof member>;
type ExactNode = { pin: PinnedRef; snapshot: LoadedNode["versions"][number]["snapshot"]; members: PinnedRef[] };
const keyFor = (pin: PinnedRef): EntityKey => `${pin.kind}:${pin.id}`;
const pinFor = (kind: PinnedRef["kind"], id: string | number, versionId: unknown) =>
  pinnedRef.safeParse({ kind, id: String(id), versionId }).data;

function validMember(kind: ComposedPiece["kind"], { pin, role, quantity = 1 }: PieceMember) {
  const primitiveRole = kind === "capability" && pin.kind === "primitive";
  const storesQuantity = (kind === "capability" || kind === "effect") && pin.kind === "primitive";
  return (supportedMemberships[kind] as readonly string[]).includes(pin.kind) &&
    primitiveRole === Boolean(role) && (storesQuantity || quantity === 1);
}

function exactNode(pin: PinnedRef, loaded: LoadedNode): ExactNode | null {
  const [version] = loaded.versions;
  if (loaded.versions.length !== 1 || version?.id !== pin.versionId || version.deltaKind !== "FULL") return null;
  const snapshot = version.snapshot;
  if (typeof snapshot["name"] !== "string" || snapshot["name"] !== loaded.row["name"]) return null;
  const refs = dependencyReferences(snapshot);
  const stored = readDependencyPins(snapshot) ?? [];
  const rawPins = snapshot["dependencyPins"];
  if (refs.length > maxCreationCapabilityMembers || stored.length !== refs.length ||
      loaded.links.length !== refs.length || (rawPins !== undefined && (!Array.isArray(rawPins) || rawPins.length !== stored.length))) return null;
  const members = new Map<string, PinnedRef>();
  const key = (kind: string, id: string | number, role: unknown) => `${kind}:${id}:${role ?? ""}`;
  const live = new Map(loaded.links.map(({ kind, id, data }) => [key(kind, id, data["role"]), data]));
  const expected = new Map(refs.map(({ kind, id, data }) => [key(kind, id, data["role"]), data]));
  if (live.size !== refs.length || expected.size !== refs.length) return null;
  for (const ref of stored) {
    const bound = pinFor(ref.kind, ref.id, ref.versionId);
    if (!bound || !(supportedMemberships[pin.kind] as readonly string[]).includes(ref.kind)) return null;
    const memberKey = key(ref.kind, ref.id, ref.data["role"]);
    const actual = live.get(memberKey);
    const canonical = expected.get(memberKey);
    const details = attachmentMemberDetails(ref.data);
    if (!actual || !canonical || members.has(memberKey) || details.isMirrored || details.targetWho !== "self" ||
        canonicalJsonStringify(ref.data) !== canonicalJsonStringify({ ...canonical, versionId: ref.versionId }) ||
        canonicalJsonStringify(details) !== canonicalJsonStringify(attachmentMemberDetails(actual))) return null;
    members.set(memberKey, bound);
  }
  return { pin, snapshot, members: [...members.values()] };
}

/** Guard every pinned descendant, including one already present elsewhere on the sheet. */
export async function loadExactComposition(clerkId: string, roots: readonly PinnedRef[], graph?: WorkspaceGraph) {
  const exact = new Map<EntityKey, ExactNode>();
  const attached = new Map(graph?.nodes.map(node => [node.key, node.versionId]));
  let pending = [...roots];
  while (pending.length) {
    const frontier = new Map<EntityKey, PinnedRef>();
    for (const pin of pending) {
      const key = keyFor(pin);
      const prior = exact.get(key)?.pin ?? frontier.get(key);
      if ((prior && prior.versionId !== pin.versionId) || (attached.has(key) && attached.get(key) !== pin.versionId)) {
        throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
      }
      if (!prior) frontier.set(key, pin);
    }
    if (!frontier.size) break;
    if (frontier.size + exact.size > maxNodes) throw new OperationBlockError("VALIDATION_FAILED");

    const keys = [...frontier.keys()];
    const effectIds = [...frontier.values()].flatMap(pin => pin.kind === "effect" ? [pin.id] : []);
    const primitiveIds = [...frontier.values()].flatMap(pin => pin.kind === "primitive" ? [Number(pin.id)] : []);
    const [allowed, loaded, primitives, nestedEffects, conditions] = await Promise.all([
      visibleDefinitionKeys(clerkId, keys), loadWorkspaceNodes(keys, true),
      primitiveIds.length ? loadCreationCapabilityPrimitives(clerkId, primitiveIds) : new Map(),
      effectIds.length ? db.select({ id: effectEffects.parentEffectId }).from(effectEffects).where(inArray(effectEffects.parentEffectId, effectIds)) : [],
      effectIds.length ? db.select({ id: effectConditions.effectId }).from(effectConditions).where(inArray(effectConditions.effectId, effectIds)) : [],
    ]);
    const unsupportedEffects = new Set([...nestedEffects, ...conditions].map(row => row.id));
    pending = [];
    for (const [key, pin] of frontier) {
      const loadedNode = loaded.get(key);
      const node = loadedNode && allowed.has(key) && exactNode(pin, loadedNode);
      if (!node || (pin.kind === "effect" && unsupportedEffects.has(pin.id)) ||
          (pin.kind === "primitive" && primitives.get(Number(pin.id))?.versionId !== pin.versionId)) {
        throw new OperationBlockError("DEPENDENCY_UNAVAILABLE");
      }
      exact.set(key, node);
      pending.push(...node.members);
    }
  }
  return exact;
}

function workspaceComposition(piece: ComposedPiece) {
  const primitiveSlots = piece.members.flatMap(({ pin, quantity = 1, role }, sortOrder) => pin.kind === "primitive" ?
    [{ primitiveId: Number(pin.id), quantity, role, sortOrder, isMirrored: false }] : []);
  const effectSlots = piece.members.flatMap(({ pin }, sortOrder) => pin.kind === "effect" ? [{ effectId: pin.id, sortOrder }] : []);
  const fields = Object.fromEntries(Object.entries(piece.fields).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
  return {
    fields,
    payload: {
      ...fields, isPublic: false, sourceOrigin: "companion", primitiveSlots,
      ...(piece.kind === "capability" ? { effectSlots } : {}),
      ...(piece.kind === "item" ? { effectIds: effectSlots.map(slot => slot.effectId) } : {}),
      ...(piece.kind === "item" || piece.kind === "heritage" ? {
        capabilityIds: piece.members.flatMap(({ pin }) => pin.kind === "capability" ? [pin.id] : []),
      } : {}),
      membershipOrder: piece.members.map(({ pin, role }) => keyFor(pin) + (role ? `:${role}` : "")),
    },
  };
}

export async function planComposedCharacterPiece(characterId: string, clerkId: string, piece: ComposedPiece, graph: WorkspaceGraph) {
  const direct = piece.members.map(({ pin }) => keyFor(pin));
  if (!piece.fields.name || direct.length !== new Set(direct).size || piece.members.some(slot => !validMember(piece.kind, slot)) ||
      (piece.kind === "heritage" && piece.fields.kind !== "LINEAGE" && piece.fields.defaultSize)) {
    throw new OperationBlockError("VALIDATION_FAILED");
  }
  const exact = await loadExactComposition(clerkId, piece.members.map(slot => slot.pin), graph);
  const orderedMembers = piece.members.map(({ pin, role, quantity = 1 }) => ({
    name: String(exact.get(keyFor(pin))?.snapshot["name"]), pin, ...(role ? { role } : {}), quantity,
  }));
  const { fields, payload } = workspaceComposition(piece);
  const dependencies = [...exact.values()].map(({ pin, snapshot }) => ({ pin, name: String(snapshot["name"]) }));
  return {
    root: { kind: piece.kind, name: piece.fields.name, fields, members: orderedMembers, dependencies, isPublic: false },
    recipeDigest: digestJson([payload, [...exact.values()]]),
    save: () => withDraftExecution(characterId, clerkId, async () => {
      const saved = await createWorkspaceEntity(piece.kind, payload);
      const key: EntityKey = `${piece.kind}:${saved.id}`;
      const loaded = (await loadWorkspaceNodes([key], true)).get(key);
      const pin = pinFor(piece.kind, saved.id, loaded?.versions[0]?.id);
      const root = pin && loaded && exactNode(pin, loaded);
      if (!root || !loaded || loaded.row["userId"] !== clerkId || loaded.row["isPublic"] !== false || root.snapshot["isPublic"] !== false ||
          Object.entries(fields).some(([field, value]) => root.snapshot[field] !== value) ||
          root.members.length !== orderedMembers.length || root.members.some(member =>
            !orderedMembers.some(({ pin }) => keyFor(pin) === keyFor(member) && pin.versionId === member.versionId))) {
        throw new OperationBlockError("STALE_REVIEW");
      }
      return { entityKind: piece.kind, entityId: saved.id, versionPin: root.pin.versionId };
    }, true),
  };
}
