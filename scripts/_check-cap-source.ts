import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN source_type IS NULL THEN 1 ELSE 0 END)::int AS null_count,
        SUM(CASE WHEN source_type = '' THEN 1 ELSE 0 END)::int AS empty_count
      FROM capabilities
    `);
    console.log("capabilities.source_type stats:", r.rows[0]);

    const dist = await pool.query(`
      SELECT
        source_type,
        COUNT(*)::int AS count
      FROM capabilities
      GROUP BY source_type
      ORDER BY count DESC
    `);
    for (const row of dist.rows) {
      console.log(`  ${row.source_type}: ${row.count}`);
    }

    // mirror_enabled check
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'capabilities'
        AND column_name IN ('mirror_enabled', 'mirror_vector')
      ORDER BY column_name
    `);
    console.log("\nmirror columns:");
    for (const row of cols.rows) {
      console.log(`  ${row.column_name} | ${row.data_type} | nullable=${row.is_nullable} | default=${row.column_default}`);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
