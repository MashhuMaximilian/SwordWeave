// =============================================================================
// POST /api/publish — create a publication for a target
// DELETE /api/publish — unpublish a publication
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import {
  capabilities,
  characters,
  primitives,
  publishTargetTypeEnum,
  publishVisibilityEnum,
  heritage,
} from "@/db/schema";
import { publishTarget, unpublishTarget } from "@/lib/publishing/publish-service";

const PublishSchema = z.object({
  targetType: z.enum(publishTargetTypeEnum.enumValues),
  targetId: z.string().min(1).max(64),
  visibility: z.enum(publishVisibilityEnum.enumValues).default("PUBLIC"),
});

const UnpublishSchema = z.object({
  publicationId: z.string().uuid(),
});

/**
 * Load the entity + key relations into a snapshot object.
 * Returns null if entity not found OR if the caller doesn't own it.
 *
 * Ownership rule: every publish is "the author re-publishing their own
 * content." A user cannot publish someone else's row, even if it's
 * already marked isPublic (that row's publication already exists).
 */
async function loadSnapshot(
  targetType: string,
  targetId: string,
  authorClerkUserId: string,
): Promise<Record<string, unknown> | null> {
  if (targetType === "CAPABILITY") {
    const row = await db.query.capabilities.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.id, targetId),
          eq(table.userId, authorClerkUserId),
        ),
      with: {
        primitiveLinks: {
          with: { primitive: true },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      sourceType: row.sourceType,
      verboseDescription: row.verboseDescription,
      tags: row.tags,
      metadata: row.metadata,
      primitiveLinks: row.primitiveLinks.map((l) => ({
        primitiveId: l.primitiveId,
        quantity: l.quantity,
        sortOrder: l.sortOrder,
      })),
    };
  }
  if (targetType === "PRIMITIVE") {
    const row = await db.query.primitives.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.id, Number(targetId)),
          eq(table.userId, authorClerkUserId),
        ),
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      costTier: row.costTier,
      buCost: row.buCost,
      mechanicalOutputText: row.mechanicalOutputText,
      narrativeRule: row.narrativeRule,
      isMirrorable: row.isMirrorable,
      mirrorVector: row.mirrorVector,
      hardModifiers: row.hardModifiers,
    };
  }
  if (targetType === "EFFECT") {
    const row = await db.query.effects.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.id, targetId),
          eq(table.userId, authorClerkUserId),
        ),
      with: {
        primitiveLinks: { with: { primitive: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      narrativeDescription: row.narrativeDescription,
      tags: row.tags,
      primitiveLinks: row.primitiveLinks.map((l) => ({
        primitiveId: l.primitiveId,
        quantity: l.quantity,
        sortOrder: l.sortOrder,
      })),
    };
  }
  if (targetType === "ITEM") {
    const row = await db.query.items.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.id, targetId),
          eq(table.userId, authorClerkUserId),
        ),
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      itemType: row.itemType,
      rarity: row.rarity,
      buCost: row.buCost,
      description: row.description,
      slotCost: row.slotCost,
      isTwoHanded: row.isTwoHanded,
      isConsumable: row.isConsumable,
      actsAsFocus: row.actsAsFocus,
      tags: row.tags,
    };
  }
  if (targetType === "CHARACTER") {
    // characters.userId is text (Clerk ID format) — same shape as
    // primitives/capabilities/heritage/effects/items. The call below
    // passes the Clerk ID via the authorClerkUserId parameter.
    const row = await db.query.characters.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, targetId), eq(table.userId, authorClerkUserId)),
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      level: row.level,
      size: row.size,
      notes: row.notes,
      portraitUrl: row.portraitUrl,
    };
  }
  if (
    targetType === "LINEAGE_TEMPLATE" ||
    targetType === "UPBRINGING_TEMPLATE" ||
    targetType === "MANIFEST_TEMPLATE"
  ) {
    const row = await db.query.heritage.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.id, targetId),
          eq(table.userId, authorClerkUserId),
        ),
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      description: row.description,
      imageUrl: row.imageUrl,
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { targetType, targetId, visibility } = parsed.data;

  // Resolve internal user ID from Clerk ID
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, userId),
  });
  if (!user) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const snapshot = await loadSnapshot(targetType, targetId, userId); // userId is the Clerk user ID from auth()
  if (!snapshot) {
    return NextResponse.json(
      { error: "Target not found or you don't have permission" },
      { status: 404 },
    );
  }

  try {
    const result = await publishTarget({
      targetType,
      targetId,
      authorId: user.id,
      visibility,
      snapshot,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[publish] error:", err);
    return NextResponse.json(
      { error: "Failed to publish" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UnpublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, userId),
  });
  if (!user) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  try {
    await unpublishTarget(parsed.data.publicationId, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[unpublish] error:", err);
    return NextResponse.json(
      { error: "Failed to unpublish" },
      { status: 500 },
    );
  }
}