import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common";

// =============================================================================
// Enums
// =============================================================================

export const profileVisibilityEnum = pgEnum("profile_visibility", [
  "PUBLIC",
  "FOLLOWERS_ONLY",
  "PRIVATE",
]);

// =============================================================================
// Reserved usernames
// =============================================================================

export const reservedUsernames = pgTable(
  "reserved_usernames",
  {
    username: text("username").primaryKey(),
    reason: text("reason").notNull(),
    ...timestamps,
  },
);

// =============================================================================
// Users (SwordWeave-side profile, separate from Clerk identity)
// =============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    socialLinks: jsonb("social_links")
      .$type<{
        twitter?: string;
        mastodon?: string;
        bluesky?: string;
        discord?: string;
        website?: string;
        itch?: string;
        instagram?: string;
        youtube?: string;
        drivethrurpg?: string;
        patreon?: string;
        buymeacoffee?: string;
      }>()
      .notNull()
      .default({}),
    isPublic: boolean("is_public").notNull().default(true),
    isAnonymized: boolean("is_anonymized").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_username_unique_idx").on(table.username),
    uniqueIndex("users_clerk_user_id_unique_idx").on(table.clerkUserId),
    index("users_deleted_at_idx").on(table.deletedAt),
    index("users_purge_after_idx").on(table.purgeAfter),
  ],
);

// =============================================================================
// Username history (track renames for /u/<old-username> → /u/<new-username>)
// =============================================================================

export const usernameHistory = pgTable(
  "username_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    oldUsername: text("old_username").notNull(),
    newUsername: text("new_username").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("username_history_user_id_idx").on(table.userId),
    uniqueIndex("username_history_old_username_unique_idx").on(table.oldUsername),
  ],
);

// =============================================================================
// Follows (one-way; followers see creator's new content in Library filter)
// =============================================================================

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    // Composite PK so we never have duplicate follows
    // (Drizzle composite primary keys use a name; using uniqueIndex for clarity)
    uniqueIndex("follows_follower_following_unique_idx").on(
      table.followerId,
      table.followingId,
    ),
    index("follows_follower_id_idx").on(table.followerId),
    index("follows_following_id_idx").on(table.followingId),
  ],
);

// =============================================================================
// Author stats cache (denormalized counters on user profile)
// =============================================================================

export const userStats = pgTable("user_stats", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  publicPrimitives: integer("public_primitives").notNull().default(0),
  publicCapabilities: integer("public_capabilities").notNull().default(0),
  publicCharacters: integer("public_characters").notNull().default(0),
  publicItems: integer("public_items").notNull().default(0),
  publicRaces: integer("public_races").notNull().default(0),
  publicBackgrounds: integer("public_backgrounds").notNull().default(0),
  publicArchetypes: integer("public_archetypes").notNull().default(0),
  totalForksReceived: integer("total_forks_received").notNull().default(0),
  totalLikesReceived: integer("total_likes_received").notNull().default(0),
  totalDislikesReceived: integer("total_dislikes_received").notNull().default(0),
  followersCount: integer("followers_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});