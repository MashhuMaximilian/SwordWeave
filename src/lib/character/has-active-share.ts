// =============================================================================
// hasActiveShare — PLAN Eilxina Part B (Mashu 2026-09-09).
//
// Tiny helper used by /characters/[id]/page.tsx to decide whether
// the current viewer has a non-revoked grant on this character.
// When true, the ownership redirect is bypassed so shared-with-me
// viewers can open the sheet.
//
// For Part B this is VIEW-ONLY. Part C's canResolveCharacter will
// replace this single-purpose helper with the full owner/editor/
// viewer permission model.
// =============================================================================

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { characterShares } from "@/db/schema";

export async function hasActiveShare(
  viewerInternalId: string,
  characterId: string,
): Promise<{ canEdit: boolean } | null> {
  const row = await db
    .select({
      canEdit: characterShares.canEdit,
    })
    .from(characterShares)
    .where(
      and(
        eq(characterShares.sharedWithUserId, viewerInternalId),
        eq(characterShares.characterId, characterId),
        isNull(characterShares.revokedAt),
      ),
    )
    .limit(1);
  return row.length > 0 ? { canEdit: row[0]!.canEdit } : null;
}
