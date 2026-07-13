-- ============================================================================
-- Phase 8: Icon system columns for all entity tables
-- ============================================================================
-- Per-entity iconography: every entity (primitive/effect/capability/
-- template/item) can have a single icon attached. The icon is either:
--   - a game-icons.net slug (e.g. 'lorc/sword-brandish'), rendered via
--     the CDN-cached /api/icons/game proxy with the creator's chosen color
--   - a custom upload stored in private Vercel Blob at
--     'user-uploads/<uuid>.ext', proxied through Clerk-auth
--     /api/icons/blob
--
-- Columns:
--   icon_source  : enum GAME_ICONS | UPLOAD | null (null = no icon yet)
--   icon_key     : the slug (only meaningful when source = GAME_ICONS)
--   icon_url     : the blob path (only meaningful when source = UPLOAD)
--   icon_color   : creator's chosen hex color (default #ffffff)
--
-- Nullable on all four so the migration is safe on the existing 145
-- primitives + 25 capabilities + 8 effects + 16 templates + 5 items
-- already in production. Existing rows simply have no icon until the
-- creator opens the editor.

-- 1. New enum type
DO $$ BEGIN
  CREATE TYPE "public"."icon_source" AS ENUM ('GAME_ICONS', 'UPLOAD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- 2. primitives
ALTER TABLE "primitives"
  ADD COLUMN IF NOT EXISTS "icon_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_key" text,
  ADD COLUMN IF NOT EXISTS "icon_url" text,
  ADD COLUMN IF NOT EXISTS "icon_color" text NOT NULL DEFAULT '#ffffff';--> statement-breakpoint

-- 3. effects
ALTER TABLE "effects"
  ADD COLUMN IF NOT EXISTS "icon_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_key" text,
  ADD COLUMN IF NOT EXISTS "icon_url" text,
  ADD COLUMN IF NOT EXISTS "icon_color" text NOT NULL DEFAULT '#ffffff';--> statement-breakpoint

-- 4. capabilities
ALTER TABLE "capabilities"
  ADD COLUMN IF NOT EXISTS "icon_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_key" text,
  ADD COLUMN IF NOT EXISTS "icon_url" text,
  ADD COLUMN IF NOT EXISTS "icon_color" text NOT NULL DEFAULT '#ffffff';--> statement-breakpoint

-- 5. templates (covers race/background/archetype/build templates)
ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "icon_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_key" text,
  ADD COLUMN IF NOT EXISTS "icon_url" text,
  ADD COLUMN IF NOT EXISTS "icon_color" text NOT NULL DEFAULT '#ffffff';--> statement-breakpoint

-- 6. items
ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "icon_source" "public"."icon_source",
  ADD COLUMN IF NOT EXISTS "icon_key" text,
  ADD COLUMN IF NOT EXISTS "icon_url" text,
  ADD COLUMN IF NOT EXISTS "icon_color" text NOT NULL DEFAULT '#ffffff';--> statement-breakpoint

-- 7. Indexes for icon lookups (used by the icon picker when filtering
--    "show me icons already used on my entities"). Game-icons slugs
--    are unique enough that a btree on (icon_key) WHERE icon_source =
--    GAME_ICONS is enough; uploaded URLs are unique per row by blob path.
CREATE INDEX IF NOT EXISTS "primitives_icon_key_idx"
  ON "primitives" ("icon_key")
  WHERE "icon_source" = 'GAME_ICONS';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "effects_icon_key_idx"
  ON "effects" ("icon_key")
  WHERE "icon_source" = 'GAME_ICONS';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capabilities_icon_key_idx"
  ON "capabilities" ("icon_key")
  WHERE "icon_source" = 'GAME_ICONS';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_icon_key_idx"
  ON "templates" ("icon_key")
  WHERE "icon_source" = 'GAME_ICONS';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_icon_key_idx"
  ON "items" ("icon_key")
  WHERE "icon_source" = 'GAME_ICONS';