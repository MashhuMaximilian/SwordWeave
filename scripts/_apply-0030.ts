/**
 * Migration 0030 applier: rewrites canonical primitive source_origin
 * from 'system:phase5-commit-c-library-seed' to 'system'.
 *
 * Idempotent, data-only. Does not touch user-owned (user:*)
 * or fork:NN rows.
 *
 * Run: pnpm exec tsx scripts/_apply-0030.ts
 */
import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    const before = await pool.query(`
      SELECT
        COUNT(*)::int AS system_p5,
        SUM(CASE WHEN source_origin = 'system' THEN 1 ELSE 0 END)::int AS already_system
      FROM primitives
    `);
    console.log("BEFORE:", before.rows[0]);

    const result = await pool.query(`
      UPDATE "primitives"
      SET "source_origin" = 'system'
      WHERE "source_origin" = 'system:phase5-commit-c-library-seed'
    `);
    console.log(`Updated rows: ${result.rowCount ?? 0}`);

    const after = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN source_origin = 'system' THEN 1 ELSE 0 END)::int AS system,
        SUM(CASE WHEN source_origin LIKE 'system:%' THEN 1 ELSE 0 END)::int AS other_system,
        SUM(CASE WHEN source_origin LIKE 'user:%' THEN 1 ELSE 0 END)::int AS user_owned,
        SUM(CASE WHEN source_origin LIKE 'fork:%' THEN 1 ELSE 0 END)::int AS fork
      FROM primitives
    `);
    console.log("AFTER:", after.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
