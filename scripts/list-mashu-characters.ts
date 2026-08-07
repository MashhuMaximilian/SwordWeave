import { Pool } from "@neondatabase/serverless";

async function main() {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] as string });

  const result = await pool.query(`
    SELECT id, user_id, name, level FROM characters
    WHERE user_id IS NOT NULL
    ORDER BY created_at DESC LIMIT 20
  `);
  console.log("Recent characters with user_id:");
  for (const r of result.rows) {
    console.log(`  ${r.id} | user=${r.user_id} | name=${r.name} | L${r.level}`);
  }

  const userResult = await pool.query(`
    SELECT DISTINCT user_id FROM characters
    WHERE user_id IS NOT NULL
  `);
  console.log("\nUnique user_ids:");
  for (const r of userResult.rows) {
    console.log(`  ${r.user_id}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
