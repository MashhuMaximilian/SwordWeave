-- Phase 8.5 / Session H6 (Mashu 2026-08-03)
-- Add is_not_equippable flag to items.
--
-- Rationale: some items (consumables like potions, scrolls,
-- ammunition pouches) are carried but never "equipped" — they
-- just sit in the character's inventory and are used from there.
-- Forcing such items through the equip slot accounting (and the
-- Equip / Unequip button on the character sheet's Items tab)
-- is misleading. Setting is_not_equippable = true tells the UI
-- to hide the equip toggle and the engine to skip these items
-- when computing equip slot usage (slots are still used by
-- WEAPON / ARMOR / FOCUS items).
--
-- Default false (most items CAN be equipped).

ALTER TABLE "items"
  ADD COLUMN "is_not_equippable" boolean NOT NULL DEFAULT false;
