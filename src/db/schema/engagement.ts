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
// Publishable targets: anything that can be published to the Library has a
// corresponding "publications" row when visibility != private. Publications
// carry the version_id at time of publish and the visibility tier.
// =============================================================================

export const publishTargetTypeEnum = pgEnum("publish_target_type", [
  "PRIMITIVE",
  "CAPABILITY",
  "CHARACTER",
  "ITEM",
  "EFFECT",
  "LINEAGE_TEMPLATE",
  "UPBRINGING_TEMPLATE",
  "MANIFEST_TEMPLATE",
  "BUILD_TEMPLATE",
]);

export const publishVisibilityEnum = pgEnum("publish_visibility", [
  "PUBLIC",
  "FOLLOWERS_ONLY",
  "PRIVATE",
]);

// =============================================================================
// Publications (one row per published version)
// =============================================================================

export const publications = pgTable(
  "publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: publishTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(), // string union: integer primitive_id OR uuid capability_id
    versionId: uuid("version_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    authorId: uuid("author_id"), // null for system content
    visibility: publishVisibilityEnum("visibility").notNull().default("PUBLIC"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("publications_target_idx").on(table.targetType, table.targetId),
    index("publications_author_idx").on(table.authorId),
    index("publications_visibility_idx").on(table.visibility),
    index("publications_published_at_idx").on(table.publishedAt),
  ],
);

// =============================================================================
// Likes/dislikes — per version. Unique (user, target_type, target_id,
// version_id, kind) so users can like + dislike same target (toggleable).
// =============================================================================

export const reactionKindEnum = pgEnum("reaction_kind", [
  "LIKE",
  "DISLIKE",
]);

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    targetType: publishTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    versionId: uuid("version_id").notNull(),
    kind: reactionKindEnum("kind").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reactions_unique_idx").on(
      table.userId,
      table.targetType,
      table.targetId,
      table.versionId,
      table.kind,
    ),
    index("reactions_target_idx").on(
      table.targetType,
      table.targetId,
      table.versionId,
    ),
    index("reactions_user_idx").on(table.userId),
  ],
);

// =============================================================================
// Reaction aggregates (denormalized counters per target+version)
// =============================================================================

export const reactionAggregates = pgTable(
  "reaction_aggregates",
  {
    targetType: publishTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    versionId: uuid("version_id").notNull(),
    likesCount: integer("likes_count").notNull().default(0),
    dislikesCount: integer("dislikes_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Composite PK over target+version is the natural unique key
    primaryKey({
      columns: [table.targetType, table.targetId, table.versionId],
      name: "reaction_aggregates_pk",
    }),
  ],
);

// =============================================================================
// Flags — users can flag as "unbalanced". Counter cached, no auto-moderation.
// =============================================================================

export const flagReasonEnum = pgEnum("flag_reason", [
  "UNBALANCED",
  "BROKEN",
  "INAPPROPRIATE",
  "DUPLICATE",
  "OTHER",
]);

export const flags = pgTable(
  "flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    targetType: publishTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    versionId: uuid("version_id").notNull(),
    reason: flagReasonEnum("reason").notNull(),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("flags_unique_idx").on(
      table.userId,
      table.targetType,
      table.targetId,
      table.versionId,
      table.reason,
    ),
    index("flags_target_idx").on(table.targetType, table.targetId),
  ],
);

export const flagAggregates = pgTable(
  "flag_aggregates",
  {
    targetType: publishTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    versionId: uuid("version_id").notNull(),
    unbalancedCount: integer("unbalanced_count").notNull().default(0),
    brokenCount: integer("broken_count").notNull().default(0),
    inappropriateCount: integer("inappropriate_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    otherCount: integer("other_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.targetType, table.targetId, table.versionId],
      name: "flag_aggregates_pk",
    }),
  ],
);

// =============================================================================
// Forks — attribution + counter
// =============================================================================

export const forks = pgTable(
  "forks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    forkedByUserId: uuid("forked_by_user_id").notNull(),
    sourceTargetType: publishTargetTypeEnum("source_target_type").notNull(),
    sourceTargetId: text("source_target_id").notNull(),
    sourceVersionId: uuid("source_version_id").notNull(),
    sourceAuthorId: uuid("source_author_id"), // null for system content
    forkedTargetType: publishTargetTypeEnum("forked_target_type").notNull(),
    forkedTargetId: text("forked_target_id").notNull(),
    forkedVersionId: uuid("forked_version_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index("forks_forked_by_idx").on(table.forkedByUserId),
    index("forks_source_idx").on(
      table.sourceTargetType,
      table.sourceTargetId,
    ),
    index("forks_source_author_idx").on(table.sourceAuthorId),
    index("forks_forked_target_idx").on(
      table.forkedTargetType,
      table.forkedTargetId,
    ),
  ],
);

export const forkAggregates = pgTable(
  "fork_aggregates",
  {
    sourceTargetType: publishTargetTypeEnum("source_target_type").notNull(),
    sourceTargetId: text("source_target_id").notNull(),
    sourceVersionId: uuid("source_version_id").notNull(),
    forkCount: integer("fork_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.sourceTargetType, table.sourceTargetId, table.sourceVersionId],
      name: "fork_aggregates_pk",
    }),
  ],
);