/**
 * Narrow, reviewed repair for Fire Damage resistance (13643).
 * Dry-run is the default and writes an immutable local before/after plan.
 * Apply requires the saved plan AND --apply --approved-id=13643.
 * Never rewrites version snapshots, pins, ownership, visibility or BU cost.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "../src/db/client";
import { primitives, primitiveVersions } from "../src/db/schema";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "../src/lib/publishing/hash-content";
import { recordVersion } from "../src/lib/versions/auto-snapshot";
import { renderMechanicalRule, type CanonicalMechanicalRule } from "../src/lib/primitives/mechanical-rule";
import type { HardModifier } from "../src/types/swordweave";

const REPAIR_ID = 13643;
const REPAIR_KEY = "fire-resistance-grant-to-multiplier-v1";
type Row = typeof primitives.$inferSelect;
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => {
  if (item && typeof item === "object" && !Array.isArray(item)) return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
  return item;
});

function proposedChange(row: Row) {
  // This is an ID-and-exact-shape allowlist, not a title-based bulk rewrite.
  const mods = row.hardModifiers;
  const mod = mods[0];
  if (row.id !== REPAIR_ID || row.name !== "Fire Damage resistance" || mods.length !== 1 || !mod || mod.kind !== "modify" || mod.target !== "damage_type" || mod.operation !== "grant" || stable(mod.value) !== stable({ kind: "keyword", text: "resistance" }) || mod.metadata?.scopeName !== "fire" || stable(mod.metadata?.targetScope) !== stable({ layer: null, values: [] }) || mod.condition || mod.recipient || stable(row.mechanicalRule) !== stable({ value: { kind: "keyword", text: "resistance" }, family: "GENERIC", target: "Damage Type", operation: "grant", recipient: "SELF", conditionText: "" })) {
    throw new Error("Row does not match the reviewed, unconditional self fire-resistance shape. Refusing to infer intent.");
  }
  const mechanicalRule: CanonicalMechanicalRule = { family: "DAMAGE_MULTIPLIER", value: 0.5, bindings: { damage: "fire" }, recipient: "SELF", conditionText: "" };
  const hardModifiers: HardModifier[] = [{ ...mod, target: "damage_modifier", operation: "multiply", value: { kind: "number", value: 0.5 } }];
  return { mechanicalRule, hardModifiers, mechanicalOutputText: renderMechanicalRule(mechanicalRule) };
}

async function capture() {
  const [row] = await db.select().from(primitives).where(eq(primitives.id, REPAIR_ID));
  if (!row) throw new Error("Reviewed primitive is missing.");
  const versions = await db.select().from(primitiveVersions).where(eq(primitiveVersions.primitiveId, REPAIR_ID)).orderBy(primitiveVersions.versionNumber);
  const relationships: Record<string, unknown> = {};
  for (const table of ["character_primitives", "heritage_primitives", "capability_primitives", "effect_primitives", "condition_primitives", "item_primitives", "entity_primitives", "primitive_adoptions"]) {
    const result = await db.execute(sql`SELECT * FROM ${sql.identifier(table)} WHERE primitive_id=${REPAIR_ID}`);
    relationships[table] = result.rows;
  }
  relationships["publications"] = (await db.execute(sql`SELECT * FROM publications WHERE target_type='PRIMITIVE' AND target_id=${String(REPAIR_ID)}`)).rows;
  relationships["forks"] = (await db.execute(sql`SELECT * FROM forks WHERE source_version_id IN (SELECT id FROM primitive_versions WHERE primitive_id=${REPAIR_ID}) OR forked_version_id IN (SELECT id FROM primitive_versions WHERE primitive_id=${REPAIR_ID})`)).rows;
  return { row, versions, relationships };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const planArg = process.argv.find(arg => arg.startsWith("--plan="))?.slice(7);
  if (!apply) {
    const before = await withDatabaseTransaction(async tx => {
      await tx.execute(sql`SET TRANSACTION READ ONLY`);
      return capture();
    });
    if ((before.row.mechanicalRule as Record<string, unknown>)["family"] === "DAMAGE_MULTIPLIER" && before.row.hardModifiers[0]?.target === "damage_modifier") {
      console.log("Already repaired; no changes or new version needed.");
      return;
    }
    const after = proposedChange(before.row);
    mkdirSync(".migration-backup", { recursive: true });
    const path = resolve(planArg ?? `.migration-backup/mechanical-grants-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify({ repairKey: REPAIR_KEY, createdAt: new Date().toISOString(), before, after }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ mode: "dry-run", id: REPAIR_ID, name: before.row.name, costUnchanged: before.row.buCost, before: before.row.mechanicalOutputText, after: after.mechanicalOutputText, plan: path, databaseWrites: 0 }, null, 2));
    return;
  }
  if (!planArg || !process.argv.includes(`--approved-id=${REPAIR_ID}`)) throw new Error("Apply requires --plan=<reviewed dry-run file> and --approved-id=13643.");
  const plan = JSON.parse(readFileSync(resolve(planArg), "utf8")) as { repairKey: string; before: Awaited<ReturnType<typeof capture>>; after: ReturnType<typeof proposedChange> };
  if (plan.repairKey !== REPAIR_KEY || plan.before.row.id !== REPAIR_ID) throw new Error("Unrecognized repair plan.");
  const expectedAfter = proposedChange(plan.before.row);
  if (stable(expectedAfter) !== stable(plan.after)) throw new Error("Plan's proposed change was modified; generate a new dry run.");
  await withDatabaseTransaction(async tx => {
    await tx.execute(sql`SELECT id FROM primitives WHERE id=${REPAIR_ID} FOR UPDATE`);
    const current = await capture();
    if (stable({ mechanicalRule: current.row.mechanicalRule, hardModifiers: current.row.hardModifiers, mechanicalOutputText: current.row.mechanicalOutputText }) === stable(expectedAfter)) {
      console.log("Already repaired; no changes or new version needed.");
      return;
    }
    if (stable(current) !== stable(plan.before)) throw new Error("Row, versions, or relationships changed since dry run. Nothing changed; regenerate the plan.");
    const next = { ...current.row, ...expectedAfter };
    const canonical = buildCanonicalPrimitivePayload({ ...next, mirrorEligibilityNotes: next.mirrorEligibilityNotes ?? "" });
    // Legacy mirror metadata is outside this repair; preserve it exactly.
    canonical.mirrorVector = next.mirrorVector;
    canonical.mirrorBuCredit = next.mirrorBuCredit;
    const contentHash = await hashPrimitiveContent(canonical);
    await tx.update(primitives).set({ ...expectedAfter, contentHash, updatedAt: new Date() }).where(eq(primitives.id, REPAIR_ID));
    const version = await recordVersion({ entityKind: "primitive", entityId: REPAIR_ID, contentHash, snapshot: canonical as unknown as Record<string, unknown>, publishedByUserId: null });
    console.log(JSON.stringify({ mode: "applied", id: REPAIR_ID, version, previousVersionsAndPinsPreserved: true }));
  });
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => pool.end());
