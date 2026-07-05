// =============================================================================
// Cron route — runs the soft-delete purge.
// Finds users whose 30-day grace period has expired and anonymizes them.
//
// Two modes:
// - GET /api/cron/soft-delete-purge (default)  → uses CRON_SECRET from header
//   for Vercel cron invocations.
// - Manual mode: POST /api/cron/soft-delete-purge?dryRun=1  → returns list
//   of users that WOULD be purged without anonymizing.
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import {
  anonymizeUser,
  findUsersReadyForPurge,
} from "@/lib/profiles/lookup";

// Vercel cron sends an Authorization header with the cron secret.
function verifyCronSecret(req: NextRequest): boolean {
  const expected = process.env["CRON_SECRET"];
  if (!expected) {
    // No secret configured → reject. Don't allow open access.
    return false;
  }
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return provided === expected;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runPurge({ dryRun: false });
}

export async function POST(req: NextRequest) {
  // Manual invocation: still requires auth, but lets admins pass dryRun=1
  // without setting up cron.
  const { isAdmin, reason } = await checkAdminAuth(req);
  if (!isAdmin) {
    return NextResponse.json({ error: reason }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  return runPurge({ dryRun });
}

interface PurgeResult {
  dryRun: boolean;
  scanned: number;
  anonymized: number;
  errors: Array<{ userId: string; error: string }>;
}

async function runPurge({ dryRun }: { dryRun: boolean }): Promise<NextResponse> {
  const now = new Date();
  const candidates = await findUsersReadyForPurge(now);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      scanned: candidates.length,
      wouldAnonymize: candidates.map((c) => ({ id: c.id, username: c.username })),
    });
  }

  const errors: Array<{ userId: string; error: string }> = [];
  let anonymized = 0;

  for (const c of candidates) {
    try {
      const result = await anonymizeUser(c.id);
      if (result.ok) anonymized++;
      else
        errors.push({
          userId: c.id,
          error: result.anonymizedUsername ? "noop" : "anonymize returned !ok",
        });
    } catch (e) {
      errors.push({
        userId: c.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const result: PurgeResult = {
    dryRun: false,
    scanned: candidates.length,
    anonymized,
    errors,
  };
  return NextResponse.json(result);
}

/**
 * Lightweight admin check: only allow cron-secret header OR explicit admin
 * environment variable. We don't gate this on Clerk roles yet — this endpoint
 * is intentionally minimal until Phase 6 (admin tools) lands.
 */
async function checkAdminAuth(
  req: NextRequest,
): Promise<{ isAdmin: boolean; reason: string }> {
  // Method 1: cron secret
  if (verifyCronSecret(req)) return { isAdmin: true, reason: "" };
  // Method 2: explicit admin secret header (for manual invocation by Mashu)
  const adminSecret = process.env["ADMIN_API_SECRET"];
  const provided = req.headers.get("x-admin-secret");
  if (adminSecret && provided === adminSecret) {
    return { isAdmin: true, reason: "" };
  }
  return { isAdmin: false, reason: "missing or invalid admin credentials" };
}