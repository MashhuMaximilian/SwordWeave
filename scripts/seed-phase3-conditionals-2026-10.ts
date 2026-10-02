/** Reviewed conditional numeric forks. Dry-run unless --apply. */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { forks, primitiveMarketClassifications, primitives, primitiveVersions, users } from "@/db/schema";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { resolveModifiers, type ResolvedPrimitiveSlot } from "@/lib/engine/resolve-modifiers";
import { walkPrimitiveContributionsForAxis } from "@/lib/engine/primitive-walk";
import type { ConditionContext } from "@/lib/engine/condition-evaluator";
import type { HardModifier } from "@/types/swordweave";

config({ path: ".env.local", quiet: true });
type Row = typeof primitives.$inferSelect;
type Axis = "attribute" | "practice" | "attack" | "dc" | "save";
type Variant = {
  key: string; parentId: number; name: string; axis: Axis; target: string;
  scope?: { layer: string; values: string[] }; amount: number; cost: number; tier: number;
  conditionToken: string; conditionLabel: string; family: string;
};
const belowHalf = "self:stat|vitality_pct|<|0.5";
const tracking = "self:is_tracking";
const variants: Variant[] = [
  ...(["PHYSICAL", "MENTAL", "MAGICAL"] as const).flatMap((attribute, index) =>
    ([1, 2] as const).filter(amount => !(attribute === "PHYSICAL" && amount === 2)).map(amount => ({
      key: `attribute-${attribute.toLowerCase()}-${amount}-low-vitality`, parentId: 22492 + index,
      name: `Attribute Increment +${amount} ${attribute[0]}${attribute.slice(1).toLowerCase()} below half Vitality`,
      axis: "attribute" as const, target: "attribute", scope: { layer: "ATTRIBUTE", values: [attribute] },
      amount, cost: amount === 1 ? 8 : 12, tier: amount === 1 ? 3 : 4,
      conditionToken: belowHalf, conditionLabel: "while current Vitality is below half its maximum", family: "PRACTICE_PROGRESSION",
    }))),
  ...(["PROWESS", "FIELDCRAFT", "AWARENESS", "REASON", "INFLUENCE"] as const).map((practice) => ({
    key: `practice-${practice.toLowerCase()}-2-low-vitality`, parentId: 22498 + ["PROWESS", "FINESSE", "FIELDCRAFT", "AWARENESS", "REASON", "KNOWLEDGE", "INFLUENCE", "MYSTICISM", "COMMUNION", "INTUITION"].indexOf(practice),
    name: `${practice[0]}${practice.slice(1).toLowerCase()} Check +2 below half Vitality`,
    axis: "practice" as const, target: "skill_practice_check", scope: { layer: "PRACTICE", values: [practice] },
    amount: 2, cost: 3, tier: 2, conditionToken: belowHalf,
    conditionLabel: "while current Vitality is below half its maximum", family: "PRACTICE_PROGRESSION",
  })),
  ...([1, 2] as const).map(amount => ({
    key: `practice-awareness-${amount}-tracking`, parentId: 22501,
    name: `Awareness Check +${amount} while tracking`, axis: "practice" as const,
    target: "skill_practice_check", scope: { layer: "PRACTICE", values: ["AWARENESS"] },
    amount, cost: amount === 1 ? 1 : 3, tier: amount === 1 ? 1 : 2,
    conditionToken: tracking, conditionLabel: "while the character's tracking state is active on the sheet",
    family: "PRACTICE_PROGRESSION",
  })),
  { key: "attack-2-low-vitality", parentId: 54, name: "Attack Bonus +2 below half Vitality", axis: "attack", target: "action_roll",
    scope: { layer: "METRIC", values: ["ATTACK_ROLL"] }, amount: 2, cost: 7, tier: 3,
    conditionToken: belowHalf, conditionLabel: "while current Vitality is below half its maximum", family: "UNIVERSAL_MODIFIERS" },
  { key: "dc-2-low-vitality", parentId: 22391, name: "Save DC +2 below half Vitality", axis: "dc", target: "save_dc",
    amount: 2, cost: 6, tier: 3, conditionToken: belowHalf,
    conditionLabel: "while current Vitality is below half its maximum", family: "UNIVERSAL_MODIFIERS" },
  { key: "save-physical-2-low-vitality", parentId: 22495, name: "Physical Saving Throw +2 below half Vitality", axis: "save", target: "action_roll",
    scope: { layer: "METRIC", values: ["PHYSICAL_SAVE"] }, amount: 2, cost: 4, tier: 2,
    conditionToken: belowHalf, conditionLabel: "while current Vitality is below half its maximum", family: "UNIVERSAL_MODIFIERS" },
];
const origin = (v: Variant) => `system:v12:curated:conditional:${v.key}`;

function subject(v: Variant): string {
  const scoped = v.scope?.values[0]?.toLowerCase();
  if (v.axis === "attribute") return `${scoped} attribute`;
  if (v.axis === "practice") return `${scoped} checks`;
  if (v.axis === "save") return `${scoped?.replace("_save", "")} saving throws`;
  return v.axis === "attack" ? "attack rolls" : "the one Save DC";
}
function candidate(parent: Row, v: Variant): Row {
  const condition = { kind: "compound" as const, tokens: [v.conditionToken] };
  const modifier: HardModifier = { kind: "modify", target: v.target, operation: "add",
    value: { kind: "number", value: v.amount }, stacking: "stack", condition,
    metadata: { recipient: "SELF", ...(v.scope ? { targetScope: v.scope } : {}) } };
  const explanation = v.axis === "attribute" ? "The resulting attribute also affects its checks and saving throw, and the one Attack Bonus/DC when selected for those calculations."
    : v.axis === "practice" ? "This is a flat check bonus, not a proficiency grant."
      : v.axis === "save" ? "This does not grant proficiency or alter the one DC."
        : v.axis === "attack" ? "Other action rolls and the one DC are unchanged." : "The three saving throw bonuses are unchanged.";
  return { ...parent, id: 0, name: v.name, userId: null, isPublic: true, sourceOrigin: origin(v),
    definitionKind: "EXPRESSION", bindingSchema: {}, bindings: v.axis === "practice" ? { practice: v.scope?.values[0] } : {},
    buCost: v.cost, costTier: `Tier ${v.tier} — author price ${v.cost} BU`,
    mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: subject(v), operation: "add", value: { kind: "number", value: v.amount }, recipient: "SELF", condition },
    mechanicalTemplateText: "", mechanicalOutputText: `Add ${v.amount} to ${subject(v)} ${v.conditionLabel}.`,
    narrativeRule: `Add ${v.amount} to ${subject(v)} ${v.conditionLabel}. ${explanation} When the condition ends, the bonus ends. A mirrored use subtracts ${v.amount} under the same condition.`,
    hardModifiers: [modifier], isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: v.cost,
    mirrorEligibilityNotes: "Mirroring changes add to subtract; direct acquisition uses the stated BU credit.",
    contentHash: null, createdAt: new Date(), updatedAt: new Date() };
}
function slot(row: Row, mirrored = false, inactive = false): ResolvedPrimitiveSlot {
  return { primitiveId: row.id, name: row.name, category: row.category, hardModifiers: row.hardModifiers,
    isMirrored: mirrored, isMirrorable: row.isMirrorable, mirrorVector: row.mirrorVector,
    originHeritageId: null, originCapabilityId: inactive ? "off-test-capability" : null,
    originEffectId: null, isToggledOff: inactive };
}
function conditionContext(vitality: number, isTracking: boolean): ConditionContext {
  return { character: { vitality, vitalityMax: 100, saveDc: 10, blockValue: 0,
    attributes: { physical: 2, mental: 1, magical: 0 },
    practices: { prowess: 0, finesse: 0, fieldcraft: 0, awareness: 0, reason: 0, knowledge: 0, influence: 0, mysticism: 0, communion: 0, intuition: 0 },
    proficiencies: new Set(), flags: isTracking ? new Set(["is_tracking"]) : new Set(), custom: {} } };
}
function verify(row: Row, v: Variant): void {
  const key = v.axis === "attribute" ? `attribute.${v.scope!.values[0]!.toLowerCase()}`
    : v.axis === "practice" ? `skill_practice_check.${v.scope!.values[0]!.toLowerCase()}`
      : v.axis === "save" ? "physical_saving_throw" : v.axis === "attack" ? "attack_bonus" : "save_dc";
  const get = (slots: ResolvedPrimitiveSlot[], ctx: ConditionContext) => resolveModifiers({
    characterId: "conditional-fork-check", level: 5, pb: 3,
    attributes: { physical: 2, mental: 1, magical: 0 }, proficientAttribute: "physical", chosenAttribute: "physical",
    conditionContext: ctx, slots }).totals;
  const on = conditionContext(40, true), off = v.conditionToken === tracking ? conditionContext(40, false) : conditionContext(60, true);
  for (const mirrored of [false, true]) {
    const expected = (mirrored ? -1 : 1) * v.amount;
    const base = get([], on), active = get([slot(row, mirrored)], on), disabled = get([slot(row, mirrored)], off), toggled = get([slot(row, mirrored, true)], on);
    if ((active[key] ?? 0) !== (base[key] ?? 0) + expected || (disabled[key] ?? 0) !== (get([], off)[key] ?? 0) || (toggled[key] ?? 0) !== (base[key] ?? 0))
      throw new Error(`Conditional resolver mismatch ${v.name}, mirrored=${mirrored}: ${active[key]} ${disabled[key]} ${toggled[key]}`);
    if (v.axis === "attribute") {
      const selected = v.scope!.values[0]!.toLowerCase();
      const chosenBase = { characterId: "conditional-derived", level: 5, pb: 3, attributes: { physical: 2, mental: 1, magical: 0 },
        proficientAttribute: selected as "physical"|"mental"|"magical", chosenAttribute: selected as "physical"|"mental"|"magical", conditionContext: on };
      const before = resolveModifiers({ ...chosenBase, slots: [] }).totals;
      const after = resolveModifiers({ ...chosenBase, slots: [slot(row, mirrored)] }).totals;
      for (const derived of ["attack_bonus", "save_dc", `${selected}_saving_throw`])
        if ((after[derived] ?? 0) !== (before[derived] ?? 0) + expected) throw new Error(`${v.name} failed derived ${derived}`);
    }
    if (v.axis === "practice") {
      const walked = walkPrimitiveContributionsForAxis([{ primitive: { id: 1, name: row.name, hardModifiers: row.hardModifiers }, isMirrored: mirrored }],
        "skill_practice_check", v.scope!.values[0]!.toLowerCase(), on);
      if (walked.total !== expected) throw new Error(`${v.name} failed practice sheet walk`);
    }
  }
}
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  if (apply && !actor) throw new Error("Admin actor required for fork lineage");
  for (const v of variants) {
    const [parent] = await db.select().from(primitives).where(eq(primitives.id, v.parentId)).limit(1);
    const [parentVersion] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, v.parentId), eq(primitiveVersions.isLatest, true))).limit(1);
    if (!parent || parent.userId !== null || !parent.isPublic || !parentVersion) throw new Error(`Invalid parent ${v.parentId}`);
    const row = candidate(parent, v); verify(row, v);
    const hash = await hashPrimitiveContent(buildCanonicalPrimitivePayload(row));
    const [existing] = await db.select().from(primitives).where(eq(primitives.sourceOrigin, origin(v))).limit(1);
    if (existing) {
      const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, existing.id), eq(primitiveVersions.isLatest, true))).limit(1);
      const [edge] = await db.select().from(forks).where(and(eq(forks.sourceTargetType, "PRIMITIVE"), eq(forks.sourceTargetId, String(v.parentId)), eq(forks.forkedTargetType, "PRIMITIVE"), eq(forks.forkedTargetId, String(existing.id)))).limit(1);
      const [classification] = await db.select().from(primitiveMarketClassifications).where(eq(primitiveMarketClassifications.primitiveId, existing.id)).limit(1);
      if (existing.contentHash !== hash || !version || !edge || classification?.familyKey !== v.family) throw new Error(`Drift or metadata gap for ${existing.id}`);
      console.log(`already present ${existing.id} ${v.name}`); continue;
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
        sourceVersionId: parentVersion.id, sourceAuthorId: null, forkedTargetType: "PRIMITIVE", forkedTargetId: String(inserted.id),
        forkedVersionId: versionId, metadata: { canonical: true, curatedPhase: 3, conditional: v.key } });
      await tx.insert(primitiveMarketClassifications).values({ primitiveId: inserted.id, familyKey: v.family, tier: v.tier,
        expressionKey: v.key, canonicalTemplateId: parent.templatePrimitiveId, canonicalExpressionId: inserted.id,
        source: "INHERITED", status: "CLASSIFIED", evidence: { parentId: v.parentId, curatedPhase: 3, condition: v.conditionToken } });
    });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
