/**
 * Find the 3 remaining NEEDS_MOD rows.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  const rows = (await sql`
    SELECT id, name, category::text, bu_cost
    FROM primitives
    WHERE user_id IS NULL
      AND category NOT IN ('VERB_TIER', 'DOMAIN', 'RANGE', 'DURATION', 'SIZING', 'CONDITION')
      AND (hard_modifiers IS NULL OR jsonb_array_length(hard_modifiers) = 0)
    ORDER BY id
  `) as Array<{ id: number; name: string; category: string; bu_cost: number }>;
  for (const r of rows) {
    console.log(`[${r.id}] ${r.name} (${r.category}) BU=${r.bu_cost}`);
  }
  console.log("Total:", rows.length);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
