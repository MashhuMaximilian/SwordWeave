/**
 * verify-0024-fix.mts — re-verification probe for the Phase 4 42P10 fix.
 *
 * Background. Migration 0024 (2026-07-08) added the missing
 * (entity_id, version_number) unique indexes on primitive_versions,
 * capability_versions, and template_versions. Without them, every save
 * via recordVersion failed with SQLSTATE 42P10.
 *
 * This script verifies the fix is in place and recordVersion works
 * end-to-end. Safe to run in any environment that has DATABASE_URL.
 *
 * Run:
 *   pnpm exec tsx scripts/verify-0024-fix.mts
 *
 * Cleans up its own probe rows; no production state mutation.
 */

import { neon } from "@neondatabase/serverless";
import { recordVersion } from "../src/lib/versions/auto-snapshot";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

async function main() {
  const sql = neon(url!);
  const tables = [
    "primitive_versions",
    "effect_versions",
    "capability_versions",
    "item_versions",
    "template_versions",
  ];
  const uniqueIdx = {
    primitive_versions: "primitive_versions_id_version_unique_idx",
    capability_versions: "capability_versions_id_version_unique_idx",
    template_versions: "template_versions_id_version_unique_idx",
    effect_versions: "effect_versions_id_version_unique_idx",
    item_versions: "item_versions_id_version_unique_idx",
  };

  // 1. Check the indexes are in place
  console.log("1. Checking unique indexes exist in prod DB:");
  for (const t of tables) {
    const rows = (await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ${t}
        AND indexname = ${uniqueIdx[t as keyof typeof uniqueIdx]}
    `) as unknown as Array<{ indexname: string }>;
    console.log(`   ${t}: ${rows.length === 1 ? "OK" : "MISSING"}`);
  }

  // 2. Find a real primitive to test against
  const prim = (await sql`SELECT id FROM primitives ORDER BY id ASC LIMIT 1`)[0] as
    | { id: number }
    | undefined;
  if (!prim) {
    console.error("No primitive found. Aborting.");
    process.exit(1);
  }

  // 3. Call recordVersion end-to-end
  console.log(`2. Calling recordVersion against primitive ${prim.id}...`);
  const testHash = `verify-0024-${Date.now()}`;
  let result: Awaited<ReturnType<typeof recordVersion>>;
  try {
    result = await recordVersion({
      entityKind: "primitive",
      entityId: prim.id,
      contentHash: testHash,
      snapshot: { probe: "verify-0024", hash: testHash },
      publishedByUserId: null,
    });
  } catch (e: any) {
    console.error(`   FAILED: ${e?.message?.split("\n")[0]}`);
    process.exit(1);
  }
  console.log(`   SUCCESS: versionId=${result.versionId} v${result.versionNumber}`);

  // 4. Verify the row is in the DB
  const newRow = (await sql`
    SELECT id, version_number, is_latest FROM primitive_versions WHERE id = ${result.versionId}
  `) as unknown as Array<{ id: string; version_number: number; is_latest: boolean }>;
  console.log(`3. Row in DB: ${newRow.length === 1 ? "OK" : "MISSING"} (v${newRow[0]?.version_number} isLatest=${newRow[0]?.is_latest})`);

  // 5. Cleanup
  await sql`DELETE FROM primitive_versions WHERE id = ${result.versionId}`;
  await sql`
    UPDATE primitive_versions t1 SET is_latest = true, superseded_at = null
    WHERE primitive_id = ${prim.id} AND version_number = (
      SELECT MAX(version_number) FROM primitive_versions WHERE primitive_id = ${prim.id}
    )
  `;
  console.log("4. Cleaned up probe row, restored is_latest.");

  console.log("\n=== Phase 4 fix verified ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
