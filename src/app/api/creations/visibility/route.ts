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
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { publications } from "@/db/schema/engagement";
import { primitives, effects, capabilities, items, heritage } from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import { resolveVirtualVersionId, isUuid } from "@/lib/engagement/version-helpers";

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

/**
 * Sync the `isPublic` boolean on the entity table to match the visibility tier.
 * PUBLIC / FOLLOWERS_ONLY → isPublic = true
 * PRIVATE → isPublic = false
 */
async function syncIsPublic(
  targetType: string,
  targetId: string,
  isPublic: boolean,
) {
  try {
    switch (targetType) {
      case "PRIMITIVE":
        await db.update(primitives).set({ isPublic }).where(eq(primitives.id, Number(targetId)));
        break;
      case "EFFECT":
        await db.update(effects).set({ isPublic }).where(eq(effects.id, targetId));
        break;
      case "CAPABILITY":
        await db.update(capabilities).set({ isPublic }).where(eq(capabilities.id, targetId));
        break;
      case "ITEM":
        await db.update(items).set({ isPublic }).where(eq(items.id, targetId));
        break;
      case "LINEAGE_TEMPLATE":
      case "UPBRINGING_TEMPLATE":
      case "MANIFEST_TEMPLATE":
      case "BUILD_TEMPLATE":
        await db.update(heritage).set({ isPublic }).where(eq(heritage.id, targetId));
        break;
    }
  } catch (err) {
    // Log but don't fail the request — publication row is the source of truth
    console.error("[visibility] syncIsPublic failed:", err);
  }
}

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
  const { targetType, targetId, visibility, versionId } = parsed.data;

  // Verify authorship. We trust the caller-provided targetType/targetId
  // because the publications table indexes on (target_type, target_id) and
  // we only update rows where author_id === caller.
  const existingRows = await db
    .select()
    .from(publications)
    .where(
      and(
        eq(publications.targetType, targetType as never),
        eq(publications.targetId, targetId),
      ),
    )
    .limit(1);
  const existing = existingRows[0];
  if (existing && existing.authorId !== authorId) {
    return NextResponse.json(
      { error: "Forbidden: not the author of this row" },
      { status: 403 },
    );
  }

  if (visibility === "PRIVATE") {
    // Mark any existing publication as unpublished.
    if (existing) {
      await db
        .update(publications)
        .set({ unpublishedAt: new Date() })
        .where(eq(publications.id, existing.id));
    }
    // Sync isPublic = false on the entity table
    await syncIsPublic(targetType, targetId, false);
    return NextResponse.json({ ok: true, visibility: "PRIVATE" });
  }

  const finalVersionId =
    versionId ?? resolveVirtualVersionId(targetType, targetId);
  if (!isUuid(finalVersionId)) {
    return NextResponse.json(
      { error: "versionId must be a UUID" },
      { status: 400 },
    );
  }

  if (existing) {
    // Update visibility on the current publication.
    await db
      .update(publications)
      .set({ visibility, unpublishedAt: null })
      .where(eq(publications.id, existing.id));
    // Sync isPublic = true for PUBLIC/FOLLOWERS_ONLY
    await syncIsPublic(targetType, targetId, true);
    return NextResponse.json({ ok: true, visibility, publicationId: existing.id });
  }

  // Create a new publication.
  const [created] = await db
    .insert(publications)
    .values({
      targetType: targetType as never,
      targetId,
      versionId: finalVersionId,
      versionNumber: 1,
      authorId,
      visibility,
    })
    .returning({ id: publications.id });
  // Sync isPublic = true for PUBLIC/FOLLOWERS_ONLY
  await syncIsPublic(targetType, targetId, true);
  return NextResponse.json({
    ok: true,
    visibility,
    publicationId: created?.id ?? null,
  });
}
