import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { primitiveMarketClassifications, primitives, primitiveVersions, publications } from "@/db/schema";
import { directPrimitivePinCondition } from "@/lib/character/direct-primitive-pin";
import { familyForCategory } from "@/lib/primitives/canonical-market";
import { parseAuthorableCompositionRule, renderMechanicalRule } from "@/lib/primitives/mechanical-rule";
import { savePrimitiveMarketClassification } from "@/lib/primitives/save-market-classification";
import { buildCanonicalPrimitivePayload, canonicalJsonStringify, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { authoredPrimitiveFields } from "./draft";

const starterFamilies = new Map<string, string>([
  ["VERB_TIER", "VERB_ACCESS"], ["DOMAIN", "DOMAIN_ACCESS"], ["RANGE", "RANGE"], ["INTENSITY_DICE", "DICE"],
]);

export class CharacterPrimitiveConflictError extends Error {
  constructor() {
    super("A primitive with this name already exists in your library. Reuse it or choose another name.");
  }
}

export function primitiveSnapshotDigest(snapshot: unknown) {
  return createHash("sha256").update(canonicalJsonStringify(snapshot)).digest("hex");
}

export function prepareCharacterPrimitive(fields: unknown, clerkId: string) {
  const input = authoredPrimitiveFields.safeParse(fields);
  if (!input.success) return null;
  const { name, category, costTier, buCost, narrativeRule, isMirrorable, mirrorVector, mirrorBuCredit, mechanicalRule } = input.data;
  const family = familyForCategory(category);
  const expectedRule = starterFamilies.get(category);
  const rule = mechanicalRule ? parseAuthorableCompositionRule(mechanicalRule) : { family: "DESCRIPTIVE" as const };
  const tier = Number(costTier.match(/Tier\s+(\d+)/i)?.[1] ?? 0);
  if (!name || !costTier || !family || !rule || tier > 2147483647 || isMirrorable || (mirrorBuCredit ?? 0) > 0 ||
      (mirrorVector && mirrorVector !== "STANDARD_ONLY") || (expectedRule ?? "DESCRIPTIVE") !== rule.family) return null;

  const snapshot = buildCanonicalPrimitivePayload({ name, category, costTier, buCost, narrativeRule: narrativeRule.trim(),
    mechanicalOutputText: renderMechanicalRule(rule), mechanicalRule: rule, isPublic: false, isMirrorable: false,
    mirrorVector: "STANDARD_ONLY", mirrorBuCredit: 0, mirrorEligibilityNotes: "", hardModifiers: [],
  });
  const sourceOrigin = `user:${clerkId}`;
  return { category, familyKey: family.key, rule, snapshot, snapshotDigest: primitiveSnapshotDigest(snapshot), sourceOrigin };
}

type PrimitiveForkSource = {
  id: number;
  versionId: string;
  snapshot: Record<string, unknown>;
};
type PrimitiveFork = { id: number; versionId: string; name: string; snapshotDigest: string };
export type PreparedCharacterPrimitive = NonNullable<ReturnType<typeof prepareCharacterPrimitive>> & { fork?: PrimitiveFork };
export type PrivatePrimitiveReceipt = { entityKind: "primitive"; entityId: string; versionPin: string };

const primitiveForkChanges = authoredPrimitiveFields.partial();

export const authoredPrimitiveMatchesLive = sql`(
  ${primitives.definitionKind} = 'EXPRESSION'
  AND ${primitives.bindingSchema} = '{}'::jsonb
  AND ${primitives.bindings} = COALESCE(${primitiveVersions.snapshot}#>'{mechanicalRule,bindings}', '{}'::jsonb)
  AND ${primitives.mechanicalTemplateText} = ''
  AND ${primitives.targetScope} IS NULL
  AND ${primitiveVersions.snapshot}->>'costTier' = ${primitives.costTier}
  AND ${primitiveVersions.snapshot}->>'narrativeRule' = ${primitives.narrativeRule}
  AND ${primitives.mirrorEligibilityNotes} = ''
  AND ${primitives.tags} = ARRAY[]::text[]
  AND ${primitives.iconSource} IS NULL AND ${primitives.iconKey} IS NULL AND ${primitives.iconUrl} IS NULL
  AND ${primitives.iconColor} = '#ffffff'
)`;

// The website recognizes the native prefix and source ID. A private namespace
// keeps another player's private fork from disclosing itself via a collision.
function privateForkOrigin(sourceId: number, clerkId: string) {
  return `fork:${sourceId}:${createHash("sha256").update(clerkId).digest("hex")}`;
}

function storedPrimitiveSnapshot({ snapshot, fork }: PreparedCharacterPrimitive) {
  return fork ? { ...snapshot, sourceId: String(fork.id), sourceVersionId: fork.versionId, sourceSnapshotDigest: fork.snapshotDigest } : snapshot;
}

/** A sparse fork patch is applied to an immutable canonical source, then validated as native authoring. */
export function prepareCharacterPrimitiveFork(source: PrimitiveForkSource, changes: unknown, clerkId: string):
  { recipe: PreparedCharacterPrimitive } | { error: "UNSUPPORTED_FORK_SOURCE" | "INVALID_FORK_CHANGES" | "UNCHANGED_FORK" } {
  const { snapshot } = source;
  const mechanicalRule = snapshot["mechanicalRule"];
  const fields = {
    name: snapshot["name"], category: snapshot["category"], costTier: snapshot["costTier"],
    buCost: snapshot["buCost"], narrativeRule: snapshot["narrativeRule"],
    ...((mechanicalRule && canonicalJsonStringify(mechanicalRule) !== '{"family":"DESCRIPTIVE"}') ? { mechanicalRule } : {}),
  };
  const base = prepareCharacterPrimitive(fields, clerkId);
  const { sourceId: _sourceId, sourceVersionId: _versionId, sourceSnapshotDigest: _digest, ...canonicalSource } = snapshot;
  if (!base || typeof canonicalSource["isPublic"] !== "boolean" ||
      canonicalJsonStringify({ ...base.snapshot, isPublic: canonicalSource["isPublic"] }) !== canonicalJsonStringify(canonicalSource)) {
    return { error: "UNSUPPORTED_FORK_SOURCE" };
  }
  const patch = primitiveForkChanges.safeParse(changes ?? {});
  const next = patch.success ? prepareCharacterPrimitive({ ...fields, ...patch.data }, clerkId) : null;
  if (!next) return { error: "INVALID_FORK_CHANGES" };
  if (next.snapshotDigest === base.snapshotDigest) return { error: "UNCHANGED_FORK" };
  const recipe = { ...next, sourceOrigin: privateForkOrigin(source.id, clerkId),
    fork: { id: source.id, versionId: source.versionId, name: base.snapshot.name, snapshotDigest: primitiveSnapshotDigest(snapshot) } };
  return { recipe: { ...recipe, snapshotDigest: primitiveSnapshotDigest(storedPrimitiveSnapshot(recipe)) } };
}

function matchesReviewedOrigin(approved: PreparedCharacterPrimitive, clerkId: string) {
  return approved.sourceOrigin === (approved.fork ? privateForkOrigin(approved.fork.id, clerkId) : `user:${clerkId}`);
}

/** Joins the approved creation step's transaction, including its market and version rows. */
export async function savePrivateCharacterPrimitive(approved: PreparedCharacterPrimitive, clerkId: string): Promise<PrivatePrimitiveReceipt> {
  const { snapshot, sourceOrigin, category, familyKey, rule } = approved;
  if (!matchesReviewedOrigin(approved, clerkId)) throw new Error("Primitive provenance does not match the reviewed recipe.");
  const contentHash = await hashPrimitiveContent(snapshot);
  const [created] = await db.insert(primitives).values({
    name: snapshot.name, category, userId: clerkId, sourceOrigin, isPublic: false, costTier: snapshot.costTier, buCost: snapshot.buCost,
    mechanicalOutputText: snapshot.mechanicalOutputText, mechanicalRule: { ...rule }, bindings: rule.bindings ?? {},
    narrativeRule: snapshot.narrativeRule, isMirrorable: false, mirrorVector: "STANDARD_ONLY", mirrorBuCredit: 0, contentHash,
  }).onConflictDoNothing({ target: [primitives.name, primitives.sourceOrigin] }).returning({ id: primitives.id });
  if (!created) throw new CharacterPrimitiveConflictError();

  await savePrimitiveMarketClassification(created.id, familyKey, snapshot.costTier, "companion");
  const { versionId } = await recordVersion({ entityKind: "primitive", entityId: created.id, contentHash,
    snapshot: { ...storedPrimitiveSnapshot(approved) }, publishedByUserId: clerkId });
  return { entityKind: "primitive", entityId: String(created.id), versionPin: versionId };
}

/** Recheck the committed result's ownership and exact authored version before placing it on the sheet. */
export async function currentPrivateCharacterPrimitive(approved: PreparedCharacterPrimitive, clerkId: string, id: number, versionId: string) {
  if (!matchesReviewedOrigin(approved, clerkId)) return null;
  const contentHash = await hashPrimitiveContent(approved.snapshot);
  if (resolveContentVersionId("primitive", id, contentHash) !== versionId) return null;
  const rows = await db.select({ id: primitives.id, versionId: primitiveVersions.id, snapshot: primitiveVersions.snapshot })
    .from(primitives).innerJoin(primitiveVersions, eq(primitiveVersions.primitiveId, primitives.id))
    .innerJoin(primitiveMarketClassifications, eq(primitiveMarketClassifications.primitiveId, primitives.id)).where(and(
      eq(primitives.id, id), eq(primitiveVersions.id, versionId), eq(primitives.userId, clerkId), eq(primitives.isPublic, false),
      eq(primitives.sourceOrigin, approved.sourceOrigin), eq(primitives.contentHash, contentHash), directPrimitivePinCondition, authoredPrimitiveMatchesLive,
      eq(primitiveMarketClassifications.familyKey, approved.familyKey),
      sql`NOT EXISTS (SELECT 1 FROM ${publications} WHERE ${publications.targetType} = 'PRIMITIVE'
        AND ${publications.targetId} = ${String(id)} AND ${publications.unpublishedAt} IS NULL
        AND ${publications.visibility} IN ('PUBLIC', 'FOLLOWERS_ONLY'))`,
    )).limit(2);
  const [row] = rows;
  if (rows.length !== 1 || !row || primitiveSnapshotDigest(row.snapshot) !== approved.snapshotDigest) return null;
  return { id: row.id, versionId: row.versionId };
}
