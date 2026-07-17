/**
 * POST /api/users/sync
 *
 * Idempotently creates or updates the current Clerk user's SwordWeave profile.
 *
 * Use case: webhooks sometimes miss events (delivery failures, env misconfig,
 * race conditions during initial deploy). This endpoint is the "self-healing"
 * path — the user can hit it from /settings/profile or any post-login page
 * to ensure their profile exists.
 *
 * Auth: requires Clerk session. Reads clerkUserId from the session token.
 *
 * Body: { username?: string }  — optional. If provided, used as the new
 *   username (validated + reserved-check). If absent, Clerk's current username
 *   is used.
 *
 * Behavior:
 *   - Profile exists, username unchanged: 200 { ok: true, action: "noop" }
 *   - Profile exists, username changed: 200 { ok: true, action: "renamed" }
 *   - Profile missing, username provided/available: 200 { ok: true, action: "created" }
 *   - Profile missing, no username: 400 { ok: false, error: "USERNAME_REQUIRED" }
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";
import {
  createProfileFromClerk,
  renameUsername,
} from "@/lib/profiles/lookup";
import { validateUsername } from "@/lib/profiles/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  // Read optional username override from body
  let requestedUsername: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.username === "string") {
      requestedUsername = body.username;
    }
  } catch {
    // Empty body is fine — we'll fall back to Clerk's current username
  }

  // Pull current Clerk user for fresh display name + avatar
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json(
      { ok: false, error: "CLERK_USER_LOOKUP_FAILED" },
      { status: 502 },
    );
  }

  const clerkUsername = clerkUser.username ?? "";
  const username = requestedUsername ?? clerkUsername ?? "";

  // Check if profile already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
    columns: { id: true, username: true },
  });

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
  const avatarUrl = clerkUser.imageUrl || null;
  // Phase 7.10 system-user rule: read Clerk publicMetadata.role === "admin".
  // Admins' authored canon rows render as "System" in the library UI.
  const clerkRole = (clerkUser.publicMetadata as { role?: string } | null)?.role;
  const isAdmin = clerkRole === "admin";

  // Validate username (skip if updating an existing profile without change)
  if (username) {
    const validation = validateUsername(username);
    if (!validation.valid || !validation.normalized) {
      return NextResponse.json(
        {
          ok: false,
          error: validation.error ?? "INVALID_USERNAME",
          errorMessage: validation.errorMessage ?? "Invalid username.",
        },
        { status: 400 },
      );
    }
  }

  // Existing profile — handle update path
  if (existing) {
    if (username && existing.username !== username.toLowerCase()) {
      const result = await renameUsername(existing.id, username);
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, errorMessage: result.errorMessage },
          { status: result.error === "USERNAME_TAKEN" ? 409 : 400 },
        );
      }
    }
    await db
      .update(users)
      .set({ displayName, avatarUrl, isAdmin })
      .where(eq(users.id, existing.id));
    return NextResponse.json({
      ok: true,
      action: "updated",
      username: existing.username,
    });
  }

  // No profile yet — create
  if (!username) {
    return NextResponse.json(
      {
        ok: false,
        error: "USERNAME_REQUIRED",
        errorMessage: "Set a username in Clerk first, then call /api/users/sync.",
      },
      { status: 400 },
    );
  }

  const result = await createProfileFromClerk({
    clerkUserId,
    username,
    displayName,
    avatarUrl,
    isAdmin,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, errorMessage: result.errorMessage },
      { status: result.error === "USERNAME_TAKEN" ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    action: "created",
    userId: result.userId,
    username: username.toLowerCase(),
  });
}