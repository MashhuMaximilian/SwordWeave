import { privateJson } from "@/lib/http/private-json";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  collectionEntries,
  collections,
  visibleEntries,
} from "@/lib/collections/service";
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return privateJson({ error: "Unauthenticated" }, { status: 401 });
  const parsed = z
    .object({
      entries: z
        .array(z.object({ targetType: z.string(), targetId: z.string() }))
        .max(500),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return privateJson({ error: "Invalid entries" }, { status: 400 });
  const visible = await visibleEntries(parsed.data.entries, userId);
  if (!visible.length) return privateJson({ userId, memberships: [] });
  const refs = new Set(visible.map((r) => `${r.targetType}:${r.targetId}`));
  const memberships = await db
    .select({
      collectionId: collectionEntries.collectionId,
      targetType: collectionEntries.targetType,
      targetId: collectionEntries.targetId,
    })
    .from(collectionEntries)
    .innerJoin(collections, eq(collections.id, collectionEntries.collectionId))
    .where(
      and(
        eq(collections.ownerId, userId),
        inArray(
          collectionEntries.targetId,
          visible.map((r) => r.targetId),
        ),
      ),
    );
  return privateJson({
    userId,
    memberships: memberships.filter((m) =>
      refs.has(`${m.targetType}:${m.targetId}`),
    ),
  });
}
