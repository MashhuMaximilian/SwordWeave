import {
  pgTable,
  text,
  uuid,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common";
import { publishVisibilityEnum } from "./engagement";
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => collections.id, {
      onDelete: "restrict",
    }),
    visibility: publishVisibilityEnum("visibility")
      .notNull()
      .default("PRIVATE"),
    systemKind: text("system_kind"),
    ...timestamps,
  },
  (t) => [
    index("collections_owner_idx").on(t.ownerId),
    uniqueIndex("collections_system_idx").on(t.ownerId, t.systemKind),
  ],
);
export const collectionEntries = pgTable(
  "collection_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("collection_entries_unique_idx").on(
      t.collectionId,
      t.targetType,
      t.targetId,
    ),
    index("collection_entries_target_idx").on(t.targetType, t.targetId),
  ],
);
export const collectionFollows = pgTable(
  "collection_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("collection_follows_unique_idx").on(t.userId, t.collectionId),
  ],
);

export const collectionSources = pgTable(
  "collection_sources",
  {
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("collection_sources_target_idx").on(t.targetType, t.targetId),
  ],
);
