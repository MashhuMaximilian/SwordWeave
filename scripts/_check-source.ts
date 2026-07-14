/**
 * Check the source/origin metadata on existing primitive rows.
 * Run: pnpm exec tsx scripts/_check-source.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

async function main() {
  const rows = await sql`
    SELECT
      category::text as category,
      COUNT(*) as total,
      COUNT(source_origin) as with_origin,
      COUNT(*) FILTER (WHERE source_origin IS NULL) as null_origin
    FROM primitives WHERE user_id IS NULL
    GROUP BY category
    ORDER BY category
  `;
  console.log("source_origin by category:");
  console.log("(NULL = not yet populated)");
  console.log("");
  for (const r of rows) {
    console.log(
      `  ${String(r["category"]).padEnd(28)} total=${r["total"]} with_origin=${r["with_origin"]} null=${r["null_origin"]}`
    );
  }

  // Sample the actual values
  const sample = await sql`
    SELECT name, source_origin, category::text as category
    FROM primitives WHERE user_id IS NULL AND source_origin IS NOT NULL
    LIMIT 10
  `;
  console.log("\nSample rows WITH source_origin (max 10):");
  if (sample.length === 0) {
    console.log("  (none — source_origin is NULL everywhere)");
  } else {
    for (const r of sample) {
      console.log(`  [${r["category"]}] ${r["name"]} → "${r["source_origin"]}"`);
    }
  }

  // Distinct values
  const distinct = await sql`
    SELECT source_origin, COUNT(*) as n
    FROM primitives WHERE user_id IS NULL
    GROUP BY source_origin
    ORDER BY n DESC
  `;
  console.log("\nAll distinct source_origin values:");
  for (const r of distinct) {
    const v = r["source_origin"] ?? "(NULL)";
    console.log(`  ${String(v).padEnd(60)} ${r["n"]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
