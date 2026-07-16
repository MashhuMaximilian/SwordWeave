/**
 * Phase 7.9.3c — Dump TEMPORAL + KINETIC rows for proposal design.
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
           LEFT(narrative_rule, 200) as narrative_preview,
           LEFT(mechanical_output_text, 200) as mech_preview
    FROM primitives
    WHERE category IN ('TEMPORAL_CHRONOLOGICAL', 'KINETIC_CONTROL')
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
  }>;

  let lastCat = "";
  for (const r of rows) {
    if (r.category !== lastCat) {
      console.log("\n" + "=".repeat(80));
      console.log(`CATEGORY: ${r.category}`);
      console.log("=".repeat(80));
      lastCat = r.category;
    }
    console.log(
      `[${String(r.id).padStart(3, " ")}] ${r.name.padEnd(48)} BU=${String(r.bu_cost).padStart(2, " ")} tier=${(r.cost_tier ?? "").padEnd(6)} mirror=${r.is_mirrorable}`,
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
