-- =============================================================================
-- Migration 0045: Phase 8.2 batch 1 — character_log table
-- =============================================================================
-- Phase 8.2 (Mashu 2026-07-22): the character sheet needs a persistent
-- history of runtime events so players can remember what happened
-- between sessions ("I took 30 damage last session... did I heal any
-- of it back?"). The user clarified that all per-character runtime
-- state lives on the sheet, not in the modal/builder:
--
--   - Vitality changes (damage / heal)
--   - Rest events (long / short)
--   - Capability trigger (one-shot fire + revert)
--   - Capability toggle (active ↔ inactive)
--   - Item equip / unequip
--   - Level-up
--
-- Capability toggle state itself is localStorage-only per Mashu's
-- preference — it shouldn't survive a hard refresh, but the act of
-- toggling SHOULD leave a log entry so players can reconstruct
-- their session narrative.
--
-- Shape:
--   character_log
--     id          bigserial PK
--     character_id uuid FK → characters.id (CASCADE)
--     kind        text — discriminator (vitality_change / rest / level_up /
--                            capability_trigger / capability_toggle /
--                            item_equip / item_unequip)
--     payload     jsonb — per-kind structured data (delta + new_value for
--                          vitality_change, rest_type for rest, etc.)
--     created_at  timestamptz NOT NULL DEFAULT now()
--
-- Indexed by (character_id, created_at DESC) so the sheet's log view
-- reads "most recent first" without a sort.
--
-- Append-only by convention — no update / delete in app code. Cascade
-- on character delete cleans the log automatically.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "character_log" (
  "id" bigserial PRIMARY KEY,
  "character_id" uuid NOT NULL REFERENCES "characters"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "character_log_character_created_idx"
  ON "character_log" ("character_id", "created_at" DESC);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "character_log_kind_idx"
  ON "character_log" ("kind");