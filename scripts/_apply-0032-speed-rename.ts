/**
 * Migration 0032 — Phase-7-E/UX2a: rename the legacy MOVEMENT_SPEED
 * metric to WALKING_SPEED across the canonical primitive scope rows.
 *
 * Idempotent. The five new speed axes (walking/climbing/swimming/
 * flying/burrowing) extend `STANDALONE_METRICS`. This script just
 * sweeps any stored `MOVEMENT_SPEED` values in `target_scope` JSONB
 * to `WALKING_SPEED` since the legacy MOVEMENT_SPEED value semantically
 * meant "walking."
 *
 * Storage: target_scope is `jsonb`. We rewrite the whole row's
 * target_scope to keep the schema stable.
 */
import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const cs = process.env["DATABASE_URL"];
  if (!cs) throw new Error("DATABASE_URL missing");
  const pool = new Pool({ connectionString: cs });
  try {
    // Find rows with MOVEMENT_SPEED anywhere in their target_scope.values
    const before = await pool.query(`
      SELECT id, name, target_scope::text AS t
      FROM primitives
      WHERE target_scope IS NOT NULL
        AND target_scope::text LIKE '%MOVEMENT_SPEED%'
    `);
    console.log(`Found ${before.rows.length} rows with MOVEMENT_SPEED:`);
    for (const row of before.rows) {
      // Replace MOVEMENT_SPEED with WALKING_SPEED in the JSON string
      const oldText = row.t as string;
      const newText = oldText.replace(/"MOVEMENT_SPEED"/g, '"WALKING_SPEED"');
      const result = await pool.query(
        `UPDATE primitives SET target_scope = $1::jsonb WHERE id = $2`,
        [newText, row.id],
      );
      console.log(`  ${row.name.padEnd(42)} updated (${result.rowCount} row)`);
    }

    // Verify
    const after = await pool.query(`
      SELECT COUNT(*) AS n
      FROM primitives
      WHERE target_scope IS NOT NULL
        AND target_scope::text LIKE '%MOVEMENT_SPEED%'
    `);
    console.log(`\nVerification: rows still containing MOVEMENT_SPEED = ${after.rows[0].n}`);

    const walking = await pool.query(`
      SELECT COUNT(*) AS n
      FROM primitives
      WHERE target_scope IS NOT NULL
        AND target_scope::text LIKE '%WALKING_SPEED%'
    `);
    console.log(`Rows with WALKING_SPEED: ${walking.rows[0].n}`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
