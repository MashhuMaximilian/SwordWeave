import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const r = await pool.query(`
      SELECT name, category, target_scope
      FROM primitives
      WHERE category IN ('DEFENSE', 'STRUCTURAL', 'OUTPUT', 'TARGETING')
      ORDER BY category, name
    `);
    for (const row of r.rows) {
      console.log(`${row.category} | ${row.name} | ${row.target_scope}`);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
