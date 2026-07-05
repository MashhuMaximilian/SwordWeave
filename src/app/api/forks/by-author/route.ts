// =============================================================================
// GET /api/forks/by-author?username=X  (or ?clerkId=X)
//
// Public read endpoint — no auth required. Returns all forks created BY the
// given user (the forker). Used on /u/[username] profile pages.
//
// At least one of `username` or `clerkId` must be provided.
//
// Response:
// { forks: ForkEntry[] }
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listByForker } from "@/lib/publishing/forks-query";

const QuerySchema = z
  .object({
    username: z.string().min(1).max(64).optional(),
    clerkId: z.string().min(1).max(128).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine((q) => Boolean(q.username || q.clerkId), {
    message: "Provide `username` or `clerkId`",
  });

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);

  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    let clerkUserId: string | null = parsed.data.clerkId ?? null;

    // Resolve username → Clerk ID if needed
    if (!clerkUserId && parsed.data.username) {
      const row = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.username, parsed.data.username!),
        columns: { clerkUserId: true },
      });
      if (!row?.clerkUserId) {
        return NextResponse.json({ forks: [] });
      }
      clerkUserId = row.clerkUserId;
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    const forks = await listByForker(
      clerkUserId,
      parsed.data.limit ?? 20,
    );
    return NextResponse.json({ forks });
  } catch (err) {
    console.error("[forks/by-author] query failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}