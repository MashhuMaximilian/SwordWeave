-- ============================================================================
-- Phase 7: Speed/Quickening category + target_scope field on primitives
-- ============================================================================
-- The BU Market canonical separates Speed/Quickening from DURATION:
-- DURATION = how long effects persist; SPEED/QUICKENING = when execution happens
-- in combat. This migration adds the missing enum value and a targetScope
-- field for modifier primitives (e.g., +2 to Prowess) so they can be mirrored
-- or targeted at build time without baking the scope into the primitive.

-- 1. Add SPEED_QUICKENING enum value
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'SPEED_QUICKENING';--> statement-breakpoint

-- 2. Add target_scope column to primitives
--    For modifier primitives (probability bias, attribute/dice bonuses, etc.),
--    this records the narrow scope the modifier applies to: a specific
--    Practice (e.g., 'AWARENESS'), an Attribute ('PHYSICAL'), HP, or
--    'NARROW_FOCUS' for ultra-specific triggers.
--    Stored as a free-form text field with the canonical vocabulary enforced
--    at write-time (see src/lib/primitives/target-scope.ts).
ALTER TABLE "primitives"
  ADD COLUMN IF NOT EXISTS "target_scope" text;--> statement-breakpoint

-- 3. Add mirrored_target_scope for the mirror-vector field
--    When a primitive is mirrorable, the mirror mode applies to the same
--    target_scope (we don't allow scoping a mirror to a different thing).
--    This is implicit — mirrors inherit target_scope from their parent.
--    No new column needed.

-- 4. Index for fast filter-by-scope lookups in capability builder
CREATE INDEX IF NOT EXISTS "primitives_target_scope_idx"
  ON "primitives" ("target_scope")
  WHERE "target_scope" IS NOT NULL;
