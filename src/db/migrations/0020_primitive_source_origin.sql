-- =============================================================================
-- Migration 0020: universal source_origin on primitives
--
-- Phase 3 of the edit-creates-fork refactor.
-- (https://docs/architecture/edit-creates-fork.md §11.3, §6.5)
--
-- Effects, capabilities, items, and templates already have a `source_origin`
-- text column with a unique index on (name, source_origin). Primitives were
-- the lone holdout — they used a 3-col unique on (name, category, user_id)
-- instead. This migration brings primitives into line with the rest of the
-- engine so every entity type has a single public-identity model.
--
-- `source_origin` is the *public identity* of a row:
--   - system content → "system:<seed-name>"   (e.g. system:phase5-commit-c-library-seed)
--   - user-authored  → "user:<clerk-user-id>"
--   - fork           → "fork:<source-row-id>"
--
-- The (name, source_origin) unique constraint is what makes the fork
-- lineage system work: a fork of "Strike" gets source_origin="fork:<id>"
-- and can have the same name as the source without collision. Two system
-- rows with the same name (across categories) are likewise distinguishable
-- by their seed-name suffix.
--
-- Backfill strategy (idempotent on re-runs):
--   1. Add column nullable.
--   2. user_id IS NULL  → 'system:phase5-commit-c-library-seed'
--      user_id IS NOT NULL → 'user:' || user_id
--   3. Drop the (name, category, user_id) unique index.
--   4. Create the (name, source_origin) unique index.
--
-- Safety: 0 collisions on (name, user_id) for owned rows and 0 on
-- (name, category) for system rows in the current dataset (audited
-- 2026-07-08 before this migration). Re-run scripts/check-collision-risk.mts
-- before applying to a fresh prod copy.
--
-- Trade-off: dropping the category column from the unique means two
-- user-authored primitives with the same name in different categories can
-- now coexist. The doc §6.5 explicit chose (name, source_origin) over
-- (name, category, source_origin) for this reason: forks-of-the-same-source
-- can reuse the category naturally, and a user's "Strike" should be
-- replaceable when slotted into different build categories.
-- =============================================================================
ALTER TABLE "primitives" ADD COLUMN "source_origin" text;--> statement-breakpoint

-- Backfill. system rows get a stable seed; user rows get user:<id>.
UPDATE "primitives"
SET "source_origin" = CASE
  WHEN "user_id" IS NULL THEN 'system:phase5-commit-c-library-seed'
  ELSE 'user:' || "user_id"
END
WHERE "source_origin" IS NULL;--> statement-breakpoint

-- Drop the old 3-col unique. The replacement index below is the new
-- public-identity contract.
DROP INDEX IF EXISTS "primitives_name_category_user_unique_idx";--> statement-breakpoint

-- New public-identity unique on (name, source_origin).
CREATE UNIQUE INDEX "primitives_name_source_origin_unique_idx"
  ON "primitives" USING btree ("name", "source_origin");--> statement-breakpoint

-- Index for the common "find all rows for a given source_origin" lookup
-- (e.g. "show all forks of this primitive"). Cheap to maintain, speeds
-- up version-history queries that walk fork lineage.
CREATE INDEX "primitives_source_origin_idx"
  ON "primitives" USING btree ("source_origin");
