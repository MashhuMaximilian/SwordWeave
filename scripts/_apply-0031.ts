/**
 * Migration 0031 applier: ALTER TYPE primitive_category ADD VALUE 'TACTICAL' and 'VITALITY'.
 *
 * ALTER TYPE ... ADD VALUE must run outside a multi-statement transaction in
 * older Postgres. Neon/PG 16 supports it inside a transaction but the safety
 * practice is to run as autocommit DDL. We use the Postgres pool directly
 * with a single-statement per ALTER call so each autocommits.
 *
 * Idempotent: ADD VALUE IF NOT EXISTS.
 */
import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    // Before
    const before = await pool.query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'primitive_category'
        AND enumlabel IN ('TACTICAL', 'VITALITY')
    `);
    console.log("BEFORE missing:", before.rows.map((r: any) => r.enumlabel));

    await pool.query(
      `ALTER TYPE "primitive_category" ADD VALUE IF NOT EXISTS 'TACTICAL';`,
    );
    console.log("Added TACTICAL");

    await pool.query(
      `ALTER TYPE "primitive_category" ADD VALUE IF NOT EXISTS 'VITALITY';`,
    );
    console.log("Added VITALITY");

    const after = await pool.query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'primitive_category'
        AND enumlabel IN ('TACTICAL', 'VITALITY')
    `);
    console.log("AFTER present:", after.rows.map((r: any) => r.enumlabel));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
