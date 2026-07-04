import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env["DATABASE_URL"]!);

  // Delete specific IDs from pre-migration era
  const oldIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  console.log(`Deleting IDs: ${oldIds.join(", ")}`);

  const result = await sql`
    DELETE FROM primitives
    WHERE id = ANY(${oldIds})
    RETURNING id, name
  `;
  console.log(`Deleted ${result.length} rows:`);
  for (const row of result) {
    console.log(`  - ID ${row["id"]}: ${row["name"]}`);
  }

  // Verify
  const remaining = await sql`SELECT COUNT(*) as count FROM primitives`;
  console.log(`\nRemaining: ${remaining[0]?.["count"] ?? 0}`);

  const tierBreakdown = await sql`
    SELECT cost_tier, COUNT(*) as count
    FROM primitives
    GROUP BY cost_tier
    ORDER BY cost_tier
  `;
  console.log(`\nTier breakdown:`);
  for (const row of tierBreakdown) {
    console.log(`  ${row["cost_tier"]}: ${row["count"]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});