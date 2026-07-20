// =============================================================================
// GET /api/forks/by-source?targetType=X&targetId=Y
//
// Public read endpoint — no auth required. Returns forks taken FROM the
// given source target. Used by <ForksList> on library item detail pages.
//
// Response:
// {
//   forks: ForkEntry[],
//   totalForks: number,
// }
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  listBySource,
  type ForkTargetType,
} from "@/lib/publishing/forks-query";

const QuerySchema = z.object({
  targetType: z.enum([
    "PRIMITIVE",
    "CAPABILITY",
    "EFFECT",
    "ITEM",
    "CHARACTER",
    "LINEAGE_TEMPLATE",
    "UPBRINGING_TEMPLATE",
    "MANIFEST_TEMPLATE",
    "BUILD_TEMPLATE",
  ]),
  targetId: z.string().min(1).max(128),
  limit: z.coerce.number().int().min(1).max(50).optional(),
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
    const result = await listBySource(
      parsed.data.targetType as ForkTargetType,
      parsed.data.targetId,
      parsed.data.limit ?? 10,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[forks/by-source] query failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}