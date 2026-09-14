import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common";
import {
  primitiveClassificationSourceEnum,
  primitiveClassificationStatusEnum,
} from "./enums";
import { primitives } from "./engine";

/** Stable, presentation-independent BU Market family catalog. */
export const lexiconFamilies = pgTable(
  "lexicon_families",
  {
    key: text("key").primaryKey(),
    label: text("label").notNull(),
    chapter: text("chapter").notNull(),
    chapterOrder: integer("chapter_order").notNull(),
    familyOrder: integer("family_order").notNull(),
    description: text("description").notNull().default(""),
    aliases: text("aliases").array().notNull().default(sql`ARRAY[]::text[]`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lexicon_families_order_idx").on(
      table.chapterOrder,
      table.familyOrder,
    ),
  ],
);

/** Market navigation metadata. Runtime primitive categories remain intact. */
export const primitiveMarketClassifications = pgTable(
  "primitive_market_classifications",
  {
    primitiveId: integer("primitive_id")
      .notNull()
      .references(() => primitives.id, { onDelete: "cascade" }),
    familyKey: text("family_key")
      .notNull()
      .references(() => lexiconFamilies.key, { onDelete: "restrict" }),
    tier: integer("tier"),
    expressionKey: text("expression_key"),
    canonicalTemplateId: integer("canonical_template_id"),
    canonicalExpressionId: integer("canonical_expression_id"),
    source: primitiveClassificationSourceEnum("source").notNull(),
    status: primitiveClassificationStatusEnum("status")
      .notNull()
      .default("CLASSIFIED"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.primitiveId], name: "primitive_market_classifications_pk" }),
    index("primitive_market_family_tier_idx").on(table.familyKey, table.tier),
    index("primitive_market_expression_idx").on(table.familyKey, table.expressionKey),
    index("primitive_market_status_idx").on(table.status),
  ],
);
