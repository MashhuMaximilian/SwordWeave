-- Phase 9.4 (Mashu 2026-09-07): character_primitives gets an
-- originItemId column so a primitive can be slotted directly
-- onto an item (the character's physical inventory).
--
-- Items are containers that nest primitives / effects /
-- capabilities. Until this migration, primitives slotted to
-- item bodies had no column to record that — they had to be
-- walked via character_capabilities which only worked for
-- capability-bundled primitives.
--
-- Migration is idempotent (ADD COLUMN IF NOT EXISTS requires
-- Postgres 9.6+, which Vercel Postgres satisfies). Re-running
-- on an existing DB does nothing.
--
-- Reversible: ALTER TABLE character_primitives DROP COLUMN
-- origin_item_id;

ALTER TABLE character_primitives
  ADD COLUMN IF NOT EXISTS origin_item_id uuid
  REFERENCES items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS character_primitives_origin_item_idx
  ON character_primitives(origin_item_id);

-- The partial unique indexes inherited_uniq / mirror_uniq were
-- updated to include the new column in the schema layer. They
-- already exist as partial indexes; Postgres does not support
-- adding/removing columns from an existing partial unique
-- index without dropping and recreating it. Drop and recreate
-- to pick up the new column.

DROP INDEX IF EXISTS character_primitives_inherited_uniq;
CREATE UNIQUE INDEX character_primitives_inherited_uniq
  ON character_primitives(character_id, primitive_id)
  WHERE origin_heritage_id IS NOT NULL
     OR origin_capability_id IS NOT NULL
     OR origin_effect_id IS NOT NULL
     OR origin_item_id IS NOT NULL;

DROP INDEX IF EXISTS character_primitives_mirror_uniq;
CREATE UNIQUE INDEX character_primitives_mirror_uniq
  ON character_primitives(character_id, primitive_id)
  WHERE is_mirrored = true
    AND origin_heritage_id IS NULL
    AND origin_capability_id IS NULL
    AND origin_effect_id IS NULL
    AND origin_item_id IS NULL;
