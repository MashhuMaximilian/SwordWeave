// Backfill primitive.content_hash for all existing rows so the no-op
// detection works on legacy rows after their first Phase 1 save.
//
// Algorithm:
//   1. Read every row from `primitives`.
//   2. Build the canonical payload using the same algorithm the form
//      uses (src/lib/publishing/hash-content.ts).
//   3. Compute SHA-256 of the envelope.
//   4. UPDATE primitives.content_hash = '<hash>' WHERE id = <row.id>.
//
// Idempotent — running twice produces the same hashes. Rows whose hash
// already matches are skipped to avoid unnecessary writes.

import { db } from "@/db/client";
import { primitives } from "@/db/schema/engine";
import { eq, sql } from "drizzle-orm";
import { buildCanonicalPrimitivePayload, hashPrimitiveContent } from "@/lib/publishing/hash-content";
import type { HardModifier } from "@/types/swordweave";

async function main() {
  console.log("Reading all primitive rows...");
  const rows = await db
    .select({
      id: primitives.id,
      name: primitives.name,
      category: primitives.category,
      costTier: primitives.costTier,
      buCost: primitives.buCost,
      mechanicalOutputText: primitives.mechanicalOutputText,
      narrativeRule: primitives.narrativeRule,
      isPublic: primitives.isPublic,
      isMirrorable: primitives.isMirrorable,
      mirrorVector: primitives.mirrorVector,
      mirrorBuCredit: primitives.mirrorBuCredit,
      mirrorEligibilityNotes: primitives.mirrorEligibilityNotes,
      hardModifiers: primitives.hardModifiers,
      contentHash: primitives.contentHash,
    })
    .from(primitives);

  console.log(`Total rows: ${rows.length}`);
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const payload = buildCanonicalPrimitivePayload({
        name: row.name,
        category: row.category,
        costTier: row.costTier,
        buCost: row.buCost,
        mechanicalOutputText: row.mechanicalOutputText,
        narrativeRule: row.narrativeRule,
        isPublic: row.isPublic,
        isMirrorable: row.isMirrorable,
        mirrorVector: row.mirrorVector,
        mirrorBuCredit: row.mirrorBuCredit,
        mirrorEligibilityNotes: row.mirrorEligibilityNotes,
        hardModifiers: (row.hardModifiers ?? []) as readonly HardModifier[],
      });
      const hash = await hashPrimitiveContent(payload);

      if (row.contentHash === hash) {
        skipped++;
        continue;
      }

      await db
        .update(primitives)
        .set({ contentHash: hash })
        .where(eq(primitives.id, row.id));
      updated++;
    } catch (e) {
      failed++;
      console.error(`row ${row.id} (${row.name}) failed:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed}`);

  // Verify all rows have a hash now.
  const result = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      withHash: sql<number>`COUNT(${primitives.contentHash})::int`,
    })
    .from(primitives);
  console.log("Post-backfill counts:", result);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});