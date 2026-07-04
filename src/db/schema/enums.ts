import { pgEnum } from "drizzle-orm/pg-core";

export const primitiveCategoryEnum = pgEnum("primitive_category", [
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
