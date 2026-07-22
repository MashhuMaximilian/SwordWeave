-- Migration 0044 — Phase 8.1 batch 13.1 follow-up
--
-- Mashu 2026-07-22: "If I forked something and then when I try to
-- delete it it tells me i cannot bc it has 2 templates capabilities
-- or whatever...which is weird. If I created a character or a
-- heritage of sorts or capability, and I delete it, I only delete
-- that compilation, not its components too."
--
-- Two schema-level blockers were preventing this:
--
--   1. heritage_capabilities.capability_id had ON DELETE RESTRICT.
--      Deleting a capability that any heritage referenced failed.
--      The user's mental model: deleting a cap removes that cap +
--      the link rows pointing to it; the heritages that referenced
--      it just lose that slot (they're NOT deleted).
--
--   2. build_capabilities.capability_id had ON DELETE RESTRICT.
--      Same blocker. Same fix.
--
-- Note: character_capabilities.capability_id stays RESTRICT —
-- characters are sacred; you can't accidentally delete a cap that
-- a character has slotted. The user didn't complain about that
-- case and the existing character-side blocker behavior is
-- correct.
--
-- The endpoint-level blocker check in /api/creations/delete was
-- also redundant — it counted `heritage_capabilities` rows for a
-- template and refused deletion. The schema already cascades on
-- heritage delete (templateId → heritage_primitives / heritage_
-- capabilities / heritage_versions all CASCADE). So that endpoint
-- check has been removed in code (see creations/delete/route.ts).
--
-- Note on constraint names: Drizzle generates constraint names
-- from the Drizzle table variable name (e.g. `templateCapabilities`)
-- NOT the physical table name (`heritage_capabilities`). So the
-- physical constraint name in Postgres is
-- `template_capabilities_capability_id_capabilities_id_fk` even
-- though the table is `heritage_capabilities`. We drop by that
-- physical constraint name.

ALTER TABLE "heritage_capabilities"
  DROP CONSTRAINT IF EXISTS "template_capabilities_capability_id_capabilities_id_fk";

ALTER TABLE "heritage_capabilities"
  ADD CONSTRAINT "template_capabilities_capability_id_capabilities_id_fk"
  FOREIGN KEY ("capability_id")
  REFERENCES "capabilities"("id")
  ON DELETE CASCADE;

ALTER TABLE "build_capabilities"
  DROP CONSTRAINT IF EXISTS "build_capabilities_capability_id_capabilities_id_fk";

ALTER TABLE "build_capabilities"
  ADD CONSTRAINT "build_capabilities_capability_id_capabilities_id_fk"
  FOREIGN KEY ("capability_id")
  REFERENCES "capabilities"("id")
  ON DELETE CASCADE;