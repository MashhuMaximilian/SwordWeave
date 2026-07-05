// Apply 0015 — add total_forks_created to user_stats
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("NO_URL"); process.exit(1); }

const pool = new Pool({ connectionString: url });

async function run() {
  const statements = [
    'ALTER TABLE "user_stats" ADD COLUMN IF NOT EXISTS "total_forks_created" integer DEFAULT 0 NOT NULL',
  ];
  for (const s of statements) {
    try {
      await pool.query(s);
      console.log("OK:", s.slice(0, 80));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("FAIL:", s.slice(0, 80), "->", msg);
    }
  }

  // Backfill from existing forks
  const backfill = await pool.query(`
    UPDATE user_stats us
    SET total_forks_created = COALESCE(sub.cnt, 0)
    FROM (
      SELECT forked_by_user_id, COUNT(*)::int AS cnt
      FROM forks
      GROUP BY forked_by_user_id
    ) sub
    WHERE us.user_id = sub.forked_by_user_id
  `);
  console.log("Backfilled:", backfill.rowCount, "rows");

  await pool.end();
}

run().catch((e) => { console.error("FAIL:", e); process.exit(1); });