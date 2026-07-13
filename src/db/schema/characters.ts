/**
 * Phase 4 schema — characters, races, backgrounds, items, builds.
 *
 * Identity model:
 * - Characters are user-owned (user_id required for ownership)
 * - Races, backgrounds, items, builds have nullable user_id (null = canonical/system)
 * - All support soft identity: (name, user_id) is unique; (name, source_origin) is public identity
 *
 * Identity follows the DM-Override principle from UX-WORKFLOW-SPEC:
 * anyone can edit any record if they're using it.
 */
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { iconSourceEnum } from "./enums";
import { timestamps } from "./common";
import { entities } from "./entities";
import { items } from "./items";
import {
  capabilities,
  capabilityPrimitives,
  primitives,
} from "./engine";

// =============================================================================
// Enums
// =============================================================================

export const characterSizeEnum = pgEnum("character_size", [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
]);

export const characterAttrEnum = pgEnum("character_attribute", [
  "PHYSICAL",
  "MENTAL",
  "MAGICAL",
]);

export const characterPrimitiveSourceEnum = pgEnum("character_primitive_source", [
  "RACE",
  "BACKGROUND",
  "PERSONAL",
  "TRAINING",
  "LEVEL_UP",
  "DM",
]);

export const templateKindEnum = pgEnum("template_kind", [
  "RACE",
  "BACKGROUND",
  "ARCHETYPE",
]);

export const itemSizeEnum = pgEnum("item_size", [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
]);

// =============================================================================
// Characters
// =============================================================================

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),                  // nullable for system/example characters
    name: text("name").notNull(),
    size: characterSizeEnum("size").notNull().default("MEDIUM"),
    raceName: text("race_name"),
    raceImageUrl: text("race_image_url"),
    raceDescription: text("race_description"),
    backgroundName: text("background_name"),
    backgroundImageUrl: text("background_image_url"),
    backgroundDescription: text("background_description"),
    archetypeName: text("archetype_name"),
    level: integer("level").notNull().default(1),
    attrPhysical: integer("attr_physical").notNull().default(0),
    attrMental: integer("attr_mental").notNull().default(0),
    attrMagical: integer("attr_magical").notNull().default(0),
    attrProficient: characterAttrEnum("attr_proficient"),
    practiceSlices: jsonb("practice_slices").notNull().default(sql`'{}'::jsonb`),
    currentVitality: integer("current_vitality"),
    startingBu: integer("starting_bu").notNull().default(25),
    buSpent: integer("bu_spent").notNull().default(0),
    dmBonusBu: integer("dm_bonus_bu").notNull().default(0),
    enforceTemplateCaps: boolean("enforce_template_caps").notNull().default(false),
    isMirrored: boolean("is_mirrored").notNull().default(false),
    notes: text("notes"),
    dmNotes: text("dm_notes"),
    portraitUrl: text("portrait_url"),
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"), // "build:<id>" | "manual" | etc.
    ...timestamps,
  },
  (table) => [
    index("characters_user_id_idx").on(table.userId),
    index("characters_is_public_idx").on(table.isPublic),
    index("characters_user_name_idx").on(table.userId, table.name),
    // Attribute sum must equal 10, each in [-1, +5]
    check(
      "characters_attr_sum_check",
      sql`${table.attrPhysical} + ${table.attrMental} + ${table.attrMagical} = 10
          AND ${table.attrPhysical} BETWEEN -1 AND 5
          AND ${table.attrMental} BETWEEN -1 AND 5
          AND ${table.attrMagical} BETWEEN -1 AND 5`,
    ),
    // Level hard-cap at 20
    check(
      "characters_level_range_check",
      sql`${table.level} BETWEEN 1 AND 20`,
    ),
    // Total BU progression cap (hard)
    check(
      "characters_bu_progression_check",
      sql`${table.buSpent} <= ${table.startingBu} + (${table.level} - 1) * 5 + ${table.dmBonusBu}`,
    ),
    check(
      "characters_starting_bu_check",
      sql`${table.startingBu} >= 0 AND ${table.startingBu} <= 1000`,
    ),
  ],
);

// =============================================================================
// slot_source — Phase 3 of the edit-creates-fork refactor.
//
// The three values correspond to the three kinds of slot a build can hold
// for a primitive / capability / item (per §6.6 of edit-creates-fork.md):
//
//   OWNED   — the slotted entity is something the user authored from scratch.
//             Updateable from source dependencies (transitive walk).
//   FORKED  — the slotted entity is a fork. Frozen. Cannot be "updated from
//             source" — that would defeat the fork's whole purpose.
//   PINNED  — the slotted entity is a library item pinned to a specific
//             version. Updateable: re-fetch the latest version AND
//             transitively re-fetch its dependency tree.
//
// Decision logic for the value lives in the application layer
// (depends on the source's source_origin and the caller's relationship
// to the source). The DB just enforces the enum constraint.
// =============================================================================
export const slotSourceEnum = pgEnum("slot_source", [
  "OWNED",
  "FORKED",
  "PINNED",
]);

/** The 3 slot_source values. Type alias for use in app code. */
export type SlotSource = (typeof slotSourceEnum.enumValues)[number];

// Junction: character <-> primitive
export const characterPrimitives = pgTable(
  "character_primitives",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "restrict" }),
    source: characterPrimitiveSourceEnum("source").notNull().default("PERSONAL"),
    acquiredAtLevel: integer("acquired_at_level").notNull().default(1),
    /**
     * True if this primitive was acquired as a mirror vector (negative BU).
     * Mirrored primitives contribute mirrorBuCredit to the character's
     * volatility rating (bounded by getVolatilityCeiling(level)).
     * See src/lib/engine/bu.ts for full mirror-vector accounting.
     */
    isMirrored: boolean("is_mirrored").notNull().default(false),
    /**
     * Phase 3: which version of the primitive this slot references.
     * Null on rows created before versioning existed (pre-Phase 3) —
     * the runtime treats those as "version unknown" and shows a
     * stale-version indicator until the user re-slots. Phase 4
     * (content-hash auto-snapshot) populates this on new slots.
     */
    versionId: uuid("version_id"),
    /**
     * Phase 3: what kind of slot relationship this is. Drives the
     * "Update available" UI in the build preview (Phase 5) and the
     * transitive dependency walk. Defaults to PINNED because all
     * pre-Phase-3 slots are functionally a pin on the live row.
     */
    slotSource: slotSourceEnum("slot_source").notNull().default("PINNED"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.primitiveId],
      name: "character_primitives_pk",
    }),
    index("character_primitives_character_id_idx").on(table.characterId),
    index("character_primitives_primitive_id_idx").on(table.primitiveId),
    index("character_primitives_version_id_idx").on(table.versionId),
    index("character_primitives_slot_source_idx").on(table.slotSource),
  ],
);

// Junction: character <-> capability
export const characterCapabilities = pgTable(
  "character_capabilities",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "restrict" }),
    acquiredAtLevel: integer("acquired_at_level").notNull().default(1),
    /**
     * Phase 3: which version of the capability this slot references.
     * See character_primitives.versionId for the full rationale.
     */
    versionId: uuid("version_id"),
    /**
     * Phase 3: slot-source enum. See character_primitives.slotSource.
     */
    slotSource: slotSourceEnum("slot_source").notNull().default("PINNED"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.capabilityId],
      name: "character_capabilities_pk",
    }),
    index("character_capabilities_character_id_idx").on(table.characterId),
    index("character_capabilities_capability_id_idx").on(table.capabilityId),
    index("character_capabilities_version_id_idx").on(table.versionId),
    index("character_capabilities_slot_source_idx").on(table.slotSource),
  ],
);

// =============================================================================
// Templates (race / background / archetype — same shape)
// =============================================================================

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    kind: templateKindEnum("kind").notNull(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    description: text("description"),
    suggestedTraits: text("suggested_traits"), // markdown
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"),
    contentHash: text("content_hash"),
    // Phase 8: per-entity iconography (see engine.ts primitives for
    // rationale). Templates share the same icon contract as every
    // other entity — single source, single key/url, single color.
    iconSource: iconSourceEnum("icon_source"),
    iconKey: text("icon_key"),
    iconUrl: text("icon_url"),
    iconColor: text("icon_color").notNull().default("#ffffff"),
    // Phase 8 backfill: see primitives for the rationale.
    iconProposedSource: iconSourceEnum("icon_proposed_source"),
    iconProposedKey: text("icon_proposed_key"),
    iconProposedUrl: text("icon_proposed_url"),
    iconProposedColor: text("icon_proposed_color"),
    ...timestamps,
  },
  (table) => [
    index("templates_user_id_idx").on(table.userId),
    index("templates_kind_idx").on(table.kind),
    index("templates_is_public_idx").on(table.isPublic),
    index("templates_content_hash_idx").on(table.contentHash),
    // (name, user_id) unique, but Postgres treats NULL user_id as distinct
    // so we rely on application-level dedup (like capabilities migration).
    unique("templates_user_name_kind_unique").on(
      table.name,
      table.userId,
      table.kind,
    ),
  ],
);

export const templatePrimitives = pgTable(
  "template_primitives",
  {
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.templateId, table.primitiveId],
      name: "template_primitives_pk",
    }),
    index("template_primitives_template_id_idx").on(table.templateId),
    index("template_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);

export const templateCapabilities = pgTable(
  "template_capabilities",
  {
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.templateId, table.capabilityId],
      name: "template_capabilities_pk",
    }),
    index("template_capabilities_template_id_idx").on(table.templateId),
    index("template_capabilities_capability_id_idx").on(table.capabilityId),
  ],
);

// =============================================================================
// Items — defined in items.ts (Phase 4 added itemPrimitives there too)
// =============================================================================
// items, itemCapabilities, itemPrimitives live in items.ts to keep item tables
// together. Re-exported via schema/index.ts.

export const characterItems = pgTable(
  "character_items",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    equipped: boolean("equipped").notNull().default(false),
    /**
     * Phase 3: which version of the item this slot references.
     * See character_primitives.versionId for the full rationale.
     */
    versionId: uuid("version_id"),
    /**
     * Phase 3: slot-source enum. See character_primitives.slotSource.
     */
    slotSource: slotSourceEnum("slot_source").notNull().default("PINNED"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.itemId],
      name: "character_items_pk",
    }),
    index("character_items_character_id_idx").on(table.characterId),
    index("character_items_item_id_idx").on(table.itemId),
    index("character_items_version_id_idx").on(table.versionId),
    index("character_items_slot_source_idx").on(table.slotSource),
  ],
);

// =============================================================================
// Builds (character snapshots + archetype templates)
// =============================================================================

export const builds = pgTable(
  "builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    name: text("name").notNull(),
    description: text("description"),
    level: integer("level").notNull().default(1),
    startingBu: integer("starting_bu").notNull().default(25),
    isArchetypeTemplate: boolean("is_archetype_template").notNull().default(false),
    // Snapshot fields
    raceName: text("race_name"),
    raceDescription: text("race_description"),
    backgroundName: text("background_name"),
    backgroundDescription: text("background_description"),
    archetypeName: text("archetype_name"),
    attrPhysical: integer("attr_physical"),
    attrMental: integer("attr_mental"),
    attrMagical: integer("attr_magical"),
    attrProficient: characterAttrEnum("attr_proficient"),
    practiceSlices: jsonb("practice_slices"),
    portraitUrl: text("portrait_url"),
    // Refs to library
    raceId: uuid("race_id").references(() => templates.id, { onDelete: "set null" }),
    backgroundId: uuid("background_id").references(() => templates.id, {
      onDelete: "set null",
    }),
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"),
    // Phase 8: per-entity iconography. Builds previously had only
    // portraitUrl (a free-form image link the user pastes in for the
    // hero shot). They now ALSO get the system icon so the picker is
    // available in the build composer and cards show the system icon
    // in tight spaces. portraitUrl is unchanged; it's a separate concept
    // (hero art, optional) from the system icon (always present, color
    // is a per-row tint applied via /api/icons/game?color=…).
    iconSource: iconSourceEnum("icon_source"),
    iconKey: text("icon_key"),
    iconUrl: text("icon_url"),
    iconColor: text("icon_color").notNull().default("#ffffff"),
    iconProposedSource: iconSourceEnum("icon_proposed_source"),
    iconProposedKey: text("icon_proposed_key"),
    iconProposedUrl: text("icon_proposed_url"),
    iconProposedColor: text("icon_proposed_color"),
    ...timestamps,
  },
  (table) => [
    index("builds_user_id_idx").on(table.userId),
    index("builds_is_public_idx").on(table.isPublic),
    index("builds_is_archetype_idx").on(table.isArchetypeTemplate),
    check(
      "builds_level_range_check",
      sql`${table.level} BETWEEN 1 AND 20`,
    ),
  ],
);

export const buildCapabilities = pgTable(
  "build_capabilities",
  {
    buildId: uuid("build_id")
      .notNull()
      .references(() => builds.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "restrict" }),
    acquiredAtLevel: integer("acquired_at_level").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.buildId, table.capabilityId],
      name: "build_capabilities_pk",
    }),
    index("build_capabilities_build_id_idx").on(table.buildId),
    index("build_capabilities_capability_id_idx").on(table.capabilityId),
  ],
);

// Re-export engine capabilityPrimitives for relation wiring
export { capabilityPrimitives };

// Re-export entities for relation wiring
export { entities };