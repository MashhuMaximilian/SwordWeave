import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  follows,
  userStats,
  usernameHistory,
  users,
} from "@/db/schema/profiles";

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: {
    twitter?: string;
    mastodon?: string;
    bluesky?: string;
    discord?: string;
    website?: string;
    itch?: string;
    instagram?: string;
    youtube?: string;
    drivethrurpg?: string;
    patreon?: string;
    buymeacoffee?: string;
  };
  isAnonymized: boolean;
  createdAt: Date;
  stats: {
    publicPrimitives: number;
    publicCapabilities: number;
    publicCharacters: number;
    publicItems: number;
    publicRaces: number;
    publicBackgrounds: number;
    publicArchetypes: number;
    totalForksReceived: number;
    totalLikesReceived: number;
    totalDislikesReceived: number;
    followersCount: number;
    followingCount: number;
  };
  // Set only when the viewer is logged in
  viewerIsFollowing: boolean;
  // Set only when the viewer is the owner
  isOwner: boolean;
}

/**
 * Load a public profile by username, following username_history redirects.
 * Returns null if the username has never existed.
 */
export async function loadProfileByUsername(
  rawUsername: string,
  viewerClerkId: string | null,
): Promise<PublicProfile | null> {
  const username = rawUsername.trim().toLowerCase();
  if (!username) return null;

  // Direct lookup
  let profile = await db.query.users.findFirst({
    where: and(
      eq(users.username, username),
      // Don't show deleted/anonymized profiles publicly
      // (we still resolve the username to allow "user not found" UX,
      // but we hide the row)
    ),
    with: { stats: true },
  });

  // Walk history if direct miss
  if (!profile) {
    const histRow = await db.query.usernameHistory.findFirst({
      where: eq(usernameHistory.oldUsername, username),
      columns: { userId: true, newUsername: true },
    });
    if (histRow) {
      profile = await db.query.users.findFirst({
        where: eq(users.id, histRow.userId),
        with: { stats: true },
      });
    }
  }

  if (!profile || profile.isAnonymized || profile.deletedAt) {
    return null;
  }

  // Determine owner/follower status if viewer is logged in
  let viewerUserId: string | null = null;
  if (viewerClerkId) {
    const viewer = await db.query.users.findFirst({
      where: eq(users.clerkUserId, viewerClerkId),
      columns: { id: true },
    });
    viewerUserId = viewer?.id ?? null;
  }

  const isOwner = viewerUserId !== null && viewerUserId === profile.id;
  let viewerIsFollowing = false;
  if (viewerUserId && !isOwner) {
    const followRow = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, viewerUserId),
        eq(follows.followingId, profile.id),
      ),
    });
    viewerIsFollowing = !!followRow;
  }

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    socialLinks: (profile.socialLinks as PublicProfile["socialLinks"]) ?? {},
    isAnonymized: profile.isAnonymized,
    createdAt: profile.createdAt,
    stats: {
      publicPrimitives: profile.stats?.publicPrimitives ?? 0,
      publicCapabilities: profile.stats?.publicCapabilities ?? 0,
      publicCharacters: profile.stats?.publicCharacters ?? 0,
      publicItems: profile.stats?.publicItems ?? 0,
      publicRaces: profile.stats?.publicRaces ?? 0,
      publicBackgrounds: profile.stats?.publicBackgrounds ?? 0,
      publicArchetypes: profile.stats?.publicArchetypes ?? 0,
      totalForksReceived: profile.stats?.totalForksReceived ?? 0,
      totalLikesReceived: profile.stats?.totalLikesReceived ?? 0,
      totalDislikesReceived: profile.stats?.totalDislikesReceived ?? 0,
      followersCount: profile.stats?.followersCount ?? 0,
      followingCount: profile.stats?.followingCount ?? 0,
    },
    viewerIsFollowing,
    isOwner,
  };
}