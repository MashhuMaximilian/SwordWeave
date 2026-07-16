/**
 * Phase 7.9 — Re-audit through the NEW primitive model.
 *
 * Old model (wrong): Only mirrorable primitives need modifiers.
 * New model (correct): A primitive = a thing. At most 1 modifier per
 *   primitive. A modifier-less primitive is pure flavor. Mirrorability
 *   is derived from the modifier's op (set is the only non-mirrorable).
 *
 * Classification:
 *   SKIP      — structural atom (VERB_TIER, DOMAIN, RANGE, DURATION,
 *               SIZING, CONDITION [semantic state tags]). Exists for
 *               tier/permission reference, no mechanical payload.
 *   NEEDS_MOD — has a meaningful mechanical payload, requires 1
 *               modifier authored (op + target + value + condition +
 *               stack-rule). Stored `is_mirrorable` may or may not
 *               match derived — flag drift.
 *   DONE      — already has a modifier in DB. Verify shape conforms to
 *               v1 condition system.
 *
 * Outputs:
 *   - stdout summary table by category
 *   - worklist per category with proposed classification
 *   - chirality drift report (stored vs derived is_mirrorable)
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

// Categories that are structural atoms — no modifier needed.
// Per Mashu (round 3): "Verb tiers and domains surely don't have
// modifiers and not mirrorable. The others [range, duration, sizing,
// semantic state tags] I guess so not mirrorable. They are more related
// to runtime."
const STRUCTURAL_CATEGORIES = new Set<string>([
  "VERB_TIER", // 4 rows — permission unlocks for verb use
  "DOMAIN", // 4 rows — tier access for domain use
  "RANGE", // 7 rows — distance gates
  "DURATION", // 6 rows — time gates
  "SIZING", // 4 rows — geometric shapes
  "CONDITION", // 4 rows — semantic state tags (Physical Interaction, etc.)
]);

interface PrimitiveRow {
  id: number;
  name: string;
  category: string;
  cost_tier: string;
  bu_cost: number;
  is_mirrorable: boolean;
  mirror_vector: string;
  mirror_bu_credit: number;
  mechanical_output_text: string;
  hard_modifiers: unknown;
  target_scope: unknown;
}

async function main() {
  const rows = (await sql`
    SELECT
      id, name,
      category::text as category,
      cost_tier, bu_cost,
      is_mirrorable,
      mirror_vector::text as mirror_vector,
      mirror_bu_credit,
      mechanical_output_text,
      hard_modifiers,
      target_scope
    FROM primitives
    WHERE user_id IS NULL
    ORDER BY category, name
  `) as PrimitiveRow[];

  // Classification
  let skipCount = 0;
  let doneCount = 0;
  let needsModCount = 0;
  let chiralityDrift = 0;

  const byClass = new Map<string, PrimitiveRow[]>();
  for (const r of rows) {
    const hasMod =
      Array.isArray(r.hard_modifiers) &&
      (r.hard_modifiers as unknown[]).length > 0;
    let cls: string;
    if (STRUCTURAL_CATEGORIES.has(r.category)) {
      cls = "SKIP";
      skipCount++;
    } else if (hasMod) {
      cls = "DONE";
      doneCount++;
    } else {
      cls = "NEEDS_MOD";
      needsModCount++;
    }
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls)!.push(r);
  }

  // Chirality drift: stored is_mirrorable=true but op=set (which is
  // non-mirrorable per OP_SPECS), or stored false but op !== set.
  // For DONE rows we can read the op directly.
  for (const r of byClass.get("DONE") ?? []) {
    const mods = (r.hard_modifiers as unknown[]) ?? [];
    const first = mods[0] as { operation?: string } | undefined;
    const op = first?.operation;
    const derivedMirrorable = op !== undefined && op !== "set";
    if (r.is_mirrorable !== derivedMirrorable) {
      chiralityDrift++;
    }
  }
  // For NEEDS_MOD rows that are flagged is_mirrorable=true: those
  // will be mirrorable IF the modifier they get uses a non-set op.
  // We don't have drift to detect yet (no modifier to check). But
  // the stored flag will be re-validated at write time.
  const needsModAndFlaggedMirrorable = (byClass.get("NEEDS_MOD") ?? []).filter(
    (r) => r.is_mirrorable,
  ).length;

  console.log("=".repeat(80));
  console.log(`PHASE 7.9 RE-AUDIT (new primitive model)`);
  console.log("=".repeat(80));
  console.log(`Total canonical primitives: ${rows.length}`);
  console.log(`  SKIP      (structural atom):  ${skipCount}`);
  console.log(`  DONE      (modifier exists):  ${doneCount}`);
  console.log(`  NEEDS_MOD (modifier pending): ${needsModCount}`);
  console.log(`  Chirality drift on DONE rows: ${chiralityDrift}`);
  console.log(
    `  NEEDS_MOD rows already flagged is_mirrorable=true: ${needsModAndFlaggedMirrorable}`,
  );
  console.log("");

  // Category breakdown
  console.log("BY CATEGORY:");
  console.log(
    "  Category".padEnd(30) +
      "Class".padEnd(15) +
      "Total".padStart(8) +
      "Done".padStart(7) +
      "Mirror".padStart(9),
  );
  console.log("-".repeat(80));
  const catMap = new Map<
    string,
    { total: number; done: number; mirror: number; cls: string }
  >();
  for (const r of rows) {
    const hasMod =
      Array.isArray(r.hard_modifiers) &&
      (r.hard_modifiers as unknown[]).length > 0;
    const cls = STRUCTURAL_CATEGORIES.has(r.category)
      ? "SKIP"
      : hasMod
        ? "DONE"
        : "NEEDS_MOD";
    if (!catMap.has(r.category)) {
      catMap.set(r.category, { total: 0, done: 0, mirror: 0, cls });
    }
    const c = catMap.get(r.category)!;
    c.total++;
    if (hasMod) c.done++;
    if (r.is_mirrorable) c.mirror++;
  }
  for (const [cat, c] of catMap.entries()) {
    console.log(
      `  ${cat.padEnd(30)}${c.cls.padEnd(15)}${String(c.total).padStart(8)}${String(c.done).padStart(7)}${String(c.mirror).padStart(9)}`,
    );
  }
  console.log("");

  // NEEDS_MOD worklist, grouped by category
  console.log("=".repeat(80));
  console.log(`NEEDS_MOD WORKLIST (${needsModCount} rows, grouped by category)`);
  console.log("=".repeat(80));
  const needsModByCat = new Map<string, PrimitiveRow[]>();
  for (const r of byClass.get("NEEDS_MOD") ?? []) {
    if (!needsModByCat.has(r.category)) needsModByCat.set(r.category, []);
    needsModByCat.get(r.category)!.push(r);
  }
  for (const [cat, rs] of needsModByCat.entries()) {
    console.log(`\n  --- ${cat} (${rs.length} rows) ---`);
    for (const r of rs) {
      const target = r.target_scope
        ? JSON.stringify(r.target_scope).slice(0, 50)
        : "(no target_scope)";
      const mirror = r.is_mirrorable ? "MIRR" : "    ";
      const tier = r.cost_tier.replace(/^Tier \d+ — /, "T");
      console.log(
        `    [${String(r.id).padStart(3)}] ${mirror} ${tier.padEnd(35)}${String(r.bu_cost).padStart(3)} BU  ${r.name.slice(0, 50)}`,
      );
      if (r.mechanical_output_text) {
        console.log(
          `         ${r.mechanical_output_text.replace(/\n/g, " ").slice(0, 90)}`,
        );
      }
    }
  }

  // DONE rows — show their modifier shape
  console.log("\n");
  console.log("=".repeat(80));
  console.log(`DONE ROWS (${doneCount}, show current modifier shape)`);
  console.log("=".repeat(80));
  for (const r of byClass.get("DONE") ?? []) {
    const mods = (r.hard_modifiers as unknown[]) ?? [];
    const m = mods[0] as Record<string, unknown> | undefined;
    const op = String(m?.["operation"] ?? "?");
    const target = String(m?.["target"] ?? "?");
    const value =
      m?.["value"] !== undefined ? JSON.stringify(m["value"]).slice(0, 40) : "?";
    const stacking = String(m?.["stacking"] ?? "?");
    const cond = m?.["condition"] ?? m?.["v1Condition"];
    const condStr = cond ? " +cond" : "";
    console.log(
      `  [${r.id}] ${r.name} (${r.category}, ${r.bu_cost} BU)`,
    );
    console.log(
      `       op=${op} target=${target} value=${value} stack=${stacking}${condStr}`,
    );
    const derived = op !== "set";
    const stored = r.is_mirrorable;
    if (derived !== stored) {
      console.log(
        `       ⚠ CHIRALITY DRIFT: stored is_mirrorable=${stored} but derived=${derived} (op=${op})`,
      );
    }
  }

  // SKIP rows — just count
  console.log("\n");
  console.log("=".repeat(80));
  console.log(`SKIP ROWS (${skipCount}, structural atoms, no modifier needed)`);
  console.log("=".repeat(80));
  for (const r of byClass.get("SKIP") ?? []) {
    console.log(
      `  [${String(r.id).padStart(3)}] ${r.category.padEnd(15)} ${r.name.slice(0, 60)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
