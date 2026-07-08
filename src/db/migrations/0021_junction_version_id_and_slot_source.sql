-- =============================================================================
-- Migration 0021: character junction version_id + slot_source enum
--
-- Phase 3 of the edit-creates-fork refactor.
-- (https://docs/architecture/edit-creates-fork.md §11.3, §6.6)
--
-- The three character junction tables now know:
--   1. WHICH version of the slotted entity they reference (version_id), so
--      a build pinned to capability v3 keeps showing v3 even if the source
--      publishes v5.
--   2. WHAT KIND of slot relationship it is (slot_source), so the build
--      preview can badge each slot OWNED / FORKED / PINNED and decide
--      whether "update from source" is available.
--
-- T3.2 (version_id) and T3.3 (slot_source) are shipped in a single
-- migration because they both target the same three tables and the
-- column-level changes are independent. Splitting them across two
-- migrations would have meant re-locking the same tables twice.
--
-- Both columns are nullable on existing rows. Per the doc:
--   - version_id NULL on existing rows → the slot was created before
--     versioning existed; the runtime treats it as "version unknown"
--     and shows a stale-version indicator until the user re-slots.
--   - slot_source is backfilled to 'PINNED' for existing rows because
--     pre-versioning slots are functionally a pin on the live row
--     (the only available version at the time).
--
-- The `slot_source` enum is created as a Postgres ENUM TYPE (not a
-- text + check) to match the rest of the schema's convention for
-- constrained string columns. Drizzle generates the right pgEnum
-- binding in src/db/schema/characters.ts.
-- =============================================================================

-- T3.2: version_id on character_primitives (nullable — backfilled lazily)
ALTER TABLE "character_primitives" ADD COLUMN "version_id" uuid;--> statement-breakpoint
CREATE INDEX "character_primitives_version_id_idx"
  ON "character_primitives" USING btree ("version_id");--> statement-breakpoint

-- T3.2: version_id on character_capabilities (nullable)
ALTER TABLE "character_capabilities" ADD COLUMN "version_id" uuid;--> statement-breakpoint
CREATE INDEX "character_capabilities_version_id_idx"
  ON "character_capabilities" USING btree ("version_id");--> statement-breakpoint

-- T3.2: version_id on character_items (nullable)
ALTER TABLE "character_items" ADD COLUMN "version_id" uuid;--> statement-breakpoint
CREATE INDEX "character_items_version_id_idx"
  ON "character_items" USING btree ("version_id");--> statement-breakpoint

-- T3.3: slot_source enum type
CREATE TYPE "slot_source" AS ENUM ('OWNED', 'FORKED', 'PINNED');--> statement-breakpoint

-- T3.3: slot_source on character_primitives
ALTER TABLE "character_primitives" ADD COLUMN "slot_source" "slot_source";--> statement-breakpoint
UPDATE "character_primitives" SET "slot_source" = 'PINNED' WHERE "slot_source" IS NULL;--> statement-breakpoint
ALTER TABLE "character_primitives"
  ALTER COLUMN "slot_source" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "character_primitives"
  ALTER COLUMN "slot_source" SET DEFAULT 'PINNED';--> statement-breakpoint
CREATE INDEX "character_primitives_slot_source_idx"
  ON "character_primitives" USING btree ("slot_source");--> statement-breakpoint

-- T3.3: slot_source on character_capabilities
ALTER TABLE "character_capabilities" ADD COLUMN "slot_source" "slot_source";--> statement-breakpoint
UPDATE "character_capabilities" SET "slot_source" = 'PINNED' WHERE "slot_source" IS NULL;--> statement-breakpoint
ALTER TABLE "character_capabilities"
  ALTER COLUMN "slot_source" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "character_capabilities"
  ALTER COLUMN "slot_source" SET DEFAULT 'PINNED';--> statement-breakpoint
CREATE INDEX "character_capabilities_slot_source_idx"
  ON "character_capabilities" USING btree ("slot_source");--> statement-breakpoint

-- T3.3: slot_source on character_items
ALTER TABLE "character_items" ADD COLUMN "slot_source" "slot_source";--> statement-breakpoint
UPDATE "character_items" SET "slot_source" = 'PINNED' WHERE "slot_source" IS NULL;--> statement-breakpoint
ALTER TABLE "character_items"
  ALTER COLUMN "slot_source" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "character_items"
  ALTER COLUMN "slot_source" SET DEFAULT 'PINNED';--> statement-breakpoint
CREATE INDEX "character_items_slot_source_idx"
  ON "character_items" USING btree ("slot_source");
