// =============================================================================
// POST /api/creations/visibility — set the visibility tier for a user-owned
// creation. Creates a new `publications` row when promoting to PUBLIC or
// FOLLOWERS_ONLY, or marks any existing publication as unpublished when
// moving to PRIVATE.
//
// Body: { targetType, targetId, visibility, versionId? }
//
// Visibility tiers:
//   - PUBLIC         — visible to everyone in the library
//   - FOLLOWERS_ONLY — visible to the author + their followers
//   - PRIVATE        — visible only to the author (no publication row)
//
// Authorization: only the row's author can change visibility.
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { publications } from "@/db/schema/engagement";
import { primitives, effects, capabilities, items, heritage, characters, builds } from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { withCharacterMutation } from "@/lib/character/mutation-transaction";
import { resolveVirtualVersionId, isUuid } from "@/lib/engagement/version-helpers";
import { withPublishingResponse } from "@/lib/publishing/save-transaction";

const BodySchema = z.object({
  targetType: z.enum([
    "PRIMITIVE",
    "CAPABILITY",
    "CHARACTER",
    "ITEM",
    "EFFECT",
    "LINEAGE_TEMPLATE",
    "UPBRINGING_TEMPLATE",
    "MANIFEST_TEMPLATE",
    "BUILD_TEMPLATE",
  ]),
  targetId: z.string().min(1),
  visibility: z.enum(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"]),
  versionId: z.string().uuid().optional(),
});

const entityTables = {
  PRIMITIVE: primitives, EFFECT: effects, CAPABILITY: capabilities, ITEM: items, CHARACTER: characters,
  LINEAGE_TEMPLATE: heritage, UPBRINGING_TEMPLATE: heritage, MANIFEST_TEMPLATE: heritage, BUILD_TEMPLATE: builds,
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const author = await resolveUserIdByClerkId(userId);
  if (!author) {
    return NextResponse.json(
      { error: "User profile not found" },
      { status: 404 },
    );
  }
  // `author` is the user UUID returned by resolveUserIdByClerkId.
  const authorId = author;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { targetType, targetId: rawTargetId, visibility, versionId } = parsed.data;
  const numericId = targetType === "PRIMITIVE" ? Number(rawTargetId) : null;
  if (numericId !== null ? !/^[1-9][0-9]*$/.test(rawTargetId) || numericId > 2_147_483_647 : !isUuid(rawTargetId)) {
    return NextResponse.json({ error: "Invalid target ID" }, { status: 400 });
  }
  const targetId = rawTargetId.toLowerCase();
  const setVisibility = () => withPublishingResponse(async () => {
    const table = entityTables[targetType];
    const entity = and(eq(sql`${table.id}::text`, targetId),
      sql`${table.userId} IN (${userId}, ${authorId})`,
      table === heritage ? sql`${heritage.kind}::text || '_TEMPLATE' = ${targetType}` : undefined);
    const [owned] = await db.select({ id: table.id }).from(table).where(entity).for("update");
    if (!owned) return NextResponse.json({ error: "Creation unavailable" }, { status: 404 });
    const target = and(eq(publications.targetType, targetType), eq(publications.targetId, targetId));
    const rows = await db.select().from(publications).where(target).orderBy(desc(publications.versionNumber));
    if (rows.some(row => row.authorId !== authorId)) {
      return NextResponse.json({ error: "Creation unavailable" }, { status: 404 });
    }
    const active = and(target, isNull(publications.unpublishedAt));
    const existing = rows.find(row => !row.unpublishedAt) ?? rows[0];
    let publicationId: string | null = null;
    if (visibility === "PRIVATE") {
      await db.update(publications).set({ unpublishedAt: new Date() }).where(active);
    } else if (existing) {
      await db.update(publications).set({ visibility, unpublishedAt: null })
        .where(existing.unpublishedAt ? eq(publications.id, existing.id) : active);
      publicationId = existing.id;
    } else {
      const finalVersionId = versionId ?? resolveVirtualVersionId(targetType, targetId);
      if (!isUuid(finalVersionId)) return NextResponse.json({ error: "versionId must be a UUID" }, { status: 400 });
      const [created] = await db.insert(publications).values({
        targetType, targetId, versionId: finalVersionId, versionNumber: 1, authorId, visibility,
      }).returning({ id: publications.id });
      publicationId = created?.id ?? null;
    }
    await db.update(table).set({ isPublic: visibility !== "PRIVATE" }).where(entity);
    return NextResponse.json({ ok: true, visibility, ...(visibility === "PRIVATE" ? {} : { publicationId }) });
  });
  try {
    return await (targetType === "CHARACTER" ? withCharacterMutation(targetId, setVisibility) : setVisibility());
  } catch {
    return NextResponse.json({ error: "Could not save visibility" }, { status: 500 });
  }
}
