export type EntityId = string;
export type PrimitiveId = string;
export type EffectId = string;
export type CapabilityId = string;
export type ItemId = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type PrimitiveCategory =
  | "verb-tier"
  | "domain-license"
  | "effect-rule"
  | "output"
  | "targeting"
  | "sizing"
  | "range"
  | "duration"
  | "casting-time"
  | "character-sheet-augment"
  | "item-augment"
  | "monster-augment"
  | "background-augment"
  | "heritage-augment";

export type ModifierOperation =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "set"
  | "min"
  | "max"
  | "grant"
  | "revoke"
  | "toggle";

export type ModifierTarget =
  | "character.attribute.physical"
  | "character.attribute.mental"
  | "character.attribute.magical"
  | "character.maxVitality"
  | "character.currentVitality"
  | "character.movement.land"
  | "character.movement.fly"
  | "character.movement.swim"
  | "character.defense.physicalDc"
  | "character.defense.mentalDc"
  | "character.defense.magicalDc"
  | "character.skill"
  | "character.proficiencyBonus"
  | "action.roll"
  | "action.damage"
  | "action.range"
  | "action.targetCount"
  | "action.areaSize"
  | "action.duration"
  | "action.strain"
  | "entity.loadout"
  | "item.slotCost"
  | "scene.pace";

export type ModifierStackingMode =
  | "stack"
  | "highest-only"
  | "lowest-only"
  | "unique-by-primitive"
  | "unique-by-target";

export interface ModifierCondition {
  readonly key: string;
  readonly operator:
    | "equals"
    | "not-equals"
    | "greater-than"
    | "greater-than-or-equal"
    | "less-than"
    | "less-than-or-equal"
    | "includes"
    | "exists";
  readonly value?: JsonValue;
}

export interface HardModifier {
  readonly kind: "modify";
  readonly target: ModifierTarget | string;
  readonly operation: ModifierOperation;
  readonly value: JsonValue;
  readonly condition?: ModifierCondition;
  readonly stacking?: ModifierStackingMode;
  readonly metadata?: Record<string, JsonValue>;
}

export interface Primitive {
  readonly id: PrimitiveId;
  readonly name: string;
  readonly category: PrimitiveCategory;
  readonly buCost: number;
  readonly description?: string;
  readonly hardModifiers: readonly HardModifier[];
}

export interface PrimitiveReference {
  readonly primitiveId: PrimitiveId;
  readonly quantity?: number;
  readonly label?: string;
  readonly locked?: boolean;
}

export interface Effect {
  readonly id: EffectId;
  readonly name: string;
  readonly description: string;
  readonly primitiveReferences: readonly PrimitiveReference[];
}

export type CapabilityType = "active" | "passive" | "augment" | "reaction";
export type SourceType = "physical" | "magical" | "psychic" | "hybrid";

export interface Capability {
  readonly id: CapabilityId;
  readonly name: string;
  readonly type: CapabilityType;
  readonly sourceType: SourceType;
  readonly description: string;
  readonly verbs: readonly PrimitiveReference[];
  readonly domains: readonly PrimitiveReference[];
  readonly effects: readonly EffectId[];
}

export type EntityType = "player" | "monster";

export interface DefensiveProfile {
  readonly physicalDc: number;
  readonly mentalDc: number;
  readonly magicalDc: number;
}

export interface EntityLiveStats {
  readonly level?: number;
  readonly proficiencyBonus: number;
  readonly maxVitality: number;
  readonly currentVitality: number;
  readonly movement: {
    readonly land: number;
    readonly fly?: number;
    readonly swim?: number;
    readonly climb?: number;
    readonly burrow?: number;
  };
  readonly defenses: DefensiveProfile;
  readonly attributes: {
    readonly physical: number;
    readonly mental: number;
    readonly magical: number;
  };
}

export interface ActiveLoadout {
  readonly capabilities: readonly CapabilityId[];
  readonly effects: readonly EffectId[];
  readonly items: readonly ItemId[];
  readonly slottedPrimitives: readonly PrimitiveReference[];
}

export interface Entity {
  readonly id: EntityId;
  readonly name: string;
  readonly type: EntityType;
  readonly buBudget: number;
  readonly liveStats: EntityLiveStats;
  readonly ownedPrimitives: readonly PrimitiveReference[];
  readonly activeLoadout: ActiveLoadout;
}
