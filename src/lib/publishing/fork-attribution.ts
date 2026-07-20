// =============================================================================
// Fork attribution — Phase 9 follow-up.
//
// Single chokepoint for everything that has to happen after a fork row is
// inserted: write the `forks` attribution row, UPSERT the `fork_aggregates`
// counter, and bump the forker's `user_stats.total_forks_created`. Optionally
// bumps the source author's `user_stats.total_forks_received` when the source
// is user-attributed.
//
// Before this refactor the same 4 writes were duplicated across 5 entity
// types in /api/fork/route.ts AND completely missing from the atelier API
// routes (which silently created fork rows in the entity tables without
// any attribution). Calling recordForkAttribution() from BOTH places fixes
// the missing-attribution bug in one shot.
//
// Usage:
//   await recordForkAttribution({
//     forkerInternalId,
//     forkerClerkId,       // for source-author resolution
//     sourceClerkUserId,   // null for system-attributed sources
//     sourceTargetType:    "PRIMITIVE",
//     sourceTargetId:      "42",
//     forkedTargetType:    "PRIMITIVE",
//     forkedTargetId:      "1050",
//     metadata:            { name: "Domain of Storm (fork)", category: "DOMAIN" },
//   });
// =============================================================================

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { forkAggregates, forks, userStats } from "@/db/schema";
import type { ReactionTargetType } from "@/lib/engagement/version-helpers";
import { resolveVirtualVersionId } from "@/lib/engagement/version-helpers";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

export interface RecordForkAttributionParams {
  /** Internal UUID of the forking user (forks.forked_by_user_id). */
  forkerInternalId: string;
  /** Clerk ID of the forker (used for source-author resolution). */
  forkerClerkId: string;
  /**
   * Clerk ID of the source row's author (entity.userId). Null when the
   * source is system-attributed (system primitives, etc.) — in that
   * case we skip the `total_forks_received` bump since there's no
   * recipient.
   */
  sourceClerkUserId: string | null;
  sourceTargetType: ReactionTargetType;
  sourceTargetId: string;
  forkedTargetType: ReactionTargetType;
  forkedTargetId: string;
  /** Free-form attribution metadata — name, category, kind, etc. */
  metadata: Record<string, unknown>;
}

export async function recordForkAttribution(
  params: RecordForkAttributionParams,
): Promise<{ forkId: string; aggregateCount: number }> {
  const versionId = resolveVirtualVersionId(
    params.sourceTargetType,
    params.sourceTargetId,
  );

  // Resolve source author → internal UUID. Null for system content.
  const sourceAuthorId = params.sourceClerkUserId
    ? await resolveUserIdByClerkId(params.sourceClerkUserId)
    : null;

  // 1. Insert the `forks` attribution row.
  const [inserted] = await db
    .insert(forks)
    .values({
      forkedByUserId: params.forkerInternalId,
      sourceTargetType: params.sourceTargetType,
      sourceTargetId: params.sourceTargetId,
      sourceVersionId: versionId,
      sourceAuthorId,
      forkedTargetType: params.forkedTargetType,
      forkedTargetId: params.forkedTargetId,
      // forkedVersionId initially points at the source's virtual version.
      // When the forker publishes their own version, the publish service
      // updates this to the real version row id (see publish-service.ts).
      forkedVersionId: versionId,
      metadata: params.metadata,
    })
    .returning({ id: forks.id });
  const forkId = inserted?.id ?? "";

  // 2. Atomic fork_count increment on the source target/version.
  const [agg] = await db
    .insert(forkAggregates)
    .values({
      sourceTargetType: params.sourceTargetType,
      sourceTargetId: params.sourceTargetId,
      sourceVersionId: versionId,
      forkCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        forkAggregates.sourceTargetType,
        forkAggregates.sourceTargetId,
        forkAggregates.sourceVersionId,
      ],
      set: {
        forkCount: sql`${forkAggregates.forkCount} + 1`,
        updatedAt: sql`NOW()`,
      },
    })
    .returning({ forkCount: forkAggregates.forkCount });
  const aggregateCount = Number(agg?.forkCount ?? 1);

  // 3. Bump forker's totalForksCreated. UPSERT so a stats row is created
  // on the first fork by a new user.
  await db
    .insert(userStats)
    .values({
      userId: params.forkerInternalId,
      totalForksCreated: 1,
    })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: {
        totalForksCreated: sql`${userStats.totalForksCreated} + 1`,
        updatedAt: sql`NOW()`,
      },
    });

  // 4. Bump source author's totalForksReceived. Only when the source is
  // user-attributed — system content has no author to credit.
  if (sourceAuthorId) {
    await db
      .insert(userStats)
      .values({
        userId: sourceAuthorId,
        totalForksReceived: 1,
      })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: {
          totalForksReceived: sql`${userStats.totalForksReceived} + 1`,
          updatedAt: sql`NOW()`,
        },
      });
  }

  return { forkId, aggregateCount };
}
