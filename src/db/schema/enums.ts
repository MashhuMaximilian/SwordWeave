import { pgEnum } from "drizzle-orm/pg-core";

export const primitiveCategoryEnum = pgEnum("primitive_category", [
  // Core BU Market categories
  "VERB_TIER",
  "DOMAIN",
  "SIZING",
  "TARGETING",
  "RANGE",
  "DURATION",
  "OUTPUT",
  "CONDITION",
  "DEFENSE",
  "STRUCTURAL",
  "PROBABILITY_BIAS",
  "TRIGGER_HOOK",
  "PERCEPTION_QUALIFIER",
  "KINETIC_CONTROL",
  "AGENCY_OVERRIDE",
  "METAMORPHOSIS",
  "ACTION_ECONOMY",
  "EVALUATION_STRAIN",
  "TEMPORAL_CHRONOLOGICAL",
  "SENSORY_ARRAY",
  "MOBILITY_LOCOMOTION",
  "TARGETING_AOE",
  "INTENSITY_DICE",
  "BOSS_ECONOMY",
  "DEFENSIVE",
  "SPEED_QUICKENING", // Phase 7: split from DURATION (when, not how long)
  // Phase 7-B: tactical + life-state primitives
  "TACTICAL", // Cover Tiers I-IV and future spatial/tactical modifiers
  "VITALITY", // Stabilize, Last Breath, and life-state engine primitives
  // Character-slot categories (legacy — slated for purge in Phase 7)
  "SHEET_AUGMENT",
  "HERITAGE_AUGMENT",
  "BACKGROUND_AUGMENT",
  "CHARACTER_SHEET_AUGMENT",
  "PRACTICE_PROGRESSION_AUGMENT",
  "ITEM_AUGMENT",
]);

export const capabilityPrimitiveRoleEnum = pgEnum("capability_primitive_role", [
  "VERB",
  "DOMAIN",
  "SIZING",
  "RANGE",
  "DURATION",
  "OUTPUT",
  "AUGMENT",
  "OTHER",
]);

export const capabilityTypeEnum = pgEnum("capability_type", [
  "ACTIVE",
  "PASSIVE",
  "AUGMENT",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "PHYSICAL",
  "MAGICAL",
  "PSYCHIC",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "PLAYER",
  "MONSTER",
  "RACE_TEMPLATE",
  "BACKGROUND_TEMPLATE",
  "BUILD_TEMPLATE",
]);

export const itemTypeEnum = pgEnum("item_type", [
  "WEAPON",
  "ARMOR",
  "TRINKET",
  "ARTIFACT",
  "CONSUMABLE",
]);

export const itemRarityEnum = pgEnum("item_rarity", [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
]);

/**
 * Phase 8: icon system. Every entity (primitive/effect/capability/
 * template/item) can have a single icon attached. The icon is either:
 *   - GAME_ICONS: a game-icons.net slug (e.g. "lorc/sword-brandish"),
 *     served via the /api/icons/game/[author]/[slug] proxy which
 *     recolors the SVG to the entity's icon_color and caches it
 *     immutably at the edge.
 *   - UPLOAD: a custom image stored in private Vercel Blob at
 *     "user-uploads/<uuid>.<ext>", proxied through Clerk-auth
 *     /api/icons/blob/[...path].
 *
 * The enum is intentionally narrow — only the two sources we support
 * today. Adding new sources later (e.g. AI-generated icons) is an
 * additive migration; existing rows keep their enum value.
 */
export const iconSourceEnum = pgEnum("icon_source", [
  "GAME_ICONS",
  "UPLOAD",
]);
