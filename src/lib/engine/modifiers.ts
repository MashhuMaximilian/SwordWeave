/**
 * modifiers.ts — Hard Modifier evaluation and stacking
 *
 * Pure functions. No I/O. No DB.
 *
 * Hard Modifiers are atomic transformations applied to derived stats during
 * runtime (combat, save resolution, capability evaluation).
 *
 * Modifiers carry:
 *   - target: what they affect (e.g., "character.defense.physicalDc")
 *   - operation: how they affect it (add, subtract, set, etc.)
 *   - value: the magnitude or payload
 *   - condition?: optional gating predicate (only apply if predicate holds)
 *   - stacking?: how they combine with other modifiers targeting the same thing
 *
 * Canonical stacking modes (from types/swordweave.ts):
 *   - stack: default, sum all values
 *   - highest-only: only the largest value applies
 *   - lowest-only: only the smallest value applies
 *   - unique-by-primitive: each primitive contributes at most one (sum across primitives)
 *   - unique-by-target: each (primitive, target) pair is unique (collapse duplicates)
 *
 * Resistance/vulnerability rule (Notion canonical):
 *   "Largest applies, does NOT stack" — already true for the highest-only
 *   stacking mode. We enforce this in `applyStacking`.
 */

import type {
  HardModifier,
  HardModifierCondition,
  JsonValue,
  ModifierStackingMode,
  ModifierTarget,
} from "@/types/swordweave";

// =============================================================================
// Types
// =============================================================================

export interface EvaluationContext {
  readonly character: {
    readonly id: string;
    readonly level: number;
    readonly attributes: {
      readonly physical: number;
      readonly mental: number;
      readonly magical: number;
    };
  };
  readonly effect?: {
    readonly id: string;
    readonly name: string;
  };
  readonly capability?: {
    readonly id: string;
    readonly name: string;
  };
  readonly environment?: Record<string, JsonValue>;
}

export type EvaluationResult = {
  readonly target: string;
  readonly value: JsonValue;
}[];

/**
 * Track provenance for debugging. Records which modifier produced which value.
 */
export interface AppliedModifierTrace {
  readonly primitiveId?: string;
  readonly operation: HardModifier["operation"];
  readonly value: JsonValue;
  readonly conditionMatched: boolean;
}

// =============================================================================
// Condition evaluation
// =============================================================================

/**
 * Evaluate a condition against the current EvaluationContext.
 *
 * Condition format (from types):
 *   { key, operator, value? }
 *
 * Operators:
 *   - equals, not-equals: exact match against context[key]
 *   - greater-than, less-than (+ -or-equal): numeric comparison
 *   - includes: target is in array/string
 *   - exists: context has key (any value, including null)
 *
 * Returns true if the condition is satisfied (or if no condition).
 */
export function evaluateCondition(
  condition: HardModifierCondition | undefined,
  context: EvaluationContext,
): boolean {
  if (!condition) return true;

  // Phase-7-Q-B: condition may be legacy {key, operator, value} OR
  // v1 {kind, ...}.
  //
  // v1 evaluation: the engine does NOT evaluate v1 conditions in
  // Phase 7. The character sheet displays the condition as a badge;
  // the DM adjudicates at the table. Returning `true` means the
  // modifier is always applied — the displayed condition is a hint,
  // not a runtime gate. Future work can route preset keys through
  // a real evaluation pass.
  //
  // Legacy evaluation: keep the existing operator-based logic so
  // pre-v1 modifiers still gate correctly. Detect legacy first so
  // we don't accidentally pass through parseCondition.
  if ("kind" in condition) {
    // v1 shape — always applies
    return true;
  }

  // Legacy shape — delegate to operator-based evaluation.
  const legacyCondition: { key: string; operator: string; value?: JsonValue } = {
    key: String(condition.key),
    operator: String(condition.operator),
  };
  if ("value" in condition && condition.value !== undefined) {
    legacyCondition.value = condition.value;
  }
  return evaluateLegacyCondition(legacyCondition, context);
}

/**
 * @deprecated Phase-7-Q-B: legacy operator-based evaluation kept
 * for backwards compatibility with pre-v1 modifiers. New writes
 * use the v1 shape; this path only fires when a modifier carries
 * the legacy `{key, operator, value}` triple directly.
 *
 * Engine-side migration: new primitives should use v1 condition
 * shapes (`{kind, ...}`). Once E (DB migration) runs, this helper
 * becomes unreachable and can be deleted.
 */
function evaluateLegacyCondition(
  condition: { key: string; operator: string; value?: JsonValue },
  context: EvaluationContext,
): boolean {
  const ctx = buildContextLookup(context);
  const targetValue = ctx[condition.key];

  switch (condition.operator) {
    case "equals":
      return targetValue === condition.value;

    case "not-equals":
      return targetValue !== condition.value;

    case "greater-than":
      return (
        typeof targetValue === "number" &&
        typeof condition.value === "number" &&
        targetValue > condition.value
      );

    case "greater-than-or-equal":
      return (
        typeof targetValue === "number" &&
        typeof condition.value === "number" &&
        targetValue >= condition.value
      );

    case "less-than":
      return (
        typeof targetValue === "number" &&
        typeof condition.value === "number" &&
        targetValue < condition.value
      );

    case "less-than-or-equal":
      return (
        typeof targetValue === "number" &&
        typeof condition.value === "number" &&
        targetValue <= condition.value
      );

    case "includes":
      if (Array.isArray(targetValue)) {
        return targetValue.includes(condition.value as JsonValue);
      }
      if (typeof targetValue === "string" && typeof condition.value === "string") {
        return targetValue.includes(condition.value);
      }
      return false;

    case "exists":
      return targetValue !== undefined;

    default:
      // Unknown operator — default to "applies" so we don't silently
      // gate modifiers behind a typo. Logging happens via the
      // engine's own trace path, not here.
      return true;
  }
}

function buildContextLookup(
  context: EvaluationContext,
): Record<string, JsonValue> {
  const lookup: Record<string, JsonValue> = {};
  lookup["character.id"] = context.character.id;
  lookup["character.level"] = context.character.level;
  lookup["character.attribute.physical"] = context.character.attributes.physical;
  lookup["character.attribute.mental"] = context.character.attributes.mental;
  lookup["character.attribute.magical"] = context.character.attributes.magical;
  if (context.effect) {
    lookup["effect.id"] = context.effect.id;
    lookup["effect.name"] = context.effect.name;
  }
  if (context.capability) {
    lookup["capability.id"] = context.capability.id;
    lookup["capability.name"] = context.capability.name;
  }
  if (context.environment) {
    for (const [k, v] of Object.entries(context.environment)) {
      lookup[k] = v;
    }
  }
  return lookup;
}

// =============================================================================
// Operation application
// =============================================================================

/**
 * Apply an operation to a base value.
 *
 * Returns the new value. For non-applicable operations (e.g., "grant" on a
 * numeric target), returns the base value unchanged.
 */
export function applyOperation(
  base: JsonValue,
  operation: HardModifier["operation"],
  modifierValue: JsonValue,
): JsonValue {
  switch (operation) {
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "min":
    case "max":
    case "set": {
      const b = toNumber(base);
      const v = toNumber(modifierValue);
      if (b === null || v === null) return base;

      switch (operation) {
        case "add":
          return b + v;
        case "subtract":
          return b - v;
        case "multiply":
          return b * v;
        case "divide":
          if (v === 0) return base;
          return b / v;
        case "min":
          return Math.min(b, v);
        case "max":
          return Math.max(b, v);
        case "set":
          return v;
      }
    }

    case "grant": {
      // Grant sets the value if the current is empty/undefined, otherwise leaves it
      if (base === null || base === undefined || base === 0 || base === "") {
        return modifierValue;
      }
      return base;
    }

    case "revoke": {
      // Revoke zeroes out or empties
      if (typeof base === "number") return 0;
      if (typeof base === "string") return "";
      if (Array.isArray(base)) return [];
      if (typeof base === "object" && base !== null) return {};
      return null;
    }
  }
  // Phase 7.5 v3: default is to return base unchanged. This
  // covers unexpected op strings from legacy data after
  // migrateOperation() has run.
  return base;
}

function toNumber(value: JsonValue): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

// =============================================================================
// Stacking
// =============================================================================

/**
 * Apply a stacking mode to a list of values.
 *
 * "stack" (default): sum all numeric values. Non-numeric values: last-wins.
 * "highest-only": max of numeric values. Non-numeric: first wins.
 * "lowest-only": min of numeric values. Non-numeric: first wins.
 * "unique-by-primitive": for each primitive, take last (then sum across primitives)
 *                        — caller is responsible for grouping by primitive
 * "unique-by-target": same as highest-only for numeric, first-wins for non-numeric
 */
export function applyStacking(
  values: readonly JsonValue[],
  mode: ModifierStackingMode = "stack",
): JsonValue {
  if (values.length === 0) return 0;

  // Filter to numeric first (since most modifiers target numeric stats)
  const numericValues = values
    .map((v) => toNumber(v))
    .filter((v): v is number => v !== null);

  switch (mode) {
    case "stack": {
      if (numericValues.length > 0) {
        return numericValues.reduce((a, b) => a + b, 0);
      }
      const last = values[values.length - 1];
      return last ?? 0;
    }

    case "highest-only": {
      if (numericValues.length > 0) {
        return Math.max(...numericValues);
      }
      const first = values[0];
      return first ?? 0;
    }

    case "lowest-only": {
      if (numericValues.length > 0) {
        return Math.min(...numericValues);
      }
      const first = values[0];
      return first ?? 0;
    }

    case "unique-by-primitive": {
      // Caller pre-grouped by primitive; here we just take the last of each
      // group. But as a single-array function, "unique-by-primitive" reduces
      // to "stack" since unique-by-primitive means one entry per primitive.
      if (numericValues.length > 0) {
        return numericValues.reduce((a, b) => a + b, 0);
      }
      const first = values[0];
      return first ?? 0;
    }

    case "unique-by-target": {
      // Same as highest-only for numeric stacks
      if (numericValues.length > 0) {
        return Math.max(...numericValues);
      }
      const first = values[0];
      return first ?? 0;
    }

    case "replace": {
      // Phase 7.5 v3: explicit override. The latest value
      // wins — no merging, no averaging. For numeric stacks,
      // take the LAST value (since authors usually order
      // overrides after the original). For non-numeric, take
      // the LAST value verbatim.
      const last = values[values.length - 1];
      return last ?? 0;
    }
  }
  // Default for unknown modes — fall through to last value.
  return values[values.length - 1] ?? 0;
}

// =============================================================================
// Main evaluation
// =============================================================================

/**
 * Evaluate a set of modifiers against an EvaluationContext.
 *
 * Returns the resulting map of { target → final value }.
 *
 * Algorithm:
 *   1. Group modifiers by target
 *   2. For each target:
 *      a. Filter to those whose condition is satisfied
 *      b. Apply each modifier's operation to a running base (defaults to 0)
 *      c. If modifiers specify a stacking mode, apply stacking
 *      d. Default stacking = "stack"
 *   3. Return the map
 */
export function evaluateModifiers(
  modifiers: readonly HardModifier[],
  context: EvaluationContext,
): Record<string, JsonValue> {
  // Group by target
  const byTarget = new Map<string, HardModifier[]>();
  for (const mod of modifiers) {
    const list = byTarget.get(mod.target) ?? [];
    list.push(mod);
    byTarget.set(mod.target, list);
  }

  const result: Record<string, JsonValue> = {};

  for (const [target, mods] of byTarget.entries()) {
    if (!mods) continue;
    const matched = mods.filter((m) => evaluateCondition(m.condition, context));

    if (matched.length === 0) continue;

    // Default stacking = "stack" if not specified on any mod
    const firstMod = matched[0];
    if (!firstMod) continue;
    const stackingMode = firstMod.stacking ?? "stack";

    // Apply each modifier's operation sequentially
    let base: JsonValue = 0;
    for (const mod of matched) {
      base = applyOperation(base, mod.operation, mod.value);
    }

    // If we have multiple modifiers, also apply the stacking mode across them
    if (matched.length > 1) {
      const allValues = matched.map((m) => {
        // Each modifier's contribution in isolation
        return applyOperation(0, m.operation, m.value);
      });
      const stacked = applyStacking(allValues, stackingMode);
      // Use the stacked value if it's different from sequential (catches
      // non-additive stacking modes that the sequential application missed)
      if (stacked !== base) {
        base = stacked;
      }
    }

    result[target] = base;
  }

  return result;
}

/**
 * Evaluate a single target. Useful when you only care about one stat.
 *
 * Returns null if no modifiers match this target.
 */
export function evaluateTarget(
  modifiers: readonly HardModifier[],
  target: ModifierTarget | string,
  context: EvaluationContext,
): JsonValue | null {
  const filtered = modifiers.filter((m) => m.target === target);
  if (filtered.length === 0) return null;

  const matched = filtered.filter((m) =>
    evaluateCondition(m.condition, context),
  );
  if (matched.length === 0) return null;

  const firstMatched = matched[0];
  if (!firstMatched) return null;

  const stackingMode = firstMatched.stacking ?? "stack";
  const contributions = matched.map((m) => applyOperation(0, m.operation, m.value));

  if (matched.length === 1) {
    return applyOperation(0, firstMatched.operation, firstMatched.value);
  }

  return applyStacking(contributions, stackingMode);
}

// =============================================================================
// Damage resistance resolution (canonical rule)
// =============================================================================

/**
 * Resolve damage against resistance/vulnerability modifiers.
 *
 * Notion canonical rule: "Largest applies, does NOT stack."
 *
 * Given a base damage value and a set of resistance/vulnerability modifiers,
 * returns the final damage after applying the largest modifier.
 *
 * Resistance modifiers (negative values) reduce damage.
 * Vulnerability modifiers (positive values, marked with metadata.vulnerable)
 * increase damage (typically 2x).
 *
 * We use ModifierOperation with `multiply` or `add` and rely on
 * ModifierStackingMode = "highest-only".
 */
export interface DamageApplicationInput {
  readonly baseDamage: number;
  readonly damageType: string; // e.g., "fire", "slashing", "psychic"
  readonly resistanceModifiers: readonly HardModifier[];
  readonly vulnerabilityModifiers: readonly HardModifier[];
  readonly context: EvaluationContext;
}

export interface DamageApplicationResult {
  readonly finalDamage: number;
  readonly appliedModifier?: HardModifier;
  readonly resisted: boolean;
  readonly vulnerable: boolean;
}

/**
 * Apply damage resistance/vulnerability to a base damage roll.
 *
 * Uses "highest-only" stacking per Notion canonical rule:
 * "Largest applies, does NOT stack."
 */
export function resolveDamageApplication(
  input: DamageApplicationInput,
): DamageApplicationResult {
  const {
    baseDamage,
    damageType,
    resistanceModifiers,
    vulnerabilityModifiers,
    context,
  } = input;

  // Filter to modifiers that target this damage type
  const filterForDamageType = (mods: readonly HardModifier[]) =>
    mods.filter((m) => {
      // Modifiers must apply to this damage type
      const targetType = (m.metadata?.["damageType"] ?? m.target) as string;
      // Match either exact type or "all"
      return targetType === damageType || targetType === "all";
    });

  const validResist = filterForDamageType(resistanceModifiers).filter((m) =>
    evaluateCondition(m.condition, context),
  );
  const validVuln = filterForDamageType(vulnerabilityModifiers).filter((m) =>
    evaluateCondition(m.condition, context),
  );

  // Compute resistance contribution (negative numbers reduce damage)
  let resistanceFactor = 0;
  let bestResistMod: HardModifier | undefined;
  if (validResist.length > 0) {
    const contributions = validResist.map((m) => ({
      // For subtract: value is the reduction (negative result)
      // For multiply: value IS the multiplier (read directly to avoid 0*x trap)
      // For add: value is the bonus (positive result)
      contribution:
        m.operation === "multiply"
          ? (toNumber(m.value) ?? 0)
          : (toNumber(applyOperation(0, m.operation, m.value)) ?? 0),
      op: m.operation,
      mod: m,
    }));
    // For subtract modifiers (resistance), we want the LARGEST reduction (most negative)
    // For multiply (e.g., 0.5x), we want the SMALLEST multiplier (most reduction)
    // Strategy: take the modifier that reduces damage the most.
    const sorted = [...contributions].sort((a, b) => {
      // For multiply operations, smaller is better (more reduction)
      if (a.op === "multiply" && b.op === "multiply") return b.contribution - a.contribution;
      if (a.op === "multiply") return 1; // a is multiply, prefer b
      if (b.op === "multiply") return -1; // b is multiply, prefer a
      // Both subtract: smaller (more negative) wins
      return a.contribution - b.contribution;
    });
    const first = sorted[0];
    if (first) {
      resistanceFactor = first.contribution;
      bestResistMod = first.mod;
    }
  }

  // Compute vulnerability contribution (positive numbers amplify damage)
  let vulnerabilityFactor = 0;
  let bestVulnMod: HardModifier | undefined;
  if (validVuln.length > 0) {
    const contributions = validVuln.map((m) => ({
      contribution:
        m.operation === "multiply"
          ? (toNumber(m.value) ?? 0)
          : (toNumber(applyOperation(0, m.operation, m.value)) ?? 0),
      op: m.operation,
      mod: m,
    }));
    // For vulnerability (positive), take the LARGEST amplification
    // For multiply, take the LARGEST multiplier
    const sorted = [...contributions].sort((a, b) => {
      // For multiply operations, larger multiplier wins
      if (a.op === "multiply" && b.op === "multiply") return b.contribution - a.contribution;
      if (a.op === "multiply") return -1; // a is multiply, prefer a
      if (b.op === "multiply") return 1; // b is multiply, prefer b
      // Both add: larger wins
      return b.contribution - a.contribution;
    });
    const first = sorted[0];
    if (first) {
      vulnerabilityFactor = first.contribution;
      bestVulnMod = first.mod;
    }
  }

  // Apply: resistance first, then vulnerability
  // Note: "largest applies" means the single biggest modifier overall, but
  // here we treat resistance and vulnerability as separate axes since they
  // are categorically different operations.
  let final = baseDamage;

  if (resistanceFactor !== 0) {
    // resistanceFactor is negative (subtract) or a multiplier (0.5)
    if (bestResistMod?.operation === "multiply") {
      final = final * resistanceFactor;
    } else {
      final = final + resistanceFactor; // resistanceFactor is negative
    }
  }

  if (vulnerabilityFactor !== 0) {
    if (bestVulnMod?.operation === "multiply") {
      final = final * vulnerabilityFactor;
    } else {
      final = final + vulnerabilityFactor;
    }
  }

  return {
    finalDamage: Math.max(0, Math.floor(final)),
    ...(bestVulnMod ? { appliedModifier: bestVulnMod } : bestResistMod ? { appliedModifier: bestResistMod } : {}),
    resisted: resistanceFactor !== 0,
    vulnerable: vulnerabilityFactor !== 0,
  };
}