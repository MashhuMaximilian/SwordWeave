// =============================================================================
// Engagement aggregate map
//
// Returns likes / dislikes / forks counts for a list of library items,
// keyed by composite ID (`<TARGET_TYPE>:<target_id>`). Used by:
//   - /library/browse (enriches LibraryItems before rendering)
//   - /sandbox/grammar + /sandbox/blueprint (sandbox cards)
//   - /creations (my-creations list)
//
// Joins reaction_aggregates + fork_aggregates across all versions of an
// item, grouping by the composite ID and summing across versions.
//
// Pure read; safe to call multiple times in a single request.
// =============================================================================

import { sql, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { reactionAggregates, forkAggregates } from "@/db/schema/engagement";

export type EngagementCounts = {
  likes: number;
  dislikes: number;
  forks: number;
};

/**
 * Resolve engagement counts for a list of composite IDs (`<TYPE>:<id>`).
 * Returns a Map keyed by composite ID. Missing entries default to 0/0/0.
 *
 * Note: returns a Map even when input is empty so callers can `.get()`
 * safely.
 */
export async function resolveEngagementMap(
  compositeIds: string[],
): Promise<Map<string, EngagementCounts>> {
  const map = new Map<string, EngagementCounts>();
  if (compositeIds.length === 0) return map;

  // Parse composite IDs into (type, id) tuples for type-aware joins
  const parsed = compositeIds
    .map((cid) => {
      const idx = cid.indexOf(":");
      if (idx === -1) return null;
      const type = cid.slice(0, idx);
      const id = cid.slice(idx + 1);
      return { cid, type, id };
    })
    .filter((p): p is { cid: string; type: string; id: string } => p !== null);

  const uniqueIds = Array.from(new Set(parsed.map((p) => p.id)));

  // Reactions: one row per (target_type, target_id, version_id). We sum across
  // all versions to get the lifetime engagement for the de-duplicated item.
  const reactionRows = await db
    .select({
      targetType: reactionAggregates.targetType,
      targetId: reactionAggregates.targetId,
      likesCount: sql<number>`SUM(${reactionAggregates.likesCount})::int`,
      dislikesCount: sql<number>`SUM(${reactionAggregates.dislikesCount})::int`,
    })
    .from(reactionAggregates)
    .where(inArray(reactionAggregates.targetId, uniqueIds))
    .groupBy(reactionAggregates.targetType, reactionAggregates.targetId);

  // Forks: keyed by (source_target_type, source_target_id, source_version_id).
  const forkRows = await db
    .select({
      sourceTargetType: forkAggregates.sourceTargetType,
      sourceTargetId: forkAggregates.sourceTargetId,
      count: sql<number>`SUM(${forkAggregates.forkCount})::int`,
    })
    .from(forkAggregates)
    .where(inArray(forkAggregates.sourceTargetId, uniqueIds))
    .groupBy(forkAggregates.sourceTargetType, forkAggregates.sourceTargetId);

  // Build per-(type,id) intermediate maps
  const reactionByTypeId = new Map<
    string,
    { likes: number; dislikes: number }
  >();
  for (const r of reactionRows) {
    reactionByTypeId.set(`${r.targetType}:${r.targetId}`, {
      likes: Number(r.likesCount),
      dislikes: Number(r.dislikesCount),
    });
  }
  const forkByTypeId = new Map<string, number>();
  for (const f of forkRows) {
    forkByTypeId.set(`${f.sourceTargetType}:${f.sourceTargetId}`, Number(f.count));
  }

  // Map each composite ID → its (type, id) → look up aggregates
  for (const cid of new Set(compositeIds)) {
    const idx = cid.indexOf(":");
    if (idx === -1) continue;
    const type = cid.slice(0, idx);
    const id = cid.slice(idx + 1);
    const key = `${type}:${id}`;
    const react = reactionByTypeId.get(key);
    const forks = forkByTypeId.get(key) ?? 0;
    map.set(cid, {
      likes: react?.likes ?? 0,
      dislikes: react?.dislikes ?? 0,
      forks,
    });
  }

  return map;
}

/**
 * Enrich a list of LibraryItems with engagement counts. Returns a new
 * array (does not mutate). Items missing from the engagement map get
 * zero counts (already the default for LibraryItem).
 */
export function enrichItemsWithEngagement<
  T extends { id: string; likesCount?: number | null; dislikesCount?: number | null; forkCount?: number | null },
>(
  items: T[],
  engagementMap: Map<string, EngagementCounts>,
): T[] {
  return items.map((item) => {
    const counts = engagementMap.get(item.id);
    if (!counts) return item;
    return {
      ...item,
      likesCount: counts.likes,
      dislikesCount: counts.dislikes,
      forkCount: counts.forks,
    };
  });
}