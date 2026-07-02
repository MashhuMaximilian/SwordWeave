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
  items,
} from "./items";

export const primitivesRelations = relations(primitives, ({ many }) => ({
  conditionLinks: many(conditionPrimitives),
  effectLinks: many(effectPrimitives),
  capabilityLinks: many(capabilityPrimitives),
  entityLinks: many(entityPrimitives),
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

export const itemsRelations = relations(items, ({ many }) => ({
  capabilityLinks: many(itemCapabilities),
  effectLinks: many(itemEffects),
  inventoryLinks: many(entityInventory),
}));

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
