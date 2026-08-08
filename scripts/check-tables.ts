import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neondatabase/serverless";

const MASHU_USER_ID = "user_3GBKnmCEvgYSjfeFqmAQrzO7cyP";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const charResult = await pool.query(
    `SELECT id FROM characters WHERE user_id = $1 AND name = $2 ORDER BY created_at DESC LIMIT 1`,
    [MASHU_USER_ID, "i2 Test Character"],
  );

  if (charResult.rowCount === 0) {
    console.log("No i2 Test Character found.");
    return;
  }

  const charId = charResult.rows[0].id;
  console.log(`Character: i2 Test Character (${charId})`);

  // Check what tables exist
  const tables = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE tablename IN ('capabilities', 'capability_versions', 'capability_version_primitives', 'character_capabilities')
    ORDER BY tablename
  `);
  console.log("Available tables:", tables.rows.map((r: any) => r.tablename));

  await pool.end();
}

main().catch(console.error);
