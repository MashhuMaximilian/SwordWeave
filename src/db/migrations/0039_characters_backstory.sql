-- =============================================================================
-- Migration 0039: add `backstory jsonb` column to `characters`
-- =============================================================================
-- Phase 8.1 batch 5 (rework): the character creation modal's Backstory
-- tab holds four freeform fields:
--   - origin       (Origin & History)
--   - motivation   (Motivation & Goals)
--   - ties         (Ties & Allies)
--   - flaw         (Flaw & Conflict)
--
-- Per Mashu 2026-07-21: JSONB for flexibility. New fields can be added
-- without schema migrations. The shape is documented in
-- src/components/character-modal/character-modal-store.tsx (TypeScript
-- interface CharacterBackstory).
--
-- Safe + non-destructive: existing rows get an empty object.
--
-- Hand-written because drizzle-kit 0.31 cannot regenerate the snapshot
-- (same drift as 0037/0038). See
-- docs/phase-8/SESSION-RECAP-character-modal-and-slot-buttons.md rev 10.
-- =============================================================================

ALTER TABLE "characters"
  ADD COLUMN "backstory" jsonb NOT NULL DEFAULT '{}'::jsonb;