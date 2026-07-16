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
 *
 * Phase-7-D: this module now consumes modifiers via the canonical
 * short axis (`metadata.targetScope`) introduced by Phase-7-E. The
 * legacy dotted-string targets still load via LEGACY_TARGET_MIGRATIONS,
 * so a mix of old and new modifier rows round-trip transparently.
 *
 * Modifier matching rule (D2):
 *   1. Resolve the modifier's stored target via `resolveStoredScope`.
 *      New-format rows have metadata.targetScope.{layer, values}.
 *      Legacy dotted-target rows resolve to the canonical axis via
 *      `LEGACY_TARGET_MIGRATIONS`.
 *   2. Filter modifiers by *scope* (layer + axis name), not by the
 *      literal target string. A modifier targeting `attribute` axis
 *      with layer=ATTRIBUTE matches any physical/mental/magical
 *      attribute modifier, regardless of which `values[]` checkboxes
 *      it has; the value list narrows the application axis.
 */
import {
  resolveStoredScope,
  LEGACY_TARGET_MIGRATIONS,
  type ModifierTarget,
} from "@/lib/primitives/modifier-scope";
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
 *
 * Phase-7-D: matching also accepts the canonical short axis
 * `attribute` (with metadata.targetScope.layer === "ATTRIBUTE")
 * carried over from the legacy dotted string via LEGACY_TARGET_MIGRATIONS.
 * A modifier whose `target` is the legacy dotted form still matches.
 */
export function calculateAttributeScore(
  base: number,
  target: "physical" | "mental" | "magical",
  modifiers: readonly HardModifier[] = [],
): number {
  let value = base;
  const expectedLegacy = `character.attribute.${target}`;
  const expectedAxis: ModifierTarget = "attribute";
  const expectedScopeLayer = "ATTRIBUTE";
  const expectedScopeValue = target.toUpperCase();

  for (const mod of modifiers) {
    if (!modifierMatchesScope(mod, {
      legacyTarget: expectedLegacy,
      shortAxis: expectedAxis,
      scopeLayer: expectedScopeLayer,
      scopeValue: expectedScopeValue,
    })) {
      continue;
    }

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
    // Phase-7-D: accept either legacy dotted target or new short
    // axis max_vitality with metadata.targetScope.layer === "METRIC".
    if (
      !modifierMatchesScope(mod, {
        legacyTarget: "character.maxVitality",
        shortAxis: "max_vitality",
        scopeLayer: "METRIC",
        scopeValue: "HP",
      })
    ) {
      continue;
    }
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
 *
 * Phase-7-D: matches by canonical short axis `speed` (with
 * targetScope.values[] restricting the locomotion type) and falls
 * back to legacy dotted targets `character.movement.land/fly/swim/
 * climb/burrow`. The metadata.targetScope.values may contain any of
 * WALKING_SPEED, CLIMBING_SPEED, SWIMMING_SPEED, FLYING_SPEED,
 * BURROWING_SPEED; legacy migration resolves a dotted
 * `character.movement.<X>` form to its METRIC layer value.
 */
export function compileMovement(
  level: number,
  modifiers: readonly HardModifier[] = [],
): EntityLiveStats["movement"] {
  // Level is reserved for future use (e.g. level-scaled traits).
  void level;

  let land = BASELINE_LAND_SPEED;
  let fly: number | undefined;
  let swim: number | undefined;
  let climb: number | undefined;
  let burrow: number | undefined;

  for (const mod of modifiers) {
    // Resolve the movement type. We try legacy dotted first
    // (back-compat), then the canonical axis with metadata values.
    let movementType: "land" | "fly" | "swim" | "climb" | "burrow" | undefined;

    // Canonical axis match (Phase-7-E): `mod.target === "speed"`
    // with `metadata.targetScope.values[i] === WALKING_SPEED` etc.
    if (modifierMatchesScope(mod, {
      legacyTarget: "character.movement.land",
      shortAxis: "speed",
      scopeLayer: "METRIC",
      scopeValue: "WALKING_SPEED",
    })) {
      movementType = "land";
    } else if (modifierMatchesScope(mod, {
      legacyTarget: "character.movement.fly",
      shortAxis: "speed",
      scopeLayer: "METRIC",
      scopeValue: "FLYING_SPEED",
    })) {
      movementType = "fly";
    } else if (modifierMatchesScope(mod, {
      legacyTarget: "character.movement.swim",
      shortAxis: "speed",
      scopeLayer: "METRIC",
      scopeValue: "SWIMMING_SPEED",
    })) {
      movementType = "swim";
    } else if (modifierMatchesScope(mod, {
      legacyTarget: "character.movement.climb",
      shortAxis: "speed",
      scopeLayer: "METRIC",
      scopeValue: "CLIMBING_SPEED",
    })) {
      movementType = "climb";
    } else if (modifierMatchesScope(mod, {
      legacyTarget: "character.movement.burrow",
      shortAxis: "speed",
      scopeLayer: "METRIC",
      scopeValue: "BURROWING_SPEED",
    })) {
      movementType = "burrow";
    }

    if (!movementType) continue;
    void land; // land touched at the bottom

    if (typeof mod.value !== "number" && typeof mod.value !== "string") {
      continue;
    }
    const numericValue =
      typeof mod.value === "number" ? mod.value : Number(mod.value);
    if (!Number.isFinite(numericValue)) continue;

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
      case "grant":
      case "revoke":
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

// =============================================================================
// Phase-7-D: targetScope-aware modifier matching
// =============================================================================

interface ModifierMatchCriteria {
  /**
   * The legacy dotted target the old resolver expected. New-format
   * modifiers with metadata.targetScope will still match this if their
   * (axis, layer, value) trio fits, otherwise the resolver falls back.
   */
  readonly legacyTarget: string;
  /** Canonical short axis (e.g., `"attribute"`, `"max_vitality"`). */
  readonly shortAxis: ModifierTarget;
  /** Layer the new format uses (e.g., `"ATTRIBUTE"`, `"METRIC"`). */
  readonly scopeLayer: string;
  /**
   * Optional value within the scope values array that the modifier
   * MUST hit. e.g. for an attribute PHYSICAL attribute, values must
   * contain "PHYSICAL" (or be empty, "any"). Use `null` to skip the
   * value check.
   */
  readonly scopeValue: string;
}

/**
 * Decide whether a single modifier row applies to a given resolution
 * axis, given both legacy dotted-target and new metadata.targetScope
 * representations.
 *
 * Match precedence:
 *   1. Legacy dotted target string equality (Phase-7 and earlier).
 *   2. New-format short axis + layer match.
 *   3. scopeValue check:
 *      - empty values[]  → matches any (broad)
 *      - non-empty values[] → at least one entry must match
 *
 * Pure function, no I/O.
 */
export function modifierMatchesScope(
  mod: HardModifier,
  criteria: ModifierMatchCriteria,
): boolean {
  // 1. Legacy dotted string equality. This covers Phase-7 and earlier
  // modifiers whose `target` carries the full dotted name.
  if (mod.target === criteria.legacyTarget) {
    return true;
  }

  // 2. Migration: even when mod.target is dotted, the migration
  // table points at the canonical short axis. We need to check
  // the migration's defaultScope.values too, because the table
  // maps every dotted attribute form to the same `attribute`
  // axis with different values (PHYSICAL/MENTAL/MAGICAL).
  const migration = (LEGACY_TARGET_MIGRATIONS as Record<string, unknown>)[
    mod.target
  ];
  if (
    migration &&
    typeof migration === "object" &&
    "target" in (migration as Record<string, unknown>) &&
    (migration as { target: string }).target === criteria.shortAxis
  ) {
    // Check the migration's defaultScope.values matches our
    // expected scopeValue. The migration table stores
    // defaultScope.values: ["PHYSICAL"] (etc.) for attribute rows,
    // so we use it directly.
    const defaultScope = (migration as Record<string, unknown>)[
      "defaultScope"
    ];
    if (
      defaultScope &&
      typeof defaultScope === "object" &&
      "values" in (defaultScope as Record<string, unknown>)
    ) {
      const vals = (defaultScope as { values: unknown }).values;
      if (Array.isArray(vals)) {
        // If the migration's values array contains our expected
        // scopeValue, match; if values is empty, broad match.
        if (vals.length === 0) return true;
        if (vals.includes(criteria.scopeValue)) return true;
        // Fall through to the new-shape path below; if that
        // doesn't match either, we'll return false.
      }
    }
  }

  // 3. New-format short axis. Compare to criteria.shortAxis.
  if (mod.target !== criteria.shortAxis) {
    return false;
  }

  // 4. Resolve the stored scope. If there is no metadata, accept any
  // modifier on the matching axis (legacy behavior).
  const scope = resolveStoredScope({
    target: mod.target,
    metadata:
      mod.metadata && typeof mod.metadata === "object"
        ? (mod.metadata as Record<string, unknown>)
        : null,
  });
  if (!scope || scope.layer !== criteria.scopeLayer) {
    return false;
  }

  // 5. scopeValue check: empty values[] is "any"; otherwise the
  // expected value must be present.
  if (scope.values.length === 0) {
    return true;
  }
  return scope.values.includes(criteria.scopeValue);
}