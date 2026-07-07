// =============================================================================
// DEBUG-ONLY: /api/debug/page-context
//
// Returns diagnostic info about the runtime context for /library/item/[id]:
//   - process.env.DATABASE_URL presence
//   - Clerk auth state
//   - DB query attempt result
//   - Request headers that matter
//
// Used to diagnose why the source page errors with "DATABASE_URL required"
// for browser requests but not for curl with no headers.
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const result: Record<string, unknown> = {
    debug: true,
    route: "/api/debug/page-context",
    env: {
      DATABASE_URL_present: Boolean(process.env["DATABASE_URL"]),
      DATABASE_URL_length: process.env["DATABASE_URL"]?.length ?? 0,
      DATABASE_URL_prefix: process.env["DATABASE_URL"]?.slice(0, 25) ?? null,
      NODE_ENV: process.env["NODE_ENV"] ?? null,
      VERCEL_ENV: process.env["VERCEL_ENV"] ?? null,
    },
    ["clerk" as string]: null,
    ["dbProbe" as string]: null,
  };

  // Probe Clerk auth
  try {
    const a = await auth();
    result["clerk"] = { userId: a.userId, sessionId: a.sessionId };
  } catch (e: unknown) {
    result["clerk"] = { error: e instanceof Error ? e.message : String(e) };
  }

  // Probe DB with a trivial query
  try {
    const rows = await db.execute("SELECT 1 as ok");
    result["dbProbe"] = { ok: true, rows: (rows as unknown as { rows?: unknown[] }).rows?.length ?? "n/a" };
  } catch (e: unknown) {
    result["dbProbe"] = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      errorName: e instanceof Error ? e.name : null,
    };
  }

  // Probe Drizzle-style query against reaction_aggregates (same path the page uses)
  try {
    const { sql: drizzleSql, eq } = await import("drizzle-orm");
    const { reactionAggregates } = await import("@/db/schema");
    const r = await db
      .select({ likes: drizzleSql<number>`SUM(${reactionAggregates.likesCount})::int` })
      .from(reactionAggregates)
      .where(eq(reactionAggregates.targetType, "PRIMITIVE" as never))
      .limit(1);
    result["drizzleProbe"] = { ok: true, rowCount: r.length, sample: r[0] ?? null };
  } catch (e: unknown) {
    result["drizzleProbe"] = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      errorName: e instanceof Error ? e.name : null,
    };
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
