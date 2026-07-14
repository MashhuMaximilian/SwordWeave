import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const cats = await pool.query(`
      SELECT DISTINCT category, COUNT(*)::int AS count
      FROM primitives
      GROUP BY category
      ORDER BY category
    `);
    for (const r of cats.rows) {
      console.log(`${r.category}: ${r.count}`);
    }
    console.log();
    const sample = await pool.query(`
      SELECT name, category, target_scope, source_origin
      FROM primitives
      WHERE category IN ('TACTICAL', 'RECOVERY', 'UTILITY', 'DEFENSIVE')
      ORDER BY category, name
      LIMIT 30
    `);
    for (const r of sample.rows) {
      console.log(r.category, '|', r.source_origin, '|', r.name, '|', r.target_scope);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
