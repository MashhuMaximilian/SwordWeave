// =============================================================================
// Library engagement prefetch
//
// Batch-loads the current user's reactions + follow state for a list of
// library items, so the Browse page can hydrate LikeForkBar without N+1
// queries. All in one round-trip.
// =============================================================================

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { follows, reactions, users } from "@/db/schema";
import { resolveVirtualVersionId } from "@/lib/engagement/version-helpers";

export interface LibraryEngagement {
  /** Map of composite item ID → current user's reaction (or null) */
  reactions: Record<string, "LIKE" | "DISLIKE" | null>;
  /** Map of author user ID → is the current user following them */
  following: Record<string, boolean>;
}

export async function loadLibraryEngagement(
  currentUserInternalId: string | null,
  items: Array<{
    id: string;
    targetType: string;
    targetId: string;
    authorId: string | null;
  }>,
): Promise<LibraryEngagement> {
  const result: LibraryEngagement = {
    reactions: {},
    following: {},
  };

  for (const item of items) result.reactions[item.id] = null;

  if (!currentUserInternalId || items.length === 0) return result;

  // Wrap engagement prefetch in try/catch — these are prefetch hints for
  // the UI (which like / fork icons the user has). If they fail for ANY
  // reason (Drizzle shape mismatch, Neon pooler hiccup, new schema column
  // not yet migrated) we MUST still return the library page, just with
  // empty engagement state. The previous version would throw and the
  // entire /library/browse page would 500 — surfacing a "could not load"
  // error to the user that prevents them from browsing the corpus at all.
  try {
    // Build (targetType, targetId, versionId) tuples for reaction lookup
    const versioned = items.map((it) => ({
      cid: it.id,
      targetType: it.targetType,
      targetId: it.targetId,
      versionId: resolveVirtualVersionId(
        it.targetType as never,
        it.targetId,
      ),
    }));

    // Single query: reactions where (userId, targetType, targetId, versionId) IN ...
    // Drizzle doesn't support tuple-IN cleanly; use OR with AND clauses.
    // For batches ≤50 this is fine; for larger batches paginate.
    const reactionRows = await db
      .select({
        targetType: reactions.targetType,
        targetId: reactions.targetId,
        kind: reactions.kind,
      })
      .from(reactions)
      .where(
        and(
          eq(reactions.userId, currentUserInternalId),
          or(
            ...versioned.map((v) =>
              and(
                eq(reactions.targetType, v.targetType as never),
                eq(reactions.targetId, v.targetId),
                eq(reactions.versionId, v.versionId),
              )!,
            ),
          )!,
        ),
      );

    // Index reactions by (type, id)
    const byTypeId = new Map<string, "LIKE" | "DISLIKE">();
    for (const r of reactionRows) {
      byTypeId.set(`${r.targetType}:${r.targetId}`, r.kind as "LIKE" | "DISLIKE");
    }
    for (const v of versioned) {
      const key = `${v.targetType}:${v.targetId}`;
      result.reactions[v.cid] = byTypeId.get(key) ?? null;
    }

    // Follow state for authors
    const authorIds = Array.from(
      new Set(
        items.map((it) => it.authorId).filter((id): id is string => Boolean(id)),
      ),
    );
    if (authorIds.length > 0) {
      // Library entities store Clerk IDs, while follows references users.id UUIDs.
      const authorRows = await db
        .select({ id: users.id, clerkUserId: users.clerkUserId })
        .from(users)
        .where(inArray(users.clerkUserId, authorIds));
      const clerkByInternal = new Map(authorRows.map((row) => [row.id, row.clerkUserId]));
      const internalAuthorIds = authorRows.map((row) => row.id);
      if (internalAuthorIds.length === 0) return result;
      const followRows = await db
        .select({
          followingId: follows.followingId,
        })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, currentUserInternalId),
            inArray(follows.followingId, internalAuthorIds),
          ),
        );
      const followingSet = new Set(followRows.map((r) => clerkByInternal.get(r.followingId)).filter(Boolean));
      for (const clerkId of authorIds) {
        result.following[clerkId] = followingSet.has(clerkId);
      }
    }
  } catch (err) {
    // Don't let a transient engagement-prefetch failure tank the entire
    // /library/browse page. The user can still browse + search; likes
    // and fork counts just won't be personalized for this request.
    console.error(
      "[loadLibraryEngagement] failed, returning empty engagement:",
      err,
    );
  }

  return result;
}

// Re-export for convenience
export { users };
export type { users as usersTable };
