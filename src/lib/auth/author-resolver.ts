// =============================================================================
// Resolve library-item authors
//
// Phase 4 schemas use `user_id text` on items (primitives/heritage) where
// the value is actually the Clerk user ID (e.g. `user_2abc...`). Users table
// stores it as `clerk_user_id` with an internal UUID `id`. This helper
// bridges the two.
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export interface AuthorInfo {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  // Phase 7.10 system-user rule: when true, the user's authored canon rows
  // render as "System" in the library UI. Set from Clerk publicMetadata.role
  // === "admin" by the webhook and sync route.
  isAdmin: boolean;
}

export async function resolveAuthorByClerkId(
  clerkUserId: string | null | undefined,
): Promise<AuthorInfo | null> {
  if (!clerkUserId) return null;
  const row = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
    columns: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isAnonymized: true,
      deletedAt: true,
      isAdmin: true,
    },
  });
  if (!row) return null;
  // Don't surface anonymized/deleted users — their content remains in the
  // library (attributed to the original author id) but the UI should not
  // show the deterministic hash handle or display name. Return null and
  // let the caller render as system content.
  if (row.isAnonymized || row.deletedAt) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    isAdmin: row.isAdmin,
  };
}

/**
 * Phase 9 follow-up: look up the caller's `is_admin` flag in one fast
 * query. Used by `dispatchEntitySave` to apply the admin canon-edit
 * exception (intent=load + admin caller + system/admin source →
 * version-update instead of fork).
 *
 * Returns `false` when the user is unknown (safer default — non-admin
 * matrix applies) so callers don't have to null-check.
 */
export async function getCallerIsAdmin(
  clerkUserId: string | null | undefined,
): Promise<boolean> {
  if (!clerkUserId) return false;
  const row = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
    columns: { isAdmin: true },
  });
  return row?.isAdmin ?? false;
}

/**
 * Resolve a Clerk user ID → internal user UUID (the `users.id` value).
 * Returns null if the Clerk ID doesn't correspond to a known user.
 */
export async function resolveUserIdByClerkId(
  clerkUserId: string | null | undefined,
): Promise<string | null> {
  if (!clerkUserId) return null;
  const row = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
    columns: { id: true },
  });
  return row?.id ?? null;
}