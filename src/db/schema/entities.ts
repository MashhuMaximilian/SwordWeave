import { boolean, index, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./common";
import { entityTypeEnum } from "./enums";
import { capabilities, primitives } from "./engine";

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    name: text("name").notNull(),
    entityType: entityTypeEnum("entity_type").notNull(),
    level: integer("level").notNull().default(1),
    cumulativeBuBudget: integer("cumulative_bu_budget").notNull().default(0),
    currentVitality: integer("current_vitality").notNull().default(0),
    physical: integer("physical").notNull().default(0),
    mental: integer("mental").notNull().default(0),
    magical: integer("magical").notNull().default(0),
    presence: integer("presence").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("entities_user_id_idx").on(table.userId),
    index("entities_entity_type_idx").on(table.entityType),
    index("entities_user_type_idx").on(table.userId, table.entityType),
  ],
);

export const entityPrimitives = pgTable(
  "entity_primitives",
  {
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    sourceLabel: text("source_label"),
    isPermanent: boolean("is_permanent").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.entityId, table.primitiveId],
      name: "entity_primitives_pk",
    }),
    index("entity_primitives_entity_id_idx").on(table.entityId),
    index("entity_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);

export const entityCapabilities = pgTable(
  "entity_capabilities",
  {
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    loadoutSlot: text("loadout_slot"),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.entityId, table.capabilityId],
      name: "entity_capabilities_pk",
    }),
    index("entity_capabilities_entity_id_idx").on(table.entityId),
    index("entity_capabilities_capability_id_idx").on(table.capabilityId),
  ],
);
