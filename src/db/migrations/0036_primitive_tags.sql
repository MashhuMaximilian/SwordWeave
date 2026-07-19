-- =============================================================================
-- Migration 0036: add `tags` text[] column to `primitives`
-- =============================================================================
-- Effects, capabilities, items, and templates already carry a `tags` text[]
-- column (one chip each in the unified preview). Primitives were missing
-- it, so the Tags section only showed for some entity kinds. This migration
-- adds the column (nullable text[] defaulting to empty), matching the
-- shape used elsewhere, so every entity kind can surface free-form tags.
--
-- Safe + non-destructive: existing rows get an empty array; new writes
-- from the primitive form's `tags` (comma-separated -> array) populate it.
-- =============================================================================

ALTER TABLE "primitives"
  ADD COLUMN "tags" text[] NOT NULL DEFAULT ARRAY[]::text[];
