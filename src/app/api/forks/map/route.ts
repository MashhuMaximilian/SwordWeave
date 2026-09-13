import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getForkMap } from "@/lib/publishing/fork-map";
import type { ForkTargetType } from "@/lib/publishing/forks-query";

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
  cursor: z.string().max(256).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await getForkMap(
        parsed.data.targetType as ForkTargetType,
        parsed.data.targetId,
        {
          ...(parsed.data.limit === undefined ? {} : { limit: parsed.data.limit }),
          ...(parsed.data.cursor === undefined ? {} : { cursor: parsed.data.cursor }),
        },
      ),
    );
  } catch (error) {
    console.error("[forks/map] query failed", error);
    return NextResponse.json(
      { error: "Unable to load the fork map" },
      { status: 500 },
    );
  }
}
