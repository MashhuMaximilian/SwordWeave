// Single permission gate for character access. Replaces the 26 inline
// `row.userId !== userId` checks across /api/characters/* routes
// + /characters/[id]/page.tsx.
//
// Three permission levels:
//   - OWNER    (full read + write)        — the row's userId matches the caller
//   - EDITOR   (full read + write)        — character_shares.canEdit=true
//   - VIEWER   (read only)                — character_shares.canEdit=false
//   - NONE     (caller gets 403 / redirect)
//
// Design choices:
//   - ONE query for the character row + (if needed) the share row.
//     Avoids the depth-3+ Postgres LATERAL trap by using a shallow
//     load + a flat lookup. The character fetch is the same shape
//     every route already does; we just promote the ownership
//     check into the helper.
//   - Returns the permission + the character row together so the
//     caller doesn't refetch.
//   - `clerkUserId` is the input (matches auth() in routes).
//     We resolve to internal UUID internally — caller never has to.
//   - For the page SC (Next.js redirect), there's a sibling
//     `canResolveCharacterForPage()` that returns the permission
//     level directly so redirect() can fire before any rendering.
//   - `canResolveCharacter` throws on NONE (so callers can use
//     a single try/catch and write the 403 once). For the page,
//     the sibling returns null instead.
//
// Why throw on NONE for routes but return null for pages:
//   - API routes want a JSON 403 response. Throwing lets every route
//     share the same catch handler.
//   - Pages want redirect() at the top of the server component,
//     BEFORE any rendering (Next 14+ requires it). Returning null
//     and letting the caller redirect is cleaner.
// =============================================================================

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { characters, characterShares } from "@/db/schema";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

export type CharacterPermission = "OWNER" | "EDITOR" | "VIEWER";

export interface ResolvedCharacter {
  /** The character row (minimal — id + userId + version columns + timestamps). */
  character: typeof characters.$inferSelect;
  /** The permission level for the caller on this character. */
  permission: CharacterPermission;
  /** Internal user.id of the caller (or null if clerkUserId didn't resolve). */
  viewerInternalId: string | null;
  /** Internal user.id of the character OWNER (always set — even for anon rows,
   *  ownerUserId is just the row's userId column). */
  ownerInternalId: string | null;
}

/** Internal — does the work for both `canResolveCharacter` (throws) and
 *  `canResolveCharacterForPage` (returns null). */
async function resolveCharacter(
  clerkUserId: string | null,
  characterId: string,
): Promise<ResolvedCharacter | null> {
  // Anonymous caller (no Clerk session) — must be a published public
  // character to have ANY access. For Part C we keep the existing
  // redirect behavior: anon gets NONE on private, and is handled
  // separately by the public library route.
  if (!clerkUserId) {
    return null;
  }

  // Step 1: resolve caller's internal user.id (Clerk ID → UUID).
  // null if the caller has never logged in / doesn't exist yet.
  const viewerInternalId = await resolveUserIdByClerkId(clerkUserId);

  // Step 2: load the character row + the share row in two shallow
  // queries. Avoid depth-3+ joins (per the codebase trap).
  const charRow = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
  });
  if (!charRow) {
    return null;
  }

  // Step 3: compute permission.
  //
  // OWNER shortcut: if the row's userId IS the caller's Clerk ID,
  // they're the owner. We use Clerk-ID-on-row comparison because
  // that's the convention used by every existing route. (Some rows
  // have internal-UUID userId — those don't match a Clerk ID; the
  // owner would NOT see themselves via this path. That's a
  // pre-existing data inconsistency, not something this helper
  // can fix.)
  if (charRow.userId === clerkUserId) {
    return {
      character: charRow,
      permission: "OWNER",
      viewerInternalId,
      ownerInternalId: null, // OWNER's internal id is the viewer's
    };
  }

  // Step 4: not the owner — check shares. viewerInternalId is the
  // join key into character_shares.sharedWithUserId.
  if (!viewerInternalId) {
    return null;
  }

  const shareRow = await db
    .select({ canEdit: characterShares.canEdit })
    .from(characterShares)
    .where(
      and(
        eq(characterShares.sharedWithUserId, viewerInternalId),
        eq(characterShares.characterId, characterId),
        isNull(characterShares.revokedAt),
      ),
    )
    .limit(1);

  if (shareRow.length === 0) {
    return null;
  }

  return {
    character: charRow,
    permission: shareRow[0]!.canEdit ? "EDITOR" : "VIEWER",
    viewerInternalId,
    ownerInternalId: null, // not needed for non-owner callers
  };
}

/**
 * Route-side helper: throws `CharacterAccessDenied` on NONE,
 * returns `{ character, permission }` otherwise.
 *
 * Usage in an API route:
 *
 *   try {
 *     const { character, permission } = await canResolveCharacter(
 *       clerkUserId, characterId
 *     );
 *     if (permission === "VIEWER" && isMutating) return 403;
 *     // ... use character ...
 *   } catch (e) {
 *     if (e instanceof CharacterAccessDenied) {
 *       return NextResponse.json({ error: e.message }, { status: 403 });
 *     }
 *     throw e;
 *   }
 */
export async function canResolveCharacter(
  clerkUserId: string | null,
  characterId: string,
): Promise<ResolvedCharacter> {
  const resolved = await resolveCharacter(clerkUserId, characterId);
  if (!resolved) {
    throw new CharacterAccessDenied(characterId);
  }
  return resolved;
}

/**
 * Page-side helper: returns the resolved permission, or null if
 * the caller has no access (caller redirects). The page SC can
 * pass the permission to <CharacterSheetView /> as a prop so the
 * sheet knows whether to show Edit/Clone buttons.
 */
export async function canResolveCharacterForPage(
  clerkUserId: string | null,
  characterId: string,
): Promise<ResolvedCharacter | null> {
  return resolveCharacter(clerkUserId, characterId);
}

/**
 * Thrown by `canResolveCharacter` when the caller has no access.
 * Routes catch this in their outer try/catch and translate to a 403.
 */
export class CharacterAccessDenied extends Error {
  public readonly characterId: string;
  constructor(characterId: string) {
    super(
      `You don't have access to character ${characterId}. Sign in as the owner, or ask the owner to share it with you.`,
    );
    this.name = "CharacterAccessDenied";
    this.characterId = characterId;
  }
}
