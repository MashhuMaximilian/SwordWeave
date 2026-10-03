/** Dry run by default. --apply publishes size defaults without changing any character or old snapshot. */
import { writeFileSync, mkdirSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import { heritage } from "@/db/schema";
import {
  buildCanonicalTemplatePayload,
  hashTemplateContent,
} from "@/lib/publishing/hash-content";
import { recordVersion } from "@/lib/versions/auto-snapshot";
import type { CharacterSize } from "@/lib/heritage/lineage-size";
const small = new Set([
  "Burrowhide",
  "Hearthspark",
  "Duskling",
  "Griproot",
  "Whispercolony",
  "Glidesprout",
  "Reachling",
  "Chitterkin",
  "Hollowbone",
]);
async function main() {
  const rows = await db.query.heritage.findMany({
    where: eq(heritage.kind, "LINEAGE"),
    with: { primitiveLinks: true, capabilityLinks: true },
  });
  const pending = rows
    .filter((row) => !row.defaultSize)
    .map((row) => ({
      row,
      size: (row.name === "Stone Goliath" || row.name === "Ursa Major"
        ? "LARGE"
        : small.has(row.name)
          ? "SMALL"
          : "MEDIUM") as CharacterSize,
    }));
  console.log(
    JSON.stringify(
      {
        mode: process.argv.includes("--apply") ? "APPLY" : "DRY RUN",
        lineages: rows.length,
        pending: pending.map((x) => ({
          id: x.row.id,
          name: x.row.name,
          size: x.size,
        })),
        existingDefaultsPreserved: rows.length - pending.length,
      },
      null,
      2,
    ),
  );
  if (!process.argv.includes("--apply") || !pending.length) return;
  mkdirSync("tmp", { recursive: true });
  writeFileSync(
    "tmp/lineage-size-before-2026-10.json",
    JSON.stringify(
      pending.map((x) => ({
        id: x.row.id,
        defaultSize: x.row.defaultSize,
        contentHash: x.row.contentHash,
      })),
      null,
      2,
    ),
  );
  await withDatabaseTransaction(async () => {
    await db.execute(sql`SELECT pg_advisory_xact_lock(680202610)`);
    for (const { row, size } of pending) {
      const fresh = await db.query.heritage.findFirst({
        where: eq(heritage.id, row.id),
      });
      if (!fresh || fresh.defaultSize) continue;
      if (fresh.contentHash !== row.contentHash)
        throw Error(`Concurrent edit: ${row.name}`);
      const payload = buildCanonicalTemplatePayload({
        kind: row.kind,
        name: row.name,
        description: row.description ?? "",
        suggestedTraits: row.suggestedTraits ?? "",
        defaultSize: size,
        isPublic: row.isPublic,
        membershipOrder: row.membershipOrder,
        primitiveIds: row.primitiveLinks.map((p) => p.primitiveId),
        primitiveSlots: row.primitiveLinks.map((p) => ({
          primitiveId: p.primitiveId,
          isMirrored: p.isMirrored,
        })),
        capabilityIds: row.capabilityLinks.map((c) => c.capabilityId),
        iconSource: row.iconSource,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        iconColor: row.iconColor,
      });
      const contentHash = await hashTemplateContent(payload);
      await db
        .update(heritage)
        .set({ defaultSize: size, contentHash, updatedAt: new Date() })
        .where(eq(heritage.id, row.id));
      await recordVersion({
        entityKind: "template",
        entityId: row.id,
        contentHash,
        snapshot: { ...payload, imageUrl: row.imageUrl },
        publishedByUserId: row.userId,
      });
    }
  });
  console.log(
    `Added ${pending.length} versioned lineage defaults; character sizes and existing pins unchanged.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
