// =============================================================================
// Visibility helper — enforces PUBLIC / FOLLOWERS_ONLY / PRIVATE access
//
// Used by source pages, library queries, version pages, and preview modals.
// =============================================================================

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { follows, publications, users } from "@/db/schema";
import type { publishTargetTypeEnum } from "@/db/schema";

export type Visibility = "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";

export interface VisibilityCheckResult {
  allowed: boolean;
  reason?: "private" | "followers_only" | "not_found";
}

/**
 * Check if a viewer can access an entity based on its visibility.
 *
 * Rules:
 * - Owner can always see their own content
 * - PUBLIC: everyone can see
 * - FOLLOWERS_ONLY: only the owner's followers can see
 * - PRIVATE: only the owner can see
 *
 * Checks publications table FIRST (source of truth), then falls back
 * to isPublic boolean. On any error, falls back to isPublic (fail-open).
 */
export async function checkVisibility(input: {
  targetType: string;
  targetId: string;
  ownerId: string | null;
  isPublic: boolean;
  viewerId: string | null;
}): Promise<VisibilityCheckResult> {
  const { targetType, targetId, ownerId, isPublic, viewerId } = input;

  // Owner can always see their own content
  if (viewerId && ownerId && viewerId === ownerId) {
    return { allowed: true };
  }

  // System content (no owner) is always public
  if (!ownerId) {
    return { allowed: true };
  }

  // Not logged in + not public = not allowed
  if (!viewerId && !isPublic) {
    return { allowed: false, reason: "private" };
  }

  try {
    // Check publications table for visibility tier (source of truth)
    const pub = await db.query.publications.findFirst({
      where: (table, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
        andFn(
          eqFn(table.targetType, targetType as (typeof publishTargetTypeEnum.enumValues)[number]),
          eqFn(table.targetId, targetId),
          isNullFn(table.unpublishedAt),
        ),
      columns: { visibility: true },
    });

    if (pub) {
      // Publication exists — use its visibility tier
      switch (pub.visibility) {
        case "PUBLIC":
          return { allowed: true };
        case "PRIVATE":
          return { allowed: false, reason: "private" };
        case "FOLLOWERS_ONLY":
          if (!viewerId) {
            return { allowed: false, reason: "followers_only" };
          }
          // Check if viewer follows the owner
          const viewerUser = await db.query.users.findFirst({
            where: (table, { eq: eqFn }) => eqFn(table.clerkUserId, viewerId),
            columns: { id: true },
          });
          if (!viewerUser) {
            return { allowed: false, reason: "followers_only" };
          }
          const following = await db.query.follows.findFirst({
            where: (table, { and: andFn, eq: eqFn }) =>
              andFn(
                eqFn(table.followerId, viewerUser.id),
                eqFn(table.followingId, ownerId),
              ),
            columns: { followerId: true },
          });
          return following
            ? { allowed: true }
            : { allowed: false, reason: "followers_only" };
      }
    }

    // No active publication — check if there's an unpublished one
    // (means the entity was set to PRIVATE)
    const unpublished = await db.query.publications.findFirst({
      where: (table, { and: andFn, eq: eqFn }) =>
        andFn(
          eqFn(table.targetType, targetType as (typeof publishTargetTypeEnum.enumValues)[number]),
          eqFn(table.targetId, targetId),
        ),
      columns: { unpublishedAt: true },
    });
    if (unpublished?.unpublishedAt) {
      // Entity was explicitly set to PRIVATE
      return { allowed: false, reason: "private" };
    }
  } catch {
    // Publication query failed — fall through to isPublic fallback
  }

  // No publication row at all — fall back to isPublic boolean
  return isPublic ? { allowed: true } : { allowed: false, reason: "private" };
}

/**
 * Build a WHERE clause that filters by visibility for library queries.
 * Used by queryLibrary and similar list queries.
 *
 * For a given viewer:
 * - Include PUBLIC content (isPublic = true)
 * - Include FOLLOWERS_ONLY content if viewer follows the author
 * - Include PRIVATE content if viewer is the author
 * - Include system content (no userId)
 */
export function visibilityWhereClause(
  viewerId: string | null,
  table: { isPublic: unknown; userId: unknown },
) {
  if (!viewerId) {
    // Not logged in — only public + system content
    return or(
      eq(table.isPublic as Parameters<typeof eq>[0], true as Parameters<typeof eq>[1]),
      isNull(table.userId as Parameters<typeof eq>[0]),
    );
  }

  // Logged in — public + system + own content
  // FOLLOWERS_ONLY filtering requires a JOIN against publications + follows,
  // which is too expensive for list queries. We handle it at the detail level.
  return or(
    eq(table.isPublic as Parameters<typeof eq>[0], true as Parameters<typeof eq>[1]),
    isNull(table.userId as Parameters<typeof eq>[0]),
    eq(table.userId as Parameters<typeof eq>[0], viewerId as Parameters<typeof eq>[1]),
  );
}
