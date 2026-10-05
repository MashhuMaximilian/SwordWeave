import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { collectionSources } from "@/db/schema/collections";
import { getCollection, visibleEntries } from "@/lib/collections/service";
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const targetType = req.nextUrl.searchParams.get("targetType") ?? "",
    targetId = req.nextUrl.searchParams.get("targetId") ?? "";
  try {
    if (!(await visibleEntries([{ targetType, targetId }], userId)).length)
      return NextResponse.json({ collection: null });
    const [source] = await db
      .select()
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.targetType, targetType),
          eq(collectionSources.targetId, targetId),
        ),
      );
    if (!source) return NextResponse.json({ collection: null });
    const collection = await getCollection(source.collectionId, userId);
    return NextResponse.json({
      collection: { id: collection["id"], name: collection["name"] },
    });
  } catch {
    return NextResponse.json({ collection: null });
  }
}
