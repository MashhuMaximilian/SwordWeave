import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { and, eq } from "drizzle-orm";
import {
  listCollections,
  collections,
  collectionEntries,
  saveMemberships,
} from "@/lib/collections/service";
const input = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.string().uuid().nullable().optional(),
  visibility: z
    .enum(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"])
    .default("PRIVATE"),
});
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const owner =
    req.nextUrl.searchParams.get("own") === "true"
      ? (userId ?? undefined)
      : (req.nextUrl.searchParams.get("owner") ?? undefined);
  const rows = await listCollections(userId, owner);
  const type = req.nextUrl.searchParams.get("targetType"),
    id = req.nextUrl.searchParams.get("targetId");
  const memberships =
    userId && type && id
      ? await db
          .select({ collectionId: collectionEntries.collectionId })
          .from(collectionEntries)
          .innerJoin(
            collections,
            eq(collections.id, collectionEntries.collectionId),
          )
          .where(
            and(
              eq(collections.ownerId, userId),
              eq(collectionEntries.targetType, type),
              eq(collectionEntries.targetId, id),
            ),
          )
      : [];
  return NextResponse.json({
    collections: rows,
    membershipIds: memberships.map((m) => m.collectionId),
  });
}
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json(
      { error: "Sign in to create collections" },
      { status: 401 },
    );
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
  if (parsed.data.parentId) {
    const [p] = await db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.id, parsed.data.parentId),
          eq(collections.ownerId, userId),
        ),
      );
    if (!p)
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  }
  const [collection] = await db
    .insert(collections)
    .values({ ...parsed.data, ownerId: userId })
    .returning();
  return NextResponse.json({ collection }, { status: 201 });
}
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in to bookmark" }, { status: 401 });
  const parsed = z
    .object({
      targetType: z.string(),
      targetId: z.string().min(1),
      collectionIds: z.array(z.string().uuid()).max(100),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid bookmark" }, { status: 400 });
  try {
    await saveMemberships(
      userId,
      parsed.data.targetType,
      parsed.data.targetId,
      parsed.data.collectionIds,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to save" },
      { status: 400 },
    );
  }
}
