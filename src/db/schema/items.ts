import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common";
import { itemRarityEnum, iconSourceEnum, itemTypeEnum } from "./enums";
import { entities } from "./entities";
import { capabilities, effects, primitives } from "./engine";

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    itemType: itemTypeEnum("item_type").notNull(),
    rarity: itemRarityEnum("rarity").notNull().default("COMMON"),
    buCost: integer("bu_cost").notNull().default(0),
    description: text("description").notNull().default(""),
    slotCost: integer("slot_cost").notNull().default(1),
    // How many of this item a character holds. Default 1 (most items —
    // weapons, armor, accessories — are unique). Consumables and
    // stackable types use > 1. The form lets the author set this freely;
    // we don't restrict it because the user explicitly asked for it to
    // be flexible ("consumables usually could be more. Also other types
    // could be more that's why I don't wanna restrict this").
    quantity: integer("quantity").notNull().default(1),
    isTwoHanded: boolean("is_two_handed").notNull().default(false),
    isConsumable: boolean("is_consumable").notNull().default(false),
    actsAsFocus: boolean("acts_as_focus").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(false),
    userId: text("user_id"),
    sourceOrigin: text("source_origin"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    contentHash: text("content_hash"),
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
    index("items_item_type_idx").on(table.itemType),
    index("items_rarity_idx").on(table.rarity),
    index("items_is_public_idx").on(table.isPublic),
    index("items_user_id_idx").on(table.userId),
    index("items_tags_idx").using("gin", table.tags),
    index("items_content_hash_idx").on(table.contentHash),
    uniqueIndex("items_name_source_origin_unique_idx").on(
      table.name,
      table.sourceOrigin,
    ),
  ],
);

export const itemCapabilities = pgTable(
  "item_capabilities",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    capabilityId: uuid("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    slotLabel: text("slot_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.itemId, table.capabilityId],
      name: "item_capabilities_pk",
    }),
    index("item_capabilities_item_id_idx").on(table.itemId),
    index("item_capabilities_capability_id_idx").on(table.capabilityId),
  ],
);

export const itemEffects = pgTable(
  "item_effects",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
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
      columns: [table.itemId, table.effectId],
      name: "item_effects_pk",
    }),
    index("item_effects_item_id_idx").on(table.itemId),
    index("item_effects_effect_id_idx").on(table.effectId),
  ],
);

export const entityInventory = pgTable(
  "entity_inventory",
  {
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    isEquipped: boolean("is_equipped").notNull().default(false),
    equippedSlot: text("equipped_slot"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.entityId, table.itemId],
      name: "entity_inventory_pk",
    }),
    index("entity_inventory_entity_id_idx").on(table.entityId),
    index("entity_inventory_item_id_idx").on(table.itemId),
    index("entity_inventory_equipped_idx").on(table.isEquipped),
  ],
);

// =============================================================================
// Phase 4: item_primitives junction (item -> primitives linkage)
// =============================================================================

export const itemPrimitives = pgTable(
  "item_primitives",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    // Phase 7 Q-M-UX: per-slot Mirrored flag.
    isMirrored: boolean("is_mirrored").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.itemId, table.primitiveId],
      name: "item_primitives_pk",
    }),
    index("item_primitives_item_id_idx").on(table.itemId),
    index("item_primitives_primitive_id_idx").on(table.primitiveId),
  ],
);
