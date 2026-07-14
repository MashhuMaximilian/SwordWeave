import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const r = await pool.query(`
      SELECT name, category, bu_cost, cost_tier, target_scope, source_origin,
        LEFT(mechanical_output_text, 80) AS mech,
        LEFT(narrative_rule, 80) AS narr
      FROM primitives
      WHERE category IN ('TACTICAL', 'VITALITY')
      ORDER BY category, name
    `);
    for (const row of r.rows) {
      console.log(`[${row.category}] ${row.name}`);
      console.log(`  ${row.bu_cost} BU | ${row.cost_tier} | ${row.source_origin}`);
      console.log(`  Target: ${row.target_scope}`);
      console.log(`  Mech: ${row.mech}`);
      console.log(`  Narr: ${row.narr}`);
      console.log();
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
