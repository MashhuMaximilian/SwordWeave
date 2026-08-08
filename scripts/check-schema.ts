import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neondatabase/serverless";

const MASHU_USER_ID = "user_3GBKnmCEvgYSjfeFqmAQrzO7cyP";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Check character_capabilities schema
  const ccCols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'character_capabilities'
    ORDER BY ordinal_position
  `);
  console.log("character_capabilities columns:");
  ccCols.rows.forEach((r: any) => {
    console.log(`  ${r.column_name} (${r.data_type})`);
  });

  await pool.end();
}

main().catch(console.error);
