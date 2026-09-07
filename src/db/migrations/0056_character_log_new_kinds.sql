-- Migration 0056 (Phase 9.3): NO-OP. The skill
-- (swordweave-phase8-character-sheet-runtime, section 0) is
-- authoritative: character_log.kind is a plain text column
-- created in 0045, NOT a Postgres enum. The drizzle pgEnum is
-- purely TypeScript-level.
--
-- This file is kept as a marker that no SQL is needed when adding
-- new CharacterLogKind values. To add a kind: edit the drizzle
-- pgEnum in src/db/schema/characters.ts and the payload union in
-- src/lib/character/character-log.ts. The text column accepts any
-- string at the DB layer.

SELECT 1;
