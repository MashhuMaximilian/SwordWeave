// =============================================================================
// GET /api/library — browse the public library with sort + filter
// Query params:
//   targetType: PRIMITIVE | CAPABILITY | LINEAGE_TEMPLATE | ...
//   category: primitive category
//   authorUsername: filter by author
//   visibility: PUBLIC (default) | FOLLOWERS_ONLY
//   minLikes: integer
//   hasForks: 0 | 1
//   sort: LIKES | RECENT | FORKS | ALPHABETICAL (default LIKES)
//   limit: 1-100 (default 24)
//   offset: integer (default 0)
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { queryLibrary } from "@/lib/publishing/library-query";

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  let viewerId: string | undefined;
  if (clerkUserId) {
    const user = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
      columns: { id: true },
    });
    viewerId = user?.id;
  }

  const sp = req.nextUrl.searchParams;
  const targetType = sp.get("targetType") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const search = sp.get("q") ?? sp.get("search") ?? undefined;
  const authorUsername = sp.get("authorUsername") ?? undefined;
  const minLikesRaw = sp.get("minLikes");
  const minLikes = minLikesRaw ? parseInt(minLikesRaw, 10) : undefined;
  const hasForks = sp.get("hasForks") === "1";
  const sort = (sp.get("sort") as
    | "LIKES"
    | "RECENT"
    | "FORKS"
    | "ALPHABETICAL"
    | null) ?? "LIKES";
  const limit = Math.min(parseInt(sp.get("limit") ?? "24", 10) || 24, 100);
  const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;

  try {
    const result = await queryLibrary({
      ...(targetType ? { targetType: targetType as never } : {}),
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      ...(authorUsername ? { authorUsername } : {}),
      ...(minLikes !== undefined ? { minLikes } : {}),
      hasForks,
      sort,
      limit,
      offset,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[library] error:", err);
    return NextResponse.json(
      { error: "Failed to query library" },
      { status: 500 },
    );
  }
}