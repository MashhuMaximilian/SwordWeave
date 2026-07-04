-- ============================================================================
-- Phase 4.5: Complete BU Market taxonomy + volatility tracking
-- ============================================================================
-- Adds missing primitive categories from the BU Market Canonical page,
-- and the is_mirrored column on character_primitives (junction) to track
-- mirror-vector (negative) primitive acquisitions per character.

-- 1. Extend primitive_category enum with missing categories from BU Market
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'PROBABILITY_BIAS';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'TRIGGER_HOOK';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'PERCEPTION_QUALIFIER';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'KINETIC_CONTROL';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'AGENCY_OVERRIDE';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'METAMORPHOSIS';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'ACTION_ECONOMY';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'EVALUATION_STRAIN';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'TEMPORAL_CHRONOLOGICAL';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'SENSORY_ARRAY';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'MOBILITY_LOCOMOTION';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'TARGETING_AOE';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'INTENSITY_DICE';--> statement-breakpoint
ALTER TYPE "public"."primitive_category" ADD VALUE IF NOT EXISTS 'BOSS_ECONOMY';--> statement-breakpoint

-- 2. Add is_mirrored column on character_primitives junction
--    Tracks per-link whether the primitive was acquired as a mirror (negative).
--    Mirrored primitives grant mirrorBuCredit back to the character instead of
--    consuming BU. Multiple mirror links accumulate against the volatility
--    ceiling (see src/lib/engine/volatility.ts).
ALTER TABLE "character_primitives"
  ADD COLUMN IF NOT EXISTS "is_mirrored" boolean NOT NULL DEFAULT false;--> statement-breakpoint