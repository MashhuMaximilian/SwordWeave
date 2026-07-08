-- Migration 0024: Phase 4 missing version-table indexes
--
-- Background. Migration 0014 (Phase 6 backend, src/db/migrations/0014_phase6_effect_item_versions.sql)
-- created `effect_versions` + `item_versions` AND their indexes. The Drizzle
-- schema in src/db/schema/versions.ts declares the SAME shape for
-- primitive_versions, capability_versions, and template_versions, including
-- a unique index on (entity_id, version_number) — but the matching CREATE
-- UNIQUE INDEX statements were never written as a migration. Result: those
-- 3 tables in prod have only the primary key.
--
-- This was a real bug discovered 2026-07-08 when the first user save
-- against a primitive went through src/lib/versions/auto-snapshot.ts and
-- Postgres rejected the ON CONFLICT (primitive_id, version_number) clause
-- with SQLSTATE 42P10 ("there is no unique or exclusion constraint matching
-- the ON CONFLICT specification"). Confirmed by:
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'primitive_versions';
--   → only `primitive_versions_pkey` (id). No `_id_version_unique_idx`.
--
-- What this migration does
-- ------------------------
-- For each of the 3 affected tables, add:
--   1. A UNIQUE INDEX on (entity_id, version_number) — required for the
--      `ON CONFLICT (entity_id, version_number) DO UPDATE` in
--      recordVersion (src/lib/versions/auto-snapshot.ts:203).
--   2. The regular (entity_id) lookup index (matches the Drizzle schema).
--   3. The (is_latest) lookup index.
--
-- These are the exact names Drizzle's `pgTable(...)` would have generated,
-- keeping the prod DB in lockstep with src/db/schema/versions.ts.
--
-- Idempotency note. CREATE UNIQUE INDEX IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS are used so re-running the migration is a no-op. Verified
-- safe because the constraints they're guarded by are pre-existing in the
-- Drizzle schema — there's no scenario where we'd want a different
-- version of the same constraint.
--
-- Affected tables
-- ---------------
--   primitive_versions  — entity column: primitive_id (integer)
--   capability_versions — entity column: capability_id (uuid)
--   template_versions   — entity column: template_id (uuid)
--
-- Effect_versions and item_versions are NOT touched (they already have
-- the indexes from migration 0014).

CREATE UNIQUE INDEX IF NOT EXISTS "primitive_versions_id_version_unique_idx"
  ON "primitive_versions" USING btree ("primitive_id","version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "primitive_versions_primitive_id_idx"
  ON "primitive_versions" USING btree ("primitive_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "primitive_versions_is_latest_idx"
  ON "primitive_versions" USING btree ("is_latest");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capability_versions_id_version_unique_idx"
  ON "capability_versions" USING btree ("capability_id","version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capability_versions_capability_id_idx"
  ON "capability_versions" USING btree ("capability_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capability_versions_is_latest_idx"
  ON "capability_versions" USING btree ("is_latest");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "template_versions_id_version_unique_idx"
  ON "template_versions" USING btree ("template_id","version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_versions_template_id_idx"
  ON "template_versions" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_versions_is_latest_idx"
  ON "template_versions" USING btree ("is_latest");
