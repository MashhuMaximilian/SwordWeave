import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const r = await pool.query(`
      SELECT id, name, source_origin, hard_modifiers::text AS h
      FROM primitives
      WHERE hard_modifiers IS NOT NULL
    `);
    let found = 0;
    for (const row of r.rows) {
      const h = (row.h as string) ?? "";
      if (
        /"target"\s*:\s*"(walking|climbing|swimming|flying|burrowing)_speed"/.test(h) ||
        /"target"\s*:\s*"action_shape_size"/.test(h)
      ) {
        console.log(`${row.name.padEnd(42)} | source=${row.source_origin} | h[:200]=${h.slice(0, 200)}`);
        found++;
      }
    }
    console.log(`\n${found} primitive(s) with stale speed/targeting target strings.`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
