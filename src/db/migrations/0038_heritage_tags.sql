-- =============================================================================
-- Migration 0038: add `tags text[]` column to `heritage`
-- =============================================================================
-- Phase 8 rev 10: heritage parity with primitives/capabilities/effects/items.
-- Every entity kind now carries a `tags text[]` column for free-form tag
-- chips in the unified preview. Heritage was the last holdout — adding it
-- closes the gap so the Tags section renders consistently across every kind.
--
-- Schema change: src/db/schema/characters.ts:heritage adds `tags` text[]
-- with the same default + NOT NULL shape as items/capabilities/effects.
-- A GIN index `heritage_tags_idx` is added to match the others.
--
-- Safe + non-destructive: existing rows get an empty array; new writes
-- from the heritage form's `tags` (comma-separated -> array) populate it.
--
-- Hand-written because the project uses drizzle-kit 0.31 which can't generate
-- while the snapshot drift from the heritage rename (0037) is unresolved.
-- Snapshots need a separate manual regeneration pass — see
-- `docs/phase-8/SESSION-RECAP-character-modal-and-slot-buttons.md` rev 10.
-- =============================================================================

ALTER TABLE "heritage"
  ADD COLUMN "tags" text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE INDEX "heritage_tags_idx" ON "heritage" USING gin ("tags");