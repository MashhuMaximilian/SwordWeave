import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { flagAggregates } from "@/db/schema";
import { resolveVirtualVersionId, type ReactionTargetType } from "./version-helpers";

/** Same unpinned version as GET /api/flags, batched for visible library cards. */
export async function loadLibraryFlagCounts(targets: Array<{id: string; targetType: ReactionTargetType; targetId: string}>) {
  const counts = new Map<string, number>();
  if (!targets.length) return counts;
  const versions = new Map(targets.map(target => [resolveVirtualVersionId(target.targetType, target.targetId), target]));
  const rows = await db.select({
    targetType: flagAggregates.targetType, targetId: flagAggregates.targetId, versionId: flagAggregates.versionId,
    unbalanced: flagAggregates.unbalancedCount, broken: flagAggregates.brokenCount,
    inappropriate: flagAggregates.inappropriateCount, duplicate: flagAggregates.duplicateCount, other: flagAggregates.otherCount,
  }).from(flagAggregates).where(inArray(flagAggregates.versionId, [...versions.keys()]));
  for (const row of rows) {
    const target = versions.get(row.versionId);
    if (!target || target.targetType !== row.targetType || target.targetId !== row.targetId) continue;
    counts.set(target.id, Number(row.unbalanced) + Number(row.broken) + Number(row.inappropriate) + Number(row.duplicate) + Number(row.other));
  }
  return counts;
}
