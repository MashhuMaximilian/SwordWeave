import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env["DATABASE_URL"]!);

  // First check what's there
  const before = await sql`SELECT id, name, category FROM primitives ORDER BY id`;
  console.log(`Before: ${before.length} primitives`);

  // Find duplicates (same name + category with NULL user_id)
  const dups = await sql`
    SELECT name, category, COUNT(*) as count, ARRAY_AGG(id ORDER BY id) as ids
    FROM primitives
    WHERE user_id IS NULL
    GROUP BY name, category
    HAVING COUNT(*) > 1
  `;

  console.log(`Found ${dups.length} duplicate groups`);

  // For each duplicate group, keep the first ID, delete the rest
  let totalDeleted = 0;
  for (const group of dups) {
    const ids = group["ids"] as number[];
    const keepId = ids[0];
    const deleteIds = ids.slice(1);
    if (deleteIds.length === 0) continue;

    const result = await sql`
      DELETE FROM primitives
      WHERE id = ANY(${deleteIds})
      RETURNING id, name
    `;
    totalDeleted += result.length;
    console.log(`  Kept ${keepId}, deleted ${deleteIds.length} duplicates of "${group["name"]}" (${group["category"]})`);
  }

  const after = await sql`SELECT COUNT(*) as count FROM primitives`;
  console.log(`\nAfter: ${after[0]?.["count"] ?? 0} primitives`);
  console.log(`Deleted: ${totalDeleted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});