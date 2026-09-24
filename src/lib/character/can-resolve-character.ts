// Single permission gate for character access. Replaces the 26 inline
// `row.userId !== userId` checks across /api/characters/* routes
// + /characters/[id]/page.tsx.
//
// Character permission levels:
//   - OWNER    (full read + write)        — the row's userId matches the caller
//   - EDITOR   (full read + write)        — character_shares.canEdit=true
//   - SUGGESTER (private drafts + proposals) — explicit active-share role extension
//   - VIEWER   (read only)                — existing canEdit=false grants without that extension
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
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { characters, characterShares, characterWorkspaceCommands } from "@/db/schema";
import {
  resolveLocalAuthorIdentity,
  resolveUserIdByClerkId,
} from "@/lib/auth/author-resolver";

import { permissionFromShare, type CharacterPermission } from "./permission-policy";
export type { CharacterPermission } from "./permission-policy";

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
  let effectiveClerkUserId = clerkUserId;
  let viewerInternalId = await resolveUserIdByClerkId(clerkUserId);

  // A local Clerk development instance can be recreated while the local
  // database still contains rows owned by the previous Clerk id. The archive
  // pages already reconnect that session by stable username; character access
  // must use the same identity or every sheet link briefly opens and then
  // redirects back to the roster. Keep this fallback development-only.
  if (process.env.NODE_ENV === "development" && !viewerInternalId) {
    const clerkAccount = await currentUser().catch(() => null);
    const localIdentity = await resolveLocalAuthorIdentity(
      clerkUserId,
      clerkAccount?.username,
    );
    effectiveClerkUserId = localIdentity.clerkUserId;
    viewerInternalId = localIdentity.internalUserId;
  }

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
  // Local data spans both ownership conventions used by the app: older rows
  // store the Clerk id while newer rows may store the internal user UUID.
  // Resolve both to the same OWNER permission so every character surface uses
  // one answer after a local Clerk development instance is recreated.
  if (
    charRow.userId === effectiveClerkUserId ||
    (viewerInternalId !== null && charRow.userId === viewerInternalId)
  ) {
    return {
      character: charRow,
      permission: "OWNER",
      viewerInternalId,
      ownerInternalId: viewerInternalId,
    };
  }

  // Step 4: not the owner — check shares. viewerInternalId is the
  // join key into character_shares.sharedWithUserId.
  if (!viewerInternalId) {
    return null;
  }

  const shareRow = await db
    .select({ id: characterShares.id, canEdit: characterShares.canEdit })
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

  const suggestGrant = await db.select({ result: characterWorkspaceCommands.result }).from(characterWorkspaceCommands).where(and(eq(characterWorkspaceCommands.characterId, characterId), eq(characterWorkspaceCommands.commandId, `share-role:${shareRow[0]!.id}`))).limit(1);
  return {
    character: charRow,
    permission: permissionFromShare(shareRow[0]!.canEdit, suggestGrant[0]?.result["canSuggest"] === true),
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
 *     if (permission !== "OWNER" && permission !== "EDITOR" && isMutating) return 403;
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
