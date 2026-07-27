-- =============================================================================
-- Migration 0048: Phase 8.3a — multi-instance primitive model
-- =============================================================================
-- Per Mashu 2026-07-27 message.txt, the v2 storage model requires three
-- storage outcomes per (character, primitive_id):
--
--   1. Inherited (origin_* set) → 1 row collapsed, free, 1× effect
--   2. Direct + paid (origin_* null, is_mirrored false) → N rows allowed,
--      each pays full BU, stacks
--   3. Direct + mirrored (origin_* null, is_mirrored true) → 1 row,
--      links to inherited (if any), costs -BU, flips sign
--
-- The current PK `character_primitives_pk (character_id, primitive_id)`
-- enforces 1 row per (character, primitive) which kills both (2) and (3).
-- This migration replaces it with:
--   * An instance_id UUID surrogate key on every row
--   * Partial unique indexes for inherited (one per char/prim) and mirror
--     (one per char/prim) rows
--   * No constraint on direct-paid rows (multiple allowed)
--
-- Mirror scope (per Mashu 2026-07-27 followup): the mirror flag affects
-- only the character's stat aggregation. When a primitive is referenced
-- inside a capability or effect, the reference uses the primitive's
-- authored direction — the mirror is invisible to the reference resolver.
--
-- NOTE: this migration is hand-written because the migration snapshot
-- (0035_snapshot.json) is stale relative to the current schema (migrations
-- 0037-0047 made enum/table renames that didn't regenerate snapshots).
-- The SQL is idempotent where possible (IF NOT EXISTS) and the changes
-- are minimal. See followup task: regenerate snapshots for 0037-0048.
-- =============================================================================

-- 1. Add instance_id (nullable first so existing rows don't fail)
ALTER TABLE "character_primitives"
  ADD COLUMN IF NOT EXISTS "instance_id" UUID DEFAULT gen_random_uuid();--> statement-breakpoint

-- 2. Backfill existing rows with fresh UUIDs (NULL → UUID)
UPDATE "character_primitives"
  SET "instance_id" = gen_random_uuid()
  WHERE "instance_id" IS NULL;--> statement-breakpoint

-- 3. Make instance_id NOT NULL now that all rows have one
ALTER TABLE "character_primitives"
  ALTER COLUMN "instance_id" SET NOT NULL;--> statement-breakpoint

-- 3b. Ensure the DEFAULT is preserved on the NOT NULL column so future
--     inserts auto-generate an instance_id (matching the Drizzle schema).
DO $$
BEGIN
  -- Postgres doesn't have IF EXISTS for column default, so check via pg_attrdef.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef
    WHERE adrelid = 'character_primitives'::regclass
      AND attnum = (SELECT attnum FROM pg_attribute
                    WHERE attrelid = 'character_primitives'::regclass
                      AND attname = 'instance_id')
  ) THEN
    ALTER TABLE "character_primitives"
      ALTER COLUMN "instance_id" SET DEFAULT gen_random_uuid();
  END IF;
END $$;--> statement-breakpoint

-- 4. Drop the existing PK
ALTER TABLE "character_primitives"
  DROP CONSTRAINT "character_primitives_pk";--> statement-breakpoint

-- 5. Add partial unique indexes

-- 5a. Inherited rows: one per (character, primitive) where origin_* is set
CREATE UNIQUE INDEX IF NOT EXISTS "character_primitives_inherited_uniq"
  ON "character_primitives" ("character_id", "primitive_id")
  WHERE "origin_heritage_id" IS NOT NULL
     OR "origin_capability_id" IS NOT NULL
     OR "origin_effect_id" IS NOT NULL;--> statement-breakpoint

-- 5b. Mirror rows: one per (character, primitive) where is_mirrored = true
--     and no origin (direct mirror slot, linking to inherited copy if any)
CREATE UNIQUE INDEX IF NOT EXISTS "character_primitives_mirror_uniq"
  ON "character_primitives" ("character_id", "primitive_id")
  WHERE "is_mirrored" = true
    AND "origin_heritage_id" IS NULL
    AND "origin_capability_id" IS NULL
    AND "origin_effect_id" IS NULL;--> statement-breakpoint

-- 5c. Note: direct-paid rows have NO unique constraint. Multiple rows
--     per (character, primitive) are allowed, each with is_mirrored=false
--     and origin_* null. Each represents an intentional duplicate purchase.

-- 6. Add an index on instance_id for direct row lookups (e.g. by id)
CREATE INDEX IF NOT EXISTS "character_primitives_instance_id_idx"
  ON "character_primitives" ("instance_id");--> statement-breakpoint

-- =============================================================================
-- Rollback considerations (for posterity):
--
-- To roll back:
--   1. DROP INDEX IF EXISTS character_primitives_instance_id_idx;
--   2. DROP INDEX IF EXISTS character_primitives_mirror_uniq;
--   3. DROP INDEX IF EXISTS character_primitives_inherited_uniq;
--   4. ALTER TABLE character_primitives DROP COLUMN instance_id;
--   5. ALTER TABLE character_primitives ADD CONSTRAINT
--      character_primitives_pk PRIMARY KEY (character_id, primitive_id);
--
-- This will fail if the data has multiple direct-paid rows per (char, prim).
-- Manual cleanup of duplicate rows would be required.
-- =============================================================================