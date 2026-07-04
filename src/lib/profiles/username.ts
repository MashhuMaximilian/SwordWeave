/**
 * Username validation and normalization.
 *
 * Rules:
 *   - 3-64 characters
 *   - lowercase letters, digits, underscores only
 *   - cannot start or end with underscore
 *   - no consecutive underscores
 *   - cannot be a reserved name (case-insensitive)
 */

import { RESERVED_USERNAMES } from "./reserved-usernames";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 64;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;
export const USERNAME_LEADING_TRAILING_UNDERSCORE = /^_|_$/;
export const USERNAME_CONSECUTIVE_UNDERSCORES = /__/;

export type UsernameValidationError =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_CHARACTERS"
  | "LEADING_OR_TRAILING_UNDERSCORE"
  | "CONSECUTIVE_UNDERSCORES"
  | "RESERVED"
  | "EMPTY";

export interface UsernameValidationResult {
  valid: boolean;
  normalized: string | null;
  error: UsernameValidationError | null;
  errorMessage: string | null;
}

const ERROR_MESSAGES: Record<UsernameValidationError, string> = {
  TOO_SHORT: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
  TOO_LONG: `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`,
  INVALID_CHARACTERS:
    "Username can only contain lowercase letters, digits, and underscores.",
  LEADING_OR_TRAILING_UNDERSCORE:
    "Username cannot start or end with an underscore.",
  CONSECUTIVE_UNDERSCORES: "Username cannot contain consecutive underscores.",
  RESERVED: "This username is reserved.",
  EMPTY: "Username is required.",
};

const RESERVED_SET = new Set(
  RESERVED_USERNAMES.map((r) => r.username.toLowerCase()),
);

/**
 * Normalize a username to canonical form (lowercase, trimmed).
 * Returns null if the input is empty/whitespace-only.
 */
export function normalizeUsername(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Validate a username. Returns the normalized form on success, error details
 * on failure. The caller decides whether to actually use the normalized form
 * (e.g. surface "Did you mean?" to the user).
 */
export function validateUsername(input: string): UsernameValidationResult {
  const normalized = normalizeUsername(input);
  if (normalized === null) {
    return {
      valid: false,
      normalized: null,
      error: "EMPTY",
      errorMessage: ERROR_MESSAGES.EMPTY,
    };
  }

  if (normalized.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      normalized,
      error: "TOO_SHORT",
      errorMessage: ERROR_MESSAGES.TOO_SHORT,
    };
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      normalized,
      error: "TOO_LONG",
      errorMessage: ERROR_MESSAGES.TOO_LONG,
    };
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "INVALID_CHARACTERS",
      errorMessage: ERROR_MESSAGES.INVALID_CHARACTERS,
    };
  }

  if (USERNAME_LEADING_TRAILING_UNDERSCORE.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "LEADING_OR_TRAILING_UNDERSCORE",
      errorMessage: ERROR_MESSAGES.LEADING_OR_TRAILING_UNDERSCORE,
    };
  }

  if (USERNAME_CONSECUTIVE_UNDERSCORES.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "CONSECUTIVE_UNDERSCORES",
      errorMessage: ERROR_MESSAGES.CONSECUTIVE_UNDERSCORES,
    };
  }

  if (RESERVED_SET.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: "RESERVED",
      errorMessage: ERROR_MESSAGES.RESERVED,
    };
  }

  return { valid: true, normalized, error: null, errorMessage: null };
}

/**
 * Anonymize a deleted user. Format: deleted-user-<short-hash>.
 * Hash is the first 8 hex chars of a deterministic SHA-256 of the user id.
 * Deterministic so the same deleted user always gets the same anonymized
 * username (for join consistency in URLs and queries).
 */
export async function anonymizeUserId(
  userId: string,
  cryptoImpl: { subtle: SubtleCrypto } = crypto,
): Promise<string> {
  const data = new TextEncoder().encode(userId);
  const digest = await cryptoImpl.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Use underscores (not hyphens) so the anonymized name passes the username
  // pattern check (lowercase letters, digits, underscores only).
  return `deleted_user_${hex}`;
}