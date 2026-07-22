-- =============================================================================
-- Migration 0043: character_primitives origin tracking for bundle expansion
-- =============================================================================
-- Phase 8.1 batch 13.1 (Mashu 2026-07-22): the user clarified that
-- capabilities and effects are ways to "organize" primitives — the
-- only thing that costs BU is the primitive. So when a heritage
-- bundles primitives + capabilities, and a capability bundles
-- primitives + effects, and an effect bundles primitives, ALL of
-- those primitives must show on the character sheet (deduped) with
-- their origin tagged so the player can see where each one came
-- from.
--
-- This migration adds three nullable FK columns to character_primitives
-- so each row can record which container brought it in:
--
--   origin_heritage_id   uuid  → the heritage row (if any) that bundled this
--   origin_capability_id uuid  → the capability row (if any) that bundled this
--   origin_effect_id     uuid  → the effect row (if any) that bundled this
--
-- Constraints:
--   - Exactly one origin (or none for directly-slotted primitives).
--   - When origin_* is set, source reflects the top-level container's source
--     tab (LINEAGE / UPBRINGING / MANIFEST / PERSONAL). When none are set,
--     source is whatever the user picked on the slot (PERSONAL by default).
--
-- The bundle-expander server logic (src/lib/engine/bundle-expander.ts)
-- populates these columns. They are nullable so the migration is safe
-- on existing data: pre-batch-13.1 rows have all nulls and behave as
-- "directly slotted, origin unknown" — same as today.
--
-- We do NOT add a check constraint enforcing "exactly one origin" because
-- a primitive might come from a heritage → capability → effect chain and
-- we want to record the FULL chain for UI breadcrumbs. Future batch can
-- add stricter constraints if needed.
-- =============================================================================

ALTER TABLE "character_primitives"
  ADD COLUMN IF NOT EXISTS "origin_heritage_id" uuid REFERENCES "heritage"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "origin_capability_id" uuid REFERENCES "capabilities"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "origin_effect_id" uuid REFERENCES "effects"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_primitives_origin_heritage_idx" ON "character_primitives" ("origin_heritage_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_primitives_origin_capability_idx" ON "character_primitives" ("origin_capability_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_primitives_origin_effect_idx" ON "character_primitives" ("origin_effect_id");--> statement-breakpoint

-- Phase 8.1 batch 13.1: a capability can be brought in via a heritage
-- (lineage/upbringing/manifest). Track which heritage owns it so the
-- sheet can show breadcrumbs.
ALTER TABLE "character_capabilities"
  ADD COLUMN IF NOT EXISTS "origin_heritage_id" uuid REFERENCES "heritage"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_capabilities_origin_heritage_idx" ON "character_capabilities" ("origin_heritage_id");