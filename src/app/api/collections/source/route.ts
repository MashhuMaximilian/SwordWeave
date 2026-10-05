import { privateJson } from "@/lib/http/private-json";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
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
      return privateJson({ collection: null });
    const [source] = await db
      .select()
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.targetType, targetType),
          eq(collectionSources.targetId, targetId),
        ),
      );
    if (!source) return privateJson({ collection: null });
    const collection = await getCollection(source.collectionId, userId);
    return privateJson({
      collection: { id: collection["id"], name: collection["name"] },
    });
  } catch {
    return privateJson({ collection: null });
  }
}
