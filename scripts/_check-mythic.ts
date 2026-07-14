import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const r = await pool.query(`
      SELECT name, narrative_rule
      FROM primitives
      WHERE name LIKE '%Mythic Safeguard%'
    `);
    for (const row of r.rows) {
      console.log(row.name, '::', row.narrative_rule);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
