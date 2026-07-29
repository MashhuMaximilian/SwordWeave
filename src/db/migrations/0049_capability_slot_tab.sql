-- =============================================================================
-- Migration 0049: capability_slot_tab column
-- =============================================================================
-- Phase 8.4 v24.6 (Mashu 2026-07-29): per-tab accordion routing for DIRECT
-- capabilities (originHeritageId IS NULL).
--
-- Background: when a user slots a capability DIRECTLY (not via a heritage)
-- into the character edit modal, they pick a tab (Lineage / Upbringing /
-- Manifest). The sheet currently hardcodes all direct caps into the MANIFEST
-- accordion, so slots made from the Lineage/Upbringing tabs were invisible on
-- the character sheet.
--
-- Fix: add a slot_tab column that records which tab the cap was slotted into.
-- Heritage-bundled caps (originHeritageId IS NOT NULL) leave slot_tab NULL —
-- they inherit the tab from their heritage's kind (already wired). Existing
-- direct caps default to MANIFEST (preserves the old behavior).
-- =============================================================================

ALTER TABLE character_capabilities
  ADD COLUMN slot_tab heritage_kind NULL;

-- Default for existing direct caps (heritage-bundled ones stay NULL).
UPDATE character_capabilities
   SET slot_tab = 'MANIFEST'
 WHERE origin_heritage_id IS NULL;

-- Future inserts default to MANIFEST when not specified.
ALTER TABLE character_capabilities
  ALTER COLUMN slot_tab SET DEFAULT 'MANIFEST';