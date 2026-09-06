-- Phase 9.1 (Mashu 2026-09-06): mirror the lineage_id / upbringing_id
-- pattern with manifest_id. The characters table previously stored
-- manifest only via the snapshot text fields (manifestName /
-- manifestDescription); the new builder needs a real FK so the
-- accordion-to-heritage flow can persist a manifest bundle the same
-- way it persists lineage / upbringing.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS manifest_id uuid
    REFERENCES heritage(id) ON DELETE SET NULL;
