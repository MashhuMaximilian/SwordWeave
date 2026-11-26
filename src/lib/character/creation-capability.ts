import { createHash } from "node:crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { capabilities, capabilityEffects, capabilityPrimitiveRoleEnum, capabilityPrimitives, capabilityVersions, primitives, primitiveVersions, publications } from "@/db/schema";
import { buildAssemblyAndComputeBU, parsePrimitiveSlots } from "@/lib/api/capability-helpers";
import { directPrimitivePinCondition } from "@/lib/character/direct-primitive-pin";
import { authoredCapabilityFields } from "@/lib/mcp/draft";
import { buildCanonicalCapabilityPayload, canonicalJsonStringify, hashCapabilityContent } from "@/lib/publishing/hash-content";
import { visibilityCondition } from "@/lib/publishing/library-query";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import { resolveContentVersionId } from "@/lib/versions/content-hash";

export const maxCreationCapabilityMembers = 24;
const primitiveId = z.number().int().positive().max(2147483647);
const memberSchema = z.strictObject({
  primitiveId,
  role: z.enum(capabilityPrimitiveRoleEnum.enumValues),
  quantity: z.number().int().positive(),
  slotLabel: z.string().nullish(),
  notes: z.string().nullish(),
  isMirrored: z.literal(false).optional(),
  targetWho: z.literal("self").optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  versionId: z.uuid().optional(),
});
const membersSchema = z.object({
  primitiveSlots: z.array(memberSchema).min(1).max(maxCreationCapabilityMembers),
  dependencyPins: z.array(z.strictObject({
    kind: z.literal("primitive"), id: primitiveId, versionId: z.uuid(), data: memberSchema,
  })).min(1).max(maxCreationCapabilityMembers),
});
const unsupportedReferenceFields = [
  "primitiveIds", "primitiveLinks", "effectIds", "effectSlots", "effectLinks", "capabilityIds", "capabilitySlots",
  "capabilityLinks", "itemIds", "itemSlots", "itemLinks", "heritageIds", "heritageSlots", "heritageLinks",
] as const;
const forkSourceFields = new Set<string>([
  "name", "type", "sourceType", "verboseDescription", "isPublic", "metadata", "membershipOrder",
  "primitiveSlots", "dependencyPins", "tags", "iconSource", "iconKey", "iconUrl", "iconColor",
  "sourceId", "sourceVersionId", "sourceSnapshotDigest", "sourceMembersDigest", ...unsupportedReferenceFields,
]);

type Member = z.infer<typeof memberSchema>;
function memberDetails(member: Member) {
  return {
    primitiveId: member.primitiveId, role: member.role, quantity: member.quantity,
    slotLabel: member.slotLabel ?? "", notes: member.notes ?? "", targetWho: member.targetWho ?? "self",
  };
}

function digest(value: unknown) {
  return createHash("sha256").update(canonicalJsonStringify(value)).digest("hex");
}

export async function loadCreationCapabilityPrimitives(clerkId: string, ids: readonly number[]) {
  const rows = await db.select({
    id: primitives.id, name: primitives.name, category: primitives.category, buCost: primitives.buCost,
    isMirrorable: primitives.isMirrorable, mirrorBuCredit: primitives.mirrorBuCredit, hardModifiers: primitives.hardModifiers,
    userId: primitives.userId, sourceOrigin: primitives.sourceOrigin, versionId: primitiveVersions.id, snapshot: primitiveVersions.snapshot,
  }).from(primitives).innerJoin(primitiveVersions, eq(primitiveVersions.primitiveId, primitives.id)).where(and(
    inArray(primitives.id, ids), gte(primitives.buCost, 0), directPrimitivePinCondition,
    visibilityCondition("PRIMITIVE", sql`${primitives.id}`, sql`${primitives.userId}`, clerkId, sql`${primitives.isPublic}`),
  ));
  return new Map(rows.map(({ snapshot, ...child }) => [child.id, { ...child, freeFoundation: false, snapshotDigest: digest(snapshot) }]));
}

/** Both the proposal and catalogue use the same exact, visible and reproducible capability slice. */
export async function loadCreationCapabilities(clerkId: string, ids: readonly string[]) {
  if (!ids.length) return [];
  const rows = await db.select({
    id: capabilities.id, name: capabilities.name, type: capabilities.type, sourceType: capabilities.sourceType,
    verboseDescription: capabilities.verboseDescription, membershipOrder: capabilities.membershipOrder, metadata: capabilities.metadata,
    plainAppearance: sql<boolean>`cardinality(${capabilities.tags}) = 0 AND ${capabilities.iconKey} IS NULL
      AND ${capabilities.iconSource} IS NULL AND ${capabilities.iconUrl} IS NULL AND ${capabilities.iconColor} = '#ffffff'`,
    versionId: capabilityVersions.id, snapshot: capabilityVersions.snapshot,
  }).from(capabilities).innerJoin(capabilityVersions, eq(capabilityVersions.capabilityId, capabilities.id)).where(and(
    inArray(capabilities.id, ids),
    visibilityCondition("CAPABILITY", sql`${capabilities.id}`, sql`${capabilities.userId}`, clerkId, sql`${capabilities.isPublic}`),
    eq(capabilityVersions.isLatest, true), eq(capabilityVersions.deltaKind, "FULL"),
    sql`(SELECT count(*) FROM capability_versions other WHERE other.capability_id = ${capabilities.id} AND other.is_latest) = 1`,
    sql`NOT EXISTS (SELECT 1 FROM ${capabilityEffects} WHERE ${capabilityEffects.capabilityId} = ${capabilities.id})`,
    sql`(SELECT count(*) FROM ${capabilityPrimitives} WHERE ${capabilityPrimitives.capabilityId} = ${capabilities.id}) BETWEEN 1 AND ${maxCreationCapabilityMembers}`,
  ));
  const candidates = rows.flatMap(({ snapshot, metadata, membershipOrder, ...root }) => {
    // The native composer recomputes these fields and omits them from canonical versions.
    const { totalBu: _totalBu, compiledAt: _compiledAt, ...authoredMetadata } = metadata;
    if (snapshot["name"] !== root.name || snapshot["type"] !== root.type || snapshot["sourceType"] !== root.sourceType ||
      snapshot["verboseDescription"] !== root.verboseDescription ||
      canonicalJsonStringify(snapshot["metadata"] ?? {}) !== canonicalJsonStringify(authoredMetadata) ||
      canonicalJsonStringify(snapshot["membershipOrder"] ?? []) !== canonicalJsonStringify(membershipOrder ?? []) ||
      unsupportedReferenceFields.some(field => snapshot[field] !== undefined && (!Array.isArray(snapshot[field]) || snapshot[field].length > 0))) return [];
    const parsed = membersSchema.safeParse(snapshot);
    if (!parsed.success) return [];
    const { primitiveSlots, dependencyPins } = parsed.data;
    const slotById = new Map(primitiveSlots.map(slot => [slot.primitiveId, slot]));
    if (slotById.size !== primitiveSlots.length || slotById.size !== dependencyPins.length ||
      new Set(dependencyPins.map(pin => pin.id)).size !== dependencyPins.length) return [];
    const memberKeys = new Set(dependencyPins.map(pin => `primitive:${pin.id}:${pin.data.role}`));
    if (membershipOrder?.some(key => !memberKeys.has(key)) ||
      (membershipOrder && new Set(membershipOrder).size !== membershipOrder.length)) return [];
    for (const pin of dependencyPins) {
      const slot = slotById.get(pin.id);
      if (!slot || pin.data.primitiveId !== pin.id ||
        (slot.versionId && slot.versionId !== pin.versionId) || (pin.data.versionId && pin.data.versionId !== pin.versionId) ||
        canonicalJsonStringify(memberDetails(slot)) !== canonicalJsonStringify(memberDetails(pin.data)) ||
        slot.sortOrder !== pin.data.sortOrder) return [];
    }
    const order = new Map((membershipOrder ?? []).map((key, index) => [key, index]));
    const pins = [...dependencyPins].sort((left, right) =>
      (order.get(`primitive:${left.id}:${left.data.role}`) ?? left.data.sortOrder ?? Infinity) -
      (order.get(`primitive:${right.id}:${right.data.role}`) ?? right.data.sortOrder ?? Infinity));
    const fields = { name: root.name, type: root.type, sourceType: root.sourceType, verboseDescription: root.verboseDescription };
    // Forking copies authored fields. Reuse can also admit roots whose additional
    // display fields the starter cannot reproduce in a new private definition.
    const plainSource = root.plainAppearance && Object.keys(authoredMetadata).length === 0 &&
      (snapshot["tags"] === undefined || (Array.isArray(snapshot["tags"]) && !snapshot["tags"].length)) &&
      snapshot["iconSource"] == null && snapshot["iconKey"] == null && snapshot["iconUrl"] == null &&
      (snapshot["iconColor"] ?? "#ffffff") === "#ffffff" &&
      Object.keys(snapshot).every(key => forkSourceFields.has(key)) &&
      (pins.length === 1 || membershipOrder?.length === pins.length ||
        (!membershipOrder?.length && pins.every(pin => pin.data.sortOrder !== undefined) && new Set(pins.map(pin => pin.data.sortOrder)).size === pins.length)) &&
      fields.name === fields.name.trim() && fields.verboseDescription === fields.verboseDescription.trim();
    return [{ id: root.id, name: root.name, versionId: root.versionId, snapshotDigest: digest(snapshot), pins,
      forkFields: plainSource ? fields : null }];
  });
  if (!candidates.length) return [];

  const memberIds = [...new Set(candidates.flatMap(root => root.pins.map(pin => pin.id)))];
  const [liveMembers, childrenById] = await Promise.all([
    db.select({
      capabilityId: capabilityPrimitives.capabilityId,
      primitiveId: capabilityPrimitives.primitiveId, role: capabilityPrimitives.role, quantity: capabilityPrimitives.quantity,
      slotLabel: capabilityPrimitives.slotLabel, notes: capabilityPrimitives.notes, isMirrored: capabilityPrimitives.isMirrored,
      targetWho: capabilityPrimitives.targetWho, sortOrder: capabilityPrimitives.sortOrder,
    }).from(capabilityPrimitives).where(inArray(capabilityPrimitives.capabilityId, candidates.map(root => root.id))),
    loadCreationCapabilityPrimitives(clerkId, memberIds),
  ]);
  return candidates.flatMap(({ pins, ...root }) => {
    const live = liveMembers.filter(member => member.capabilityId === root.id).map(({ capabilityId: _rootId, ...member }) => member);
    if (live.length !== pins.length) return [];
    const members = [];
    for (const pin of pins) {
      const child = childrenById.get(pin.id);
      const member = memberSchema.safeParse(live.find(row => row.primitiveId === pin.id));
      if (!child || child.versionId !== pin.versionId || !member.success ||
        canonicalJsonStringify(memberDetails(member.data)) !== canonicalJsonStringify(memberDetails(pin.data)) ||
        (pin.data.sortOrder !== undefined && member.data.sortOrder !== pin.data.sortOrder)) return [];
      const { primitiveId: id, ...placement } = memberDetails(pin.data);
      members.push({ id, primitive: child, ...placement });
    }
    return [{ ...root, members }];
  });
}

export type CreationCapability = Awaited<ReturnType<typeof loadCreationCapabilities>>[number];

type ExistingMember = Pick<CreationCapability["members"][number], "primitive" | "role" | "quantity">;
type NewMember = Omit<ExistingMember, "primitive"> & {
  primitive: Omit<ExistingMember["primitive"], "versionId"> & { versionId: string | null };
  authoredPieceKey?: string;
  slotLabel?: string;
  notes?: string;
};

type CapabilityFork = { id: string; versionId: string; name: string; snapshotDigest: string; membersDigest: string };

function capabilityOrigin(clerkId: string, fork?: CapabilityFork) {
  return fork ? `fork:${fork.id}:${createHash("sha256").update(clerkId).digest("hex")}` : `user:${clerkId}`;
}

export class CharacterCapabilityConflictError extends Error {
  constructor() {
    super("A capability with this name already exists in your library. Reuse it or choose another name.");
  }
}

export function preparePrivateCreationCapability(fields: unknown, members: readonly NewMember[], clerkId: string, fork?: CapabilityFork) {
  const parsed = authoredCapabilityFields.safeParse(fields);
  if (!parsed.success || !parsed.data.name || !members.length || members.length > maxCreationCapabilityMembers) return null;
  const ids = new Set<number>();
  const singletonRoles = new Set<string>();
  for (const { primitive, role } of members) {
    if (ids.has(primitive.id) || primitive.buCost < 0) return null;
    ids.add(primitive.id);
    if (role === "RANGE" || role === "SIZING" || role === "DURATION" || role === "OUTPUT") {
      if (singletonRoles.has(role)) return null;
      singletonRoles.add(role);
    }
  }
  // Draft-only children have temporary negative IDs. Validate native slot fields
  // against the parser, then use the reviewed identities for costing and ordering.
  const slots = parsePrimitiveSlots(members.map(({ role, quantity, slotLabel, notes }, index) => ({ primitiveId: index + 1, role, quantity, slotLabel, notes })))
    .map((slot, index) => ({ ...slot, primitiveId: members[index]!.primitive.id }));
  const description = parsed.data.verboseDescription.trim();
  const { name, type, sourceType } = parsed.data;
  const { totalBu } = buildAssemblyAndComputeBU(slots, new Map(members.map(({ primitive }) => [String(primitive.id),
    { ...primitive, id: String(primitive.id) }])), { id: "draft", name, type, sourceType, description });
  if (!Number.isSafeInteger(totalBu) || totalBu < 0) return null;
  const membershipOrder = slots.map(slot => `primitive:${slot.primitiveId}:${slot.role}`);
  const canonical = buildCanonicalCapabilityPayload({
    name, type, sourceType, verboseDescription: description, membershipOrder, isPublic: false, tags: [],
    primitiveSlots: slots.map(slot => ({ ...slot, slotLabel: slot.slotLabel ?? "", notes: slot.notes ?? "" })), effectIds: [],
  });
  const slotsById = new Map(canonical.primitiveSlots.map(slot => [slot.primitiveId, slot]));
  // The content hash follows the website format. The approved version snapshot
  // also freezes the exact child version and the reviewed membership order.
  const snapshot = { ...canonical, ...(fork ? { sourceId: fork.id, sourceVersionId: fork.versionId,
    sourceSnapshotDigest: fork.snapshotDigest, sourceMembersDigest: fork.membersDigest } : {}),
    dependencyPins: members.map(({ primitive }) => ({
    kind: "primitive" as const, id: primitive.id, versionId: primitive.versionId,
    data: { ...slotsById.get(primitive.id)!, versionId: primitive.versionId },
  })) };
  return { name, type, sourceType, description, totalBu, slots, canonical, snapshot, snapshotDigest: digest(snapshot),
    membershipOrder, sourceOrigin: capabilityOrigin(clerkId, fork), ...(fork ? { fork } : {}),
    members: members.map(member => ({ ...member, id: member.primitive.id, slotLabel: member.slotLabel ?? "", notes: member.notes ?? "", targetWho: "self" as const })),
  };
}

export type PreparedCreationCapability = NonNullable<ReturnType<typeof preparePrivateCreationCapability>>;

export function prepareCreationCapabilityFork(source: CreationCapability, changes: unknown, replacement: NewMember[] | undefined, clerkId: string) {
  if (!source.forkFields) return { error: "UNSUPPORTED_FORK_SOURCE" } as const;
  const patch = authoredCapabilityFields.partial().safeParse(changes ?? {});
  if (!patch.success) return { error: "INVALID_FORK_CHANGES" } as const;
  const base = preparePrivateCreationCapability(source.forkFields, source.members, clerkId);
  const fork = { id: source.id, versionId: source.versionId, name: source.name, snapshotDigest: source.snapshotDigest,
    membersDigest: digest(source.members.map(member => [member.id, member.primitive.versionId, member.primitive.snapshotDigest])) };
  const recipe = preparePrivateCreationCapability({ ...source.forkFields, ...patch.data }, replacement ?? source.members, clerkId, fork);
  if (!base || !recipe) return { error: "INVALID_FORK_CHANGES" } as const;
  if (digest([recipe.canonical, recipe.snapshot.dependencyPins]) === digest([base.canonical, base.snapshot.dependencyPins])) return { error: "UNCHANGED_FORK" } as const;
  return { recipe } as const;
}

export function bindCreationCapabilityMembers(
  recipe: PreparedCreationCapability,
  clerkId: string,
  pins: ReadonlyMap<string, { kind: string; id: number | string; versionId: string }>,
) {
  if (recipe.members.every(member => !member.authoredPieceKey)) return recipe;
  const members: NewMember[] = [];
  for (const { authoredPieceKey, primitive, role, quantity, slotLabel, notes } of recipe.members) {
    const pin = authoredPieceKey ? pins.get(authoredPieceKey) : primitive;
    if (!pin?.versionId || typeof pin.id !== "number" || pin.id <= 0 || ("kind" in pin && pin.kind !== "primitive")) return null;
    members.push({ primitive: { ...primitive, id: pin.id, versionId: pin.versionId }, role, quantity, slotLabel, notes });
  }
  const bound = preparePrivateCreationCapability({ name: recipe.name, type: recipe.type, sourceType: recipe.sourceType,
    verboseDescription: recipe.description }, members, clerkId, recipe.fork);
  return bound?.totalBu === recipe.totalBu ? bound : null;
}

/** Runs inside the approved operation transaction so the root, links and version commit with its receipt. */
export async function savePrivateCreationCapability(recipe: PreparedCreationCapability, clerkId: string) {
  if (recipe.sourceOrigin !== capabilityOrigin(clerkId, recipe.fork)) throw new Error("Capability author does not match the reviewed actor.");
  if (recipe.members.some(member => member.id <= 0 || !member.primitive.versionId)) {
    throw new Error("Capability members must have committed version pins before saving.");
  }
  const contentHash = await hashCapabilityContent(recipe.canonical);
  const [created] = await db.insert(capabilities).values({
    name: recipe.name, type: recipe.type, sourceType: recipe.sourceType, verboseDescription: recipe.description,
    membershipOrder: recipe.membershipOrder, userId: clerkId, sourceOrigin: recipe.sourceOrigin,
    isPublic: false, contentHash, metadata: { totalBu: recipe.totalBu, compiledAt: new Date().toISOString() },
  }).onConflictDoNothing({ target: [capabilities.name, capabilities.sourceOrigin] }).returning({ id: capabilities.id });
  if (!created) throw new CharacterCapabilityConflictError();
  await db.insert(capabilityPrimitives).values(recipe.slots.map(slot => ({ ...slot, capabilityId: created.id })));
  const { versionId } = await recordVersion({ entityKind: "capability", entityId: created.id, contentHash, snapshot: recipe.snapshot, publishedByUserId: clerkId });
  return { entityKind: "capability" as const, entityId: created.id, versionPin: versionId };
}

export async function currentPrivateCreationCapability(recipe: PreparedCreationCapability, clerkId: string, id: string, versionId: string) {
  const contentHash = await hashCapabilityContent(recipe.canonical);
  if (recipe.sourceOrigin !== capabilityOrigin(clerkId, recipe.fork) || resolveContentVersionId("capability", id, contentHash) !== versionId) return null;
  const [owned] = await db.select({ id: capabilities.id }).from(capabilities).where(and(
    eq(capabilities.id, id), eq(capabilities.userId, clerkId), eq(capabilities.sourceOrigin, recipe.sourceOrigin),
    eq(capabilities.isPublic, false), eq(capabilities.contentHash, contentHash),
    sql`NOT EXISTS (SELECT 1 FROM ${publications} WHERE ${publications.targetType} = 'CAPABILITY'
      AND ${publications.targetId} = ${id} AND ${publications.unpublishedAt} IS NULL
      AND ${publications.visibility} IN ('PUBLIC', 'FOLLOWERS_ONLY'))`,
  )).limit(1);
  if (!owned) return null;
  const [current] = await loadCreationCapabilities(clerkId, [id]);
  return current?.forkFields && current.versionId === versionId && current.snapshotDigest === recipe.snapshotDigest ? { id, versionId } : null;
}
