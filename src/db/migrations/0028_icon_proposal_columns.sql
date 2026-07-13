-- ============================================================================
-- Phase 8: Icon proposal columns (backfill workflow)
-- ============================================================================
-- The Phase 8 schema (0027_icon_columns.sql) added icon_source / icon_key /
-- icon_url / icon_color as the *committed* icon state per entity. Those
-- are what the rest of the app reads.
--
-- This migration adds a parallel set of *proposal* columns. The backfill
-- script (scripts/backfill-icons.ts) populates these with a best-guess
-- icon for every existing entity. The review UI (Phase 8 follow-up) lets
-- a human accept (promote proposed → committed) or skip each proposal.
--
-- Why a separate column set instead of writing straight to icon_source:
--   1. The script is idempotent and safe to re-run; it can overwrite
--      its own proposals without ever touching a manually-set icon.
--   2. A user who has already picked an icon keeps their choice until
--      they explicitly accept a different proposal.
--   3. The CSV report can join against the same columns without
--      competing with manual saves.
--
-- Columns mirror 0027 exactly:
--   icon_proposed_source  : enum GAME_ICONS | UPLOAD | null
--   icon_proposed_key     : the slug, when source = GAME_ICONS
--   icon_proposed_url     : the blob path, when source = UPLOAD
--   icon_proposed_color   : the proposed hex color
--
-- All nullable. The "no proposal" state is the same as the row not
-- existing in the index, so the script can clear its work by setting
-- them back to null.

ALTER TABLE "primitives"
  ADD COLUMN IF NOT EXISTS "icon_proposed_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_proposed_key" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_url" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_color" text;--> statement-breakpoint

ALTER TABLE "effects"
  ADD COLUMN IF NOT EXISTS "icon_proposed_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_proposed_key" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_url" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_color" text;--> statement-breakpoint

ALTER TABLE "capabilities"
  ADD COLUMN IF NOT EXISTS "icon_proposed_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_proposed_key" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_url" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_color" text;--> statement-breakpoint

ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "icon_proposed_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_proposed_key" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_url" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_color" text;--> statement-breakpoint

ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "icon_proposed_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_proposed_key" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_url" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_color" text;--> statement-breakpoint

-- Backfill index: lets the review UI quickly list every entity that
-- still has a pending proposal. Partial index keeps the size down.
CREATE INDEX IF NOT EXISTS "primitives_has_proposal_idx"
  ON "primitives" ("id")
  WHERE "icon_proposed_source" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "effects_has_proposal_idx"
  ON "effects" ("id")
  WHERE "icon_proposed_source" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capabilities_has_proposal_idx"
  ON "capabilities" ("id")
  WHERE "icon_proposed_source" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_has_proposal_idx"
  ON "templates" ("id")
  WHERE "icon_proposed_source" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_has_proposal_idx"
  ON "items" ("id")
  WHERE "icon_proposed_source" IS NOT NULL;
