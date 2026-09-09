-- PLAN Eilxina Part B (Mashu 2026-09-09): character_shares table for
-- per-character access grants between users. Distinct from publications
-- (visibility on the library codex): a share is a discrete grant to one
-- specific user, with or without edit rights, that survives even when
-- the character is private.
--
-- This is a new table; no existing schema needs to change. The
-- PARTIAL unique index enforces "one active grant per (character,
-- invitee)" — re-sharing after revoke creates a new row.
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS. Re-running on an
-- existing DB does nothing.
--
-- Reversible: DROP TABLE character_shares;

CREATE TABLE IF NOT EXISTS character_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_edit boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: at most one ACTIVE grant per (character, invitee).
-- Revoked rows excluded via WHERE so re-sharing creates a fresh row.
CREATE UNIQUE INDEX IF NOT EXISTS character_shares_active_unique_idx
  ON character_shares(character_id, shared_with_user_id)
  WHERE revoked_at IS NULL;

-- Lookups by inviter (e.g. "who am I sharing with?") and by character
-- (e.g. "who has access to this character?"). Both common in the
-- share-management UI (Part C).
CREATE INDEX IF NOT EXISTS character_shares_shared_with_idx
  ON character_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS character_shares_character_idx
  ON character_shares(character_id);
CREATE INDEX IF NOT EXISTS character_shares_shared_by_idx
  ON character_shares(shared_by_user_id);
