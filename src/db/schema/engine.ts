import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { HardModifier, JsonValue } from "@/types/swordweave";
import { timestamps } from "./common";
import {
  capabilityPrimitiveRoleEnum,
  capabilityTypeEnum,
  primitiveCategoryEnum,
  sourceTypeEnum,
} from "./enums";

export const primitives = pgTable(
  "primitives",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: primitiveCategoryEnum("category").notNull(),
    buCost: integer("bu_cost").notNull().default(0),
    hardModifiers: jsonb("hard_modifiers")
      .$type<readonly HardModifier[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (table) => [
    index("primitives_category_idx").on(table.category),
    uniqueIndex("primitives_name_category_unique_idx").on(
      table.name,
      table.category,
    ),
  ],
);

export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ...timestamps,
  },
  (table) => [uniqueIndex("conditions_name_unique_idx").on(table.name)],
);

export const conditionPrimitives = pgTable(
  "condition_primitives",
  {
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.conditionId, table.primitiveId],
      name: "condition_primitives_pk",
    }),
    index("condition_primitives_condition_id_idx").on(table.conditionId),
    index("condition_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);

export const effects = pgTable(
  "effects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    narrativeDescription: text("narrative_description").notNull().default(""),
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    ...timestamps,
  },
  (table) => [
    index("effects_is_public_idx").on(table.isPublic),
    index("effects_tags_idx").using("gin", table.tags),
    uniqueIndex("effects_name_source_origin_unique_idx").on(
      table.name,
      table.sourceOrigin,
    ),
  ],
);

export const effectPrimitives = pgTable(
  "effect_primitives",
  {
    effectId: uuid("effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.effectId, table.primitiveId],
      name: "effect_primitives_pk",
    }),
    index("effect_primitives_effect_id_idx").on(table.effectId),
    index("effect_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);

export const effectConditions = pgTable(
  "effect_conditions",
  {
    effectId: uuid("effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.effectId, table.conditionId],
      name: "effect_conditions_pk",
    }),
    index("effect_conditions_effect_id_idx").on(table.effectId),
    index("effect_conditions_condition_id_idx").on(table.conditionId),
  ],
);

export const capabilities = pgTable(
  "capabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: capabilityTypeEnum("type").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    verboseDescription: text("verbose_description").notNull().default(""),
    isPublic: boolean("is_public").notNull().default(false),
    sourceOrigin: text("source_origin"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    metadata: jsonb("metadata")
      .$type<Record<string, JsonValue>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    index("capabilities_type_idx").on(table.type),
    index("capabilities_source_type_idx").on(table.sourceType),
    index("capabilities_is_public_idx").on(table.isPublic),
    index("capabilities_tags_idx").using("gin", table.tags),
    uniqueIndex("capabilities_name_source_origin_unique_idx").on(
      table.name,
      table.sourceOrigin,
    ),
  ],
);

export const capabilityPrimitives = pgTable(
  "capability_primitives",
  {
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    role: capabilityPrimitiveRoleEnum("role").notNull(),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    slotLabel: text("slot_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.capabilityId, table.primitiveId, table.role],
      name: "capability_primitives_pk",
    }),
    index("capability_primitives_capability_id_idx").on(table.capabilityId),
    index("capability_primitives_primitive_id_idx").on(table.primitiveId),
    index("capability_primitives_role_idx").on(table.role),
  ],
);

export const capabilityEffects = pgTable(
  "capability_effects",
  {
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "cascade" }),
    effectId: uuid("effect_id")
      .notNull()
      .references(() => effects.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    slotLabel: text("slot_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.capabilityId, table.effectId],
      name: "capability_effects_pk",
    }),
    index("capability_effects_capability_id_idx").on(table.capabilityId),
    index("capability_effects_effect_id_idx").on(table.effectId),
  ],
);
