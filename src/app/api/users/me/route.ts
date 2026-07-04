/**
 * GET /api/users/me
 *
 * Returns the current viewer's SwordWeave profile. Used by the UserMenu
 * component to render a fresh display name + avatar (Clerk's session data
 * is stale until the user reloads). Also used by other client components
 * that need lightweight "who am I" access without a full page render.
 *
 * Auth: requires Clerk session.
 *
 * Response: 200 { username, displayName, avatarUrl } | 401
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const row = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: {
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  });
}