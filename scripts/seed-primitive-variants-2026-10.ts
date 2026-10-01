/** Curated phase-3 system forks. Read-only unless --apply is supplied. */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { forks, primitiveMarketClassifications, primitives, primitiveVersions, users } from "@/db/schema";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { resolveModifiers, type ResolvedPrimitiveSlot } from "@/lib/engine/resolve-modifiers";
import type { HardModifier } from "@/types/swordweave";

config({ path: ".env.local", quiet: true });

type Row = typeof primitives.$inferSelect;
type Magnitude = 2 | 3 | 5 | "PB";
type Family = "attribute" | "attack" | "dc";
type Variant = { family: Family; parentId: number; magnitude: Magnitude; name: string; target: string; scope?: { layer: string; values: string[] }; cost: number; tier: number; templateId: number | null; bindings: Record<string, unknown> };

const variants: Variant[] = [
  ...(["PHYSICAL", "MENTAL", "MAGICAL"] as const).flatMap((attribute, index) =>
    ([2, 3, 5, "PB"] as const).map((magnitude) => ({
      family: "attribute" as const, parentId: 22492 + index, magnitude,
      name: `Attribute Increment +${magnitude} ${attribute[0]}${attribute.slice(1).toLowerCase()}`,
      target: "attribute", scope: { layer: "ATTRIBUTE", values: [attribute] },
      cost: magnitude === 2 ? 16 : magnitude === 3 ? 20 : magnitude === 5 ? 28 : 16,
      tier: magnitude === 2 || magnitude === "PB" ? 4 : 5,
      templateId: 53, bindings: { attribute },
    }))),
  ...([2, 3, 5, "PB"] as const).map((magnitude) => ({
    family: "attack" as const, parentId: 54, magnitude,
    name: `Attack Bonus +${magnitude}`,
    target: "action_roll", scope: { layer: "ACTION_ROLL", values: ["ATTACK_ROLL"] },
    cost: magnitude === 2 ? 10 : magnitude === 3 ? 14 : magnitude === 5 ? 22 : 12,
    tier: magnitude === 2 ? 3 : magnitude === 5 ? 5 : 4,
    templateId: null, bindings: {},
  })),
  ...([2, 3, 5, "PB"] as const).map((magnitude) => ({
    family: "dc" as const, parentId: 22391, magnitude,
    name: `Save DC +${magnitude}`,
    target: "save_dc",
    cost: magnitude === 2 ? 8 : magnitude === 3 ? 12 : magnitude === 5 ? 20 : 12,
    tier: magnitude === 2 ? 3 : magnitude === 5 ? 5 : 4,
    templateId: null, bindings: {},
  })),
];

const sourceOrigin = (v: Variant) => `system:v12:curated:${v.family}:${v.parentId}:${String(v.magnitude).toLowerCase()}`;
const valueOf = (magnitude: Magnitude) => magnitude === "PB"
  ? { kind: "derived", which: "pb" } as const
  : { kind: "number", value: magnitude } as const;
const printable = (magnitude: Magnitude) => magnitude === "PB" ? "your full Proficiency Bonus" : String(magnitude);

function makeCandidate(parent: Row, v: Variant): Row {
  const modifier: HardModifier = {
    kind: "modify", target: v.target, operation: "add", value: valueOf(v.magnitude),
    stacking: "stack", metadata: {
      recipient: "SELF",
      ...(v.scope ? { targetScope: v.scope } : {}),
    },
  };
  const subject = v.family === "attribute" ? `${v.scope!.values[0]![0]}${v.scope!.values[0]!.slice(1).toLowerCase()}`
    : v.family === "attack" ? "Attack Rolls" : "the single Save DC";
  const mechanicalOutputText = `Add ${printable(v.magnitude)} to ${subject}.`;
  const narrativeRule = v.family === "attribute"
    ? `While active, add ${printable(v.magnitude)} to ${subject}. Checks, saving throws, and the one Attack Bonus/DC when this is the selected proficient attribute use the resulting attribute value. A mirrored use subtracts the same amount.`
    : v.family === "attack"
      ? `While active, add ${printable(v.magnitude)} to the character's Attack Rolls only. Other action rolls and saving throws are unchanged. A mirrored use subtracts the same amount.`
      : `While active, add ${printable(v.magnitude)} to the character's one DC. It applies both when attacked and when another creature saves against the character's effects. It does not change the three saving throw bonuses. A mirrored use subtracts the same amount.`;
  return {
    ...parent, id: 0, name: v.name, userId: null, isPublic: true,
    sourceOrigin: sourceOrigin(v), definitionKind: "EXPRESSION", templatePrimitiveId: v.templateId,
    bindingSchema: {}, bindings: v.bindings,
    buCost: v.cost, costTier: `Tier ${v.tier} — author price ${v.cost} BU`,
    mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: subject, operation: "add", value: valueOf(v.magnitude), recipient: "SELF" },
    mechanicalTemplateText: "", mechanicalOutputText, narrativeRule,
    hardModifiers: [modifier], isMirrorable: true, mirrorVector: "VARIABLE_VECTOR",
    mirrorBuCredit: v.cost, mirrorEligibilityNotes: "Mirroring changes add to subtract; direct acquisition uses the stated BU credit.",
    contentHash: null, createdAt: new Date(), updatedAt: new Date(),
  };
}

function slot(row: Row, mirrored = false, off = false): ResolvedPrimitiveSlot {
  return { primitiveId: row.id, name: row.name, category: row.category, hardModifiers: row.hardModifiers,
    isMirrored: mirrored, isMirrorable: row.isMirrorable, mirrorVector: row.mirrorVector,
    originHeritageId: null, originCapabilityId: off ? "test-capability" : null,
    originEffectId: null, isToggledOff: off };
}

function checkResolver(row: Row, v: Variant): void {
  for (const pb of [3, 6]) {
    const attributes = { physical: 4, mental: 3, magical: 2 };
    const chosenAttribute = v.family === "attribute" ? v.scope!.values[0]!.toLowerCase() as "physical" | "mental" | "magical" : "physical" as const;
    const base = { characterId: "curated-fork-check", level: pb === 3 ? 5 : 20, pb,
      attributes, proficientAttribute: chosenAttribute, chosenAttribute };
    const get = (slots: ResolvedPrimitiveSlot[]) => resolveModifiers({ ...base, slots }).totals;
    const before = get([]), normal = get([slot(row)]), mirrored = get([slot(row, true)]), off = get([slot(row, false, true)]);
    const amount = v.magnitude === "PB" ? pb : v.magnitude;
    const key = v.family === "attribute" ? `attribute.${chosenAttribute}` : v.family === "attack" ? "attack_bonus" : "save_dc";
    if (normal[key] !== before[key]! + amount || mirrored[key] !== before[key]! - amount || off[key] !== before[key]) {
      throw new Error(`Resolver mismatch for ${v.name} on ${key} at PB ${pb}`);
    }
    if (v.family === "attribute") {
      for (const derived of ["attack_bonus", "save_dc", `${chosenAttribute}_saving_throw`]) {
        if (normal[derived] !== before[derived]! + amount || mirrored[derived] !== before[derived]! - amount || off[derived] !== before[derived]) {
          throw new Error(`Derived mismatch for ${v.name} on ${derived} at PB ${pb}`);
        }
      }
    }
    if (v.family === "attack" && normal.save_dc !== before.save_dc) throw new Error(`${v.name} changes DC`);
    if (v.family === "dc" && normal.attack_bonus !== before.attack_bonus) throw new Error(`${v.name} changes Attack Bonus`);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const parents = new Map<number, Row>();
  for (const parentId of [...new Set(variants.map(v => v.parentId))]) {
    const [parent] = await db.select().from(primitives).where(eq(primitives.id, parentId));
    if (!parent || parent.userId !== null || !parent.isPublic) throw new Error(`Invalid parent ${parentId}`);
    const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, parentId), eq(primitiveVersions.isLatest, true))).limit(1);
    if (!version) throw new Error(`Missing latest version for parent ${parentId}`);
    parents.set(parentId, parent);
  }
  const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  if (apply && !actor) throw new Error("Admin actor required for system fork lineage");
  for (const v of variants) {
    const parent = parents.get(v.parentId)!;
    const candidate = makeCandidate(parent, v);
    checkResolver(candidate, v);
    const hash = await hashPrimitiveContent(buildCanonicalPrimitivePayload(candidate));
    const [existing] = await db.select().from(primitives).where(eq(primitives.sourceOrigin, sourceOrigin(v))).limit(1);
    if (existing) {
      if (existing.contentHash !== hash || existing.name !== v.name) throw new Error(`Drift in ${sourceOrigin(v)}`);
      const [version] = await db.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, existing.id), eq(primitiveVersions.isLatest, true))).limit(1);
      const [edge] = await db.select().from(forks).where(and(eq(forks.sourceTargetType, "PRIMITIVE"), eq(forks.sourceTargetId, String(v.parentId)), eq(forks.forkedTargetType, "PRIMITIVE"), eq(forks.forkedTargetId, String(existing.id)))).limit(1);
      if (!version || !edge) throw new Error(`Incomplete version or fork lineage for ${existing.id}`);
      console.log(`already present ${existing.id} ${v.name}`);
      continue;
    }
    const duplicates = await db.select({ id: primitives.id }).from(primitives).where(and(eq(primitives.name, v.name), eq(primitives.isPublic, true))).limit(1);
    if (duplicates.length) throw new Error(`Public name already exists: ${v.name}`);
    console.log(`${apply ? "creating" : "ready"} ${v.name} (${v.cost} BU, parent ${v.parentId})`);
    if (!apply) continue;
    await db.transaction(async tx => {
      const [inserted] = await tx.insert(primitives).values({ ...candidate, id: undefined, contentHash: hash }).returning();
      if (!inserted) throw new Error(`Insert failed: ${v.name}`);
      const versionId = resolveContentVersionId("primitive", inserted.id, hash);
      await tx.insert(primitiveVersions).values({ id: versionId, primitiveId: inserted.id, versionNumber: 1,
        isLatest: true, deltaKind: "FULL", snapshot: JSON.parse(JSON.stringify(inserted)) as Record<string, unknown>, publishedByUserId: null });
      const [parentVersion] = await tx.select().from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, v.parentId), eq(primitiveVersions.isLatest, true))).limit(1);
      if (!parentVersion) throw new Error(`Parent version disappeared: ${v.parentId}`);
      await tx.insert(forks).values({ forkedByUserId: actor!.id, sourceTargetType: "PRIMITIVE", sourceTargetId: String(v.parentId),
        sourceVersionId: parentVersion.id, sourceAuthorId: null, forkedTargetType: "PRIMITIVE", forkedTargetId: String(inserted.id),
        forkedVersionId: versionId, metadata: { canonical: true, curatedPhase: 3, magnitude: v.magnitude } });
      await tx.insert(primitiveMarketClassifications).values({ primitiveId: inserted.id, familyKey: "PRACTICE_PROGRESSION",
        tier: v.tier, expressionKey: `${v.family}-${String(v.magnitude).toLowerCase()}-${v.scope?.values[0]?.toLowerCase() ?? "all"}`,
        canonicalTemplateId: v.templateId, canonicalExpressionId: inserted.id, source: "INHERITED", status: "CLASSIFIED",
        evidence: { parentId: v.parentId, curatedPhase: 3, scope: v.scope ?? null } });
    });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
