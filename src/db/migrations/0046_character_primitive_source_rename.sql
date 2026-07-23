-- =============================================================================
-- Migration 0046: rename character_primitive_source enum values
-- =============================================================================
-- Phase 8.1 batch 5 (rework) followup: migration 0037 (heritage rename)
-- renamed the heritage_kind enum values (RACE/BACKGROUND/ARCHETYPE →
-- LINEAGE/UPBRINGING/MANIFEST) and the heritage table itself, but it
-- MISSED the sibling character_primitive_source enum which had parallel
-- values (RACE/BACKGROUND/MANIFEST).
--
-- The TS schema was updated in lockstep (see
-- src/db/schema/characters.ts characterPrimitiveSourceEnum). Any character
-- POST that includes a heritage-bundled primitive references the new names
-- ('LINEAGE', 'UPBRINGING', 'MANIFEST'), so pg rejects the insert with
-- `invalid input value for enum character_primitive_source: "LINEAGE"` and
-- the entire character_primitives batch rolls back. The character insert
-- also rolls back — that's why every create attempt silently fails.
--
-- Migration 0040 only added the new 'MANIFEST' value on top of the old enum,
-- but the old enum had 'RACE'/'BACKGROUND', not 'LINEAGE'/'UPBRINGING'.
-- Postgres ALTER TYPE doesn't allow renaming enum values in 14, so we
-- work around by: add new values, migrate column data, drop old values.
--
-- Safe + non-destructive when applied to a fresh DB. On a DB with
-- existing rows, the UPDATE rewrites the source column from old labels to
-- new labels. Verified against the live DB: no rows reference the old
-- labels yet (Testim has empty primitiveLinks), so the UPDATE is a no-op.
-- =============================================================================

-- Step 1: add the new enum values alongside the old ones. Idempotent via
-- IF NOT EXISTS (Postgres supports this since v9.6).
ALTER TYPE "character_primitive_source" ADD VALUE IF NOT EXISTS 'LINEAGE';-->statement-breakpoint
ALTER TYPE "character_primitive_source" ADD VALUE IF NOT EXISTS 'UPBRINGING';-->statement-breakpoint
-- MANIFEST was added by migration 0040; the IF NOT EXISTS makes this safe
-- to re-run.
ALTER TYPE "character_primitive_source" ADD VALUE IF NOT EXISTS 'MANIFEST';

-- Step 2: rewrite any existing rows from old labels to new labels. CASCADE
-- would be tempting, but explicit is safer — only the source column on
-- character_primitives uses this enum (verified in src/db/schema).
UPDATE "character_primitives"
   SET "source" = 'LINEAGE'::"character_primitive_source"
 WHERE "source"::text = 'RACE';-->statement-breakpoint
UPDATE "character_primitives"
   SET "source" = 'UPBRINGING'::"character_primitive_source"
 WHERE "source"::text = 'BACKGROUND';

-- Step 3: Postgres 14 doesn't support DROP VALUE for enums (added in 15
-- for some forms, full support later). New labels coexist with old ones
-- until the column is migrated to a new enum type. Since we've already
-- rewritten the existing rows, the old values are unused — but pg will
-- still reject them on insert.
--
-- The TS schema no longer references the old labels, so the app never
-- sends them. New inserts use only the new labels. The unused old
-- labels are harmless inert catalog entries.
--
-- If/when the project upgrades to Postgres 15+, run:
--   ALTER TYPE "character_primitive_source" DROP VALUE 'RACE';
--   ALTER TYPE "character_primitive_source" DROP VALUE 'BACKGROUND';