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
//   - targetType: PRIMITIVE | CAPABILITY | EFFECT | ITEM | RACE_TEMPLATE | etc.
//   - targetId:   the row's id (number-as-string for primitives, UUID for the rest)
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reactions } from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

const VALID_TARGET_TYPES = [
  "PRIMITIVE",
  "CAPABILITY",
  "EFFECT",
  "ITEM",
  "CHARACTER",
  "RACE_TEMPLATE",
  "BACKGROUND_TEMPLATE",
  "ARCHETYPE_TEMPLATE",
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
    return NextResponse.json(
      { error: "targetType and targetId are required." },
      { status: 400 },
    );
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({
      userReaction: null,
      currentUserInternalId: null,
    });
  }

  const currentUserInternalId = await resolveUserIdByClerkId(clerkUserId);
  if (!currentUserInternalId) {
    return NextResponse.json({
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
      ),
    )
    .limit(1);

  // If we have a reaction, also surface the user's internal id so the
  // LikeForkBar can decide whether to show the follow button.
  return NextResponse.json({
    userReaction: rows[0]?.kind ?? null,
    currentUserInternalId,
  });
}
