-- Phase 9.3 (Mashu 2026-09-06): add new character_log_kind enum values.
--
-- "capability_attached" = a capability was attached to a character
--   via POST /api/characters/[id]/capabilities/attach. Distinct
--   from primitive_slotted because the subject is a capability, not
--   a primitive.
-- "effect_attached" = an effect was attached via the parallel
--   /effects/attach route.
-- "item_attached" = reserved for /items/attach (Phase 9.3 follow-up).
--
-- Idempotent: ALTER TYPE ... ADD VALUE IF NOT EXISTS is supported
-- in Postgres 9.6+. Re-running on an existing DB does nothing.
--
-- Reversible: ALTER TYPE ... DROP VALUE (Postgres 16+); otherwise
-- delete the rows first.

ALTER TYPE character_log_kind ADD VALUE IF NOT EXISTS 'capability_attached';
ALTER TYPE character_log_kind ADD VALUE IF NOT EXISTS 'effect_attached';
ALTER TYPE character_log_kind ADD VALUE IF NOT EXISTS 'item_attached';
