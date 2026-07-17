/**
 * Profile lookup, creation, mutation, and anonymization.
 *
 * The webhook handler (user.created) and any internal user-creation flow go
 * through `createProfileFromClerk()`. Username changes go through
 * `renameUsername()` which writes to username_history for old-URL redirects.
 * Soft delete uses `softDeleteUser()` which sets `deleted_at` and schedules
 * `purge_after`. Final purge is `anonymizeUser()`.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userStats, usernameHistory, users } from "@/db/schema/profiles";
import {
  anonymizeUserId as buildAnonymizedName,
  validateUsername,
} from "./username";

export interface CreateProfileInput {
  clerkUserId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  // Phase 7.10 system-user rule: when true, the user's authored canon rows
  // render as "System" in the UI. Populated from Clerk publicMetadata.role
  // === "admin" by the webhook and sync route.
  isAdmin?: boolean;
}

export interface CreateProfileResult {
  ok: boolean;
  userId?: string;
  error?:
    | "USERNAME_INVALID"
    | "USERNAME_RESERVED"
    | "USERNAME_TAKEN"
    | "CLERK_ID_TAKEN";
  errorMessage?: string;
}

/**
 * Create a SwordWeave profile for a Clerk user. Idempotent on
 * (clerkUserId, username) — if the Clerk user already has a profile with the
 * same username, returns the existing row. If the username is taken by
 * someone else, fails.
 */
export async function createProfileFromClerk(
  input: CreateProfileInput,
): Promise<CreateProfileResult> {
  const validation = validateUsername(input.username);
  if (!validation.valid || !validation.normalized) {
    return {
      ok: false,
      error: "USERNAME_INVALID",
      errorMessage: validation.errorMessage ?? "Invalid username",
    };
  }
  const username = validation.normalized;

  // Check username uniqueness first (cheaper than Clerk id check, but both
  // needed to give a precise error)
  const existingByUsername = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true, clerkUserId: true },
  });
  if (existingByUsername) {
    if (existingByUsername.clerkUserId === input.clerkUserId) {
      // Same user re-registering — return existing row
      return { ok: true, userId: existingByUsername.id };
    }
    return {
      ok: false,
      error: "USERNAME_TAKEN",
      errorMessage: `Username "${username}" is already taken.`,
    };
  }

  // Check Clerk id uniqueness
  const existingByClerkId = await db.query.users.findFirst({
    where: eq(users.clerkUserId, input.clerkUserId),
    columns: { id: true, username: true },
  });
  if (existingByClerkId) {
    return {
      ok: true,
      userId: existingByClerkId.id,
    };
  }

  // Insert
  const [row] = await db
    .insert(users)
    .values({
      clerkUserId: input.clerkUserId,
      username,
      displayName: input.displayName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      isAdmin: input.isAdmin ?? false,
    })
    .returning({ id: users.id });

  if (!row) {
    return {
      ok: false,
      error: "USERNAME_TAKEN",
      errorMessage: "Failed to create profile (concurrent insert?).",
    };
  }

  // Initialize user_stats row
  await db.insert(userStats).values({ userId: row.id });

  return { ok: true, userId: row.id };
}

export interface RenameResult {
  ok: boolean;
  error?: "USERNAME_INVALID" | "USERNAME_TAKEN" | "NOT_FOUND";
  errorMessage?: string;
}

/**
 * Rename a user. Writes the old username to username_history so /u/<old>
 * routes can redirect. Free, no rate limit (per spec).
 */
export async function renameUsername(
  userId: string,
  newUsernameRaw: string,
): Promise<RenameResult> {
  const validation = validateUsername(newUsernameRaw);
  if (!validation.valid || !validation.normalized) {
    return {
      ok: false,
      error: "USERNAME_INVALID",
      errorMessage: validation.errorMessage ?? "Invalid username",
    };
  }
  const newUsername = validation.normalized;

  const current = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true },
  });
  if (!current) {
    return { ok: false, error: "NOT_FOUND" };
  }

  if (current.username === newUsername) {
    return { ok: true }; // no-op
  }

  // Check the new username isn't taken
  const taken = await db.query.users.findFirst({
    where: eq(users.username, newUsername),
    columns: { id: true },
  });
  if (taken && taken.id !== userId) {
    return {
      ok: false,
      error: "USERNAME_TAKEN",
      errorMessage: `Username "${newUsername}" is already taken.`,
    };
  }

  // Update + write history in one transaction
  const result = await db.transaction(async (tx) => {
    await tx.insert(usernameHistory).values({
      userId,
      oldUsername: current.username,
      newUsername,
    });
    const [updated] = await tx
      .update(users)
      .set({ username: newUsername })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return updated;
  });

  if (!result) {
    return { ok: false, error: "NOT_FOUND" };
  }
  return { ok: true };
}

/**
 * Resolve a username to a user, following username_history redirects. Returns
 * null if the username has never been used by anyone.
 */
export async function resolveUsername(
  username: string,
): Promise<{ id: string; currentUsername: string } | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;

  // Direct hit
  const direct = await db.query.users.findFirst({
    where: eq(users.username, normalized),
    columns: { id: true, username: true },
  });
  if (direct) {
    return { id: direct.id, currentUsername: direct.username };
  }

  // Redirect from history
  const histRow = await db.query.usernameHistory.findFirst({
    where: eq(usernameHistory.oldUsername, normalized),
    columns: { userId: true, newUsername: true },
  });
  if (histRow) {
    // Walk forward — the current username is whatever users.username is now
    const current = await db.query.users.findFirst({
      where: eq(users.id, histRow.userId),
      columns: { id: true, username: true },
    });
    if (current) return { id: current.id, currentUsername: current.username };
  }

  return null;
}

export interface SoftDeleteOptions {
  graceDays?: number;
  now?: Date;
}

/**
 * Soft-delete a user. Sets deleted_at and purge_after (now + 30 days by
 * default). Content remains; final anonymization happens in
 * `anonymizeUser()`.
 */
export async function softDeleteUser(
  userId: string,
  options: SoftDeleteOptions = {},
): Promise<{ ok: boolean; purgeAfter: Date | null }> {
  const graceDays = options.graceDays ?? 30;
  const now = options.now ?? new Date();
  const purgeAfter = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(users)
    .set({ deletedAt: now, purgeAfter, updatedAt: now })
    .where(and(eq(users.id, userId), /* only if not already deleted */))
    .returning({ id: users.id, deletedAt: users.deletedAt });

  if (!updated || !updated.deletedAt) {
    // Was the user already deleted? Check.
    const existing = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { deletedAt: true, purgeAfter: true },
    });
    return { ok: !!existing?.deletedAt, purgeAfter: existing?.purgeAfter ?? null };
  }
  return { ok: true, purgeAfter };
}

/**
 * Anonymize a user. Replaces username, displayName, avatar, bio, social links
 * with anonymous placeholders. Original content (primitives, capabilities,
 * characters, etc.) remains linked to the user id but is no longer
 * attributable. Mark the row with `isAnonymized=true` so the UI can render a
 * tombstone.
 */
export async function anonymizeUser(userId: string): Promise<{
  ok: boolean;
  anonymizedUsername: string | null;
}> {
  const anonymizedUsername = await buildAnonymizedName(userId);

  const [updated] = await db
    .update(users)
    .set({
      username: anonymizedUsername,
      displayName: "Deleted User",
      avatarUrl: null,
      bio: null,
      socialLinks: {},
      isAnonymized: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ username: users.username });

  if (!updated) return { ok: false, anonymizedUsername: null };
  return { ok: true, anonymizedUsername: updated.username };
}

/**
 * Find users whose grace period has expired and are not yet anonymized.
 * Returns ids so the caller can anonymize each one.
 */
export async function findUsersReadyForPurge(now: Date = new Date()): Promise<
  Array<{ id: string; username: string }>
> {
  return db.query.users.findMany({
    where: (u, { and: a, isNotNull, lte, eq: e }) =>
      a(
        a(e(u.isAnonymized, false), isNotNull(u.deletedAt)),
        lte(u.purgeAfter, now),
      ),
    columns: { id: true, username: true },
  });
}