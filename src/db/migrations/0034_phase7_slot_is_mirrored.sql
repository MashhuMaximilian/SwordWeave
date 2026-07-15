-- 0034 — Phase 7 Q-M-UX: per-slot is_mirrored flag on editing slot tables.
--
-- The workshop composers (effect-composer, capability-composer,
-- template-composer, character-wizard) already let users flag a slotted
-- primitive as mirrored, and the persisted character slot tables
-- (character_primitives from migration 0010) already have an
-- is_mirrored column. The editing slot tables for effects,
-- capabilities, templates, and items did not — this is the gap.
--
-- This migration adds is_mirrored to all four editing slot tables so
-- the same flag can be persisted at the source-entity level. Existing
-- rows default to false (not mirrored), which is the safe initial
-- state.

ALTER TABLE "effect_primitives"
  ADD COLUMN IF NOT EXISTS "is_mirrored" boolean DEFAULT false NOT NULL;

ALTER TABLE "capability_primitives"
  ADD COLUMN IF NOT EXISTS "is_mirrored" boolean DEFAULT false NOT NULL;

ALTER TABLE "template_primitives"
  ADD COLUMN IF NOT EXISTS "is_mirrored" boolean DEFAULT false NOT NULL;

ALTER TABLE "item_primitives"
  ADD COLUMN IF NOT EXISTS "is_mirrored" boolean DEFAULT false NOT NULL;
