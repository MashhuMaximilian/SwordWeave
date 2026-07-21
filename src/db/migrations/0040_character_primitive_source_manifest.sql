-- =============================================================================
-- Migration 0040: add 'MANIFEST' value to character_primitive_source enum
-- =============================================================================
-- Phase 8.1 batch 5 (rework): the character creation modal's 7 tabs
-- include a Manifest tab. When a primitive is slotted into the active
-- Manifest tab from /atelier, the slot's `source` column gets the value
-- 'MANIFEST'. The other tab values (LINEAGE, UPBRINGING) already exist
-- from migration 0037 (heritage rename). Only MANIFEST is new here.
--
-- Postgres supports ALTER TYPE ... ADD VALUE since v9.1.
-- Safe + non-destructive: existing rows are unaffected (MANIFEST is a
-- new label, not a rename).
--
-- The enum is also referenced from app code at
-- src/db/schema/characters.ts:characterPrimitiveSourceEnum — that
-- definition is updated in lockstep with this migration.
-- =============================================================================

ALTER TYPE "character_primitive_source" ADD VALUE 'MANIFEST';