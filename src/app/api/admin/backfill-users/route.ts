// =============================================================================
// POST /api/admin/backfill-users — emergency safety net.
//
// When Clerk fires user.created webhook events but our endpoint fails
// signature verification (e.g. signing secret mismatch between Clerk
// dashboard and Vercel env vars), no `users` row gets created in the
// DB. Without a `users` row, SwordWeave pages that join against
// users (creations page, sandbox ledgers) silently return empty.
//
// This endpoint:
//   - Accepts an optional `clerkUserIds` array OR queries Clerk via
//     the live Clerk SDK to find recently-created users missing a DB row.
//   - Creates a `users` row for each, using Clerk's username + display name.
//   - Returns a summary of created/skipped rows.
//
// Auth: requires ADMIN_API_SECRET in `x-admin-secret` header OR
//        CRON_SECRET in `Authorization: Bearer ...` header.
//
// Usage:
//   curl -X POST https://swordweave.quest/api/admin/backfill-users \
//     -H "x-admin-secret: <ADMIN_API_SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"clerkUserIds":["user_xxx","user_yyy"]}'
//
// Or dry-run:
//   curl -X POST 'https://swordweave.quest/api/admin/backfill-users?dryRun=1' \
//     -H "x-admin-secret: <ADMIN_API_SECRET>"
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";
import { inArray } from "drizzle-orm";
import { checkAdminAuth } from "@/lib/admin-auth";
import { createProfileFromClerk } from "@/lib/profiles/lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BackfillResult {
  dryRun: boolean;
  scanned: number;
  created: number;
  skipped: number;
  errors: Array<{ clerkUserId: string; error: string }>;
  details: Array<{
    clerkUserId: string;
    action: "created" | "skipped" | "error";
    userId?: string | undefined;
    reason?: string | undefined;
  }>;
}

export async function POST(req: NextRequest): Promise<Response> {
  const { isAdmin, reason } = checkAdminAuth(req);
  if (!isAdmin) return NextResponse.json({ error: reason }, { status: 401 });

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  // Body: either explicit list of Clerk user IDs OR omitted to scan all.
  let explicitIds: string[] | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && Array.isArray(body.clerkUserIds)) {
      explicitIds = body.clerkUserIds.filter((x: unknown) => typeof x === "string");
    }
  } catch {
    // no body — scan all
  }

  const details: BackfillResult["details"] = [];
  const errors: BackfillResult["errors"] = [];

  // Step 1: gather candidate Clerk user IDs
  let candidateIds: string[] = [];
  if (explicitIds && explicitIds.length > 0) {
    candidateIds = explicitIds;
  } else {
    // Scan Clerk for all users, then cross-reference DB
    let list;
    try {
      const cc = await clerkClient();
      list = await cc.users.getUserList({ limit: 100 });
    } catch (e) {
      return NextResponse.json(
        { error: "failed to list Clerk users", detail: e instanceof Error ? e.message : String(e) },
        { status: 502 },
      );
    }
    candidateIds = list.data.map((u: { id: string }) => u.id);
  }

  // Step 2: find which already have a DB row
  const existingRows = candidateIds.length > 0
    ? await db
        .select({ clerkUserId: users.clerkUserId })
        .from(users)
        .where(inArray(users.clerkUserId, candidateIds))
    : [];
  const existingIds = new Set(existingRows.map((r) => r.clerkUserId));

  // Step 3: for each missing one, fetch from Clerk and create DB row
  let created = 0;
  let skipped = 0;

  for (const clerkUserId of candidateIds) {
    if (existingIds.has(clerkUserId)) {
      skipped++;
      details.push({ clerkUserId, action: "skipped", reason: "already in db" });
      continue;
    }

    if (dryRun) {
      details.push({ clerkUserId, action: "skipped", reason: "dryRun (would create)" });
      continue;
    }

    try {
      const cc = await clerkClient();
      const clerkUser = await cc.users.getUser(clerkUserId);
      const username = clerkUser.username ?? `user_${clerkUserId.slice(-8)}`;
      const displayName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
      const avatarUrl = clerkUser.imageUrl || null;

      const result = await createProfileFromClerk({
        clerkUserId,
        username,
        displayName,
        avatarUrl,
      });

      if (result.ok) {
        created++;
        details.push({ clerkUserId, action: "created", userId: result.userId ?? undefined });
      } else {
        errors.push({
          clerkUserId,
          error: `${result.error ?? "unknown"}: ${result.errorMessage ?? ""}`,
        });
        details.push({
          clerkUserId,
          action: "error",
          reason: result.errorMessage ?? result.error ?? "unknown",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ clerkUserId, error: msg });
      details.push({ clerkUserId, action: "error", reason: msg });
    }
  }

  const result: BackfillResult = {
    dryRun,
    scanned: candidateIds.length,
    created,
    skipped,
    errors,
    details,
  };
  return NextResponse.json(result);
}

/**
 * GET — return a summary of users in Clerk that are missing from DB.
 * Useful for "what would I backfill right now?" checks.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { isAdmin, reason } = checkAdminAuth(req);
  if (!isAdmin) return NextResponse.json({ error: reason }, { status: 401 });

  let list;
  try {
    const cc = await clerkClient();
    list = await cc.users.getUserList({ limit: 100 });
  } catch (e) {
    return NextResponse.json(
      { error: "failed to list Clerk users", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  const clerkIds = list.data.map((u: { id: string }) => u.id);
  const dbRows = clerkIds.length > 0
    ? await db
        .select({ clerkUserId: users.clerkUserId, username: users.username, isAnonymized: users.isAnonymized })
        .from(users)
        .where(inArray(users.clerkUserId, clerkIds))
    : [];
  const dbByClerk = new Map(dbRows.map((r) => [r.clerkUserId, r]));

  const missing: Array<{ clerkUserId: string; username: string | null }> = [];
  const present: Array<{ clerkUserId: string; username: string; isAnonymized: boolean }> = [];
  for (const u of list.data as Array<{ id: string; username: string | null }>) {
    const dbRow = dbByClerk.get(u.id);
    if (!dbRow) missing.push({ clerkUserId: u.id, username: u.username });
    else present.push({ clerkUserId: u.id, username: dbRow.username, isAnonymized: dbRow.isAnonymized });
  }

  return NextResponse.json({
    clerkTotal: list.data.length,
    dbPresent: present.length,
    missingFromDb: missing,
  });
}
