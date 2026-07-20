// =============================================================================
// autoPublishOnCreate — Phase 9 follow-up round 8.
//
// When a user creates a new entity via the build modal and selects
// `isPublic: true`, the entity table is updated but the publications
// table is NOT — so the library visibility filter (which checks
// publications FIRST) treats the row as private.
//
// Before round 8: users had to (1) save the entity, (2) open it on
// /creations, (3) toggle the visibility chip to PUBLIC there. That
// triggered the visibility API to create the publications row. Two
// steps, easy to miss → user-visible "saves it as private regardless
// of what visibility I chose".
//
// After round 8: the entity save route ALSO inserts a publications
// row (with a virtual version_id synthesized from the entity id)
// when isPublic=true. Now the save path is the publish path.
//
// The visibility API still exists for follow-on changes (flip to
// PRIVATE, then back to PUBLIC, etc.). It calls syncIsPublic() to
// keep the entity.isPublic boolean in sync with the publication
// visibility tier — same dual-write pattern, just inverted.
//
// SPEC
//   - Called from the entity POST routes (primitives, effects,
//     capabilities, items, heritage templates) AFTER the row is
//     inserted and BEFORE the response is returned.
//   - Idempotent: if a publication already exists for (targetType,
//     targetId), do nothing. The user might have already toggled
//     visibility via /creations before saving the form.
//   - For NEW rows: insert publications with the virtual version_id
//     derived from the row's id (synthesized via MD5 in
//     resolveVirtualVersionId, same as the visibility API uses).
//   - For UPDATE rows: only insert if no publications row exists
//     AND isPublic flips to true. Otherwise skip (existing pub
//     tracks visibility tier already).
// =============================================================================

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { publications } from "@/db/schema/engagement";
import {
  resolveVirtualVersionId,
  isUuid,
} from "@/lib/engagement/version-helpers";
import type { publishTargetTypeEnum } from "@/db/schema/engagement";

export type AutoPublishTargetType =
  | (typeof publishTargetTypeEnum.enumValues)[number];

interface AutoPublishArgs {
  targetType: AutoPublishTargetType;
  targetId: string;
  authorId: string;
  isPublic: boolean;
}

/**
 * Ensure a publications row exists when the caller saved an entity with
 * isPublic=true. If the row is private (isPublic=false), do nothing —
 * the visibility API handles unpublishing.
 *
 * Returns the publication id if a new row was inserted, or null if
 * nothing changed (no publications row exists for a private save, or
 * one already exists for a public save).
 */
export async function autoPublishOnCreate({
  targetType,
  targetId,
  authorId,
  isPublic,
}: AutoPublishArgs): Promise<{ publicationId: string | null; created: boolean }> {
  if (!isPublic) {
    // Private save: no publication row, no work to do.
    // (If a publication already exists from a prior save, the visibility
    // API is responsible for unpublishing it — we don't touch it here.)
    return { publicationId: null, created: false };
  }

  const finalVersionId = resolveVirtualVersionId(targetType, targetId);
  if (!isUuid(finalVersionId)) {
    console.error(
      `[auto-publish] synthesized non-UUID version_id for ${targetType}:${targetId}`,
    );
    return { publicationId: null, created: false };
  }

  // Idempotency check: don't insert a second publications row if one
  // already exists for this (targetType, targetId). The unique-ish
  // (targetType, targetId, unpublishedAt IS NULL) constraint doesn't
  // exist as a real DB index, so we explicitly check.
  const existing = await db
    .select({ id: publications.id })
    .from(publications)
    .where(
      and(
        eq(publications.targetType, targetType),
        eq(publications.targetId, targetId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // Existing publication: just ensure it's not marked unpublished.
    // (If the user later flipped to PRIVATE then back to PUBLIC via
    // /creations, the visibility API handles that — we only INSERT
    // here.)
    const existingId = existing[0]!.id;
    await db
      .update(publications)
      .set({ visibility: "PUBLIC", unpublishedAt: null })
      .where(eq(publications.id, existingId));
    return { publicationId: existingId, created: false };
  }

  // No existing publication → insert one as PUBLIC.
  const [created] = await db
    .insert(publications)
    .values({
      targetType: targetType as never,
      targetId,
      versionId: finalVersionId,
      versionNumber: 1,
      authorId,
      visibility: "PUBLIC",
    })
    .returning({ id: publications.id });

  return { publicationId: created?.id ?? null, created: true };
}
