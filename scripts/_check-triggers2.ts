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
      WHERE name IN ('Direct Material Trigger', 'Systemic Threshold Trigger',
                     'Conditional Informational Trigger', 'Interceptive Causal Trigger',
                     'Dormant Trigger Hook')
      ORDER BY name
    `);
    for (const row of r.rows) {
      console.log(`[${row.category}] ${row.name}`);
      console.log(`    target_scope: ${row.target_scope}`);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
