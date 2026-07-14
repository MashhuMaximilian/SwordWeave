import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const r = await pool.query(`
      SELECT name, category, bu_cost, target_scope, narrative_rule
      FROM primitives
      WHERE category = 'TRIGGER_HOOK'
        OR name ILIKE '%causal%'
        OR name ILIKE '%intercept%'
      ORDER BY name
    `);
    for (const row of r.rows) {
      console.log(`[${row.category}] ${row.name} | ${row.bu_cost} BU | ${row.target_scope}`);
      console.log(`    ${(row.narrative_rule || '').slice(0, 160)}`);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
