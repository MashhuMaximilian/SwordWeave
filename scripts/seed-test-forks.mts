// Test seed: insert 3 synthetic forks of PRIMITIVE 1 (Traveler's Cloak)
// to verify <ForksList> renders correctly with real data.
// Production-safe: deletes only its own seeded rows by marker.

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("NO_URL");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

async function run() {
  // Use primitive id 423 (Traveler's Cloak) for visual testing on the
  // browseable library. id 1 was chosen originally but that row doesn't
  // exist in the production DB.
  const TARGET_PRIM_ID = 423;

  // Look up real users + the Traveler's Cloak (id=423, public)
  const users = await pool.query<{ id: string; username: string; clerk_user_id: string }>(
    `SELECT id, username, clerk_user_id FROM users WHERE deleted_at IS NULL AND is_anonymized = false LIMIT 3`,
  );
  if (users.rows.length < 1) {
    console.error("Need at least 1 user. Got:", users.rows.length);
    process.exit(1);
  }

  // Lookup the real internal UUID for primitive 423 — needed for source_target_id? No: source_target_id is text id="423"
  // But we need a real source_version_id (uuid). Get any existing version or create one.
  const verRow = await pool.query<{ id: string }>(
    `SELECT id FROM primitive_versions ORDER BY version_number ASC LIMIT 1`,
  );
  let sourceVersionId: string;
  if (verRow.rows.length > 0) {
    sourceVersionId = verRow.rows[0].id;
  } else {
    // No versions yet — create a v1 FULL snapshot
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO primitive_versions (primitive_id, version_number, delta_kind, snapshot, published_by_user_id)
       VALUES ($1, 1, 'FULL', '{}'::jsonb, $2)
       RETURNING id`,
      [TARGET_PRIM_ID, users.rows[0].id],
    );
    sourceVersionId = ins.rows[0].id;
  }

  // Insert 3 forks with different forkers (reuse users if not enough distinct)
  const forkers = users.rows.length >= 3
    ? users.rows.slice(0, 3)
    : [...users.rows, ...users.rows, ...users.rows].slice(0, 3);

  const seeds: { id: string; forkerId: string; clerkId: string }[] = [];
  for (const u of forkers) {
    const forkedRowId = `test-fork-${Math.random().toString(36).slice(2, 10)}`;
    const fork = await pool.query<{ id: string }>(
      `INSERT INTO forks (
        forked_by_user_id, source_target_type, source_target_id, source_version_id,
        source_author_id, forked_target_type, forked_target_id, forked_version_id,
        metadata
      ) VALUES (
        $1, 'PRIMITIVE', $4, $2,
        (SELECT id FROM users WHERE deleted_at IS NULL AND is_anonymized = false ORDER BY created_at ASC LIMIT 1),
        'PRIMITIVE', $3, gen_random_uuid(),
        $5
      ) RETURNING id`,
      [
        u.id,
        sourceVersionId,
        forkedRowId,
        String(TARGET_PRIM_ID),
        { _testSeed: true, forkedRowId },
      ],
    );
    seeds.push({ id: fork.rows[0].id, forkerId: u.id, clerkId: u.clerk_user_id });
  }

  // Bump fork_aggregates so totalForks is correct
  await pool.query(
    `INSERT INTO fork_aggregates (source_target_type, source_target_id, source_version_id, fork_count)
     VALUES ('PRIMITIVE', $1, $2, $3)
     ON CONFLICT (source_target_type, source_target_id, source_version_id)
     DO UPDATE SET fork_count = fork_aggregates.fork_count + $3`,
    [String(TARGET_PRIM_ID), sourceVersionId, seeds.length],
  );

  console.log("Seeded", seeds.length, "forks against primitive id", TARGET_PRIM_ID);
  for (const s of seeds) console.log("  ", s);

  console.log("\nCleanup script: run with --cleanup to delete.");
  if (process.argv.includes("--cleanup")) {
    const del = await pool.query(
      `DELETE FROM forks WHERE metadata->>'_testSeed' = 'true'`,
    );
    console.log("Deleted", del.rowCount, "test forks");
    // Reset aggregate
    await pool.query(
      `UPDATE fork_aggregates SET fork_count = fork_count - $2
       WHERE source_target_type = 'PRIMITIVE' AND source_target_id = $1 AND source_version_id = $3`,
      [String(TARGET_PRIM_ID), seeds.length, sourceVersionId],
    );
    console.log("Reset fork_aggregates count");
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });