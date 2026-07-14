/**
 * Survey existing DB primitives by category. Helps us understand:
 *  - Which SHEET_AUGMENT rows exist in DB (with their names)
 *  - Which Probability Bias rows exist (if any)
 *  - Whether the DB has all the same categories as the seed file
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");

const sql = neon(url);

async function main() {
  const rows = await sql`
    SELECT category::text as category, COUNT(*) as count
    FROM primitives WHERE user_id IS NULL
    GROUP BY category ORDER BY count DESC
  `;
  console.log("DB primitives by category (user_id IS NULL):");
  for (const r of rows) {
    console.log(`  ${String(r["category"]).padEnd(28)} ${r["count"]}`);
  }

  // Specifically list the SHEET_AUGMENT and PROBABILITY_BIAS rows
  console.log("");
  console.log("SHEET_AUGMENT rows in DB:");
  const saRows = await sql`
    SELECT name, bu_cost FROM primitives
    WHERE user_id IS NULL AND category::text = 'SHEET_AUGMENT'
    ORDER BY name
  `;
  for (const r of saRows) console.log(`  ${r["name"]} (${r["bu_cost"]} BU)`);

  console.log("");
  console.log("PROBABILITY_BIAS rows in DB:");
  const pbRows = await sql`
    SELECT name, bu_cost FROM primitives
    WHERE user_id IS NULL AND category::text = 'PROBABILITY_BIAS'
    ORDER BY name
  `;
  if (pbRows.length === 0) {
    console.log("  (none)");
  } else {
    for (const r of pbRows) console.log(`  ${r["name"]} (${r["bu_cost"]} BU)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
