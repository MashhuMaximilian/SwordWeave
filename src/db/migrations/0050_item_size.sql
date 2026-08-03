-- Phase 8.5 / Session H1 (Mashu 2026-08-03)
-- Item size for encumbrance.
--
-- One item = one size. The size drives:
--   - encumbrance Load (via SIZE_LOAD map in lib/engine/encumbrance.ts)
--   - equip slot cost (via SIZE_SLOT_COST map — see same module)
--   - pouch rule for TINY items (1000/pouch)
--
-- All existing items default to SMALL.

CREATE TYPE "item_size" AS ENUM (
  'TINY',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'HUGE',
  'GARGANTUAN'
);

ALTER TABLE "items"
  ADD COLUMN "size" "item_size" NOT NULL DEFAULT 'SMALL';

CREATE INDEX "items_size_idx" ON "items" USING btree ("size");
