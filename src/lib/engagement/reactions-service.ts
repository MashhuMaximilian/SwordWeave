// =============================================================================
// Reactions service — Phase 5 Commit C
//
// User reactions (like / dislike) on any published target. Own content
// reactions are allowed per project policy. Reactions are version-pinned:
// each row targets a specific (type, id, versionId) tuple. We allow users
// to have one reaction per tuple; switching kinds toggles the row.
//
// Aggregates are updated atomically via UPSERT into reaction_aggregates.
//
// Reactions on private content are NOT allowed (target must be public via
// isPublic OR a publications row).
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  reactions,
  reactionAggregates,
  type publishTargetTypeEnum,
} from "@/db/schema";

export type ReactionKind = "LIKE" | "DISLIKE";
export type ReactionTargetType =
  (typeof publishTargetTypeEnum.enumValues)[number];

export interface ReactionInput {
  userId: string; // internal UUID
  targetType: ReactionTargetType;
  targetId: string;
  versionId: string; // For unpublished targets, callers can pass a stable
                     // virtual versionId like "v0" — but the schema requires
                     // a UUID. We'll resolve it in the API layer.
  kind: ReactionKind;
}

export interface ReactionResult {
  liked: boolean;
  disliked: boolean;
  likesCount: number;
  dislikesCount: number;
}

/**
 * Set the user's reaction on a target. If the user already has a reaction
 * of a different kind, it flips. If the same kind, it removes (toggle off).
 * Updates the denormalized aggregate atomically.
 */
export async function setReaction(input: ReactionInput): Promise<ReactionResult> {
  const { userId, targetType, targetId, versionId, kind } = input;

  return db.transaction(async (tx) => {
    // Look up existing reaction
    const existing = await tx.query.reactions.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, userId),
          eq(table.targetType, targetType),
          eq(table.targetId, targetId),
          eq(table.versionId, versionId),
        ),
    });

    let likedDelta = 0;
    let dislikedDelta = 0;

    if (existing && existing.kind === kind) {
      // Toggle off
      await tx.delete(reactions).where(eq(reactions.id, existing.id));
      if (kind === "LIKE") likedDelta = -1;
      else dislikedDelta = -1;
    } else if (existing) {
      // Switch kind
      await tx
        .update(reactions)
        .set({ kind })
        .where(eq(reactions.id, existing.id));
      if (kind === "LIKE") {
        likedDelta = 1;
        dislikedDelta = -1;
      } else {
        likedDelta = -1;
        dislikedDelta = 1;
      }
    } else {
      // New reaction
      await tx.insert(reactions).values({
        userId,
        targetType,
        targetId,
        versionId,
        kind,
      });
      if (kind === "LIKE") likedDelta = 1;
      else dislikedDelta = 1;
    }

    // Update aggregate atomically
    const [agg] = await tx
      .insert(reactionAggregates)
      .values({
        targetType,
        targetId,
        versionId,
        likesCount: Math.max(0, likedDelta),
        dislikesCount: Math.max(0, dislikedDelta),
      })
      .onConflictDoUpdate({
        target: [
          reactionAggregates.targetType,
          reactionAggregates.targetId,
          reactionAggregates.versionId,
        ],
        set: {
          likesCount: sql`GREATEST(0, ${reactionAggregates.likesCount} + ${likedDelta})`,
          dislikesCount: sql`GREATEST(0, ${reactionAggregates.dislikesCount} + ${dislikedDelta})`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({
        likesCount: reactionAggregates.likesCount,
        dislikesCount: reactionAggregates.dislikesCount,
      });

    return {
      liked: kind === "LIKE",
      disliked: kind === "DISLIKE",
      likesCount: Number(agg?.likesCount ?? 0),
      dislikesCount: Number(agg?.dislikesCount ?? 0),
    };
  });
}

/**
 * Remove the user's reaction on a target (no-op if none).
 */
export async function removeReaction(input: {
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  versionId: string;
}): Promise<ReactionResult> {
  const { userId, targetType, targetId, versionId } = input;

  return db.transaction(async (tx) => {
    const existing = await tx.query.reactions.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, userId),
          eq(table.targetType, targetType),
          eq(table.targetId, targetId),
          eq(table.versionId, versionId),
        ),
    });

    if (!existing) {
      const agg = await tx.query.reactionAggregates.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.targetType, targetType),
            eq(table.targetId, targetId),
            eq(table.versionId, versionId),
          ),
      });
      return {
        liked: false,
        disliked: false,
        likesCount: Number(agg?.likesCount ?? 0),
        dislikesCount: Number(agg?.dislikesCount ?? 0),
      };
    }

    let likesDelta = 0;
    let dislikesDelta = 0;
    if (existing.kind === "LIKE") likesDelta = -1;
    else dislikesDelta = -1;

    await tx.delete(reactions).where(eq(reactions.id, existing.id));

    const [agg] = await tx
      .insert(reactionAggregates)
      .values({
        targetType,
        targetId,
        versionId,
        likesCount: Math.max(0, likesDelta),
        dislikesCount: Math.max(0, dislikesDelta),
      })
      .onConflictDoUpdate({
        target: [
          reactionAggregates.targetType,
          reactionAggregates.targetId,
          reactionAggregates.versionId,
        ],
        set: {
          likesCount: sql`GREATEST(0, ${reactionAggregates.likesCount} + ${likesDelta})`,
          dislikesCount: sql`GREATEST(0, ${reactionAggregates.dislikesCount} + ${dislikesDelta})`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({
        likesCount: reactionAggregates.likesCount,
        dislikesCount: reactionAggregates.dislikesCount,
      });

    return {
      liked: false,
      disliked: false,
      likesCount: Number(agg?.likesCount ?? 0),
      dislikesCount: Number(agg?.dislikesCount ?? 0),
    };
  });
}

/**
 * Get aggregate counts for a target+version.
 */
export async function getReactionAggregate(
  targetType: ReactionTargetType,
  targetId: string,
  versionId: string,
): Promise<{ likes: number; dislikes: number }> {
  const row = await db.query.reactionAggregates.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.targetType, targetType),
        eq(table.targetId, targetId),
        eq(table.versionId, versionId),
      ),
  });
  return {
    likes: Number(row?.likesCount ?? 0),
    dislikes: Number(row?.dislikesCount ?? 0),
  };
}

/**
 * Get the user's current reaction on a target+version (null if none).
 */
export async function getUserReaction(
  userId: string,
  targetType: ReactionTargetType,
  targetId: string,
  versionId: string,
): Promise<ReactionKind | null> {
  const row = await db.query.reactions.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.userId, userId),
        eq(table.targetType, targetType),
        eq(table.targetId, targetId),
        eq(table.versionId, versionId),
      ),
    columns: { kind: true },
  });
  return row?.kind ?? null;
}