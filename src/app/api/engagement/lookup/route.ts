// =============================================================================
// GET /api/engagement/lookup
//
// Returns the signed-in user's reaction on a given (targetType, targetId),
// plus their internal user ID. Used by the sandbox previews so the
// LikeForkBar can render in the right state without an extra round trip.
//
// The user can be unauthenticated; we just return nulls in that case.
//
// Query params:
//   - targetType: PRIMITIVE | CAPABILITY | EFFECT | ITEM | LINEAGE_TEMPLATE | etc.
//   - targetId:   the row's id (number-as-string for primitives, UUID for the rest)
// =============================================================================

import { privateJson as NextResponseJson } from "@/lib/http/private-json";
import { visibleEntries } from "@/lib/collections/service";
import {loadLibraryFlagCounts} from "@/lib/engagement/library-flag-counts";
import {resolveVirtualVersionId} from "@/lib/engagement/version-helpers";
import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { forkAggregates, reactionAggregates, reactions } from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

const VALID_TARGET_TYPES = [
  "MONSTER",
  "ENCOUNTER",
  "COLLECTION",
  "PRIMITIVE",
  "CAPABILITY",
  "EFFECT",
  "ITEM",
  "CHARACTER",
  "LINEAGE_TEMPLATE",
  "UPBRINGING_TEMPLATE",
  "MANIFEST_TEMPLATE",
  "BUILD_TEMPLATE",
] as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");

  if (
    !targetType ||
    !targetId ||
    !(VALID_TARGET_TYPES as readonly string[]).includes(targetType)
  ) {
    return NextResponseJson(
      { error: "targetType and targetId are required." },
      { status: 400 },
    );
  }

  const { userId: clerkUserId } = await auth();
  if (!(await visibleEntries([{targetType,targetId}],clerkUserId)).length) return NextResponseJson({error:"Not found"},{status:404});
  const [reactionTotals, forkTotals, flagCounts] = await Promise.all([
    db
      .select({
        likes: sql<number>`COALESCE(SUM(${reactionAggregates.likesCount}), 0)::int`,
        dislikes: sql<number>`COALESCE(SUM(${reactionAggregates.dislikesCount}), 0)::int`,
      })
      .from(reactionAggregates)
      .where(and(
        eq(reactionAggregates.targetType, targetType as (typeof VALID_TARGET_TYPES)[number]),
        eq(reactionAggregates.targetId, targetId),
      )),
    db
      .select({ forks: sql<number>`COALESCE(SUM(${forkAggregates.forkCount}), 0)::int` })
      .from(forkAggregates)
      .where(and(
        eq(forkAggregates.sourceTargetType, targetType as (typeof VALID_TARGET_TYPES)[number]),
        eq(forkAggregates.sourceTargetId, targetId),
      )),
    loadLibraryFlagCounts([{id:`${targetType}:${targetId}`,targetType:targetType as (typeof VALID_TARGET_TYPES)[number],targetId}]),
  ]);
  const counts = {
    flags:flagCounts.get(`${targetType}:${targetId}`)??0,
    likes: Number(reactionTotals[0]?.likes ?? 0),
    dislikes: Number(reactionTotals[0]?.dislikes ?? 0),
    forks: Number(forkTotals[0]?.forks ?? 0),
  };
  if (!clerkUserId) {
    return NextResponseJson({
      ...counts,
      userReaction: null,
      currentUserInternalId: null,
    });
  }

  const currentUserInternalId = await resolveUserIdByClerkId(clerkUserId);
  if (!currentUserInternalId) {
    return NextResponseJson({
      ...counts,
      userReaction: null,
      currentUserInternalId: null,
    });
  }

  // Look up the most recent reaction by this user on this target.
  // The reactions table is version-pinned (unique on user_id+target+version),
  // so we fetch all matching rows and pick the latest.
  const rows = await db
    .select({ kind: reactions.kind, versionId: reactions.versionId })
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, currentUserInternalId),
        eq(reactions.targetType, targetType as (typeof VALID_TARGET_TYPES)[number]),
        eq(reactions.targetId, targetId),
        ...(targetType === "COLLECTION" || targetType === "ENCOUNTER" ? [eq(reactions.versionId,resolveVirtualVersionId(targetType,targetId))] : []),
      ),
    )
    .limit(1);

  // If we have a reaction, also surface the user's internal id so the
  // LikeForkBar can decide whether to show the follow button.
  return NextResponseJson({
    ...counts,
    userReaction: rows[0]?.kind ?? null,
    currentUserInternalId,
  });
}
