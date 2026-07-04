import { relations } from "drizzle-orm";
import {
  capabilities,
  capabilityEffects,
  capabilityPrimitives,
  conditionPrimitives,
  conditions,
  effectConditions,
  effectPrimitives,
  effects,
  primitives,
} from "./engine";
import { entities, entityCapabilities, entityPrimitives } from "./entities";
import {
  entityInventory,
  itemCapabilities,
  itemEffects,
  itemPrimitives,
  items,
} from "./items";
import {
  buildCapabilities,
  builds,
  characterCapabilities,
  characterItems,
  characterPrimitives,
  characters,
  templateCapabilities,
  templatePrimitives,
  templates,
} from "./characters";
import {
  capabilityVersions,
  characterVersions,
  primitiveAdoptions,
  primitiveVersions,
  templateVersions,
} from "./versions";
import {
  flags,
  forks,
  forkAggregates,
  publications,
  reactions,
  reactionAggregates,
  flagAggregates,
} from "./engagement";
import { follows, userStats, usernameHistory, users } from "./profiles";

// =============================================================================
// Engine relations
// =============================================================================

export const primitivesRelations = relations(primitives, ({ many }) => ({
  conditionLinks: many(conditionPrimitives),
  effectLinks: many(effectPrimitives),
  capabilityLinks: many(capabilityPrimitives),
  entityLinks: many(entityPrimitives),
  characterLinks: many(characterPrimitives),
  templateLinks: many(templatePrimitives),
  itemLinks: many(itemPrimitives),
  versions: many(primitiveVersions),
}));

export const conditionsRelations = relations(conditions, ({ many }) => ({
  primitiveLinks: many(conditionPrimitives),
  effectLinks: many(effectConditions),
}));

export const conditionPrimitivesRelations = relations(
  conditionPrimitives,
  ({ one }) => ({
    condition: one(conditions, {
      fields: [conditionPrimitives.conditionId],
      references: [conditions.id],
    }),
    primitive: one(primitives, {
      fields: [conditionPrimitives.primitiveId],
      references: [primitives.id],
    }),
  }),
);

export const effectsRelations = relations(effects, ({ many }) => ({
  primitiveLinks: many(effectPrimitives),
  conditionLinks: many(effectConditions),
  capabilityLinks: many(capabilityEffects),
  itemLinks: many(itemEffects),
}));

export const effectPrimitivesRelations = relations(
  effectPrimitives,
  ({ one }) => ({
    effect: one(effects, {
      fields: [effectPrimitives.effectId],
      references: [effects.id],
    }),
    primitive: one(primitives, {
      fields: [effectPrimitives.primitiveId],
      references: [primitives.id],
    }),
  }),
);

export const effectConditionsRelations = relations(
  effectConditions,
  ({ one }) => ({
    effect: one(effects, {
      fields: [effectConditions.effectId],
      references: [effects.id],
    }),
    condition: one(conditions, {
      fields: [effectConditions.conditionId],
      references: [conditions.id],
    }),
  }),
);

export const capabilitiesRelations = relations(capabilities, ({ many }) => ({
  primitiveLinks: many(capabilityPrimitives),
  effectLinks: many(capabilityEffects),
  entityLinks: many(entityCapabilities),
  itemLinks: many(itemCapabilities),
  characterLinks: many(characterCapabilities),
  templateLinks: many(templateCapabilities),
  buildLinks: many(buildCapabilities),
  versions: many(capabilityVersions),
}));

export const capabilityPrimitivesRelations = relations(
  capabilityPrimitives,
  ({ one }) => ({
    capability: one(capabilities, {
      fields: [capabilityPrimitives.capabilityId],
      references: [capabilities.id],
    }),
    primitive: one(primitives, {
      fields: [capabilityPrimitives.primitiveId],
      references: [primitives.id],
    }),
  }),
);

export const capabilityEffectsRelations = relations(
  capabilityEffects,
  ({ one }) => ({
    capability: one(capabilities, {
      fields: [capabilityEffects.capabilityId],
      references: [capabilities.id],
    }),
    effect: one(effects, {
      fields: [capabilityEffects.effectId],
      references: [effects.id],
    }),
  }),
);

// =============================================================================
// Entity relations (legacy)
// =============================================================================

export const entitiesRelations = relations(entities, ({ many }) => ({
  primitiveLinks: many(entityPrimitives),
  capabilityLinks: many(entityCapabilities),
  inventoryLinks: many(entityInventory),
}));

export const entityPrimitivesRelations = relations(
  entityPrimitives,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityPrimitives.entityId],
      references: [entities.id],
    }),
    primitive: one(primitives, {
      fields: [entityPrimitives.primitiveId],
      references: [primitives.id],
    }),
  }),
);

export const entityCapabilitiesRelations = relations(
  entityCapabilities,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityCapabilities.entityId],
      references: [entities.id],
    }),
    capability: one(capabilities, {
      fields: [entityCapabilities.capabilityId],
      references: [capabilities.id],
    }),
  }),
);

// =============================================================================
// Item relations
// =============================================================================

export const itemsRelations = relations(items, ({ many }) => ({
  capabilityLinks: many(itemCapabilities),
  effectLinks: many(itemEffects),
  primitiveLinks: many(itemPrimitives),
  inventoryLinks: many(entityInventory),
  characterLinks: many(characterItems),
}));

export const itemPrimitivesRelations = relations(
  itemPrimitives,
  ({ one }) => ({
    item: one(items, {
      fields: [itemPrimitives.itemId],
      references: [items.id],
    }),
    primitive: one(primitives, {
      fields: [itemPrimitives.primitiveId],
      references: [primitives.id],
    }),
  }),
);

export const itemCapabilitiesRelations = relations(
  itemCapabilities,
  ({ one }) => ({
    item: one(items, {
      fields: [itemCapabilities.itemId],
      references: [items.id],
    }),
    capability: one(capabilities, {
      fields: [itemCapabilities.capabilityId],
      references: [capabilities.id],
    }),
  }),
);

export const itemEffectsRelations = relations(itemEffects, ({ one }) => ({
  item: one(items, {
    fields: [itemEffects.itemId],
    references: [items.id],
  }),
  effect: one(effects, {
    fields: [itemEffects.effectId],
    references: [effects.id],
  }),
}));

export const entityInventoryRelations = relations(
  entityInventory,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityInventory.entityId],
      references: [entities.id],
    }),
    item: one(items, {
      fields: [entityInventory.itemId],
      references: [items.id],
    }),
  }),
);

// =============================================================================
// Character relations (Phase 4)
// =============================================================================

export const charactersRelations = relations(characters, ({ many }) => ({
  primitiveLinks: many(characterPrimitives),
  capabilityLinks: many(characterCapabilities),
  itemLinks: many(characterItems),
  versions: many(characterVersions),
}));

export const characterPrimitivesRelations = relations(
  characterPrimitives,
  ({ one }) => ({
    character: one(characters, {
      fields: [characterPrimitives.characterId],
      references: [characters.id],
    }),
    primitive: one(primitives, {
      fields: [characterPrimitives.primitiveId],
      references: [primitives.id],
    }),
  }),
);

export const characterCapabilitiesRelations = relations(
  characterCapabilities,
  ({ one }) => ({
    character: one(characters, {
      fields: [characterCapabilities.characterId],
      references: [characters.id],
    }),
    capability: one(capabilities, {
      fields: [characterCapabilities.capabilityId],
      references: [capabilities.id],
    }),
  }),
);

export const characterItemsRelations = relations(characterItems, ({ one }) => ({
  character: one(characters, {
    fields: [characterItems.characterId],
    references: [characters.id],
  }),
  item: one(items, {
    fields: [characterItems.itemId],
    references: [items.id],
  }),
}));

// =============================================================================
// Template relations (Phase 4)
// =============================================================================

export const templatesRelations = relations(templates, ({ many }) => ({
  primitiveLinks: many(templatePrimitives),
  capabilityLinks: many(templateCapabilities),
  raceBuilds: many(builds, { relationName: "build_race" }),
  backgroundBuilds: many(builds, { relationName: "build_background" }),
  versions: many(templateVersions),
}));

export const templatePrimitivesRelations = relations(
  templatePrimitives,
  ({ one }) => ({
    template: one(templates, {
      fields: [templatePrimitives.templateId],
      references: [templates.id],
    }),
    primitive: one(primitives, {
      fields: [templatePrimitives.primitiveId],
      references: [primitives.id],
    }),
  }),
);

export const templateCapabilitiesRelations = relations(
  templateCapabilities,
  ({ one }) => ({
    template: one(templates, {
      fields: [templateCapabilities.templateId],
      references: [templates.id],
    }),
    capability: one(capabilities, {
      fields: [templateCapabilities.capabilityId],
      references: [capabilities.id],
    }),
  }),
);

// =============================================================================
// Build relations (Phase 4)
// =============================================================================

export const buildsRelations = relations(builds, ({ many, one }) => ({
  capabilityLinks: many(buildCapabilities),
  race: one(templates, {
    fields: [builds.raceId],
    references: [templates.id],
    relationName: "build_race",
  }),
  background: one(templates, {
    fields: [builds.backgroundId],
    references: [templates.id],
    relationName: "build_background",
  }),
}));

export const buildCapabilitiesRelations = relations(
  buildCapabilities,
  ({ one }) => ({
    build: one(builds, {
      fields: [buildCapabilities.buildId],
      references: [builds.id],
    }),
    capability: one(capabilities, {
      fields: [buildCapabilities.capabilityId],
      references: [capabilities.id],
    }),
  }),
);

// Version relations (Phase 5 Commit B)
export const capabilityVersionsRelations = relations(
  capabilityVersions,
  ({ one, many }) => ({
    capability: one(capabilities, {
      fields: [capabilityVersions.capabilityId],
      references: [capabilities.id],
    }),
    primitiveAdoptions: many(primitiveAdoptions),
  }),
);

export const characterVersionsRelations = relations(
  characterVersions,
  ({ one }) => ({
    character: one(characters, {
      fields: [characterVersions.characterId],
      references: [characters.id],
    }),
  }),
);

export const templateVersionsRelations = relations(templateVersions, ({ one }) => ({
  template: one(templates, {
    fields: [templateVersions.templateId],
    references: [templates.id],
  }),
}));

export const primitiveAdoptionsRelations = relations(
  primitiveAdoptions,
  ({ one }) => ({
    capabilityVersion: one(capabilityVersions, {
      fields: [primitiveAdoptions.capabilityVersionId],
      references: [capabilityVersions.id],
    }),
    primitiveVersion: one(primitiveVersions, {
      fields: [primitiveAdoptions.primitiveVersionId],
      references: [primitiveVersions.id],
    }),
  }),
);

// Engagement relations (Phase 5 Commit B)
export const publicationsRelations = relations(publications, ({ one }) => ({
  author: one(users, {
    fields: [publications.authorId],
    references: [users.id],
  }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
}));

export const flagsRelations = relations(flags, ({ one }) => ({
  user: one(users, {
    fields: [flags.userId],
    references: [users.id],
  }),
}));

export const forksRelations = relations(forks, ({ one }) => ({
  forkedBy: one(users, {
    fields: [forks.forkedByUserId],
    references: [users.id],
  }),
  sourceAuthor: one(users, {
    fields: [forks.sourceAuthorId],
    references: [users.id],
  }),
}));
// =============================================================================
// Profile relations (Phase 5)
// =============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  stats: one(userStats, {
    fields: [users.id],
    references: [userStats.userId],
  }),
  usernameHistory: many(usernameHistory),
  followers: many(follows, { relationName: "follows_following" }),
  following: many(follows, { relationName: "follows_follower" }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));

export const usernameHistoryRelations = relations(
  usernameHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [usernameHistory.userId],
      references: [users.id],
    }),
  }),
);

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follows_follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "follows_following",
  }),
}));
