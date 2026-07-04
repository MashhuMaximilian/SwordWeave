// =============================================================================
// Resolve library-item authors
//
// Phase 4 schemas use `user_id text` on items (primitives/templates) where
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
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
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