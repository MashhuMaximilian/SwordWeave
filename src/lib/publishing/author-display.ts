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
// Rule: every UI surface that renders an author identity (table cells,
// card footers, preview modals, profile chips, etc.) calls one of these
// helpers. When the row's author is a Clerk admin, the helper returns
// null so the caller renders "by System" instead of "@xeun".
//
// Returns `null` for both admin authors AND missing authors (e.g.
// system content with user_id IS NULL). Callers should render the
// same fallback ("by System") in both cases.
// =============================================================================

export interface AuthorDisplayInput {
  authorUsername: string | null;
  authorDisplayName?: string | null;
  authorIsAdmin?: boolean | null;
}

/**
 * Returns the username to render for the row's author, with admin
 * authors masked to null. Falls back to null when no username is
 * present (system content).
 */
export function authorDisplayUsername(item: AuthorDisplayInput): string | null {
  if (!item.authorUsername) return null;
  if (item.authorIsAdmin === true) return null;
  return item.authorUsername;
}

/**
 * Returns the display name to render for the row's author, with
 * admin authors masked to null. Falls back to username if no
 * displayName is set, then null — mirrors the OwnerBar's
 * preference order (display name > username > System).
 */
export function authorDisplayName(item: AuthorDisplayInput): string | null {
  if (item.authorIsAdmin === true) return null;
  return item.authorDisplayName ?? item.authorUsername ?? null;
}
