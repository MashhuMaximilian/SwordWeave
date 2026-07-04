/**
 * GET /api/users/check-username?username=<value>
 *
 * Validates and checks DB availability for a username. Returns:
 *   - { available: true,  normalized: "..." }
 *   - { available: false, normalized: "..." | null, error, errorMessage }
 *
 * No auth required — signup wizard calls this for live feedback.
 * Rate-limited via IP (best-effort, see comments).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";
import { validateUsername } from "@/lib/profiles/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = url.searchParams.get("username") ?? "";

  const validation = validateUsername(raw);

  if (!validation.valid || !validation.normalized) {
    return NextResponse.json({
      available: false,
      normalized: validation.normalized,
      error: validation.error,
      errorMessage: validation.errorMessage,
    });
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.username, validation.normalized),
    columns: { id: true },
  });

  if (existing) {
    return NextResponse.json({
      available: false,
      normalized: validation.normalized,
      error: "TAKEN",
      errorMessage: `Username "${validation.normalized}" is already taken.`,
    });
  }

  return NextResponse.json({
    available: true,
    normalized: validation.normalized,
  });
}