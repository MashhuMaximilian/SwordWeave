// =============================================================================
// POST /api/follows — follow a user
// DELETE /api/follows?targetUserId=<uuid> — unfollow a user
// GET /api/follows?targetUserId=<uuid> — get counts + (if authed) follow status
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { follows } from "@/db/schema";
import {
  followUser,
  unfollowUser,
  getFollowCounts,
} from "@/lib/engagement/follows-service";

const FollowSchema = z.object({
  targetUserId: z.string().uuid(),
});

async function resolveUser(clerkUserId: string) {
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
  });
  return user ?? null;
}

async function getPublicFollowCounts(targetUserId: string) {
  const [follower] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, targetUserId));
  const [following] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, targetUserId));
  return {
    followerCount: Number(follower?.count ?? 0),
    followingCount: Number(following?.count ?? 0),
  };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = FollowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await followUser({
      followerUserId: user.id,
      followingUserId: parsed.data.targetUserId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[follows POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("targetUserId");
  if (!targetUserId) {
    return NextResponse.json(
      { error: "targetUserId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await unfollowUser({
      followerUserId: user.id,
      followingUserId: targetUserId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[follows DELETE] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("targetUserId");
  if (!targetUserId) {
    return NextResponse.json(
      { error: "targetUserId is required" },
      { status: 400 },
    );
  }

  try {
    const { userId: clerkUserId } = await auth();
    let currentUserId: string | null = null;
    if (clerkUserId) {
      const user = await resolveUser(clerkUserId);
      currentUserId = user?.id ?? null;
    }

    if (currentUserId) {
      const result = await getFollowCounts(currentUserId, targetUserId);
      return NextResponse.json({ ok: true, ...result });
    }

    const counts = await getPublicFollowCounts(targetUserId);
    return NextResponse.json({ ok: true, following: false, ...counts });
  } catch (err) {
    console.error("[follows GET] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}