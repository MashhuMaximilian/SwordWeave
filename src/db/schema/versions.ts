import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common";

// =============================================================================
// Versioning: only explicit "Publish" creates a version. Each version is an
// immutable snapshot stored as a delta from the previous version to save space.
// Latest version stored as full snapshot for fast reads; older versions
// reconstruct by applying forward patches from the latest.
//
//   Latest: { kind: "FULL", data: { ... } }
//   Older:  { kind: "DELTA", patch: { "field": newValue, ... } }
//
// Reconstruction walks versions newest→oldest, applying DELTA patches in
// reverse to get back to any historical version.
// =============================================================================

export const versionDeltaKindEnum = pgEnum("version_delta_kind", [
  "FULL",
  "DELTA",
]);

// =============================================================================
// Primitive versions
// =============================================================================

export const primitiveVersions = pgTable(
  "primitive_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    primitiveId: integer("primitive_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    deltaKind: versionDeltaKindEnum("delta_kind").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    publishedByUserId: uuid("published_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("primitive_versions_id_version_unique_idx").on(
      table.primitiveId,
      table.versionNumber,
    ),
    index("primitive_versions_primitive_id_idx").on(table.primitiveId),
    index("primitive_versions_is_latest_idx").on(table.isLatest),
  ],
);

// =============================================================================
// Capability versions
// =============================================================================

export const capabilityVersions = pgTable(
  "capability_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    capabilityId: uuid("capability_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    deltaKind: versionDeltaKindEnum("delta_kind").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    publishedByUserId: uuid("published_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("capability_versions_id_version_unique_idx").on(
      table.capabilityId,
      table.versionNumber,
    ),
    index("capability_versions_capability_id_idx").on(table.capabilityId),
    index("capability_versions_is_latest_idx").on(table.isLatest),
  ],
);

// =============================================================================
// Character versions
// =============================================================================

export const characterVersions = pgTable(
  "character_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    deltaKind: versionDeltaKindEnum("delta_kind").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    publishedByUserId: uuid("published_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("character_versions_id_version_unique_idx").on(
      table.characterId,
      table.versionNumber,
    ),
    index("character_versions_character_id_idx").on(table.characterId),
    index("character_versions_is_latest_idx").on(table.isLatest),
  ],
);

// =============================================================================
// Adoption: a character/capability pinned to a specific version of a
// primitive/capability they depend on. Default is the latest, but users can
// pin to an older version explicitly (no auto-update).
// =============================================================================

export const primitiveAdoptions = pgTable(
  "primitive_adoptions",
  {
    // A capability version adopts a specific primitive version.
    capabilityVersionId: uuid("capability_version_id")
      .notNull()
      .references(() => capabilityVersions.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id").notNull(),
    primitiveVersionId: uuid("primitive_version_id")
      .notNull()
      .references(() => primitiveVersions.id, { onDelete: "restrict" }),
    isLatest: boolean("is_latest").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.capabilityVersionId, table.primitiveId],
      name: "primitive_adoptions_pk",
    }),
    index("primitive_adoptions_capability_version_idx").on(
      table.capabilityVersionId,
    ),
    index("primitive_adoptions_primitive_id_idx").on(table.primitiveId),
  ],
);

// =============================================================================
// Heritage versions (lineages, upbringings, manifests, builds) — share pattern
// =============================================================================

export const heritageVersions = pgTable(
  "heritage_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    deltaKind: versionDeltaKindEnum("delta_kind").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    publishedByUserId: uuid("published_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("heritage_versions_id_version_unique_idx").on(
      table.templateId,
      table.versionNumber,
    ),
    index("heritage_versions_template_id_idx").on(table.templateId),
    index("heritage_versions_is_latest_idx").on(table.isLatest),
  ],
);

// =============================================================================
// Effect versions — Phase 6 backend
// =============================================================================

export const effectVersions = pgTable(
  "effect_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    effectId: uuid("effect_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    deltaKind: versionDeltaKindEnum("delta_kind").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    publishedByUserId: uuid("published_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("effect_versions_id_version_unique_idx").on(
      table.effectId,
      table.versionNumber,
    ),
    index("effect_versions_effect_id_idx").on(table.effectId),
    index("effect_versions_is_latest_idx").on(table.isLatest),
  ],
);

// =============================================================================
// Item versions — Phase 6 backend
// =============================================================================

export const itemVersions = pgTable(
  "item_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    deltaKind: versionDeltaKindEnum("delta_kind").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    publishedByUserId: uuid("published_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("item_versions_id_version_unique_idx").on(
      table.itemId,
      table.versionNumber,
    ),
    index("item_versions_item_id_idx").on(table.itemId),
    index("item_versions_is_latest_idx").on(table.isLatest),
  ],
);