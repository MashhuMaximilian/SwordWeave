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
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { loadLibraryEngagement } from "@/lib/engagement/library-engagement";
import { applyViewerEngagement } from "@/lib/engagement/library-viewer-state";
import { parseSort, parseType } from "@/lib/library-url-params";
import { queryLibrary } from "@/lib/publishing/library-query";

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  const sp = req.nextUrl.searchParams;
  const targetType = sp.get("targetType") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const search = sp.get("q") ?? sp.get("search") ?? undefined;
  const authorUsername = sp.get("authorUsername") ?? undefined;
  const minLikesRaw = sp.get("minLikes");
  const minLikes = minLikesRaw ? parseInt(minLikesRaw, 10) : undefined;
  const hasForks = sp.get("hasForks") === "1";
  const sort = parseSort(sp.get("sort"));
  const number = (key: string) => { const raw = sp.get(key); const value = Number(raw); return raw !== null && raw.trim() !== "" && Number.isFinite(value) && (!key.toLowerCase().includes("magnitude") ? value >= 0 : true) ? value : undefined; };
  const date = (key: string) => { const raw = sp.get(key); return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(raw)) ? raw : undefined; };
  const limit = Math.min(parseInt(sp.get("limit") ?? "24", 10) || 24, 100);
  const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;
  const origin = sp.get("origin");
  const tier = sp.get("tier");

  try {
    const result = await queryLibrary({
      ...(clerkUserId ? { viewerClerkId: clerkUserId } : {}),
      ...(origin === "system" || origin === "community" ? { origin } : {}),
      ...(tier !== null && tier !== "" && Number.isInteger(Number(tier)) && Number(tier) >= 0 ? { tier: Number(tier) } : {}),
      ...(targetType && parseType(targetType) !== "ALL" ? { targetType: parseType(targetType) as never } : {}),
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      ...(authorUsername ? { authorUsername } : {}),
      ...(minLikes !== undefined ? { minLikes } : {}),
      minBu: number("minBu"), maxBu: number("maxBu"), minForks: number("minForks"),
      fromDate: date("fromDate"), toDate: date("toDate"),
      definitionKind: sp.get("definitionKind") === "TEMPLATE" ? "TEMPLATE" : sp.get("definitionKind") === "EXPRESSION" ? "EXPRESSION" : undefined,
      recipient: sp.get("recipient") ?? undefined, conditionMode: sp.get("conditionMode") === "conditional" ? "conditional" : sp.get("conditionMode") === "always" ? "always" : undefined, mechanicTarget: sp.get("mechanicTarget") ?? undefined, magnitude: number("magnitude"), minMagnitude: number("minMagnitude"), maxMagnitude: number("maxMagnitude"),
      mirrorableOnly: sp.get("mirrorableOnly") === "1",
      tags: (sp.get("tags") ?? sp.get("tag") ?? "").split(",").map(value => value.trim()).filter(Boolean).slice(0, 30),
      hasForks,
      sort,
      limit,
      offset,
    });
    if (clerkUserId) {
      const viewerId = await resolveUserIdByClerkId(clerkUserId);
      const engagement = await loadLibraryEngagement(viewerId, result.items);
      result.items = applyViewerEngagement(result.items, engagement);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[library] error:", err);
    return NextResponse.json(
      { error: "Failed to query library" },
      { status: 500 },
    );
  }
}
