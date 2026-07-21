-- =============================================================================
-- Migration 0041: create character_heritages junction table
-- =============================================================================
-- Phase 8.1 batch 5 (rework): the character modal's Lineage / Upbringing
-- / Manifest tabs accept whole heritage units slotted from /atelier
-- (per Mashu 2026-07-21: "If I slot a lineage from atelier it's the
-- entire lineage as is"). Each slot is one heritage row + all its
-- bundled primitives + capabilities + effects.
--
-- Schema mirrors character_primitives (composite PK, on-delete cascade
-- from characters, restrict on heritage to prevent accidental heritage
-- deletes that would silently break character sheets). Fields:
--
--   characterId   uuid, FK -> characters.id (cascade)
--   heritageId    uuid, FK -> heritage.id (restrict)
--   acquiredAtLevel  int, default 1
--   isMirrored    bool, default false (per-slot mirror, Phase 7 Q-M-UX)
--   versionId     uuid, nullable (Phase 3+)
--   slotSource    slot_source enum, default PINNED
--   notes         text, nullable
--   timestamps    created_at + updated_at
--
-- The character's `kind` column on heritage carries the LINEAGE /
-- UPBRINGING / MANIFEST semantics — no separate source column needed
-- here. We index heritageId for fast reverse lookups (which characters
-- use this heritage).
--
-- Hand-written because drizzle-kit 0.31 cannot regenerate the snapshot.
-- =============================================================================

CREATE TABLE "character_heritages" (
  "character_id"     uuid NOT NULL REFERENCES "characters"("id") ON DELETE CASCADE,
  "heritage_id"      uuid NOT NULL REFERENCES "heritage"("id")   ON DELETE RESTRICT,
  "acquired_at_level" integer NOT NULL DEFAULT 1,
  "is_mirrored"      boolean NOT NULL DEFAULT false,
  "version_id"       uuid,
  "slot_source"      "slot_source" NOT NULL DEFAULT 'PINNED',
  "notes"            text,
  "created_at"       timestamp NOT NULL DEFAULT now(),
  "updated_at"       timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "character_heritages_pk" PRIMARY KEY ("character_id", "heritage_id")
);

CREATE INDEX "character_heritages_character_id_idx" ON "character_heritages" ("character_id");
CREATE INDEX "character_heritages_heritage_id_idx"  ON "character_heritages" ("heritage_id");
CREATE INDEX "character_heritages_version_id_idx"   ON "character_heritages" ("version_id");