import { seedSourceCondition } from "./srd-seed-identity";
/** Curated sheet-value forks. Dry-run by default; pass --apply to publish. */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { forks, primitiveMarketClassifications, primitives, primitiveVersions, users } from "@/db/schema";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { resolveModifiers, type ResolvedPrimitiveSlot } from "@/lib/engine/resolve-modifiers";
import { walkPrimitiveContributionsForAxis } from "@/lib/engine/primitive-walk";
import type { HardModifier } from "@/types/swordweave";

config({ path: ".env.local", quiet: true });

type Row = typeof primitives.$inferSelect;
type Variant = {
  parentId: number; key: string; name: string; target: string; amount: number;
  scope?: { layer: string; values: string[] }; cost: number; tier: number;
  family: string; description: string;
};

const variants: Variant[] = [
  { parentId: 61, key: "vitality-5", name: "Vitality Core Augment +5", target: "max_vitality", amount: 5, cost: 3, tier: 2,
    family: "UNIVERSAL_MODIFIERS", description: "Increase maximum Vitality by 5 while active. A mirrored use decreases maximum Vitality by 5; current Vitality cannot exceed the resulting maximum." },
  { parentId: 61, key: "vitality-10", name: "Vitality Core Augment +10", target: "max_vitality", amount: 10, cost: 6, tier: 2,
    family: "UNIVERSAL_MODIFIERS", description: "Increase maximum Vitality by 10 while active. A mirrored use decreases maximum Vitality by 10; current Vitality cannot exceed the resulting maximum." },
  { parentId: 218, key: "walk-5", name: "Stride Extension +5", target: "speed", amount: 5, scope: { layer: "METRIC", values: ["WALKING_SPEED"] }, cost: 3, tier: 2,
    family: "MOBILITY", description: "Increase walking speed by 5 feet while active. Climbing, swimming, flying, and burrowing speeds are unchanged. A mirrored use decreases walking speed by 5 feet." },
  { parentId: 218, key: "walk-20", name: "Stride Extension +20", target: "speed", amount: 20, scope: { layer: "METRIC", values: ["WALKING_SPEED"] }, cost: 9, tier: 3,
    family: "MOBILITY", description: "Increase walking speed by 20 feet while active. Climbing, swimming, flying, and burrowing speeds are unchanged. A mirrored use decreases walking speed by 20 feet." },
  { parentId: 22701, key: "carry-20", name: "Carry Capacity Augment +20", target: "carry_capacity", amount: 20, cost: 4, tier: 2,
    family: "SHEET_AUGMENT", description: "Increase the character's Carry Capacity by 20 Load while active. This does not increase Equipped Slots. A mirrored use decreases Carry Capacity by 20." },
  { parentId: 22701, key: "carry-10", name: "Carry Capacity Augment +10", target: "carry_capacity", amount: 10, cost: 2, tier: 1,
    family: "SHEET_AUGMENT", description: "Increase the character's Carry Capacity by 10 Load while active. This does not increase Equipped Slots. A mirrored use decreases Carry Capacity by 10." },
  { parentId: 22701, key: "carry-50", name: "Carry Capacity Augment +50", target: "carry_capacity", amount: 50, cost: 8, tier: 3,
    family: "SHEET_AUGMENT", description: "Increase the character's Carry Capacity by 50 Load while active. This does not increase Equipped Slots. A mirrored use decreases Carry Capacity by 50." },
  { parentId: 22701, key: "carry-100", name: "Carry Capacity Augment +100", target: "carry_capacity", amount: 100, cost: 14, tier: 4,
    family: "SHEET_AUGMENT", description: "Increase the character's Carry Capacity by 100 Load while active. This does not increase Equipped Slots. A mirrored use decreases Carry Capacity by 100." },
  { parentId: 22702, key: "equip-1", name: "Equipment Slot Augment +1", target: "equip_slot", amount: 1, cost: 4, tier: 2,
    family: "SHEET_AUGMENT", description: "Increase the six universal Equipped Slots by 1 while active. An item still consumes its own stated slots; a two-handed weapon consumes at least 2. A mirrored use reduces the available limit by 1." },
  { parentId: 22702, key: "equip-2", name: "Equipment Slot Augment +2", target: "equip_slot", amount: 2, cost: 8, tier: 3,
    family: "SHEET_AUGMENT", description: "Increase the six universal Equipped Slots by 2 while active. An item still consumes its own stated slots; a two-handed weapon consumes at least 2. A mirrored use reduces the available limit by 2." },
];

const origin = (v: Variant) => `system:v12:curated:sheet:${v.key}`;

function candidate(parent: Row, v: Variant): Row {
  const modifier: HardModifier = { kind: "modify", target: v.target, operation: "add", value: { kind: "number", value: v.amount }, stacking: "stack",
    metadata: { recipient: "SELF", ...(v.scope ? { targetScope: v.scope } : {}) } };
  const subject = v.target === "max_vitality" ? "Max Vitality" : v.target === "speed" ? "Walking Speed"
    : v.target === "carry_capacity" ? "Carry Capacity" : "available Equipped Slots";
  return { ...parent, id: 0, name: v.name, userId: null, isPublic: true, sourceOrigin: origin(v),
    definitionKind: "EXPRESSION", templatePrimitiveId: parent.templatePrimitiveId, bindingSchema: {}, bindings: {},
    buCost: v.cost, costTier: `Tier ${v.tier} — author price ${v.cost} BU`,
    mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: subject, operation: "add", value: { kind: "number", value: v.amount }, recipient: "SELF" },
    mechanicalTemplateText: "", mechanicalOutputText: `Add ${v.amount} to ${subject}.`, narrativeRule: v.description,
    hardModifiers: [modifier], isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: v.cost,
    mirrorEligibilityNotes: "Mirroring changes add to subtract; direct acquisition uses the stated BU credit.",
    contentHash: null, createdAt: new Date(), updatedAt: new Date() };
}

function slot(row: Row, mirrored: boolean, inactive: boolean): ResolvedPrimitiveSlot {
  return { primitiveId: row.id, name: row.name, category: row.category, hardModifiers: row.hardModifiers,
    isMirrored: mirrored, isMirrorable: row.isMirrorable, mirrorVector: row.mirrorVector,
    originHeritageId: null, originCapabilityId: inactive ? "off-capability" : null, originEffectId: null, isToggledOff: inactive };
}

function verify(row: Row, v: Variant): void {
  for (const mirrored of [false, true]) {
    const expected = (mirrored ? -1 : 1) * v.amount;
    if (v.target === "max_vitality" || v.target === "speed") {
      const context = { characterId: "sheet-fork-check", level: 5, pb: 3, attributes: { physical: 2, mental: 1, magical: 0 },
        proficientAttribute: "physical" as const, chosenAttribute: "physical" as const };
      const resolve = (slots: ResolvedPrimitiveSlot[]) => resolveModifiers({ ...context, slots }).totals;
      const axis = v.target === "speed" ? "speed.walking_speed" : "max_vitality";
      const base = resolve([])[axis] ?? 0;
      if (resolve([slot(row, mirrored, false)])[axis] !== base + expected || resolve([slot(row, mirrored, true)])[axis] !== base)
        throw new Error(`Resolver mismatch for ${v.name}, mirrored=${mirrored}`);
      if (v.target === "speed" && (resolve([slot(row, mirrored, false)])["speed.swimming_speed"] ?? 0) !== (resolve([])["speed.swimming_speed"] ?? 0))
        throw new Error(`${v.name} changes swimming speed`);
    }
    const link = { primitive: { id: 1, name: row.name, hardModifiers: row.hardModifiers }, isMirrored: mirrored };
    const walked = walkPrimitiveContributionsForAxis([link], v.target, v.target === "speed" ? "walking" : null);
    if (walked.total !== expected) throw new Error(`Sheet walk mismatch for ${v.name}, mirrored=${mirrored}: ${walked.total}`);
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  if (apply && !actor) throw new Error("Admin actor required for fork lineage");
  for (const v of variants) {
    const [parent] = await db.select().from(primitives).where(eq(primitives.id, v.parentId)).limit(1);
    if (!parent || parent.userId !== null || !parent.isPublic) throw new Error(`Invalid parent ${v.parentId}`);
    const [parentVersion] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, parent.id), eq(primitiveVersions.isLatest, true))).limit(1);
    if (!parentVersion) throw new Error(`Missing parent version ${parent.id}`);
    const row = candidate(parent, v);
    verify(row, v);
    const hash = await hashPrimitiveContent(buildCanonicalPrimitivePayload(row));
    const [existing] = await db.select().from(primitives).where(seedSourceCondition(primitives.sourceOrigin, primitives.id, origin(v))).limit(1);
    if (existing) {
      if (existing.contentHash !== hash || existing.name !== v.name) throw new Error(`Drift in ${origin(v)}`);
      const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, existing.id), eq(primitiveVersions.isLatest, true))).limit(1);
      const [edge] = await db.select().from(forks).where(and(eq(forks.sourceTargetType, "PRIMITIVE"), eq(forks.sourceTargetId, String(parent.id)), eq(forks.forkedTargetType, "PRIMITIVE"), eq(forks.forkedTargetId, String(existing.id)))).limit(1);
      const [classification] = await db.select().from(primitiveMarketClassifications).where(eq(primitiveMarketClassifications.primitiveId, existing.id)).limit(1);
      if (!version || !edge || classification?.familyKey !== v.family) throw new Error(`Incomplete fork metadata for ${existing.id}`);
      console.log(`already present ${existing.id} ${v.name}`);
      continue;
    }
    const [sameName] = await db.select({ id: primitives.id }).from(primitives).where(and(eq(primitives.name, v.name), eq(primitives.isPublic, true))).limit(1);
    if (sameName) throw new Error(`Public name already exists: ${v.name}`);
    console.log(`${apply ? "creating" : "ready"} ${v.name} (${v.cost} BU, parent ${parent.id})`);
    if (!apply) continue;
    await db.transaction(async tx => {
      const [inserted] = await tx.insert(primitives).values({ ...row, id: undefined, contentHash: hash }).returning();
      if (!inserted) throw new Error(`Insert failed for ${v.name}`);
      const versionId = resolveContentVersionId("primitive", inserted.id, hash);
      await tx.insert(primitiveVersions).values({ id: versionId, primitiveId: inserted.id, versionNumber: 1,
        isLatest: true, deltaKind: "FULL", snapshot: JSON.parse(JSON.stringify(inserted)) as Record<string, unknown>, publishedByUserId: null });
      await tx.insert(forks).values({ forkedByUserId: actor!.id, sourceTargetType: "PRIMITIVE", sourceTargetId: String(parent.id),
        sourceVersionId: parentVersion.id, sourceAuthorId: null, forkedTargetType: "PRIMITIVE", forkedTargetId: String(inserted.id),
        forkedVersionId: versionId, metadata: { canonical: true, curatedPhase: 3, sheetValue: v.key } });
      await tx.insert(primitiveMarketClassifications).values({ primitiveId: inserted.id, familyKey: v.family, tier: v.tier,
        expressionKey: v.key, canonicalTemplateId: parent.templatePrimitiveId, canonicalExpressionId: inserted.id,
        source: "INHERITED", status: "CLASSIFIED", evidence: { parentId: parent.id, curatedPhase: 3 } });
    });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
