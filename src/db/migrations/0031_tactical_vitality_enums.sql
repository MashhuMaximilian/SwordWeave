-- 0031 — Add TACTICAL and VITALITY to primitive_category enum.
--
-- Why: The audit (Phase 7-B) and user clarification identified
-- two missing categories required by canonical rules:
--
--   TACTICAL — spatial/tactical modifiers (Cover Tiers I-IV).
--   VITALITY — life-state primitives (Stabilize, Last Breath,
--              and any future death-clock mechanic primitives).
--
-- These cannot be cleanly modeled in any existing category:
--   - DOMAIN is for thematic reality licenses (Fire/Force/etc.)
--   - DEFENSE/DEFENSIVE is for defense-roll modifiers
--   - TRIGGER_HOOK is for conditional firing, not life-state
--
-- Mechanically adding rows to existing categories would mix
-- taxonomies and break the audit matrix's stated intent.
--
-- This migration extends the enum in place. Postgres requires
-- ALTER TYPE ... ADD VALUE, which must run outside a transaction
-- block on older versions. Neon/PG 16 supports it inside txns,
-- so we wrap for safety but it should run as a single statement.
--
-- Idempotency: ADD VALUE IF NOT EXISTS is supported in PG 12+.

ALTER TYPE "primitive_category" ADD VALUE IF NOT EXISTS 'TACTICAL';
ALTER TYPE "primitive_category" ADD VALUE IF NOT EXISTS 'VITALITY';
