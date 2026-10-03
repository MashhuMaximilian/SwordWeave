import { seedSourceCondition } from "./srd-seed-identity";
/** Named practice, saving throw, and locomotion forks. Dry-run unless --apply. */
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
type Axis = "practice" | "save" | "speed";
type Magnitude = number | "PB";
type Variant = {
  key: string; parentId: number; axis: Axis; name: string; subject: string;
  target: string; scope: { layer: string; values: string[] };
  amount: Magnitude; cost: number; tier: number; family: string; description: string;
};

const practices = ["PROWESS", "FINESSE", "FIELDCRAFT", "AWARENESS", "REASON", "KNOWLEDGE", "INFLUENCE", "MYSTICISM", "COMMUNION", "INTUITION"] as const;
const title = (s: string) => s[0] + s.slice(1).toLowerCase();
const practiceVariants: Variant[] = practices.flatMap((practice, index) =>
  ([1, 2, 3, 5, "PB"] as const).map((amount) => ({
    key: `practice-${practice.toLowerCase()}-${amount}`, parentId: 22498 + index, axis: "practice" as const,
    name: `${title(practice)} Check +${amount}`, subject: `${title(practice)} checks`,
    target: "skill_practice_check", scope: { layer: "PRACTICE", values: [practice] },
    amount, cost: amount === "PB" ? 12 : { 1: 2, 2: 4, 3: 6, 5: 10 }[amount], tier: amount === "PB" ? 4 : amount <= 2 ? 2 : amount === 3 ? 3 : 4,
    family: "PRACTICE_PROGRESSION",
    description: amount === "PB"
      ? `While active, add one extra full Proficiency Bonus to ${title(practice)} checks. This is an additive bonus even if already proficient; it does not grant proficiency or replace the existing proficiency contribution. A mirrored use subtracts one full Proficiency Bonus.`
      : `Add ${amount} to ${title(practice)} checks while active, whether or not the character is proficient. This is a flat check bonus, not a proficiency grant or an extra Proficiency Bonus. A mirrored use subtracts ${amount}.`,
  })));

const saves = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
const saveVariants: Variant[] = saves.flatMap((save, index) =>
  ([1, 2, 3, 5, "PB"] as const).map((amount) => ({
    key: `save-${save.toLowerCase()}-${amount}`, parentId: 22495 + index, axis: "save" as const,
    name: `${title(save)} Saving Throw +${amount}`, subject: `${title(save)} saving throws`,
    target: "action_roll", scope: { layer: "METRIC", values: [`${save}_SAVE`] },
    amount, cost: amount === "PB" ? 16 : { 1: 3, 2: 6, 3: 9, 5: 15 }[amount], tier: amount === "PB" ? 5 : amount === 1 ? 2 : amount === 2 ? 3 : amount === 3 ? 4 : 5,
    family: "UNIVERSAL_MODIFIERS",
    description: amount === "PB"
      ? `While active, add one extra full Proficiency Bonus to ${title(save)} saving throws. This is additive, not a proficiency grant or replacement. Other saving throws and the one DC are unchanged. A mirrored use subtracts one full Proficiency Bonus.`
      : `Add ${amount} to ${title(save)} saving throws while active. This does not grant proficiency, affect the other two saving throws, or alter the character's one DC. A mirrored use subtracts ${amount}.`,
  })));

const movement: ReadonlyArray<{ mode: string; parentId: number; amounts: readonly number[]; costs: readonly number[]; notes: string }> = [
  { mode: "CLIMBING", parentId: 218, amounts: [5, 10, 20], costs: [3, 5, 9], notes: "This adds to the climb speed already available on the sheet; it does not grant unrestricted movement through walls." },
  { mode: "SWIMMING", parentId: 219, amounts: [5, 10, 20], costs: [3, 5, 9], notes: "This adds to swimming speed; it does not grant water breathing." },
  { mode: "FLYING", parentId: 221, amounts: [15, 30, 60], costs: [10, 15, 24], notes: "A positive flying speed permits flight at that speed. It does not grant hovering or protection from falling." },
  { mode: "BURROWING", parentId: 220, amounts: [5, 15, 30], costs: [6, 8, 15], notes: "A positive burrowing speed permits travel through soft earth or sand at that speed; solid stone and metal remain barriers." },
];
const speedVariants: Variant[] = movement.flatMap(({ mode, parentId, amounts, costs, notes }) =>
  amounts.map((amount, index) => ({
    key: `speed-${mode.toLowerCase()}-${amount}`, parentId, axis: "speed" as const,
    name: `${title(mode)} Speed +${amount}`, subject: `${title(mode)} Speed`,
    target: "speed", scope: { layer: "METRIC", values: [`${mode}_SPEED`] },
    amount, cost: costs[index]!, tier: costs[index]! <= 5 ? 2 : costs[index]! <= 10 ? 3 : costs[index]! <= 16 ? 4 : 5,
    family: "MOBILITY",
    description: `Add ${amount} feet to ${title(mode).toLowerCase()} speed while active. ${notes} Other movement speeds are unchanged. A mirrored use reduces this speed by ${amount} feet, with a zero minimum.`,
  })));

const variants = [...practiceVariants, ...saveVariants, ...speedVariants];
const origin = (v: Variant) => `system:v12:curated:core:${v.key}`;

function candidate(parent: Row, v: Variant): Row {
  const modifier: HardModifier = {
    kind: "modify", target: v.target, operation: "add", value: v.amount === "PB" ? { kind: "derived", which: "pb" } : { kind: "number", value: v.amount },
    stacking: "stack", metadata: { recipient: "SELF", targetScope: v.scope },
  };
  return {
    ...parent, id: 0, name: v.name, userId: null, isPublic: true, sourceOrigin: origin(v),
    definitionKind: "EXPRESSION", templatePrimitiveId: parent.templatePrimitiveId,
    bindingSchema: {}, bindings: v.axis === "practice" ? { practice: v.scope.values[0] } : {},
    buCost: v.cost, costTier: `Tier ${v.tier} — author price ${v.cost} BU`,
    mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: v.subject, operation: "add", value: v.amount === "PB" ? { kind: "derived", which: "pb" } : { kind: "number", value: v.amount }, recipient: "SELF" },
    mechanicalTemplateText: "", mechanicalOutputText: `Add ${v.amount === "PB" ? "one full PB" : v.amount} to ${v.subject}.`, narrativeRule: v.description,
    hardModifiers: [modifier], isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: v.cost,
    mirrorEligibilityNotes: "Mirroring changes add to subtract; direct acquisition uses the stated BU credit.",
    contentHash: null, createdAt: new Date(), updatedAt: new Date(),
  };
}

function slot(row: Row, mirrored: boolean, inactive: boolean): ResolvedPrimitiveSlot {
  return { primitiveId: row.id, name: row.name, category: row.category, hardModifiers: row.hardModifiers,
    isMirrored: mirrored, isMirrorable: row.isMirrorable, mirrorVector: row.mirrorVector,
    originHeritageId: null, originCapabilityId: inactive ? "inactive-test-capability" : null,
    originEffectId: null, isToggledOff: inactive };
}

function verify(row: Row, v: Variant): void {
  for (const pb of [3, 6]) {
  const context = { characterId: "phase3-core-check", level: pb === 3 ? 5 : 20, pb,
    attributes: { physical: 2, mental: 1, magical: 0 },
    proficientAttribute: "physical" as const, chosenAttribute: "physical" as const };
  const resolve = (slots: ResolvedPrimitiveSlot[]) => resolveModifiers({ ...context, slots }).totals;
  const before = resolve([]);
  const metric = v.scope.values[0]!.toLowerCase();
  const key = v.axis === "practice" ? `skill_practice_check.${metric}`
    : v.axis === "save" ? `${metric.replace("_save", "")}_saving_throw`
      : `speed.${metric}`;
  for (const mirrored of [false, true]) {
    const expected = (mirrored ? -1 : 1) * (v.amount === "PB" ? context.pb : v.amount);
    const active = resolve([slot(row, mirrored, false)]);
    const off = resolve([slot(row, mirrored, true)]);
    if ((active[key] ?? 0) !== (before[key] ?? 0) + expected || (off[key] ?? 0) !== (before[key] ?? 0))
      throw new Error(`Resolver mismatch ${v.name} ${key}, mirrored=${mirrored}: ${active[key]} / ${off[key]} / ${before[key]}`);
    if (v.axis === "speed") {
      const walked = walkPrimitiveContributionsForAxis([{ primitive: { id: 1, name: row.name, hardModifiers: row.hardModifiers }, isMirrored: mirrored }], "speed", metric.replace("_speed", ""));
      if (walked.total !== expected) throw new Error(`Sheet walk mismatch for ${v.name}: ${walked.total}`);
      for (const other of ["walking_speed", "climbing_speed", "swimming_speed", "flying_speed", "burrowing_speed"].filter(x => x !== metric))
        if ((active[`speed.${other}`] ?? 0) !== (before[`speed.${other}`] ?? 0)) throw new Error(`${v.name} changed ${other}`);
    }
    if (v.axis === "save" && active.save_dc !== before.save_dc) throw new Error(`${v.name} changed DC`);
  }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  if (apply && !actor) throw new Error("Admin actor required for fork lineage");
  const parents = new Map<number, { row: Row; versionId: string }>();
  for (const id of new Set(variants.map(v => v.parentId))) {
    const [row] = await db.select().from(primitives).where(eq(primitives.id, id)).limit(1);
    const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, id), eq(primitiveVersions.isLatest, true))).limit(1);
    if (!row || row.userId !== null || !row.isPublic || !version) throw new Error(`Invalid parent ${id}`);
    parents.set(id, { row, versionId: version.id });
  }
  for (const v of variants) {
    const parent = parents.get(v.parentId)!;
    const row = candidate(parent.row, v);
    verify(row, v);
    const hash = await hashPrimitiveContent(buildCanonicalPrimitivePayload(row));
    const [existing] = await db.select().from(primitives).where(seedSourceCondition(primitives.sourceOrigin, primitives.id, origin(v))).limit(1);
    if (existing) {
      const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, existing.id), eq(primitiveVersions.isLatest, true))).limit(1);
      const [edge] = await db.select().from(forks).where(and(eq(forks.sourceTargetType, "PRIMITIVE"), eq(forks.sourceTargetId, String(v.parentId)), eq(forks.forkedTargetType, "PRIMITIVE"), eq(forks.forkedTargetId, String(existing.id)))).limit(1);
      const [classification] = await db.select().from(primitiveMarketClassifications).where(eq(primitiveMarketClassifications.primitiveId, existing.id)).limit(1);
      if (existing.contentHash !== hash || !version || !edge || classification?.familyKey !== v.family) throw new Error(`Drift or missing metadata for ${existing.id} ${v.name}`);
      console.log(`already present ${existing.id} ${v.name}`);
      continue;
    }
    const [duplicate] = await db.select({ id: primitives.id }).from(primitives).where(and(eq(primitives.name, v.name), eq(primitives.isPublic, true))).limit(1);
    if (duplicate) throw new Error(`Public name already exists: ${v.name}`);
    console.log(`${apply ? "creating" : "ready"} ${v.name} (${v.cost} BU, parent ${v.parentId})`);
    if (!apply) continue;
    await db.transaction(async tx => {
      const [inserted] = await tx.insert(primitives).values({ ...row, id: undefined, contentHash: hash }).returning();
      if (!inserted) throw new Error(`Insert failed: ${v.name}`);
      const versionId = resolveContentVersionId("primitive", inserted.id, hash);
      await tx.insert(primitiveVersions).values({ id: versionId, primitiveId: inserted.id, versionNumber: 1,
        isLatest: true, deltaKind: "FULL", snapshot: JSON.parse(JSON.stringify(inserted)) as Record<string, unknown>, publishedByUserId: null });
      await tx.insert(forks).values({ forkedByUserId: actor!.id, sourceTargetType: "PRIMITIVE", sourceTargetId: String(v.parentId),
        sourceVersionId: parent.versionId, sourceAuthorId: null, forkedTargetType: "PRIMITIVE", forkedTargetId: String(inserted.id),
        forkedVersionId: versionId, metadata: { canonical: true, curatedPhase: 3, axis: v.axis, key: v.key } });
      await tx.insert(primitiveMarketClassifications).values({ primitiveId: inserted.id, familyKey: v.family, tier: v.tier,
        expressionKey: v.key, canonicalTemplateId: parent.row.templatePrimitiveId, canonicalExpressionId: inserted.id,
        source: "INHERITED", status: "CLASSIFIED", evidence: { parentId: v.parentId, curatedPhase: 3, scope: v.scope } });
    });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
