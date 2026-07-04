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
    ...timestamps,
  },
  (table) => [
    index("templates_user_id_idx").on(table.userId),
    index("templates_kind_idx").on(table.kind),
    index("templates_is_public_idx").on(table.isPublic),
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
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.characterId, table.itemId],
      name: "character_items_pk",
    }),
    index("character_items_character_id_idx").on(table.characterId),
    index("character_items_item_id_idx").on(table.itemId),
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