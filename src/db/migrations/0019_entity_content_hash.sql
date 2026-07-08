-- =============================================================================
-- Migration 0019: add content_hash to effects, capabilities, items, templates
--
-- Phase 2 of the edit-creates-fork refactor extends the Phase 1
-- dispatch matrix from primitives to the other 4 entity types.
-- Phase 4 (content hashing) was already merged into Phase 1 for
-- primitives (migration 0018); this migration brings the rest of
-- the entity types up to the same level.
--
-- Algorithm: SHA-256 over a canonical-JSON envelope
--   { "v": 1, "<entity>": { ...sorted-key payload... } }
-- See src/lib/publishing/hash-content.ts for the producer.
--
-- The column is nullable so existing rows can be backfilled in a
-- second pass (scripts/backfill-entity-content-hash.mts). Legacy
-- rows whose hash is NULL fall through to the existing INSERT/UPDATE
-- path — they're treated as "always changed" until their first save
-- under the new system computes and persists the hash.
-- =============================================================================
ALTER TABLE "effects" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE INDEX "effects_content_hash_idx" ON "effects" USING btree ("content_hash");--> statement-breakpoint
ALTER TABLE "capabilities" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE INDEX "capabilities_content_hash_idx" ON "capabilities" USING btree ("content_hash");--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE INDEX "items_content_hash_idx" ON "items" USING btree ("content_hash");--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE INDEX "templates_content_hash_idx" ON "templates" USING btree ("content_hash");
