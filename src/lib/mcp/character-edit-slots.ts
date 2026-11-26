import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { primitives, primitiveVersions } from "@/db/schema";
import { attachmentMemberDetails, loadAttachableContainers, type ContainerAttachmentGraph } from "@/lib/character/attachable-container";
import { loadCreationCapabilities } from "@/lib/character/creation-capability";
import { creationDrawback } from "@/lib/character/creation-drawback";
import { directPrimitivePinCondition } from "@/lib/character/direct-primitive-pin";
import { currentForkGrants, type CharacterForkGrant } from "@/lib/character/workspace/fork-grants";
import type { DraftOperation } from "@/lib/character/workspace/draft-types";
import type { EntityKey, WorkspaceEdge, WorkspaceGraph, WorkspaceNode } from "@/lib/character/workspace/model";
import { visibilityCondition } from "@/lib/publishing/library-query";
import type { HardModifier } from "@/types/swordweave";
import type { CharacterActor } from "./context-shared";
import { pinnedRef } from "./draft";
import { digestJson } from "./operation-policy";

const path = z.array(z.string().min(1).max(200)).min(1).max(20);
export const attachmentChange = z.strictObject({
  kind: z.literal("attach_library_piece"), ref: pinnedRef,
  channel: z.enum(["LINEAGE", "UPBRINGING", "MANIFEST", "ITEM"]), isMirrored: z.boolean().optional(),
});
export const removeChange = z.strictObject({ kind: z.literal("remove_reference"), path });
export const mirrorChange = z.strictObject({ kind: z.literal("mirror_primitive"), path, isMirrored: z.boolean() });
export const moveChange = z.strictObject({ kind: z.literal("move_reference"), path, destinationPath: path });
type SlotChange = z.infer<typeof attachmentChange | typeof removeChange | typeof mirrorChange | typeof moveChange>;

export class CharacterEditUnavailable extends Error {}

type SlotSummary = { name: string; placement: string; pin: string; isMirrored: boolean;
  drawback?: { description: string; eligibilityNotes?: string; mirrorCredit: number } };
type NestedMember = { child: EntityKey; pin: string; isMirrored: boolean; role: string; quantity: number };
type ExactAttachmentMember = NestedMember & { slotLabel: string; notes: string; targetWho: string };
type ContainerEdit = { sourceCapabilityId: string; sourcePin: string; rootId: string; key: EntityKey; placement: string; members: ExactAttachmentMember[] };
export type SlotEdit = {
  operation: DraftOperation;
  review: { kind: SlotChange["kind"]; path: string[] | null; before: SlotSummary | null; after: SlotSummary | null; sourceContainer?: string; destinationContainer?: string;
    privateCopyAccess?: string; members?: (Pick<NestedMember, "pin" | "role" | "quantity"> & { name: string })[] };
  child: EntityKey;
  replacedEdgeId: string | null;
  containers?: ContainerEdit[];
  attachment?: { members: ExactAttachmentMember[]; snapshotDigest: string };
  containerAttachment?: { graph: ContainerAttachmentGraph; snapshotDigest: string };
};

function hashFor(node: WorkspaceNode): string | null {
  const value = node.data["contentHash"];
  return typeof value === "string" ? value : null;
}

function exactRoot(graph: WorkspaceGraph, path: string[]) {
  if (path.length !== 1) throw new CharacterEditUnavailable("Choose an exact root placement.");
  const matching = graph.edges.filter(edge => edge.id === path[0]);
  const edge = matching.length === 1 ? matching[0] : undefined;
  const node = edge?.parent === null ? graph.nodes.find(value => value.key === edge.child) : undefined;
  const pin = edge?.versionId;
  if (!edge || !node || !pin || node.versionId !== pin || node.latestVersionId !== pin) {
    throw new CharacterEditUnavailable("The selected occurrence needs an available current version. Review it on the character sheet.");
  }
  if (node.kind === "primitive" && !edge.instanceId) throw new CharacterEditUnavailable("Choose an exact primitive occurrence.");
  return { edge, node, pin };
}

function exactMember(graph: WorkspaceGraph, edge: WorkspaceEdge): NestedMember {
  const node = graph.nodes.find(value => value.key === edge.child);
  const pin = edge.versionId;
  if (!node || node.kind !== "primitive" || !pin || node.versionId !== pin || node.latestVersionId !== pin) {
    throw new CharacterEditUnavailable("Review this container on the character sheet. Its members need exact current primitive versions.");
  }
  return { child: edge.child, pin, isMirrored: edge.isMirrored, role: String(edge.data?.["role"] ?? "OTHER"), quantity: Number(edge.data?.["quantity"] ?? 1) };
}

function exactAttachmentMembers(graph: WorkspaceGraph, parent: EntityKey): ExactAttachmentMember[] {
  return graph.edges.filter(edge => edge.parent === parent).sort((left, right) => left.order - right.order).map(edge => ({
    ...exactMember(graph, edge), slotLabel: String(edge.data?.["slotLabel"] ?? ""),
    notes: String(edge.data?.["notes"] ?? ""), targetWho: String(edge.data?.["targetWho"] ?? "self"),
  }));
}

function reviewedDrawback(snapshot: Record<string, unknown>, modifiers: unknown, credit: unknown) {
  const drawback = Array.isArray(modifiers) ? creationDrawback(modifiers as readonly HardModifier[], snapshot) : null;
  if (!drawback || typeof credit !== "number" || !Number.isInteger(credit) || credit < 0) {
    throw new CharacterEditUnavailable("The selected version has no reviewable mirrored effect. Choose a drawback with an explicit mechanical effect.");
  }
  return { drawback: { ...drawback, mirrorCredit: credit } };
}

function exactContainer(graph: WorkspaceGraph, path: string[]) {
  const root = exactRoot(graph, path);
  if (root.node.kind !== "capability") throw new CharacterEditUnavailable("Open the character sheet to edit this kind of container.");
  const edges = graph.edges.filter(edge => edge.parent === root.node.key).sort((left, right) => left.order - right.order);
  if (new Set(edges.map(edge => edge.child)).size !== edges.length || edges.some(edge => graph.edges.filter(other => other.id === edge.id).length !== 1)) {
    throw new CharacterEditUnavailable("This container has ambiguous placements. Review its members on the character sheet.");
  }
  return { ...root, edges, members: exactAttachmentMembers(graph, root.node.key) };
}

function nestedEdit(graph: WorkspaceGraph, change: Exclude<SlotChange, {kind: "attach_library_piece"}>, id: string): SlotEdit | null {
  if (change.path.length !== 2) throw new CharacterEditUnavailable("Choose a primitive inside a direct capability on this character.");
  const source = exactContainer(graph, change.path.slice(0, 1));
  const index = source.edges.findIndex(edge => edge.id === change.path[1]);
  const edge = source.edges[index];
  const member = source.members[index];
  const child = member && graph.nodes.find(node => node.key === member.child);
  if (!edge || !member || !child) throw new CharacterEditUnavailable("The selected membership is unavailable.");
  const before = { name: child.name, placement: source.edge.category, pin: member.pin, isMirrored: member.isMirrored };
  const command = { target: source.node.key, path: change.path.slice(0, 1), expectedHash: hashFor(source.node), edgeId: edge.id };
  const container = (base: ReturnType<typeof exactContainer>, members: ExactAttachmentMember[]): ContainerEdit =>
    ({ sourcePin: base.pin, sourceCapabilityId: base.node.id, key: base.node.key, rootId: base.edge.id, placement: base.edge.category, members });
  const remaining = source.members.filter((_, current) => index !== current);
  if (change.kind === "remove_reference") return {
    child: child.key, replacedEdgeId: edge.id, containers: [container(source, remaining)],
    operation: { id, type: "command", payload: { ...command, operation: "remove-reference" } },
    review: { kind: change.kind, path: change.path, before, after: null, sourceContainer: source.node.name },
  };
  if (change.kind === "mirror_primitive") {
    if (child.data["isMirrorable"] !== true) throw new CharacterEditUnavailable("Choose a mirrorable primitive membership.");
    if (member.isMirrored === change.isMirrored) return null;
    const mirrored = { ...member, isMirrored: change.isMirrored };
    const drawback = change.isMirrored ? reviewedDrawback(child.data, child.data["hardModifiers"], child.data["mirrorBuCredit"]) : {};
    return {
      child: child.key, replacedEdgeId: edge.id, containers: [container(source, source.members.map((value, current) => current === index ? mirrored : value))],
      operation: { id, type: "command", payload: { ...command, operation: "mirror-reference" } },
      review: { kind: change.kind, path: change.path, before, after: { ...before, isMirrored: change.isMirrored, ...drawback }, sourceContainer: source.node.name },
    };
  }
  const destination = exactContainer(graph, change.destinationPath);
  if (destination.node.key === source.node.key || destination.members.some(value => value.child === child.key)) {
    throw new CharacterEditUnavailable("Choose a different capability that does not already contain this primitive.");
  }
  return {
    child: child.key, replacedEdgeId: edge.id, containers: [container(source, remaining), container(destination, [...destination.members, member])],
    operation: { id, type: "command", payload: { ...command, operation: "move-reference", destination: destination.node.key,
      destinationPath: change.destinationPath, destinationHash: hashFor(destination.node) } },
    review: { kind: change.kind, path: change.path, before, after: { ...before, placement: destination.edge.category },
      sourceContainer: source.node.name, destinationContainer: destination.node.name },
  };
}

export async function deriveSlotEdit(actor: CharacterActor, graph: WorkspaceGraph, change: SlotChange, alsoVisibleTo?: string): Promise<SlotEdit | null> {
  const id = randomUUID();
  if (change.kind === "attach_library_piece") {
    const { ref, channel, isMirrored = false } = change;
    if (ref.kind === "capability" && channel !== "ITEM" && !isMirrored) {
      const child: EntityKey = `capability:${ref.id}`;
      if (graph.nodes.some(node => node.key === child)) throw new CharacterEditUnavailable("This capability is already part of the character build.");
      const [available, ownerAvailable] = await Promise.all([
        loadCreationCapabilities(actor.clerkId, [ref.id]),
        alsoVisibleTo ? loadCreationCapabilities(alsoVisibleTo, [ref.id]) : undefined,
      ]);
      const candidate = available[0];
      if (!candidate || candidate.versionId !== ref.versionId ||
          (ownerAvailable && ownerAvailable[0]?.snapshotDigest !== candidate.snapshotDigest)) {
        throw new CharacterEditUnavailable("The selected capability or a member version is unavailable. Choose an eligible current pin from the library.");
      }
      const members = candidate.members.map(({ id: memberId, primitive, role, quantity, slotLabel, notes, targetWho }): ExactAttachmentMember => ({
        child: `primitive:${memberId}`, pin: primitive.versionId, isMirrored: false, role, quantity, slotLabel, notes, targetWho,
      }));
      if (members.some(member => graph.nodes.some(node => node.key === member.child && node.versionId !== member.pin))) {
        throw new CharacterEditUnavailable("This capability needs a different version of an existing primitive. Review the pins on the character sheet.");
      }
      return {
        child, replacedEdgeId: null, attachment: { members, snapshotDigest: candidate.snapshotDigest },
        operation: { id, type: "create", payload: { kind: "capability", category: channel, existingId: ref.id, expectedVersionId: ref.versionId, mirrored: false, draft: {} } },
        review: { kind: change.kind, path: null, before: null, after: { name: candidate.name, placement: channel, pin: ref.versionId, isMirrored: false },
          members: candidate.members.map(({ primitive, role, quantity }) => ({ name: primitive.name, pin: primitive.versionId, role, quantity })) },
      };
    }
    if (ref.kind === "effect" || ref.kind === "item" || ref.kind === "heritage") {
      if (isMirrored || (ref.kind === "item") !== (channel === "ITEM")) {
        throw new CharacterEditUnavailable("Choose the native placement for this piece and leave its mirror flag off.");
      }
      const child: EntityKey = `${ref.kind}:${ref.id}`;
      if (graph.nodes.some(node => node.key === child)) throw new CharacterEditUnavailable("This piece is already part of the character build.");
      const [available, ownerAvailable] = await Promise.all([
        loadAttachableContainers(ref.kind, [ref.id], actor.clerkId),
        alsoVisibleTo ? loadAttachableContainers(ref.kind, [ref.id], alsoVisibleTo) : undefined,
      ]);
      const candidate = available[0];
      if (!candidate || candidate.versionId !== ref.versionId ||
          (ownerAvailable && ownerAvailable[0]?.snapshotDigest !== candidate.snapshotDigest)) {
        throw new CharacterEditUnavailable("The selected piece or a member version is unavailable. Choose an eligible current pin from the library.");
      }
      if (candidate.channel && candidate.channel !== channel) {
        throw new CharacterEditUnavailable("Choose the tab that matches this heritage.");
      }
      const members = candidate.graph.flatMap(container => container.members);
      if (members.some(member => graph.nodes.some(node => node.key === member.child && node.versionId !== member.pin))) {
        throw new CharacterEditUnavailable("This piece needs a different version of an existing component. Review the pins on the character sheet.");
      }
      return {
        child, replacedEdgeId: null, containerAttachment: { graph: candidate.graph, snapshotDigest: candidate.snapshotDigest },
        operation: { id, type: "create", payload: { kind: ref.kind, category: channel, existingId: ref.id, expectedVersionId: ref.versionId,
          mirrored: false, draft: {} } },
        review: { kind: change.kind, path: null, before: null, after: { name: candidate.name, placement: channel, pin: ref.versionId, isMirrored: false },
          ...(members.length ? { members: members.map(({ name, pin, role, quantity }) => ({ name, pin, role, quantity })) } : {}) },
      };
    }
    if (ref.kind !== "primitive" || channel === "ITEM") throw new CharacterEditUnavailable("Attach this kind of library piece on the character sheet.");
    const child: EntityKey = `primitive:${ref.id}`;
    if (graph.nodes.some(node => node.key === child)) throw new CharacterEditUnavailable("This primitive is already part of the character build.");
    const [primitive] = await db.select({ name: primitives.name, isMirrorable: primitives.isMirrorable, mirrorBuCredit: primitives.mirrorBuCredit,
      hardModifiers: primitives.hardModifiers, snapshot: primitiveVersions.snapshot })
      .from(primitives).innerJoin(primitiveVersions, eq(primitiveVersions.primitiveId, primitives.id))
      .where(and(eq(primitives.id, Number(ref.id)), eq(primitiveVersions.id, ref.versionId), directPrimitivePinCondition,
        visibilityCondition("PRIMITIVE", sql`${primitives.id}`, sql`${primitives.userId}`, actor.clerkId, sql`${primitives.isPublic}`),
        alsoVisibleTo ? visibilityCondition("PRIMITIVE", sql`${primitives.id}`, sql`${primitives.userId}`, alsoVisibleTo, sql`${primitives.isPublic}`) : undefined));
    if (!primitive) throw new CharacterEditUnavailable("The selected catalogue version is unavailable. Choose a current pin from the library.");
    if (isMirrored && !primitive.isMirrorable) throw new CharacterEditUnavailable("This primitive cannot be taken as a mirrored drawback.");
    const drawback = isMirrored ? reviewedDrawback(primitive.snapshot, primitive.hardModifiers, primitive.mirrorBuCredit) : {};
    return {
      child, replacedEdgeId: null,
      operation: { id, type: "create", payload: { kind: "primitive", category: channel, existingId: ref.id, expectedVersionId: ref.versionId, mirrored: isMirrored, draft: {} } },
      review: { kind: change.kind, path: null, before: null, after: { name: primitive.name, placement: channel, pin: ref.versionId, isMirrored, ...drawback } },
    };
  }

  if (change.path.length > 1 || change.kind === "move_reference") {
    const edit = nestedEdit(graph, change, id);
    if (edit?.containers) {
      edit.review.privateCopyAccess = "The edited capability becomes a private copy owned by the editor. People with access to this character and its source can read this exact attached version.";
      const parents = await currentForkGrants(graph.characterId, edit.containers.map(container => container.sourceCapabilityId));
      for (const container of edit.containers) {
        const parent = parents.find(grant => grant.capabilityId === container.sourceCapabilityId
          && grant.rootEdgeId === container.rootId && grant.versionId === container.sourcePin);
        if (parent) container.sourceCapabilityId = parent.sourceCapabilityId;
      }
    }
    return edit;
  }
  const { edge, node, pin } = exactRoot(graph, change.path);
  const before = { name: node.name, placement: edge.category, pin, isMirrored: edge.isMirrored };
  const command = { target: node.key, path: change.path, expectedHash: hashFor(node) };
  if (change.kind === "remove_reference") return {
    child: node.key, replacedEdgeId: edge.id,
    operation: { id, type: "command", payload: { ...command, operation: "detach" } },
    review: { kind: change.kind, path: change.path, before, after: null },
  };
  if (node.kind !== "primitive" || node.data["isMirrorable"] !== true) throw new CharacterEditUnavailable("Choose a mirrorable primitive instance.");
  if (edge.isMirrored === change.isMirrored) return null;
  const drawback = change.isMirrored ? reviewedDrawback(node.data, node.data["hardModifiers"], node.data["mirrorBuCredit"]) : {};
  return {
    child: node.key, replacedEdgeId: edge.id,
    operation: { id, type: "command", payload: { ...command, operation: "mirror-instance" } },
    review: { kind: change.kind, path: change.path, before, after: { ...before, isMirrored: change.isMirrored, ...drawback } },
  };
}

/** Compare actual placements and mechanics while ignoring newly allocated occurrence IDs. */
export function checkedSlotResult(before: WorkspaceGraph, after: WorkspaceGraph, edits: SlotEdit[],
  results: { operationId: string; result: Record<string, unknown> }[], actor: CharacterActor) {
  const oldIds = new Set(before.edges.map(edge => edge.id));
  const touched = new Set<string>();
  const forkSources = new Map<EntityKey, EntityKey>();
  const forkGrants: CharacterForkGrant[] = [];
  for (const edit of edits) {
    const previous = edit.replacedEdgeId;
    if (previous) touched.add(previous);
    if (edit.containers) {
      const replacements = z.record(z.string(), z.string()).safeParse(results.find(row => row.operationId === edit.operation.id)?.result["replacements"]);
      if (!replacements.success) throw new CharacterEditUnavailable("The native workspace could not isolate this capability change.");
      for (const container of edit.containers) {
        const replacement = replacements.data[container.key];
        const node = after.nodes.find(value => value.key === replacement);
        const root = after.edges.find(edge => edge.parent === null && edge.child === replacement && edge.category === container.placement);
        if (!node || !root || root.versionId !== node.versionId || !root.versionId || node.userId !== actor.clerkId
          || node.data["isPublic"] !== false || node.data["sourceOrigin"] !== `fork:${container.key.slice("capability:".length)}`
          || after.edges.some(edge => edge.id === container.rootId)) {
          throw new CharacterEditUnavailable("The workspace did not produce the reviewed private capability fork.");
        }
        const afterMembers = exactAttachmentMembers(after, node.key);
        if (digestJson(afterMembers) !== digestJson(container.members)) {
          throw new CharacterEditUnavailable("The saved capability members differ from the approved pins or mirror state.");
        }
        if (before.nodes.some(candidate => candidate.key === node.key) || after.edges.filter(edge => edge.child === node.key).length !== 1) {
          throw new CharacterEditUnavailable("The private fork must have one new, exact character placement.");
        }
        forkGrants.push({ capabilityId: node.id, versionId: root.versionId, rootEdgeId: root.id, sourceCapabilityId: container.sourceCapabilityId });
        forkSources.set(node.key, container.key);
        touched.add(container.rootId);
        touched.add(root.id);
      }
      continue;
    }
    const expected = edit.review.after;
    const formerEdge = after.edges.find(edge => edge.parent === null && edge.id === previous);
    if (!expected) {
      if (formerEdge) throw new CharacterEditUnavailable("The selected placement did not detach.");
      continue;
    }
    const candidates = after.edges.filter(edge => edge.parent === null && edge.child === edit.child
      && (edge.id === previous || !oldIds.has(edge.id)) && edge.category === expected.placement
      && edge.versionId === expected.pin && edge.isMirrored === expected.isMirrored);
    if (candidates.length !== 1 || (formerEdge && formerEdge !== candidates[0])) {
      throw new CharacterEditUnavailable("The native placement differs from the reviewed version or mirror state.");
    }
    if (edit.attachment && digestJson(exactAttachmentMembers(after, edit.child)) !== digestJson(edit.attachment.members)) {
      throw new CharacterEditUnavailable("The saved capability members differ from the approved versions, roles or order.");
    }
    for (const { parent, members } of edit.containerAttachment?.graph ?? []) {
      const actual = after.edges.filter(edge => edge.parent === parent).sort((left, right) => left.order - right.order).map(edge => {
        const node = after.nodes.find(node => node.key === edge.child);
        if (!node || !edge.versionId || node.versionId !== edge.versionId || node.latestVersionId !== edge.versionId) {
          throw new CharacterEditUnavailable("A saved member does not resolve to its reviewed pin.");
        }
        return { child: edge.child, pin: edge.versionId, name: node.name, ...attachmentMemberDetails(edge.data), isMirrored: edge.isMirrored };
      });
      if (digestJson(actual) !== digestJson(members)) {
        throw new CharacterEditUnavailable("The saved members differ from the approved versions, quantities or order.");
      }
    }
    touched.add(candidates[0]!.id);
  }

  const selection = (edge: WorkspaceEdge) => ({ id: oldIds.has(edge.id) ? edge.id : null,
    parent: edge.parent ? forkSources.get(edge.parent) ?? edge.parent : null, child: forkSources.get(edge.child) ?? edge.child,
    category: edge.category, versionId: forkSources.has(edge.child) ? null : edge.versionId ?? null,
    isMirrored: edge.isMirrored, slotSource: edge.slotSource ?? null, quantity: edge.data?.["quantity"] ?? null,
    role: edge.data?.["role"] ?? null });
  const edgeDigest = after.edges.map(edge => digestJson(selection(edge))).sort();
  const definitionDigest = after.nodes.map(node => digestJson([forkSources.get(node.key) ?? node.key, node.name,
    forkSources.has(node.key) ? null : node.versionId, node.bu, node.data["contentHash"] ?? node.data["workspaceLiveContentHash"] ?? null])).sort();
  const attachedSnapshots = edits.flatMap(edit => {
    const attached = edit.attachment ?? edit.containerAttachment;
    return attached ? [attached.snapshotDigest] : [];
  });
  return { forkGrants, changedSlotIds: [...touched], slotDigest: digestJson({ edgeDigest, definitionDigest, ...(forkGrants.length ? { forkAnchors: forkGrants.map(grant => grant.sourceCapabilityId) } : {}),
    ...(attachedSnapshots.length ? { attachedSnapshots } : {}) }) };
}
