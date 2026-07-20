// =============================================================================
// Author display helpers — admin-masked username/displayName.
//
// Phase 9 follow-up: extracted from library-query.ts so client components
// can import these helpers without pulling in the server-only `db`
// dependency. Previously the helpers lived inside library-query.ts
// (which imports `db` from `@/db/client`); once client components
// (library-table, library-preview-pane, grammar-library, etc.) started
// importing the helpers, Turbopack tried to bundle `@next/env` for the
// browser, breaking the build with "Can't resolve 'fs'".
//
// Rule (Phase 9 round 5 — user feedback after round 4 still leaked):
//   Every UI surface that renders an author identity (table cells,
//   card footers, preview modals, profile chips, etc.) calls one of
//   these helpers. A row renders "by System" when ANY of:
//     - authorUsername is null (no user attached)
//     - authorIsAdmin === true (the user is a Clerk admin)
//     - sourceOrigin === "system" (legacy system rows where user_id
//       got stamped with the current user's clerk ID during an
//       unrelated edit; the sourceOrigin column is the only honest
//       signal that this row was authored by the corpus)
//
// Returns `null` for all three cases so the caller renders the same
// "by System" fallback uniformly.
// =============================================================================

export interface AuthorDisplayInput {
  authorUsername: string | null;
  authorDisplayName?: string | null;
  authorIsAdmin?: boolean | null;
  /**
   * Row's sourceOrigin column. The literal string "system" marks
   * system-attributed rows even when user_id was set to a real
   * user during a downstream edit. Without this check, the legacy
   * stock corpus renders "by @mashu" for the logged-in user
   * instead of "by System".
   */
  sourceOrigin?: string | null;
}

function isSystemAuthored(item: AuthorDisplayInput): boolean {
  // No Clerk user attached = system.
  if (!item.authorUsername) return true;
  // Admin user = system.
  if (item.authorIsAdmin === true) return true;
  // Legacy row stamped with system sourceOrigin = system, even if
  // user_id is set to a real user.
  if (item.sourceOrigin === "system") return true;
  return false;
}

/**
 * Returns the username to render for the row's author, with admin
 * authors + system-authored rows masked to null. Falls back to null
 * when no username is present (system content).
 */
export function authorDisplayUsername(item: AuthorDisplayInput): string | null {
  if (isSystemAuthored(item)) return null;
  return item.authorUsername;
}

/**
 * Returns the display name to render for the row's author, with
 * admin authors + system-authored rows masked to null. Falls back
 * to username if no displayName is set, then null — mirrors the
 * OwnerBar's preference order (display name > username > System).
 */
export function authorDisplayName(item: AuthorDisplayInput): string | null {
  if (isSystemAuthored(item)) return null;
  return item.authorDisplayName ?? item.authorUsername ?? null;
}

/**
 * Server-side equivalent of `isSystemAuthored` for code paths that
 * only have a Clerk user object (not a LibraryItem). Returns true
 * when the row should render as "by System" — i.e. the author is
 * null, the author is a Clerk admin, OR the row's sourceOrigin
 * marks it as legacy system content.
 */
export function isSystemAuthoredServer(opts: {
  author: { isAdmin: boolean } | null | undefined;
  sourceOrigin: string | null | undefined;
  hasUserId: boolean;
}): boolean {
  // No Clerk user attached = system.
  if (!opts.hasUserId) return true;
  // Admin user = system.
  if (opts.author?.isAdmin === true) return true;
  // Legacy row stamped with system sourceOrigin = system.
  if (opts.sourceOrigin === "system") return true;
  return false;
}
