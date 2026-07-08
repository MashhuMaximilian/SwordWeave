-- Migration 0025: Phase 5 backfill — populate version_id + slot_source
-- on existing character_primitives, character_capabilities, character_items
-- rows that were created BEFORE Phase 5 wired up the slot metadata.
--
-- Background
-- ----------
-- Phase 3 (migration 0021) added the version_id + slot_source columns to
-- the 3 character_* junction tables but did NOT populate them for existing
-- rows — they got the default values (version_id = NULL, slot_source =
-- 'PINNED'). Phase 5 wires up the routes to populate these on every new
-- slot, but the 10 existing rows in prod (7 character_capabilities + 3
-- character_items + 0 character_primitives) need a one-time backfill.
--
-- What this migration does
-- ------------------------
-- For each character_primitives row: set version_id = the latest
--   primitive_versions.id for that primitive, and slot_source based on
--   primitive.userId vs characters.userId and primitive.sourceOrigin.
-- For each character_capabilities row: same, with capability_versions.
-- For each character_items row: same, with item_versions.
--
-- slot_source rules (mirrors src/lib/versions/slot-source.ts):
--   - entity.userId IS NULL (system content) → 'PINNED'
--   - entity.userId != character.userId     → 'PINNED'
--   - entity.userId = character.userId AND sourceOrigin starts with 'fork:' → 'FORKED'
--   - otherwise                             → 'OWNED'
--
-- Idempotency. Each UPDATE has a WHERE that re-derives the values. The
-- migration is safe to re-run; the SET clause is deterministic so the
-- second run produces the same end state. We do NOT skip rows that
-- already have version_id — running the migration a second time will
-- re-resolve and update (useful if primitive_versions gets new rows
-- after the first backfill).
--
-- Performance. Junction tables are small (10 rows total at the time of
-- this migration). The subqueries against *_versions are each O(rows in
-- version table) but filtered by is_latest=true and an index on
-- (entity_id, version_number). Cost is negligible.
--
-- Rollback. If this needs to be undone: UPDATE character_primitives
-- SET version_id = NULL, slot_source = 'PINNED'; (and same for the
-- other two). The columns are nullable + enum-defaulted so NULL/PINNED
-- is always a valid state.

-- =============================================================================
-- character_primitives
-- =============================================================================
UPDATE character_primitives cp
SET
  version_id = pv.id,
  slot_source = CASE
    WHEN p.user_id IS NULL THEN 'PINNED'::slot_source
    WHEN p.user_id <> c.user_id THEN 'PINNED'::slot_source
    WHEN p.source_origin LIKE 'fork:%' THEN 'FORKED'::slot_source
    ELSE 'OWNED'::slot_source
  END
FROM characters c, primitives p
LEFT JOIN LATERAL (
  SELECT id
  FROM primitive_versions
  WHERE primitive_id = p.id AND is_latest = true
  ORDER BY version_number DESC
  LIMIT 1
) pv ON true
WHERE cp.character_id = c.id
  AND cp.primitive_id = p.id;
--> statement-breakpoint

-- =============================================================================
-- character_capabilities
-- =============================================================================
UPDATE character_capabilities cc
SET
  version_id = cv.id,
  slot_source = CASE
    WHEN cap.user_id IS NULL THEN 'PINNED'::slot_source
    WHEN cap.user_id <> c.user_id THEN 'PINNED'::slot_source
    WHEN cap.source_origin LIKE 'fork:%' THEN 'FORKED'::slot_source
    ELSE 'OWNED'::slot_source
  END
FROM characters c, capabilities cap
LEFT JOIN LATERAL (
  SELECT id
  FROM capability_versions
  WHERE capability_id = cap.id AND is_latest = true
  ORDER BY version_number DESC
  LIMIT 1
) cv ON true
WHERE cc.character_id = c.id
  AND cc.capability_id = cap.id;
--> statement-breakpoint

-- =============================================================================
-- character_items
-- =============================================================================
UPDATE character_items ci
SET
  version_id = iv.id,
  slot_source = CASE
    WHEN i.user_id IS NULL THEN 'PINNED'::slot_source
    WHEN i.user_id <> c.user_id THEN 'PINNED'::slot_source
    WHEN i.source_origin LIKE 'fork:%' THEN 'FORKED'::slot_source
    ELSE 'OWNED'::slot_source
  END
FROM characters c, items i
LEFT JOIN LATERAL (
  SELECT id
  FROM item_versions
  WHERE item_id = i.id AND is_latest = true
  ORDER BY version_number DESC
  LIMIT 1
) iv ON true
WHERE ci.character_id = c.id
  AND ci.item_id = i.id;
