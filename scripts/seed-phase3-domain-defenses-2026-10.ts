import { seedSourceCondition } from "./srd-seed-identity";
/** Named incoming-damage defenses. Dry-run unless --apply. */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { forks, primitiveMarketClassifications, primitives, primitiveVersions, users } from "@/db/schema";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { resolveDamage } from "@/lib/engine/damage-resolver";
import type { HardModifier } from "@/types/swordweave";

config({ path: ".env.local", quiet: true });
type Row = typeof primitives.$inferSelect;
const types = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "radiant", "necrotic", "psychic", "force"] as const;
type Variant = { type: typeof types[number]; kind: "resistance" | "immunity"; parentId: number; cost: number; tier: number };
const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const variants: Variant[] = types.flatMap(type => [
  { type, kind: "resistance" as const, parentId: 387, cost: 8, tier: 3 },
  { type, kind: "immunity" as const, parentId: 388, cost: 20, tier: 5 },
]);
const origin = (v: Variant) => `system:v12:curated:damage-defense:${v.kind}:${v.type}`;
function candidate(parent: Row, v: Variant): Row {
  const isResistance = v.kind === "resistance";
  const modifier: HardModifier = { kind: "modify", target: "damage_modifier", operation: "multiply",
    value: { kind: "number", value: isResistance ? 0.5 : 0 }, stacking: "stack",
    metadata: { recipient: "SELF", scopeName: v.type, targetScope: { layer: "DAMAGE_TYPE", values: [v.type] } } };
  const sentence = isResistance ? `Take half ${v.type} damage, rounding the final damage up. A mirrored use takes double ${v.type} damage.`
    : `Take no ${v.type} damage. This zero multiplier cannot be mirrored into a vulnerability.`;
  return { ...parent, id: 0, name: `${title(v.type)} ${title(v.kind)}`, userId: null, isPublic: true,
    sourceOrigin: origin(v), definitionKind: "EXPRESSION", bindingSchema: {}, bindings: { damageType: v.type },
    buCost: v.cost, costTier: `Tier ${v.tier} — author price ${v.cost} BU`,
    mechanicalRule: { family: "DAMAGE_MODIFIER", target: `${v.type} damage received`, operation: "multiply",
      value: { kind: "number", value: isResistance ? 0.5 : 0 }, recipient: "SELF" },
    mechanicalTemplateText: "", mechanicalOutputText: sentence, narrativeRule: sentence + " It applies only while this primitive is active and only to the named damage type.",
    hardModifiers: [modifier], isMirrorable: isResistance, mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: isResistance ? v.cost : 0,
    mirrorEligibilityNotes: isResistance ? "Mirroring inverts the half-damage multiplier to double damage." : "Zero has no inverse, so immunity is not mirrorable.",
    contentHash: null, createdAt: new Date(), updatedAt: new Date() };
}
function verify(row: Row, v: Variant): void {
  const link = { primitive: { id: row.id, name: row.name, hardModifiers: row.hardModifiers } };
  const damage = (type: string, mirrored = false, toggledOff = false) => resolveDamage({ amount: 11, type,
    primitiveLinks: [{ ...link, isMirrored: mirrored, isToggledOff: toggledOff }] });
  const expected = v.kind === "resistance" ? 6 : 0;
  if (damage(v.type).final !== expected || damage(v.type, false, true).final !== 11 || damage(v.type === "fire" ? "cold" : "fire").final !== 11)
    throw new Error(`Named ${v.kind} failed damage resolution: ${row.name}`);
  if (v.kind === "resistance" && damage(v.type, true).final !== 22) throw new Error(`Mirror failed: ${row.name}`);
}
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  if (apply && !actor) throw new Error("Admin actor required for fork lineage");
  const parents = new Map<number, { row: Row; versionId: string }>();
  for (const id of [387, 388]) {
    const [row] = await db.select().from(primitives).where(eq(primitives.id, id)).limit(1);
    const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, id), eq(primitiveVersions.isLatest, true))).limit(1);
    if (!row || row.userId !== null || !row.isPublic || !version) throw new Error(`Invalid parent ${id}`);
    parents.set(id, { row, versionId: version.id });
  }
  for (const v of variants) {
    const parent = parents.get(v.parentId)!;
    const row = candidate(parent.row, v); verify(row, v);
    const hash = await hashPrimitiveContent(buildCanonicalPrimitivePayload(row));
    const [existing] = await db.select().from(primitives).where(seedSourceCondition(primitives.sourceOrigin, primitives.id, origin(v))).limit(1);
    if (existing) {
      const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, existing.id), eq(primitiveVersions.isLatest, true))).limit(1);
      const [edge] = await db.select().from(forks).where(and(eq(forks.sourceTargetType, "PRIMITIVE"), eq(forks.sourceTargetId, String(v.parentId)), eq(forks.forkedTargetType, "PRIMITIVE"), eq(forks.forkedTargetId, String(existing.id)))).limit(1);
      const [classification] = await db.select().from(primitiveMarketClassifications).where(eq(primitiveMarketClassifications.primitiveId, existing.id)).limit(1);
      if (existing.contentHash !== hash || !version || !edge || classification?.familyKey !== "DEFENSES") throw new Error(`Drift or metadata gap ${existing.id}`);
      console.log(`already present ${existing.id} ${existing.name}`); continue;
    }
    const [duplicate] = await db.select({ id: primitives.id }).from(primitives).where(and(eq(primitives.name, row.name), eq(primitives.isPublic, true))).limit(1);
    if (duplicate) throw new Error(`Public name already exists: ${row.name}`);
    console.log(`${apply ? "creating" : "ready"} ${row.name}`);
    if (!apply) continue;
    await db.transaction(async tx => {
      const [inserted] = await tx.insert(primitives).values({ ...row, id: undefined, contentHash: hash }).returning();
      if (!inserted) throw new Error(`Insert failed: ${row.name}`);
      const versionId = resolveContentVersionId("primitive", inserted.id, hash);
      await tx.insert(primitiveVersions).values({ id: versionId, primitiveId: inserted.id, versionNumber: 1, isLatest: true,
        deltaKind: "FULL", snapshot: JSON.parse(JSON.stringify(inserted)) as Record<string, unknown>, publishedByUserId: null });
      await tx.insert(forks).values({ forkedByUserId: actor!.id, sourceTargetType: "PRIMITIVE", sourceTargetId: String(v.parentId),
        sourceVersionId: parent.versionId, sourceAuthorId: null, forkedTargetType: "PRIMITIVE", forkedTargetId: String(inserted.id),
        forkedVersionId: versionId, metadata: { canonical: true, curatedPhase: 3, damageType: v.type, kind: v.kind } });
      await tx.insert(primitiveMarketClassifications).values({ primitiveId: inserted.id, familyKey: "DEFENSES", tier: v.tier,
        expressionKey: `${v.kind}-${v.type}`, canonicalTemplateId: parent.row.templatePrimitiveId,
        canonicalExpressionId: inserted.id, source: "INHERITED", status: "CLASSIFIED",
        evidence: { parentId: v.parentId, curatedPhase: 3, damageType: v.type } });
    });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
