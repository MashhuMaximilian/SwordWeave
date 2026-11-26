import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { characterCapabilities, characterItems, characterPrimitives, primitives, type characterProposals } from "@/db/schema";
import { computeProposalDiff } from "@/lib/character/compute-proposal-diff";
import { canContain, type EntityKey } from "@/lib/character/workspace/model";
import { deepEqual } from "@/lib/versions/delta";
import { dependencyReferences, readDependencyPins, type DependencyPin } from "@/lib/versions/dependency-pins";
import { getPinnedVersionPayload } from "@/lib/versions/version-payload";
import type { VersionProposalTarget } from "@/lib/character/version-proposals";
import { visibleDefinitionKeys } from "@/lib/publishing/definition-visibility";
import { canonicalJsonStringify, sha256Hex } from "@/lib/publishing/hash-content";

type Proposal = Pick<typeof characterProposals.$inferSelect,
  "characterId" | "targetKind" | "targetId" | "currentVersionId" | "proposedVersionId" | "status"> & {
    instanceId: string | null;
  };
type VersionKind = "primitive" | "effect" | "capability" | "item";
type Pin = { kind: VersionKind; id: string; versionId: string };

const uuid = z.uuid();
const supportedKinds = ["primitive", "effect", "capability", "item"] as const;
const versionType = { primitive: "PRIMITIVE", effect: "EFFECT", capability: "CAPABILITY", item: "ITEM" } as const;
const maxDependencyPins = 40;
const safeValue = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]);
const containerTextFields = new Set(["name", "description", "verboseDescription", "narrativeDescription"]);

function definitionId(kind: VersionKind, value: string | number) {
  const id = String(value);
  if (kind === "primitive") return /^[1-9][0-9]{0,9}$/.test(id) && Number(id) <= 2_147_483_647 ? id : null;
  return uuid.safeParse(id).success ? id.toLowerCase() : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizePin(dependency: DependencyPin): Pin | null {
  if (dependency.kind === "heritage") return null;
  const id = definitionId(dependency.kind, dependency.id);
  const pin = uuid.safeParse(dependency.versionId);
  if (!id || !pin.success || !record(dependency.data)) return null;
  const nestedId = dependency.data[`${dependency.kind}Id`];
  const nestedVersion = dependency.data["versionId"];
  if (nestedId !== undefined && ((typeof nestedId !== "string" && typeof nestedId !== "number") ||
    definitionId(dependency.kind, nestedId) !== id)) return null;
  if (nestedVersion != null && (typeof nestedVersion !== "string" ||
    nestedVersion.toLowerCase() !== pin.data.toLowerCase())) return null;
  return { kind: dependency.kind, id, versionId: pin.data.toLowerCase() };
}

function historicalDependencies(parent: VersionKind, payload: Record<string, unknown>): Pin[] | null {
  const declared = payload["dependencyPins"];
  const pins = readDependencyPins(payload);
  if (declared !== undefined && (!Array.isArray(declared) || !pins || pins.length !== declared.length)) return null;
  const references = dependencyReferences(payload);
  const normalized = (pins ?? references).map(normalizePin);
  if (normalized.length > maxDependencyPins || normalized.some(pin => !pin || !canContain(parent, pin.kind))) return null;
  const valid = normalized as Pin[];

  // An explicit pin list must cover each linked occurrence. Check aliases separately
  // so an additional legacy declaration cannot conceal a dependency from the review.
  for (const kind of [...supportedKinds, "heritage"]) {
    for (const field of [`${kind}Slots`, `${kind}Links`, `${kind}Ids`]) {
      if (!Object.hasOwn(payload, field)) continue;
      const value = payload[field];
      if (!Array.isArray(value) || value.length > maxDependencyPins) return null;
      const links = dependencyReferences({ [field]: value });
      if (links.length !== value.length) return null;
      const remaining = [...valid];
      // Match explicitly pinned occurrences before otherwise identical unpinned aliases.
      links.sort((left, right) => Number(left.versionId === null) - Number(right.versionId === null));
      for (const link of links) {
        if (link.data["versionId"] != null && !uuid.safeParse(link.data["versionId"]).success) return null;
        const index = remaining.findIndex(pin => pin.kind === link.kind &&
          pin.id === definitionId(pin.kind, link.id) &&
          (link.versionId === null || pin.versionId === link.versionId.toLowerCase()));
        if (index < 0) return null;
        remaining.splice(index, 1);
      }
    }
  }

  // These links lack historical pins in the native payload format.
  if (payload["templatePrimitiveId"] != null) return null;
  const behavior = payload["consequenceBehavior"];
  if (behavior != null && (!record(behavior) || !Array.isArray(behavior["restrictions"]) ||
    behavior["restrictions"].length > 0)) return null;
  return valid;
}

function versionKey(pin: Pin): EntityKey {
  return `${pin.kind}:${pin.id}`;
}

async function visibleHistoricalPayloads(clerkId: string, start: Pin, proposed: Pin) {
  const queue = [start, proposed];
  const seen = new Map<string, Record<string, unknown>>();
  for (const pin of queue) {
    const key = versionKey(pin);
    const cacheKey = `${key}:${pin.versionId}`;
    if (seen.has(cacheKey)) continue;
    if (seen.size === maxDependencyPins || !(await visibleDefinitionKeys(clerkId, [key])).has(key)) return null;
    if (pin.kind === "primitive") {
      // Canonical primitive saves can omit the live template link from snapshots.
      const [definition] = await db.select({ templateId: primitives.templatePrimitiveId }).from(primitives)
        .where(eq(primitives.id, Number(pin.id))).limit(1);
      if (!definition || definition.templateId !== null) return null;
    }
    const version = await getPinnedVersionPayload(versionType[pin.kind], pin.id, pin.versionId);
    if (!version || typeof version.payload["name"] !== "string" || !version.payload["name"]) return null;
    const pins = historicalDependencies(pin.kind, version.payload);
    if (!pins) return null;
    queue.push(...pins);
    seen.set(cacheKey, version.payload);
  }
  return {
    current: seen.get(`${versionKey(start)}:${start.versionId}`)!,
    proposed: seen.get(`${versionKey(proposed)}:${proposed.versionId}`)!,
    sourceDigest: await sha256Hex(canonicalJsonStringify([...seen].sort(([left], [right]) => left.localeCompare(right)))),
  };
}

export async function exactDirectVersionProposalPath(proposal: Proposal, targetId: string, atVersion: string): Promise<string[] | null> {
  const { characterId, instanceId, targetKind } = proposal;
  if (targetKind === "PRIMITIVE") {
    if (instanceId !== null && !uuid.safeParse(instanceId).success) return null;
    const slots = await db.select({ id: characterPrimitives.instanceId, direct: characterPrimitives.directSource,
      heritage: characterPrimitives.originHeritageId, capability: characterPrimitives.originCapabilityId,
      effect: characterPrimitives.originEffectId, item: characterPrimitives.originItemId,
    }).from(characterPrimitives)
      .where(and(eq(characterPrimitives.characterId, characterId), eq(characterPrimitives.primitiveId, Number(targetId)),
        eq(characterPrimitives.versionId, atVersion), instanceId === null ? undefined : eq(characterPrimitives.instanceId, instanceId))).limit(2);
    const [slot] = slots;
    if (slots.length !== 1 || !slot || !(slot.direct || (!slot.heritage && !slot.capability && !slot.effect && !slot.item))) return null;
    return [slot.id];
  }
  if (instanceId !== null) return null;
  if (targetKind === "CAPABILITY") {
    const [slot] = await db.select({ tab: characterCapabilities.slotTab }).from(characterCapabilities)
      .where(and(eq(characterCapabilities.characterId, characterId), eq(characterCapabilities.capabilityId, targetId),
        eq(characterCapabilities.versionId, atVersion), isNull(characterCapabilities.originHeritageId))).limit(1);
    return slot ? [`${slot.tab ?? "MANIFEST"}:capability:${targetId}`] : null;
  }
  const [slot] = await db.select({ id: characterItems.itemId }).from(characterItems)
    .where(and(eq(characterItems.characterId, characterId), eq(characterItems.itemId, targetId),
      eq(characterItems.versionId, atVersion))).limit(1);
  return slot ? [`ITEM:item:${slot.id}`] : null;
}

export async function versionProposalTargetFromPath(characterId: string, path: readonly string[], proposedVersionId: string): Promise<VersionProposalTarget | null> {
  const pathStep = path[0];
  if (path.length !== 1 || !pathStep) return null;
  if (uuid.safeParse(pathStep).success) {
    const [slot] = await db.select({ id: characterPrimitives.primitiveId, versionId: characterPrimitives.versionId })
      .from(characterPrimitives).where(and(eq(characterPrimitives.characterId, characterId),
        eq(characterPrimitives.instanceId, pathStep))).limit(1);
    return slot?.versionId ? { targetKind: "PRIMITIVE", targetId: String(slot.id), instanceId: pathStep,
      currentVersionId: slot.versionId, proposedVersionId } : null;
  }
  const [area, kind, id, extra] = pathStep.split(":");
  if (extra !== undefined || !id || !uuid.safeParse(id).success) return null;
  if (kind === "capability" && (area === "LINEAGE" || area === "UPBRINGING" || area === "MANIFEST")) {
    const [slot] = await db.select({ tab: characterCapabilities.slotTab, versionId: characterCapabilities.versionId })
      .from(characterCapabilities).where(and(eq(characterCapabilities.characterId, characterId),
        eq(characterCapabilities.capabilityId, id), isNull(characterCapabilities.originHeritageId))).limit(1);
    return slot?.versionId && (slot.tab ?? "MANIFEST") === area ? { targetKind: "CAPABILITY", targetId: id,
      currentVersionId: slot.versionId, proposedVersionId } : null;
  }
  if (kind !== "item" || area !== "ITEM") return null;
  const [slot] = await db.select({ versionId: characterItems.versionId }).from(characterItems)
    .where(and(eq(characterItems.characterId, characterId), eq(characterItems.itemId, id))).limit(1);
  return slot?.versionId ? { targetKind: "ITEM", targetId: id, currentVersionId: slot.versionId, proposedVersionId } : null;
}

export async function verifyVersionProposalContent(clerkId: string, proposal: Proposal) {
  const kind = proposal.targetKind.toLowerCase() as VersionKind;
  const id = definitionId(kind, proposal.targetId);
  const currentId = uuid.safeParse(proposal.currentVersionId);
  const proposedId = uuid.safeParse(proposal.proposedVersionId);
  if (!id || !currentId.success || !proposedId.success ||
    currentId.data.toLowerCase() === proposedId.data.toLowerCase()) return null;
  const current = { kind, id, versionId: currentId.data.toLowerCase() };
  const proposed = { kind, id, versionId: proposedId.data.toLowerCase() };
  if (!(await visibleDefinitionKeys(clerkId, [versionKey(current)])).has(versionKey(current))) return null;
  const path = await exactDirectVersionProposalPath(proposal, id, proposal.status === "APPLIED" ? proposed.versionId : current.versionId);
  if (!path) return null;
  const payloads = await visibleHistoricalPayloads(clerkId, current, proposed);
  if (!payloads) return null;
  const { fieldChanges } = computeProposalDiff(payloads.current, payloads.proposed);
  const changes = fieldChanges.flatMap(({ field, from, to, complex }) => {
    const before = safeValue.safeParse(from);
    const after = safeValue.safeParse(to);
    return before.success && after.success ? [{ field, from: before.data, to: after.data, ...(complex ? { complex } : {}) }] : [];
  });
  const projectedFields = new Set(changes.map(change => change.field));
  const otherChanges = Object.keys({ ...payloads.current, ...payloads.proposed }).some(field =>
    !projectedFields.has(field) && !deepEqual(payloads.current[field], payloads.proposed[field]));
  return { path, diff: { fieldChanges: changes, otherChanges }, sourceDigest: payloads.sourceDigest };
}

export async function readVersionProposalDetails(clerkId: string, proposal: Proposal) {
  const evidence = await verifyVersionProposalContent(clerkId, proposal);
  return evidence ? { path: evidence.path, diff: evidence.diff } : null;
}

/** A version bump preserves memberships. Require a complete scalar diff and
 * a direct occurrence that does not also serve as an inherited baseline. */
export async function verifyWritableVersionProposalContent(clerkId: string, proposal: Proposal) {
  const evidence = await verifyVersionProposalContent(clerkId, proposal);
  if (!evidence || evidence.diff.otherChanges || evidence.diff.fieldChanges.some(change => change.complex)) return null;
  // Character runtime still derives container rules and item load from the
  // definition rows, so version-only container writes may change prose.
  if (proposal.targetKind !== "PRIMITIVE" && evidence.diff.fieldChanges.some(change => !containerTextFields.has(change.field))) return null;
  if (proposal.targetKind === "PRIMITIVE") {
    const [slot] = await db.select({
      heritage: characterPrimitives.originHeritageId, capability: characterPrimitives.originCapabilityId,
      effect: characterPrimitives.originEffectId, item: characterPrimitives.originItemId,
    }).from(characterPrimitives).where(and(eq(characterPrimitives.characterId, proposal.characterId),
      eq(characterPrimitives.instanceId, evidence.path[0]!))).limit(1);
    if (!slot || Object.values(slot).some(origin => origin !== null)) return null;
  }
  return evidence;
}
