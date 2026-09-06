-- Phase 9.1: BUILD/PLAY mode flag on characters
--
-- New characters default to 'PLAY' once they're saved. The mode is
-- only meaningful while a character is open in /characters/[id] —
-- 'BUILD' enables the inline authoring surface (drag/drop chips,
-- +Add primitive, Formalize as heritage). 'PLAY' locks the accordions
-- to the read-only sheet. New characters are created in 'PLAY' by
-- default; the /characters/new page redirects to ?mode=BUILD for the
-- creation flow.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS
-- + ADD CONSTRAINT so re-running on an existing DB does nothing.
--
-- Reversible: ALTER TABLE characters DROP COLUMN mode;

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'PLAY'
  CHECK (mode IN ('BUILD', 'PLAY'));

CREATE INDEX IF NOT EXISTS characters_mode_idx ON characters (mode);
