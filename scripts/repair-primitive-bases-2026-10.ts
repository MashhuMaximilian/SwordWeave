/**
 * Versioned repair of system primitive bases found by the October library audit.
 * Dry-run by default; pass --apply to write the checked versions.
 */
import { config } from "dotenv";
import { and, desc, eq, isNull } from "drizzle-orm";
import { primitives, primitiveVersions } from "@/db/schema";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
import { resolveModifiers, type ResolvedPrimitiveSlot } from "@/lib/engine/resolve-modifiers";
import type { HardModifier } from "@/types/swordweave";
import { isDeepStrictEqual } from "node:util";

config({ path: ".env.local", quiet: true });

type PrimitiveRow = typeof primitives.$inferSelect;
type Patch = Partial<Pick<PrimitiveRow,
  "hardModifiers" | "mechanicalRule" | "mechanicalOutputText" | "narrativeRule" |
  "isMirrorable" | "mirrorVector" | "mirrorBuCredit"
>>;

const numeric = (target: string, value: number, scope?: string): HardModifier => ({
  kind: "modify", target, operation: "add", value: { kind: "number", value }, stacking: "stack",
  metadata: scope ? { recipient: "SELF", targetScope: { layer: "ACTION_ROLL", values: [scope] } } : { recipient: "SELF" },
});

const practiceNames = ["PROWESS", "FINESSE", "FIELDCRAFT", "AWARENESS", "REASON", "KNOWLEDGE", "INFLUENCE", "MYSTICISM", "COMMUNION", "INTUITION"];

const repairs: ReadonlyArray<{ id: number; priorVersion: number; patch: Patch }> = [
  {
    id: 54, priorVersion: 5,
    patch: {
      mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: "Attack Roll", operation: "add", value: 1, recipient: "SELF" },
      mechanicalOutputText: "Add +1 to Attack Rolls.",
      narrativeRule: "Add 1 to the character's Attack Rolls while this primitive is active. It does not affect other action rolls. A fork can restrict the source or add an authored condition.",
      hardModifiers: [numeric("action_roll", 1, "ATTACK_ROLL")],
    },
  },
  {
    id: 65, priorVersion: 5,
    patch: {
      mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: "Attack Roll", operation: "add", value: 1, recipient: "SELF" },
      mechanicalOutputText: "Add +1 to Attack Rolls.",
      narrativeRule: "Add 1 to the character's Attack Rolls while this primitive is active; other action rolls are unaffected. This currently overlaps Attack Bonus Increment; choose one as the starter-library parent before expanding either family.",
      hardModifiers: [numeric("action_roll", 1, "ATTACK_ROLL")],
      isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: 4,
    },
  },
  {
    id: 22391, priorVersion: 4,
    patch: {
      mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: "Save DC", operation: "add", value: 1, recipient: "SELF" },
      mechanicalOutputText: "Add +1 to Save DC.",
      narrativeRule: "Increase the character's single Save DC by 1 while this primitive is active. This does not change Physical, Mental, or Magical saving throws.",
      hardModifiers: [numeric("save_dc", 1)],
      isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: 4,
    },
  },
  {
    id: 218, priorVersion: 3,
    patch: {
      mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: "Walking Speed", operation: "add", value: 10, recipient: "SELF" },
      mechanicalOutputText: "Add +10 ft to Walking Speed.",
      narrativeRule: "Increase your walking speed by 10 ft while this primitive is active. It does not change swimming, climbing, flying, or burrowing speed.",
      hardModifiers: [{ kind: "modify", target: "speed", operation: "add", value: { kind: "number", value: 10 }, stacking: "stack", metadata: { recipient: "SELF", targetScope: { layer: "METRIC", values: ["WALKING_SPEED"] } } }],
    },
  },
  {
    id: 22393, priorVersion: 2,
    patch: {
      mechanicalRule: { family: "UNIVERSAL_MODIFIER", target: "Practice Check", operation: "add", value: { kind: "derived", which: "pb_half" }, recipient: "SELF", conditionText: "when not proficient in that Practice" },
      mechanicalOutputText: "Add half PB, rounded up, to each Practice check in which you are not proficient.",
      narrativeRule: "For each Practice you are not proficient in, add half your Proficiency Bonus, rounded up, to its checks. A proficient Practice receives no bonus from this primitive.",
      hardModifiers: [{ kind: "modify", target: "skill_practice_check", operation: "add", value: { kind: "derived", which: "pb_half" }, stacking: "stack", metadata: { recipient: "SELF", targetScope: { layer: "PRACTICE", values: practiceNames } }, condition: { kind: "tags", customTags: ["actor:not_proficient"] } }],
      isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: 8,
    },
  },
  ...(["PHYSICAL", "MENTAL", "MAGICAL"] as const).map((_, index) => ({
    id: 22492 + index, priorVersion: 4,
    patch: {
      isMirrorable: true, mirrorVector: "VARIABLE_VECTOR", mirrorBuCredit: 12,
    } satisfies Patch,
  })),
  ...(["PHYSICAL", "MENTAL", "MAGICAL"] as const).map((attribute, index) => ({
    id: 22495 + index, priorVersion: 4,
    patch: {
      hardModifiers: [{
        kind: "modify", target: "attribute", operation: "grant",
        value: { kind: "keyword", text: "proficiency" }, stacking: "highest-only",
        metadata: { recipient: "SELF", targetScope: { layer: "ATTRIBUTE", values: [attribute] } },
        condition: { kind: "tags", customTags: [`actor:not_proficient_in_attribute(${attribute.toLowerCase()})`] },
      }],
      narrativeRule: `Gain proficiency on ${attribute[0]}${attribute.slice(1).toLowerCase()} saving throws. Add your full Proficiency Bonus only when that save is not already proficient. Repeated grants do not add it again.`,
    } satisfies Patch,
  })),
];

function testSlot(row: PrimitiveRow, mirrored = false): ResolvedPrimitiveSlot {
  return { primitiveId: row.id, name: row.name, category: row.category,
    hardModifiers: row.hardModifiers, isMirrored: mirrored,
    isMirrorable: row.isMirrorable, mirrorVector: row.mirrorVector,
    originHeritageId: null, originCapabilityId: null, originEffectId: null };
}

function checkCandidate(row: PrimitiveRow): void {
  const attributes = { physical: 4, mental: 3, magical: 2 };
  const base = {
    characterId: "library-audit", level: 5, pb: 3,
    proficientAttribute: "magical" as const, attributes,
    conditionContext: { character: {
      vitality: 20, vitalityMax: 20, saveDc: 13, blockValue: 0, attributes,
      practices: {} as never, proficiencies: new Set(["magical", "prowess"]),
      flags: new Set<string>(), custom: {},
    } },
  };
  const total = (mirrored = false) => resolveModifiers({ ...base, slots: [testSlot(row, mirrored)] }).totals;
  const expected = new Map<number, [string, number, number?]>([
    [54, ["attack_bonus", 6, 4]], [65, ["attack_bonus", 6, 4]],
    [22391, ["save_dc", 14, 12]], [22393, ["skill_practice_check.awareness", 2, -2]],
    [218, ["speed.walking_speed", 10, -10]],
    [22492, ["attribute.physical", 5, 3]], [22493, ["attribute.mental", 4, 2]],
    [22494, ["attribute.magical", 3, 1]],
    [22495, ["physical_saving_throw", 7]], [22496, ["mental_saving_throw", 6]],
    [22497, ["magical_saving_throw", 5]],
  ]);
  const assertion = expected.get(row.id);
  if (!assertion) throw new Error(`No expected result for ${row.id}`);
  const [key, normal, mirrored] = assertion;
  if (total()[key] !== normal || (mirrored !== undefined && total(true)[key] !== mirrored)) {
    throw new Error(`Resolver mismatch for ${row.id} ${row.name}: ${key}, normal=${total()[key]}, mirrored=${total(true)[key]}`);
  }
  const baseline = resolveModifiers({ ...base, slots: [] }).totals[key] ?? 0;
  const inhibited = resolveModifiers({ ...base, slots: [{ ...testSlot(row), originCapabilityId: "audit-capability", isToggledOff: true }] }).totals[key] ?? 0;
  if (inhibited !== baseline) throw new Error(`Inactive compiled primitive still changes ${key} for ${row.id}`);
  if (row.id === 22393 && (total()["skill_practice_check.prowess"] ?? 0) !== 0) {
    throw new Error("Broad Familiarity applies to a proficient Practice");
  }
}

async function main(): Promise<void> {
  const { db } = await import("@/db/client");
  const apply = process.argv.includes("--apply");
  const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
  const selectedIds = idsArg
    ? new Set(idsArg.slice("--ids=".length).split(",").map(Number))
    : null;
  for (const repair of repairs.filter((candidate) => !selectedIds || selectedIds.has(candidate.id))) {
    const [row] = await db.select().from(primitives).where(eq(primitives.id, repair.id));
    if (!row || row.userId !== null) throw new Error(`Missing or user-owned primitive ${repair.id}`);
    const [latest] = await db.select({ versionNumber: primitiveVersions.versionNumber })
      .from(primitiveVersions).where(and(eq(primitiveVersions.primitiveId, row.id), eq(primitiveVersions.isLatest, true)))
      .orderBy(desc(primitiveVersions.versionNumber)).limit(1);
    const candidate = { ...row, ...repair.patch } as PrimitiveRow;
    checkCandidate(candidate);
    const payload = buildCanonicalPrimitivePayload({ ...candidate, hardModifiers: candidate.hardModifiers });
    const hash = await hashPrimitiveContent(payload);
    if (latest?.versionNumber === repair.priorVersion + 1) {
      if (row.contentHash !== hash || Object.entries(repair.patch).some(([key, value]) =>
        !isDeepStrictEqual(row[key as keyof PrimitiveRow], value))) {
        throw new Error(`Unexpected content at repaired version ${row.id}`);
      }
      console.log(`already repaired ${row.id} ${row.name} v${latest.versionNumber}`);
      continue;
    }
    if (latest?.versionNumber !== repair.priorVersion) throw new Error(`Version drift on ${row.id}: expected v${repair.priorVersion}, found v${latest?.versionNumber}`);
    console.log(`${apply ? "repairing" : "ready"} ${row.id} ${row.name} v${repair.priorVersion + 1}`);
    if (!apply) continue;
    const versionId = resolveContentVersionId("primitive", row.id, hash);
    await db.transaction(async (tx) => {
      const hashMatch = row.contentHash === null
        ? isNull(primitives.contentHash)
        : eq(primitives.contentHash, row.contentHash);
      const [updated] = await tx.update(primitives)
        .set({ ...repair.patch, contentHash: hash, updatedAt: new Date() })
        .where(and(eq(primitives.id, row.id), hashMatch))
        .returning();
      if (!updated) throw new Error(`Concurrent edit on ${row.id}`);
      await tx.update(primitiveVersions).set({ isLatest: false, supersededAt: new Date() })
        .where(and(eq(primitiveVersions.primitiveId, row.id), eq(primitiveVersions.isLatest, true)));
      await tx.insert(primitiveVersions).values({ id: versionId, primitiveId: row.id,
        versionNumber: repair.priorVersion + 1, isLatest: true, deltaKind: "FULL",
        snapshot: JSON.parse(JSON.stringify(updated)) as Record<string, unknown>, publishedByUserId: null });
    });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
