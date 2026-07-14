-- =============================================================================
-- Migration 0030: simplify system source_origin to plain "system"
-- =============================================================================
-- All 139 canonical primitive rows are currently stamped with
-- `source_origin = 'system:phase5-commit-c-library-seed'`. The seed-name
-- suffix was useful as a transient backfill marker (see migration 0020)
-- but is a recurring maintenance hazard:
--   - Migration-aware seeders must match the exact seed string forever,
--     or every schema change requires a backfill migration. We hit this
--     bug in Phase-7-A: the seeder's ON CONFLICT key didn't match the
--     new (name, source_origin) constraint because suffix strings had
--     drifted.
--   - Adding future canonical content means choosing a fresh seed-name
--     token (system:phase8-foo, system:phase9-bar, …) or staying
--     inheriting the phase-5 token. Both are papercuts.
--
-- Goal: all canonical-system content gets a single, stable identity:
-- `source_origin = 'system'`. User content (`user:<clerk-id>`) and fork
-- content (`fork:<source-id>`) keep their existing provenance — only
-- the canonical-system suffix is being removed.
--
-- This migration is non-destructive: it only rewrites the suffix string
-- of system content. The (name, source_origin) unique constraint
-- remains the public-identity contract from migration 0020.
--
-- After this migration runs, scripts/seed-bu-market.ts is updated to
-- write SEED_SOURCE_ORIGIN = "system" instead of the phase-5 token.
-- =============================================================================

UPDATE "primitives"
SET "source_origin" = 'system'
WHERE "source_origin" = 'system:phase5-commit-c-library-seed';
