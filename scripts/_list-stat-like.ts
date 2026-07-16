/**
 * Quick list of the 27 stat-like NEEDS_MOD rows.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

const STRUCTURAL = new Set([
  "VERB_TIER", "DOMAIN", "RANGE", "DURATION", "SIZING", "CONDITION",
]);

const TARGETS = [
  "DEFENSIVE",
  "INTENSITY_DICE",
  "PRACTICE_PROGRESSION_AUGMENT",
  "MOBILITY_LOCOMOTION",
  "SENSORY_ARRAY",
  "PERCEPTION_QUALIFIER",
];

async function main() {
  const rows = await sql`
    SELECT id, name, category::text, cost_tier, bu_cost, mechanical_output_text
    FROM primitives
    WHERE user_id IS NULL
      AND category::text IN ('DEFENSIVE', 'INTENSITY_DICE', 'PRACTICE_PROGRESSION_AUGMENT', 'MOBILITY_LOCOMOTION', 'SENSORY_ARRAY', 'PERCEPTION_QUALIFIER')
    ORDER BY category::text, name
  `;
  for (const r of rows) {
    const mods = r["hard_modifiers"] as unknown[] | null;
    if (STRUCTURAL.has(String(r["category"]))) continue;
    if (mods && Array.isArray(mods) && mods.length > 0) continue; // skip DONE
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
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
