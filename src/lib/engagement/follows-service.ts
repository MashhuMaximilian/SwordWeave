// =============================================================================
// Follows service — Phase 5 Commit C
//
// One-way follows: follower -> following. A user can follow another user
// but the relationship is asymmetric (follower counts, followed counts).
//
// Following is global (a user's profile, not per-content). Followers see
// posts / library updates from people they follow in their feed (Phase 6).
//
// Self-follow is blocked.
// =============================================================================

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { follows, users } from "@/db/schema";

export interface FollowResult {
  following: boolean;
  followerCount: number;
  followingCount: number;
}

/**
 * Follow a user. No-op if already following. Errors if attempting self-follow.
 */
export async function followUser(input: {
  followerUserId: string;
  followingUserId: string;
}): Promise<FollowResult> {
  const { followerUserId, followingUserId } = input;

  if (followerUserId === followingUserId) {
    throw new Error("Cannot follow yourself");
  }

  // Verify target exists
  const target = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.id, followingUserId),
    columns: { id: true },
  });
  if (!target) {
    throw new Error("Target user not found");
  }

  // Insert (idempotent via unique index on (follower, following))
  try {
    await db.insert(follows).values({
      followerId: followerUserId,
      followingId: followingUserId,
    });
  } catch (err) {
    // Already following — no-op
    if (!(err instanceof Error && err.message.includes("unique"))) throw err;
  }

  return getFollowCounts(followerUserId, followingUserId);
}

/**
 * Unfollow a user. No-op if not currently following.
 */
export async function unfollowUser(input: {
  followerUserId: string;
  followingUserId: string;
}): Promise<FollowResult> {
  const { followerUserId, followingUserId } = input;

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerUserId),
        eq(follows.followingId, followingUserId),
      ),
    );

  return getFollowCounts(followerUserId, followingUserId);
}

/**
 * Check if user A follows user B.
 */
export async function isFollowing(
  followerUserId: string,
  followingUserId: string,
): Promise<boolean> {
  const row = await db.query.follows.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.followerId, followerUserId),
        eq(table.followingId, followingUserId),
      ),
    columns: { followerId: true },
  });
  return Boolean(row);
}

/**
 * Get follow counts + whether the current user follows the target.
 */
export async function getFollowCounts(
  currentUserId: string,
  targetUserId: string,
): Promise<FollowResult> {
  const followingPromise = isFollowing(currentUserId, targetUserId);

  const [followerCount, followingCount] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, targetUserId))
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, targetUserId))
      .then((r) => Number(r[0]?.count ?? 0)),
  ]);

  return {
    following: await followingPromise,
    followerCount,
    followingCount,
  };
}

/**
 * Get the list of users a given user follows (for "Following" tab on profile).
 */
export async function getFollowingList(
  userId: string,
  limit = 50,
  offset = 0,
) {
  return db
    .select({
      followingId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(eq(follows.followerId, userId))
    .orderBy(sql`${follows.createdAt} DESC`)
    .limit(limit)
    .offset(offset);
}

/**
 * Get the list of followers for a user.
 */
export async function getFollowersList(
  userId: string,
  limit = 50,
  offset = 0,
) {
  return db
    .select({
      followerId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(eq(follows.followingId, userId))
    .orderBy(sql`${follows.createdAt} DESC`)
    .limit(limit)
    .offset(offset);
}