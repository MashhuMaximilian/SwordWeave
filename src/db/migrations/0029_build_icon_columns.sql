-- ============================================================================
-- Phase 8: builds table — icon columns (live + proposed)
-- ============================================================================
-- The other 5 entity tables (primitives, effects, capabilities, templates,
-- items) all got icon columns in migrations 0027 + 0028. The builds table
-- was missing them — builds previously had only portraitUrl (a free-form
-- image link the user pastes in for hero art), which is the wrong shape
-- for the system icon: portraitUrl is just a URL with no category, no
-- color, no slot semantics.
--
-- Builds now carry the same 4 live + 4 proposed columns as every other
-- entity:
--   icon_source / icon_key / icon_url / icon_color  — committed state
--   icon_proposed_*                                  — backfill guess
--
-- portraitUrl is unchanged; it's a separate concept (hero art, optional)
-- from the system icon (always present, tinted by iconColor via the
-- /api/icons/game?color=… route).
--
-- Without this migration, the build composer's IconSlot would fail to
-- read the row's icon state, and the cards on /library (filter type=
-- BUILD_TEMPLATE) would show no icon — the live columns would 42703 on
-- first read.
--
-- The "backfill index" is a partial index on rows that still have a
-- pending proposal. Same shape as 0028 so the review UI (Phase 8 follow-
-- up) can list pending builds in one query.

ALTER TABLE "builds"
  ADD COLUMN IF NOT EXISTS "icon_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_key" text,
  ADD COLUMN IF NOT EXISTS "icon_url" text,
  ADD COLUMN IF NOT EXISTS "icon_color" text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS "icon_proposed_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_proposed_key" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_url" text,
  ADD COLUMN IF NOT EXISTS "icon_proposed_color" text;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "builds_has_proposal_idx"
  ON "builds" ("id")
  WHERE "icon_proposed_source" IS NOT NULL;
