// =============================================================================
// listSharedCharacters — PLAN Eilxina Part B (Mashu 2026-09-09).
//
// Server-side helper for the "Shared with me" tab on /characters.
// Returns character metadata for every character where a non-revoked
// character_shares row exists with sharedWithUserId = current user.
//
// Drizzle shallow-with + flat-attach pattern (per codebase-orientation
// §6k depth-3+ trap): we use db.query.characters.findMany with a
// custom WHERE that joins through character_shares, then resolve the
// granting user's display name with a separate flat lookup. We do
// NOT nest users inside the relation query — that triggers Postgres
// LATERAL scoping issues at depth 3+.
//
// Returned shape is intentionally minimal — just what the Shared-tab
// card needs. The full character row (with primitive/cap/item links)
// is fetched by /characters/[id]/page.tsx when the user opens the
// sheet. Keeps the list query cheap even with thousands of shares.
// =============================================================================

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  characters,
  characterShares,
  users,
} from "@/db/schema";

export interface SharedCharacterRow {
  /** The character id. */
  id: string;
  name: string;
  level: number;
  // The character_size enum (character_size from db schema) — but we
  // read it as the DB string and let the UI narrow on display. The
  // card component renders the raw string.
  size: string;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  /** Legacy column; nullable. Some rows have an attribute name like
   * "PHYSICAL"/"MENTAL"/"MAGICAL" stored as text. */
  attrProficient: string | null;
  portraitUrl: string | null;
  lineageName: string | null;
  manifestName: string | null;
  /** Internal user.id of the granting user (the owner or co-owner who shared it). */
  grantedByInternalUserId: string | null;
  grantedByUsername: string | null;
  grantedByDisplayName: string | null;
  /** Whether the grant includes edit rights. */
  canEdit: boolean;
  /** When the grant was created (ISO string). */
  grantedAt: string;
}

export async function listSharedCharacters(
  currentUserInternalId: string,
): Promise<SharedCharacterRow[]> {
  // 1. Fetch share rows + their target characters in a single query.
  //    Drizzle's `.from()` + `.innerJoin()` keeps the SQL shallow.
  const shareRows = await db
    .select({
      shareId: characterShares.id,
      canEdit: characterShares.canEdit,
      createdAt: characterShares.createdAt,
      // Character fields:
      charId: characters.id,
      charName: characters.name,
      charLevel: characters.level,
      charSize: characters.size,
      charAttrPhysical: characters.attrPhysical,
      charAttrMental: characters.attrMental,
      charAttrMagical: characters.attrMagical,
      charAttrProficient: characters.attrProficient,
      charPortraitUrl: characters.portraitUrl,
      charLineageName: characters.lineageName,
      charManifestName: characters.manifestName,
      // Granter fields:
      granterId: characterShares.sharedByUserId,
    })
    .from(characterShares)
    .innerJoin(characters, eq(characters.id, characterShares.characterId))
    .where(
      and(
        eq(characterShares.sharedWithUserId, currentUserInternalId),
        isNull(characterShares.revokedAt),
        // Defensive: skip shares for already-deleted characters. The
        // FK cascade should handle this, but doesn't fire if the
        // share row was orphaned before the migration.
        sql`${characters.userId} IS NOT NULL`,
      ),
    )
    .orderBy(desc(characterShares.createdAt))
    .limit(200);

  if (shareRows.length === 0) return [];

  // 2. Flat lookup of granter display info. The shallow pattern
  //    keeps the join depth at 2 (character_shares → characters).
  const granterIds = Array.from(
    new Set(shareRows.map((r) => r.granterId).filter((x): x is string => !!x)),
  );
  const granterRows = granterIds.length
    ? await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        })
        .from(users)
        .where(
          granterIds.length === 1
            ? eq(users.id, granterIds[0]!)
            : sql`${users.id} IN (${sql.join(granterIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
        )
    : [];
  const granterMap = new Map(granterRows.map((g) => [g.id, g]));

  // 3. Compose the row shape.
  return shareRows.map((r) => {
    const granter = r.granterId ? granterMap.get(r.granterId) : null;
    return {
      id: r.charId,
      name: r.charName,
      level: r.charLevel,
      // The DB column is character_size enum but we treat it as a
      // plain string at the API boundary — the UI renders it as-is.
      size: r.charSize as unknown as string,
      attrPhysical: r.charAttrPhysical,
      attrMental: r.charAttrMental,
      attrMagical: r.charAttrMagical,
      attrProficient: r.charAttrProficient as unknown as string | null,
      portraitUrl: r.charPortraitUrl ?? null,
      lineageName: r.charLineageName ?? null,
      manifestName: r.charManifestName ?? null,
      grantedByInternalUserId: r.granterId ?? null,
      grantedByUsername: granter?.username ?? null,
      grantedByDisplayName: granter?.displayName ?? null,
      canEdit: r.canEdit,
      grantedAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    };
  });
}
