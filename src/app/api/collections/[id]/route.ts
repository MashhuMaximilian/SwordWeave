import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, withDatabaseTransaction } from "@/db/client";
import {
  collections,
  collectionFollows,
  collectionContents,
  getCollection,
} from "@/lib/collections/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: Context) {
  const { userId } = await auth();
  const { id } = await ctx.params;
  try {
    return NextResponse.json(
      await collectionContents(
        id,
        userId,
        Math.max(0, Number(req.nextUrl.searchParams.get("page")) || 0),
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404 },
    );
  }
}
export async function PATCH(req: NextRequest, ctx: Context) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const input = z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      parentId: z.string().uuid().nullable().optional(),
      visibility: z.enum(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"]).optional(),
      follow: z.boolean().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const c = await getCollection(id, userId);
    if (input.data.follow !== undefined) {
      if (input.data.follow)
        await db
          .insert(collectionFollows)
          .values({ userId, collectionId: id })
          .onConflictDoNothing();
      else
        await db
          .delete(collectionFollows)
          .where(
            and(
              eq(collectionFollows.userId, userId),
              eq(collectionFollows.collectionId, id),
            ),
          );
      return NextResponse.json({ ok: true });
    }
    if (c["owner_id"] !== userId) throw new Error("Only your collections can be edited");
    if(c["system_kind"]&&(input.data.name!==undefined||input.data.parentId!==undefined)) throw new Error("Automatic collection names and hierarchy are fixed");
    await db.update(collections).set(input.data).where(eq(collections.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to edit collection" },
      { status: 400 },
    );
  }
}
export async function DELETE(req: NextRequest, ctx: Context) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const input = z
    .object({
      children: z.enum(["move", "delete"]).optional(),
      moveTo: z.string().uuid().nullable().optional(),
    })
    .safeParse(await req.json().catch(() => ({})));
  if (!input.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    await withDatabaseTransaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(collections)
        .where(and(eq(collections.id, id), eq(collections.ownerId, userId)));
      if (!c || c.systemKind) throw new Error("Custom collection not found");
      const children = await tx
        .select()
        .from(collections)
        .where(eq(collections.parentId, id));
      if (children.length && !input.data.children)
        throw new Error("Choose whether to move or delete child collections");
      if (input.data.children === "move") {
        const dest = input.data.moveTo ?? c.parentId;
        if (dest === id) throw new Error("Choose another parent");
        await tx
          .update(collections)
          .set({ parentId: dest })
          .where(eq(collections.parentId, id));
      }
      if (input.data.children === "delete") {
        const remove = async (parent: string) => {
          const nested = await tx
            .select()
            .from(collections)
            .where(eq(collections.parentId, parent));
          for (const child of nested) await remove(child.id);
          await tx.delete(collections).where(eq(collections.id, parent));
        };
        for (const child of children) await remove(child.id);
      }
      await tx.delete(collections).where(eq(collections.id, id));
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to delete collection" },
      { status: 400 },
    );
  }
}
