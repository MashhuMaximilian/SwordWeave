/**
 * Phase 7.9.3e+f — Dump PROBABILITY_BIAS remaining + EVALUATION_STRAIN + SHEET_AUGMENT remaining.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  const rows = (await sql`
    SELECT id, name, category::text, cost_tier, bu_cost, is_mirrorable,
           LEFT(narrative_rule, 250) as narrative_preview,
           LEFT(mechanical_output_text, 250) as mech_preview,
           (hard_modifiers IS NOT NULL AND jsonb_array_length(hard_modifiers) > 0) as has_mod
    FROM primitives
    WHERE category IN ('PROBABILITY_BIAS', 'EVALUATION_STRAIN', 'SHEET_AUGMENT')
    ORDER BY category, id
  `) as Array<{
    id: number;
    name: string;
    category: string;
    cost_tier: string;
    bu_cost: number;
    is_mirrorable: boolean;
    narrative_preview: string | null;
    mech_preview: string | null;
    has_mod: boolean;
  }>;

  let lastCat = "";
  for (const r of rows) {
    if (r.category !== lastCat) {
      console.log("\n" + "=".repeat(80));
      console.log(`CATEGORY: ${r.category}`);
      console.log("=".repeat(80));
      lastCat = r.category;
    }
    const doneTag = r.has_mod ? "DONE" : "NEEDS";
    console.log(
      `[${String(r.id).padStart(3, " ")}] ${r.name.padEnd(50)} BU=${String(r.bu_cost).padStart(2, " ")} ${doneTag} mirror=${r.is_mirrorable}`,
    );
    if (r.narrative_preview) {
      console.log(`     NARRATIVE: ${r.narrative_preview.replace(/\n/g, " ")}`);
    }
    if (r.mech_preview) {
      console.log(`     MECH:      ${r.mech_preview.replace(/\n/g, " ")}`);
    }
  }
  console.log("\nTotal:", rows.length);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
