-- PLAN Eilxina Part C (Mashu 2026-09-09): align character_shares
-- shared_by_user_id column type with the schema code (uuid → text).
--
-- The Part B migration (0059) declared it as uuid because I planned
-- to store the owner's internal user.id. But Part C routes write
-- with clerkUserId (the session Clerk ID) directly, and
-- canResolveCharacter resolves ownership via Clerk-ID-on-row
-- comparison (the codebase convention). Switching to text matches
-- the proposals table's proposer_user_id (also text → users.clerkUserId)
-- and keeps the insert path simple (no internal-ID resolution
-- before share creation).
--
-- Idempotent: the second ALTER is a no-op if already text.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_shares'
      AND column_name = 'shared_by_user_id'
      AND data_type = 'uuid'
  ) THEN
    -- Drop the FK first (it references users.id which is uuid).
    ALTER TABLE character_shares
      DROP CONSTRAINT IF EXISTS character_shares_shared_by_user_id_fkey;
    -- Convert uuid → text. Existing UUIDs cast to text cleanly.
    ALTER TABLE character_shares
      ALTER COLUMN shared_by_user_id TYPE text USING shared_by_user_id::text;
    -- Re-add the FK to users.clerk_user_id (text).
    ALTER TABLE character_shares
      ADD CONSTRAINT character_shares_shared_by_user_id_fkey
      FOREIGN KEY (shared_by_user_id)
      REFERENCES users(clerk_user_id)
      ON DELETE CASCADE;
  END IF;
END $$;
