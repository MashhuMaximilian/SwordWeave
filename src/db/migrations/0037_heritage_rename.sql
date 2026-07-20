-- =============================================================================
-- Migration 0037: rename templates → heritage (and sub-kinds RACE/BACKGROUND/ARCHETYPE → LINEAGE/UPBRINGING/MANIFEST)
-- =============================================================================
-- This is a hand-written migration because the renames span:
--   - 1 enum TYPE rename (template_kind → heritage_kind)
--   - 6 enum VALUE renames (2 enums × 3 values each)
--   - 1 table rename (templates → heritage)
--   - 3 junction/version table renames
--   - 16 index renames
--   - 14 column renames across 2 tables (characters + builds)
--
-- Auto-generated migrations would emit drop-and-add for each, which would
-- destroy data. Every statement below is a pure DDL rename — Postgres
-- preserves data, FK references auto-update, no rows are rewritten.
--
-- Companion code change: src/db/schema/* was updated in lockstep. See
-- docs/phase-8/HERITAGE-RENAME-PLAN.md for the full surface.
--
-- Backwards compatibility: NONE. Old URLs (?build=template, ?kind=RACE)
-- will 404 after deploy. The user explicitly requested full rename with no
-- shim (per the rename plan).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum VALUE renames (must come BEFORE the type rename below; RENAME VALUE
--    updates the catalog used by column constraints).
-- -----------------------------------------------------------------------------

-- heritage_kind (formerly template_kind): the 3 sub-kind values
ALTER TYPE template_kind RENAME VALUE 'RACE' TO 'LINEAGE';--> statement-breakpoint
ALTER TYPE template_kind RENAME VALUE 'BACKGROUND' TO 'UPBRINGING';--> statement-breakpoint
ALTER TYPE template_kind RENAME VALUE 'ARCHETYPE' TO 'MANIFEST';--> statement-breakpoint

-- publish_target_type: the 3 template-suffixed values
ALTER TYPE publish_target_type RENAME VALUE 'RACE_TEMPLATE' TO 'LINEAGE_TEMPLATE';--> statement-breakpoint
ALTER TYPE publish_target_type RENAME VALUE 'BACKGROUND_TEMPLATE' TO 'UPBRINGING_TEMPLATE';--> statement-breakpoint
ALTER TYPE publish_target_type RENAME VALUE 'ARCHETYPE_TEMPLATE' TO 'MANIFEST_TEMPLATE';--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 2. Enum TYPE rename (template_kind → heritage_kind). Safe: just renames the
--    type name in the catalog; columns reference the type by OID, not name.
-- -----------------------------------------------------------------------------

ALTER TYPE template_kind RENAME TO heritage_kind;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 3. Table renames. FK references auto-update because Postgres stores FKs as
--    OIDs to the referenced table — rename the referenced table and all FKs
--    still resolve correctly.
-- -----------------------------------------------------------------------------

ALTER TABLE templates RENAME TO heritage;--> statement-breakpoint
ALTER TABLE template_primitives RENAME TO heritage_primitives;--> statement-breakpoint
ALTER TABLE template_capabilities RENAME TO heritage_capabilities;--> statement-breakpoint
ALTER TABLE template_versions RENAME TO heritage_versions;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 4. Index renames. Indexes were named after the old table names; Postgres
--    doesn't auto-rename them when the table is renamed. Required for Drizzle
--    schema diff to stay clean (Drizzle schema references these by name).
-- -----------------------------------------------------------------------------

ALTER INDEX templates_user_id_idx RENAME TO heritage_user_id_idx;--> statement-breakpoint
ALTER INDEX templates_kind_idx RENAME TO heritage_kind_idx;--> statement-breakpoint
ALTER INDEX templates_is_public_idx RENAME TO heritage_is_public_idx;--> statement-breakpoint
ALTER INDEX templates_content_hash_idx RENAME TO heritage_content_hash_idx;--> statement-breakpoint
ALTER INDEX templates_user_name_kind_unique RENAME TO heritage_user_name_kind_unique;--> statement-breakpoint
ALTER INDEX template_primitives_pk RENAME TO heritage_primitives_pk;--> statement-breakpoint
ALTER INDEX template_primitives_template_id_idx RENAME TO heritage_primitives_template_id_idx;--> statement-breakpoint
ALTER INDEX template_primitives_primitive_id_idx RENAME TO heritage_primitives_primitive_id_idx;--> statement-breakpoint
ALTER INDEX template_capabilities_pk RENAME TO heritage_capabilities_pk;--> statement-breakpoint
ALTER INDEX template_capabilities_template_id_idx RENAME TO heritage_capabilities_template_id_idx;--> statement-breakpoint
ALTER INDEX template_capabilities_capability_id_idx RENAME TO heritage_capabilities_capability_id_idx;--> statement-breakpoint
ALTER INDEX template_versions_id_version_unique_idx RENAME TO heritage_versions_id_version_unique_idx;--> statement-breakpoint
ALTER INDEX template_versions_template_id_idx RENAME TO heritage_versions_template_id_idx;--> statement-breakpoint
ALTER INDEX template_versions_is_latest_idx RENAME TO heritage_versions_is_latest_idx;--> statement-breakpoint
ALTER INDEX builds_is_archetype_idx RENAME TO builds_is_manifest_idx;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 5. Column renames on `characters` table (descriptive fields only — no FKs).
-- -----------------------------------------------------------------------------

ALTER TABLE characters RENAME COLUMN race_name TO lineage_name;--> statement-breakpoint
ALTER TABLE characters RENAME COLUMN race_image_url TO lineage_image_url;--> statement-breakpoint
ALTER TABLE characters RENAME COLUMN race_description TO lineage_description;--> statement-breakpoint
ALTER TABLE characters RENAME COLUMN background_name TO upbringing_name;--> statement-breakpoint
ALTER TABLE characters RENAME COLUMN background_image_url TO upbringing_image_url;--> statement-breakpoint
ALTER TABLE characters RENAME COLUMN background_description TO upbringing_description;--> statement-breakpoint
ALTER TABLE characters RENAME COLUMN archetype_name TO manifest_name;--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 6. Column renames on `builds` table (descriptive + FK + boolean flag).
--    The FK renames preserve the FK to heritage.id (was templates.id) — the
--    FK constraint name auto-updates with the referenced column.
-- -----------------------------------------------------------------------------

ALTER TABLE builds RENAME COLUMN race_name TO lineage_name;--> statement-breakpoint
ALTER TABLE builds RENAME COLUMN race_description TO lineage_description;--> statement-breakpoint
ALTER TABLE builds RENAME COLUMN background_name TO upbringing_name;--> statement-breakpoint
ALTER TABLE builds RENAME COLUMN background_description TO upbringing_description;--> statement-breakpoint
ALTER TABLE builds RENAME COLUMN archetype_name TO manifest_name;--> statement-breakpoint
ALTER TABLE builds RENAME COLUMN race_id TO lineage_id;--> statement-breakpoint
ALTER TABLE builds RENAME COLUMN background_id TO upbringing_id;--> statement-breakpoint
ALTER TABLE builds RENAME COLUMN is_archetype_template TO is_manifest_template;--> statement-breakpoint
