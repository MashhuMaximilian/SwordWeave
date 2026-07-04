/**
 * stats.ts — Attribute, Proficiency Bonus, and Vitality compilation
 *
 * Pure functions. No I/O. No DB.
 *
 * Canonical rules from Notion (locked):
 *  - Attribute range: −1 to +5, sum exactly 10 across Physical/Mental/Magical
 *  - One Attribute Proficiency per character (chosen at character creation)
 *  - PB = +2 at L1, +1 every 4 levels (L1=2, L5=3, L9=4, L13=5, L17=6)
 *  - Max Vitality base formula: (10 + PB) * Level
 *  - Practice Proficiency grants +PB; Expertise Upgrade grants +2*PB
 *
 * (see AUDIT-REPORT.md for canonical sources)
 */
import type {
  HardModifier,
  JsonValue,
  EntityLiveStats,
  DefensiveProfile,
} from "@/types/swordweave";

// =============================================================================
// Constants
// =============================================================================

/**
 * Proficiency Bonus by level.
 * L1=2, L5=3, L9=4, L13=5, L17=6 (rounds every 4 levels).
 * Formula: 2 + floor((level - 1) / 4)
 *
 * Capped at MAX_PB (+10) per Notion "beyond this, PB caps at +10".
 */
export function proficiencyBonus(level: number): number {
  if (level < 1) {
    throw new Error(
      `Invalid level ${level}: must be >= 1. PB undefined below level 1.`,
    );
  }
  return Math.min(MAX_PB, 2 + Math.floor((level - 1) / 4));
}

/**
 * Max level the PB formula supports. Beyond this, PB caps at +10 (Tier 5 rules).
 * 2 + floor((50 - 1) / 4) = 14. Cap at +10 for safety.
 */
export const MAX_LEVEL = 50;
export const MAX_PB = 10;

/**
 * Attribute boundaries (Notion: −1 to +5, sum exactly 10).
 */
export const MIN_ATTRIBUTE = -1;
export const MAX_ATTRIBUTE = 5;
export const ATTRIBUTE_SUM = 10;

/**
 * Baseline defense: 10 + PB + Attribute modifier (Path A from BU Market).
 * NOTE: Notion specifies this is the *baseline*; magic items and feats
 * can push it higher. Pure baseline only here.
 */
export const BASELINE_DEFENSE = 10;

/**
 * Baseline species movement (most humanoids = 30 ft).
 * Per BU Market Table 14 (Kinematic Locomotion).
 */
export const BASELINE_LAND_SPEED = 30;

// =============================================================================
// Attribute compilation
// =============================================================================

export interface AttributeScores {
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
}

/**
 * Apply hard modifiers to a base attribute score.
 *
 * Used when a character has acquired modifiers that target a single attribute
 * (e.g., a Tier III Mirror that adds +1 to Mental).
 *
 * Note: Modifiers are typed against ModifierTarget. The target strings we
 * care about here are:
 *   - "character.attribute.physical"
 *   - "character.attribute.mental"
 *   - "character.attribute.magical"
 */
export function calculateAttributeScore(
  base: number,
  target: "physical" | "mental" | "magical",
  modifiers: readonly HardModifier[] = [],
): number {
  let value = base;

  for (const mod of modifiers) {
    if (mod.target !== `character.attribute.${target}`) continue;

    // Read numeric value (we accept number; non-numeric values are ignored
    // since attribute scores are numeric by definition)
    if (typeof mod.value !== "number" && typeof mod.value !== "string") {
      continue;
    }

    const numericValue =
      typeof mod.value === "number" ? mod.value : Number(mod.value);

    if (!Number.isFinite(numericValue)) continue;

    switch (mod.operation) {
      case "add":
        value += numericValue;
        break;
      case "subtract":
        value -= numericValue;
        break;
      case "set":
        value = numericValue;
        break;
      case "min":
        value = Math.min(value, numericValue);
        break;
      case "max":
        value = Math.max(value, numericValue);
        break;
      case "multiply":
        value *= numericValue;
        break;
      case "divide":
        if (numericValue === 0) break;
        value /= numericValue;
        break;
      // "grant" and "revoke" don't apply to numeric attribute scores
      case "grant":
      case "revoke":
      case "toggle":
        break;
    }
  }

  return value;
}

/**
 * Validate attribute distribution: each in [-1, +5], sum exactly 10.
 *
 * Returns null on success, or a human-readable error string on failure.
 */
export function validateAttributes(attrs: AttributeScores): string | null {
  const { physical, mental, magical } = attrs;

  const inRange = (n: number) =>
    Number.isInteger(n) && n >= MIN_ATTRIBUTE && n <= MAX_ATTRIBUTE;

  if (!inRange(physical)) {
    return `Physical attribute ${physical} out of range [${MIN_ATTRIBUTE}, ${MAX_ATTRIBUTE}]`;
  }
  if (!inRange(mental)) {
    return `Mental attribute ${mental} out of range [${MIN_ATTRIBUTE}, ${MAX_ATTRIBUTE}]`;
  }
  if (!inRange(magical)) {
    return `Magical attribute ${magical} out of range [${MIN_ATTRIBUTE}, ${MAX_ATTRIBUTE}]`;
  }

  const sum = physical + mental + magical;
  if (sum !== ATTRIBUTE_SUM) {
    return `Attribute sum ${sum} does not equal ${ATTRIBUTE_SUM} (Physical ${physical} + Mental ${mental} + Magical ${magical})`;
  }

  return null;
}

/**
 * Apply all attribute modifiers and return the final compiled attribute scores.
 *
 * This is a convenience wrapper that runs `calculateAttributeScore` for each
 * attribute using a single modifier array.
 */
export function compileAttributes(
  base: AttributeScores,
  modifiers: readonly HardModifier[] = [],
): AttributeScores {
  return {
    physical: calculateAttributeScore(base.physical, "physical", modifiers),
    mental: calculateAttributeScore(base.mental, "mental", modifiers),
    magical: calculateAttributeScore(base.magical, "magical", modifiers),
  };
}

// =============================================================================
// Vitality
// =============================================================================

/**
 * Max Vitality = (10 + PB) * Level
 *
 * Plus any modifier additions targeting character.maxVitality.
 *
 * Example:
 *   L1 character, PB=2, base formula: (10 + 2) * 1 = 12
 *   L5 character, PB=3, base formula: (10 + 3) * 5 = 65
 */
export function calculateMaxVitality(
  level: number,
  modifiers: readonly HardModifier[] = [],
): number {
  if (level < 1) {
    throw new Error(`Invalid level ${level}: must be >= 1.`);
  }

  const pb = proficiencyBonus(level);
  let value = (BASELINE_DEFENSE + pb) * level; // 10 + PB * Level (Path A baseline)

  for (const mod of modifiers) {
    if (mod.target !== "character.maxVitality") continue;
    if (typeof mod.value !== "number" && typeof mod.value !== "string") {
      continue;
    }
    const numericValue =
      typeof mod.value === "number" ? mod.value : Number(mod.value);
    if (!Number.isFinite(numericValue)) continue;

    switch (mod.operation) {
      case "add":
        value += numericValue;
        break;
      case "subtract":
        value -= numericValue;
        break;
      case "set":
        value = numericValue;
        break;
      case "min":
        value = Math.min(value, numericValue);
        break;
      case "max":
        value = Math.max(value, numericValue);
        break;
      case "multiply":
        value *= numericValue;
        break;
      case "divide":
        if (numericValue === 0) break;
        value /= numericValue;
        break;
      case "grant":
      case "revoke":
      case "toggle":
        break;
    }
  }

  return Math.max(0, Math.floor(value));
}

// =============================================================================
// Defenses
// =============================================================================

/**
 * Calculate a single defensive DC.
 *
 * Path A baseline: 10 + PB + Attribute modifier
 *
 * The attribute modifier is the AttributeScore itself (we don't use
 * D&D-style +0/+1/+2 — SwordWeave uses raw attribute scores per
 * the locked decision: "Attribute range: −1 to +5, sum exactly 10").
 */
export function calculateDefenseDc(
  baseline: number,
  pb: number,
  attributeModifier: number,
  modifiers: readonly HardModifier[] = [],
  target?: string,
): number {
  let value = baseline + pb + attributeModifier;

  for (const mod of modifiers) {
    // If a specific target is given (e.g., "character.defense.physicalDc"),
    // filter to only modifiers matching that target. Otherwise apply all.
    if (target && mod.target !== target) continue;

    if (typeof mod.value !== "number" && typeof mod.value !== "string") {
      continue;
    }
    const numericValue =
      typeof mod.value === "number" ? mod.value : Number(mod.value);
    if (!Number.isFinite(numericValue)) continue;

    switch (mod.operation) {
      case "add":
        value += numericValue;
        break;
      case "subtract":
        value -= numericValue;
        break;
      case "set":
        value = numericValue;
        break;
      case "min":
        value = Math.min(value, numericValue);
        break;
      case "max":
        value = Math.max(value, numericValue);
        break;
      case "multiply":
        value *= numericValue;
        break;
      case "divide":
        if (numericValue === 0) break;
        value /= numericValue;
        break;
      case "grant":
      case "revoke":
      case "toggle":
        break;
    }
  }

  return Math.floor(value);
}

/**
 * Compile all three defensive profiles (Physical, Mental, Magical DC).
 *
 * Returns DefensiveProfile { physicalDc, mentalDc, magicalDc }.
 */
export function compileDefenses(
  attributes: AttributeScores,
  pb: number,
  modifiers: readonly HardModifier[] = [],
): DefensiveProfile {
  return {
    physicalDc: calculateDefenseDc(
      BASELINE_DEFENSE,
      pb,
      attributes.physical,
      modifiers,
      "character.defense.physicalDc",
    ),
    mentalDc: calculateDefenseDc(
      BASELINE_DEFENSE,
      pb,
      attributes.mental,
      modifiers,
      "character.defense.mentalDc",
    ),
    magicalDc: calculateDefenseDc(
      BASELINE_DEFENSE,
      pb,
      attributes.magical,
      modifiers,
      "character.defense.magicalDc",
    ),
  };
}

// =============================================================================
// Movement
// =============================================================================

/**
 * Compile movement scores.
 *
 * Baseline: 30 ft land.
 * Modifiers can add/subtract or grant new movement types.
 */
export function compileMovement(
  level: number,
  modifiers: readonly HardModifier[] = [],
): EntityLiveStats["movement"] {
  let land = BASELINE_LAND_SPEED;
  let fly: number | undefined;
  let swim: number | undefined;
  let climb: number | undefined;
  let burrow: number | undefined;

  for (const mod of modifiers) {
    const target = mod.target;
    if (typeof mod.value !== "number" && typeof mod.value !== "string") {
      continue;
    }
    const numericValue =
      typeof mod.value === "number" ? mod.value : Number(mod.value);
    if (!Number.isFinite(numericValue)) continue;

    let movementType: "land" | "fly" | "swim" | "climb" | "burrow" | undefined;

    if (target === "character.movement.land") movementType = "land";
    else if (target === "character.movement.fly") movementType = "fly";
    else if (target === "character.movement.swim") movementType = "swim";
    else if (target === "character.movement.climb") movementType = "climb";
    else if (target === "character.movement.burrow") movementType = "burrow";

    if (!movementType) continue;

    let current =
      movementType === "land"
        ? land
        : movementType === "fly"
          ? (fly ?? 0)
          : movementType === "swim"
            ? (swim ?? 0)
            : movementType === "climb"
              ? (climb ?? 0)
              : (burrow ?? 0);

    switch (mod.operation) {
      case "add":
        current += numericValue;
        break;
      case "subtract":
        current -= numericValue;
        break;
      case "set":
        current = numericValue;
        break;
      case "grant":
        current = numericValue;
        break;
      case "revoke":
        current = 0;
        break;
      case "min":
        current = Math.min(current, numericValue);
        break;
      case "max":
        current = Math.max(current, numericValue);
        break;
      case "multiply":
        current *= numericValue;
        break;
      case "divide":
        if (numericValue === 0) break;
        current /= numericValue;
        break;
      case "toggle":
        break;
    }

    if (movementType === "land") land = current;
    else if (movementType === "fly") fly = current;
    else if (movementType === "swim") swim = current;
    else if (movementType === "climb") climb = current;
    else if (movementType === "burrow") burrow = current;
  }

  // At higher levels, baseline land speed can scale slightly with PB
  // (PB represents overall growth). But BU Market only adds via
  // purchased primitives, so land speed stays at baseline.
  // Level is a parameter reserved for future use.
  void level;

  return {
    land: Math.max(0, Math.floor(land)),
    ...(fly !== undefined && fly > 0 ? { fly: Math.floor(fly) } : {}),
    ...(swim !== undefined && swim > 0 ? { swim: Math.floor(swim) } : {}),
    ...(climb !== undefined && climb > 0 ? { climb: Math.floor(climb) } : {}),
    ...(burrow !== undefined && burrow > 0
      ? { burrow: Math.floor(burrow) }
      : {}),
  };
}

// =============================================================================
// Entity Live Stats compilation (one-shot)
// =============================================================================

export interface EntityCompilationInput {
  readonly level: number;
  readonly baseAttributes: AttributeScores;
  readonly currentVitality?: number;
  readonly modifiers: readonly HardModifier[];
}

/**
 * Compile all of a character's live stats in one pass.
 *
 * Use this whenever you have a full snapshot of base scores + all modifiers
 * and need the final derived numbers.
 */
export function compileEntityLiveStats(
  input: EntityCompilationInput,
): EntityLiveStats {
  const { level, baseAttributes, modifiers } = input;

  const pb = proficiencyBonus(level);
  const attributes = compileAttributes(baseAttributes, modifiers);
  const maxVitality = calculateMaxVitality(level, modifiers);
  const defenses = compileDefenses(attributes, pb, modifiers);
  const movement = compileMovement(level, modifiers);

  return {
    level,
    proficiencyBonus: pb,
    maxVitality,
    currentVitality: input.currentVitality ?? maxVitality,
    movement,
    defenses,
    attributes,
  };
}