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
import { loadWorkspaceNodes } from "@/lib/character/workspace/load-nodes";
import { captureCharacterSnapshot } from "@/lib/character/capture-character-snapshot";
import { findLatestVersion as findLatestAuthoredVersion } from "@/lib/versions/auto-snapshot";
import { resolveContentVersionId } from "@/lib/versions/content-hash";
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
  if (targetType === "CHARACTER") {
    const row = await db.query.characters.findFirst({ where: (t, {and,eq}) => and(eq(t.id,targetId),eq(t.userId,authorClerkUserId)) });
    if (!row) return null;
    await captureCharacterSnapshot({ characterId: targetId, publishedByUserId: authorClerkUserId });
    return (await findLatestAuthoredVersion("character", targetId))?.snapshot as Record<string,unknown> ?? null;
  }
  const kind = targetType === "PRIMITIVE" ? "primitive" : targetType === "CAPABILITY" ? "capability" : targetType === "EFFECT" ? "effect" : targetType === "ITEM" ? "item" : ["LINEAGE_TEMPLATE","UPBRINGING_TEMPLATE","MANIFEST_TEMPLATE"].includes(targetType) ? "heritage" : null;
  if (!kind) return null;
  const loaded = await loadWorkspaceNodes([`${kind}:${targetId}`]);
  const entry = loaded.get(`${kind}:${targetId}`);
  if (!entry || entry.row["userId"] !== authorClerkUserId) return null;
  if (kind === "heritage" && entry.row["kind"] !== targetType.replace("_TEMPLATE", "")) return null;
  const versionKind = kind === "heritage" ? "template" : kind;
  const latest = await findLatestAuthoredVersion(versionKind, targetId);
  if (latest && entry.row["contentHash"] && latest.versionId === resolveContentVersionId(versionKind, targetId, String(entry.row["contentHash"]))) return latest.snapshot as Record<string,unknown>;
  // Compatibility for older definitions without a canonical snapshot. Copy
  // only this entry's metadata and its relationship settings, never children.
  const snapshot = Object.fromEntries(Object.entries(entry.row).filter(([key]) => !["id","userId","createdAt","updatedAt","contentHash"].includes(key)));
  for (const childKind of ["primitive","capability","effect","item","heritage"] as const) {
    const links = entry.links.filter(link => link.kind === childKind);
    if (links.length) snapshot[`${childKind}Slots`] = links.map(link => ({...link.data,[`${childKind}Id`]:link.id}));
  }
  return snapshot;
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