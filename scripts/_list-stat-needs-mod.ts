/**
 * Phase 7.9.2 — Stat-like group worklist (filtered to NEEDS_MOD only).
 *
 * Skips:
 *   - 29 SKIP rows (VERB_TIER, DOMAIN, RANGE, DURATION, SIZING, CONDITION)
 *   - 15 DONE rows (the 13 mirrorable from 7.9.1 + the 2 chirality fixes)
 *   - Plus Vector Split (TARGETING) and Minor Die Block (DONE)
 *
 * Output: list of stat-like primitives that still need a modifier.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

const TARGETS = [
  "DEFENSIVE",
  "INTENSITY_DICE",
  "PRACTICE_PROGRESSION_AUGMENT",
  "MOBILITY_LOCOMOTION",
  "SENSORY_ARRAY",
  "PERCEPTION_QUALIFIER",
];

const ALREADY_DONE = new Set([
  18, // Vector Split
  19, // Minor Die Block
  382, 383, 384, // 3 Defensive mirrorable
  61, 62, 63, // Vitality augments
  53, 54, // Attribute/Attack increment
  201, // Vitality Shielding
  218, // Stride Extension
  161, 163, 165, // Negative Bias
]);

async function main() {
  const rows = await sql`
    SELECT id, name, category::text, cost_tier, bu_cost, mechanical_output_text, hard_modifiers
    FROM primitives
    WHERE user_id IS NULL
      AND category::text IN ('DEFENSIVE', 'INTENSITY_DICE', 'PRACTICE_PROGRESSION_AUGMENT', 'MOBILITY_LOCOMOTION', 'SENSORY_ARRAY', 'PERCEPTION_QUALIFIER')
    ORDER BY category::text, name
  `;
  console.log("STAT-LIKE NEEDS_MOD (filtered):\n");
  let count = 0;
  for (const r of rows) {
    if (ALREADY_DONE.has(Number(r["id"]))) continue;
    const mods = r["hard_modifiers"] as unknown[] | null;
    if (mods && Array.isArray(mods) && mods.length > 0) continue;
    count++;
    const tier = String(r["cost_tier"]).replace(/^Tier \d+ — /, "T");
    console.log(
      `[${String(r["id"]).padStart(3)}] ${String(r["category"]).padEnd(30)} ${tier.padEnd(30)} ${String(r["bu_cost"]).padStart(3)} BU  ${String(r["name"]).slice(0, 50)}`,
    );
    if (r["mechanical_output_text"]) {
      console.log(
        `        ${String(r["mechanical_output_text"]).replace(/\n/g, " ").slice(0, 100)}`,
      );
    }
  }
  console.log(`\nTotal: ${count}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
