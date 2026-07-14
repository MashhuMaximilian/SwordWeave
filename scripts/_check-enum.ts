import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    // Pull the enum's allowed values
    const e = await pool.query(`
      SELECT enumlabel, enumsortorder
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'primitive_category'
      ORDER BY e.enumsortorder
    `);
    console.log("primitive_category enum:");
    for (const r of e.rows) console.log(`  ${r.enumlabel}`);
    console.log();

    // DEFENSIVE rows for naming reference
    const def = await pool.query(`
      SELECT name, target_scope, source_origin
      FROM primitives
      WHERE category = 'DEFENSIVE'
      ORDER BY name
    `);
    console.log("DEFENSIVE rows:");
    for (const r of def.rows) {
      console.log(`  ${r.name} | ${r.target_scope}`);
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
