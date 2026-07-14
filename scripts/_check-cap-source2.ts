import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    // show enum source_type values
    const e = await pool.query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'source_type'
      ORDER BY e.enumsortorder
    `);
    console.log("source_type enum values:", e.rows.map(r => r.enumlabel));

    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'capabilities'
        AND column_name IN ('source_type', 'mirror_enabled', 'mirror_vector')
      ORDER BY column_name
    `);
    console.log("\ncapabilities columns:");
    for (const row of cols.rows) {
      console.log(`  ${row.column_name} | ${row.data_type} | nullable=${row.is_nullable} | default=${row.column_default}`);
    }

    const sample = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'capabilities'
      ORDER BY ordinal_position
    `);
    console.log("\nall capabilities columns:");
    for (const row of sample.rows) {
      console.log(`  ${row.column_name}`);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
