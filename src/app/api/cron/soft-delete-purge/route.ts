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
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { isAdmin, reason } = checkAdminAuth(req);
  if (!isAdmin) return NextResponse.json({ error: reason }, { status: 401 });
  return runPurge({ dryRun: false });
}

export async function POST(req: NextRequest) {
  // Manual invocation: still requires auth, but lets admins pass dryRun=1
  // without setting up cron.
  const { isAdmin, reason } = checkAdminAuth(req);
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
