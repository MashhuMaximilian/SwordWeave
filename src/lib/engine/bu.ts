/**
 * BU Ledger Engine Module
 *
 * Pure functions for calculating Build Unit costs, mirror credits,
 * volatility ratings, and enforcing volatility ceilings.
 *
 * All functions are framework-agnostic — no Next.js, no Drizzle, no React.
 * They accept plain TypeScript data and return plain TypeScript data.
 *
 * Tests: src/lib/engine/__tests__/bu.test.ts
 */

import type { HardModifier, JsonValue } from "@/types/swordweave";

// ============================================================================
// Types
// ============================================================================

/**
 * A primitive with the minimum fields needed for BU calculations.
 * Can be derived from a Drizzle row, a JSON import, or a constructor.
 */
export interface PrimitiveInput {
  readonly id: number | string;
  readonly name: string;
  readonly category: string;
  readonly buCost: number;
  readonly isMirrorable: boolean;
  readonly mirrorBuCredit: number;
  readonly hardModifiers: readonly HardModifier[];
}

/**
 * A composed capability — verbs + domains + effects + structural primitives.
 * Total BU = sum of all referenced primitive buCost values.
 */
export interface CapabilityInput {
  readonly id: number | string;
  readonly name: string;
  readonly primitiveReferences: readonly {
    readonly primitiveId: number | string;
    readonly quantity: number;
  }[];
  readonly effects: readonly EffectInput[];
}

/**
 * A reusable group of primitives that can be slotted into capabilities.
 */
export interface EffectInput {
  readonly id: number | string;
  readonly name: string;
  readonly primitiveReferences: readonly {
    readonly primitiveId: number | string;
    readonly quantity: number;
  }[];
}

/**
 * Character level → max negative BU (volatility) ceiling.
 * Source: user-provided level progression table (2026-09-24).
 */
export type VolatilityCeiling = {
  readonly levelBracket:
    | "L1-L4"
    | "L5-L8"
    | "L9-L12"
    | "L13-L16"
    | "L17-L20"
    | "L21-L24"
    | "L25-L28"
    | "L29+";
  readonly maxNegativeBu: number;
  readonly accessibleTier: string;
};

/**
 * Result of evaluating a character's BU ledger.
 */
export interface BuLedger {
  /** Sum of positive BU spent (primitives bought at full cost) */
  readonly positiveSpent: number;
  /** Sum of negative BU from mirrored primitives (always ≤ 0) */
  readonly mirrorCredit: number;
  /** Total net BU spent = positiveSpent + mirrorCredit */
  readonly netSpent: number;
  /** Absolute value of mirrorCredit — used for volatility tracking */
  readonly volatilityRating: number;
  /** Max allowed volatility for this character's level */
  readonly volatilityCeiling: number;
  /** True if volatilityRating > volatilityCeiling */
  readonly ceilingExceeded: boolean;
  /** Character's total BU budget (level-derived + spikes) */
  readonly budget: number;
  /** budget - netSpent. Negative means over budget. */
  readonly remaining: number;
  /** True if netSpent > budget */
  readonly overBudget: boolean;
}

// ============================================================================
// Volatility Ceiling Table
// ============================================================================

/**
 * The supplied table is authoritative through level 21. Beyond 21,
 * preserve the open-ended progression using +10 per level and the
 * established four-level bracket spikes. The level-21 row is an
 * explicit +31 BU increase (255 → 286), so it is kept literally.
 */

export const CUMULATIVE_BU_BY_LEVEL = [
  25, 35, 45, 55, 69, 79, 89, 99, 117, 127, 137, 147,
  169, 179, 189, 199, 225, 235, 245, 255, 286,
] as const;

/**
 * Compute the cumulative BU budget for a given character level.
 * No upper bound — works for any L >= 1.
 *
 * Through L21, values come directly from the supplied table.
 */
export function cumulativeBuForLevel(level: number): number {
  if (!Number.isFinite(level)) return 25;
  if (level < 1) return 25;
  const wholeLevel = Math.floor(level);
  if (wholeLevel <= CUMULATIVE_BU_BY_LEVEL.length) {
    return CUMULATIVE_BU_BY_LEVEL[wholeLevel - 1]!;
  }
  const extraLevels = wholeLevel - CUMULATIVE_BU_BY_LEVEL.length;
  const lastSpikeIndex = Math.floor((wholeLevel - 1) / 4);
  // Bracket spikes after the supplied L21 value occur at L25, L29, ...
  // Their values are 24, 28, ... . Closed form keeps high levels fast.
  const laterSpikes = 2 * (lastSpikeIndex * (lastSpikeIndex + 1) - 30);
  return CUMULATIVE_BU_BY_LEVEL.at(-1)! + extraLevels * 10 + laterSpikes;
}

/** Selected milestones for formula modals, including the current bracket. */
export function buProgressionMilestones(level: number): ReadonlyArray<{
  level: number;
  spike: number;
  cumulative: number;
}> {
  const currentBracket = Math.max(1, Math.floor((level - 1) / 4));
  const indices = new Set([1, 2, 3, 4, 5]);
  for (let k = Math.max(1, currentBracket - 2); k <= currentBracket + 1; k++) {
    indices.add(k);
  }
  return [...indices].sort((a, b) => a - b).map((k) => {
    const milestoneLevel = k * 4 + 1;
    const spike = cumulativeBuForLevel(milestoneLevel) -
      cumulativeBuForLevel(milestoneLevel - 1) - 10;
    const cumulative = cumulativeBuForLevel(milestoneLevel) -
      (25 + 10 * (milestoneLevel - 1));
    return { level: milestoneLevel, spike, cumulative };
  });
}

/** Representative debt brackets for formula modals, including high levels. */
export function buDebtBracketsForLevel(level: number): ReadonlyArray<{
  label: string;
  minLevel: number;
  maxLevel: number;
  ceiling: number;
}> {
  const currentIndex = Math.max(0, Math.floor((level - 1) / 4));
  const indices = new Set([0, 1, 2, 3, 4, 5, 6]);
  for (let i = Math.max(0, currentIndex - 1); i <= currentIndex + 1; i++) {
    indices.add(i);
  }
  return [...indices].sort((a, b) => a - b).map((i) => {
    const minLevel = i * 4 + 1;
    const maxLevel = minLevel + 3;
    return {
      label: `L${minLevel}-L${maxLevel}`,
      minLevel,
      maxLevel,
      ceiling: maxBuDebtForLevel(minLevel),
    };
  });
}

/**
 * Compute the maximum BU debt (volatility ceiling) for a given
 * character level. Per Mashu 2026-07-22 (clarified from earlier
 * draft): the rule is "4 BU of debt per 4 levels", with NO L1
 * special case. The brackets are exactly 4-wide:
 *
 *   L1..L4   = 4
 *   L5..L8   = 8
 *   L9..L12  = 12
 *   L13..L16 = 16
 *   L17..L20 = 20
 *   L21..L24 = 24
 *   L25..L28 = 28
 *   ...
 *
 * Formula: debt_ceiling = max(1, ceil(L / 4)) * 4
 *
 * Returns a positive number representing the absolute debt limit
 * (caller formats as `-N BU` in the UI).
 */
export function maxBuDebtForLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  if (level <= 0) return 0;
  return Math.ceil(level / 4) * 4;
}

/**
 * Given a custom BU budget (set explicitly by the user, bypassing
 * level), find the LOWEST level L whose cumulative budget equals
 * exactly this value. Returns null when no exact match exists —
 * useful for telling the user "this budget matches level N".
 *
 * For budgets that DON'T exactly match (e.g. 133 between L10's 127
 * and L11's 137), use `impliedLevelForBudget` instead — that one
 * returns the highest level whose cumulative budget is <= the
 * typed budget, i.e. "this budget is at least as much as level N".
 *
 * Binary search keeps this open ended even for large custom budgets.
 */
export function levelForBuBudget(budget: number): number | null {
  if (!Number.isSafeInteger(budget)) return null;
  if (budget < 25) return null;
  const level = impliedLevelForBudget(budget);
  return cumulativeBuForLevel(level) === budget ? level : null;
}

/**
 * "Implied" level for a
 * budget — the highest level L such that cumulativeBuForLevel(L)
 * is <= the typed budget. When the budget doesn't exactly match
 * a canon threshold, this gives the bracket the character would
 * slot into (e.g. 133 BU → L10, since 133 > 127 = L10 but < 137
 * = L11). Used by the footer so the Lvl pill doesn't get stuck
 * when the user is in "By BU" mode and types a non-canon value.
 *
 * Returns 1 for budgets below 25 (treats any valid budget as
 * "at least L1"). No level cap.
 */
export function impliedLevelForBudget(budget: number): number {
  if (!Number.isFinite(budget)) return 1;
  if (budget < 25) return 1;
  let low = 1;
  let high = 2;
  while (cumulativeBuForLevel(high) <= budget) {
    low = high;
    high *= 2;
  }
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (cumulativeBuForLevel(middle) <= budget) low = middle;
    else high = middle;
  }
  return low;
}

/**
 * Compute the volatility ceiling metadata for a character level:
 * the maximum negative BU they can carry, the level bracket label
 * (used by character-sheet-view), and the accessible tier string.
 *
 * Bracket boundaries:
 *   L1-L4   → -4  Tier I & II (Minor / Standard)
 *   L5-L8   → -8  Tier III (Major)
 *   L9-L12  → -12 Tier IV (Core Axes)
 *   L13-L16 → -16 Tier IV+ (Advanced)
 *   L17-L20 → -20 Tier V (Apex)
 *   L21-L24 → -24 Tier V+ (Apex+)
 *   L25-L28 → -28 Tier VI (Mythic)
 *   L29+    → ceiling grows by 4 per 4 levels (Tier VII+)
 */
export function getVolatilityCeiling(level: number): VolatilityCeiling {
  const maxNegativeBu = maxBuDebtForLevel(level);
  let levelBracket: VolatilityCeiling["levelBracket"];
  let accessibleTier: string;
  if (level >= 29) {
    levelBracket = "L29+";
    accessibleTier = `Tier VII+ (Mythic+, ceiling −${maxNegativeBu})`;
  } else if (level >= 25) {
    levelBracket = "L25-L28";
    accessibleTier = "Tier VI (Mythic)";
  } else if (level >= 21) {
    levelBracket = "L21-L24";
    accessibleTier = "Tier V+ (Apex+)";
  } else if (level >= 17) {
    levelBracket = "L17-L20";
    accessibleTier = "Tier V (Apex)";
  } else if (level >= 13) {
    levelBracket = "L13-L16";
    accessibleTier = "Tier IV+ (Advanced)";
  } else if (level >= 9) {
    levelBracket = "L9-L12";
    accessibleTier = "Tier IV (Core Axes)";
  } else if (level >= 5) {
    levelBracket = "L5-L8";
    accessibleTier = "Tier III (Major)";
  } else {
    levelBracket = "L1-L4";
    accessibleTier = "Tier I & II (Minor / Standard)";
  }
  return { levelBracket, maxNegativeBu, accessibleTier };
}

/**
 * Backwards-compatible alias for `cumulativeBuForLevel`. Older code
 * (and tests) used this name to mean "the character's total BU
 * pool, derived from level". Re-exports the new canonical function
 * so existing call sites keep working without churn.
 *
 * NOTE: this is the CUMULATIVE budget (positive pool). For debt
 * ceiling, use `maxBuDebtForLevel(level)` instead.
 */
export function calculateBuBudget(level: number): number {
  return cumulativeBuForLevel(level);
}

// ============================================================================
// Primitive BU Calculations
// ============================================================================

/**
 * Calculate the BU cost of a single primitive, factoring in mirror state.
 *
 * - Standard primitive (not mirrored): returns buCost (positive)
 * - Mirrored primitive: returns -mirrorBuCredit (negative, grants credit)
 *
 * The mirrorBuCredit is typically set equal to buCost, but the Notion canon
 * allows DM override to set it lower if the mirror doesn't create real friction.
 */
export function calculatePrimitiveBu(
  primitive: PrimitiveInput,
  isMirrored: boolean,
): number {
  if (!isMirrored) {
    return primitive.buCost;
  }
  if (!primitive.isMirrorable) {
    // Phase 8.I i3 fix: a slot is marked mirrored but the
    // primitive isn't mirrorable (seed data artifact).
    // Treat as non-mirrored so the engine doesn't crash on
    // legacy/migrated data. Mashu 2026-09-07 round 2: kept
    // this behavior — Mashu realized mirroring primitives
    // that grant no value (Mental Muscle Mass is the example)
    // doesn't make sense; the mirror button shouldn't even
    // show for those, which the chip already enforces via
    // isMirrorable gating.
    return primitive.buCost;
  }
  return -Math.abs(primitive.mirrorBuCredit);
}

/**
 * Sum BU costs across a list of primitives.
 * Useful for capability/effect composition calculations.
 */
export function sumPrimitiveBu(
  primitives: readonly PrimitiveInput[],
  mirroredIds: ReadonlySet<number | string> = new Set(),
): { positiveSpent: number; mirrorCredit: number; netSpent: number } {
  let positiveSpent = 0;
  let mirrorCredit = 0;

  for (const primitive of primitives) {
    const bu = calculatePrimitiveBu(primitive, mirroredIds.has(primitive.id));
    if (bu >= 0) {
      positiveSpent += bu;
    } else {
      mirrorCredit += bu; // negative number
    }
  }

  return {
    positiveSpent,
    mirrorCredit,
    netSpent: positiveSpent + mirrorCredit,
  };
}

// ============================================================================
// Character Ledger Calculation
// ============================================================================

/**
 * Evaluate a character's full BU ledger.
 *
 * @param level - Character level
 * @param primitives - All primitives in the character's ledger (both active and mirrored)
 * @param mirroredIds - Set of primitive IDs the character is using as mirrored
 * @returns Full ledger with budget, spent, volatility, ceiling status
 */
export function evaluateBuLedger(
  level: number,
  primitives: readonly PrimitiveInput[],
  mirroredIds: ReadonlySet<number | string> = new Set(),
): BuLedger {
  const budget = calculateBuBudget(level);
  const ceiling = getVolatilityCeiling(level);
  const { positiveSpent, mirrorCredit, netSpent } = sumPrimitiveBu(
    primitives,
    mirroredIds,
  );

  const volatilityRating = Math.abs(mirrorCredit);
  const ceilingExceeded = volatilityRating > ceiling.maxNegativeBu;
  const overBudget = netSpent > budget;
  const remaining = budget - netSpent;

  return {
    positiveSpent,
    mirrorCredit,
    netSpent,
    volatilityRating,
    volatilityCeiling: ceiling.maxNegativeBu,
    ceilingExceeded,
    budget,
    remaining,
    overBudget,
  };
}

/**
 * Validate that a character can take a proposed mirror primitive.
 * Returns true if accepting it would not exceed the volatility ceiling.
 */
export function canAcceptMirror(
  level: number,
  currentMirrored: readonly PrimitiveInput[],
  proposedMirror: PrimitiveInput,
): { allowed: boolean; reason: string | null } {
  if (!proposedMirror.isMirrorable) {
    return {
      allowed: false,
      reason: `Primitive "${proposedMirror.name}" is not flagged as mirrorable.`,
    };
  }

  const ceiling = getVolatilityCeiling(level);
  const currentTotal = currentMirrored.reduce(
    (sum, p) => sum + Math.abs(p.mirrorBuCredit),
    0,
  );
  const newTotal = currentTotal + Math.abs(proposedMirror.mirrorBuCredit);

  if (newTotal > ceiling.maxNegativeBu) {
    return {
      allowed: false,
      reason: `Accepting "${proposedMirror.name}" would push volatility to ${newTotal} BU, exceeding level ${level} ceiling of ${ceiling.maxNegativeBu} BU.`,
    };
  }

  return { allowed: true, reason: null };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Format a BU ledger for display.
 * Useful for the character sheet UI.
 */
export function formatLedger(ledger: BuLedger): string {
  return [
    `BU Spent: +${ledger.positiveSpent}`,
    `Mirror Credit: ${ledger.mirrorCredit}`,
    `Net Spent: ${ledger.netSpent}`,
    `Volatility: -${ledger.volatilityRating} / -${ledger.volatilityCeiling}${ledger.ceilingExceeded ? " ⚠️ EXCEEDED" : ""}`,
    `Budget: ${ledger.budget}`,
    `Remaining: ${ledger.remaining}${ledger.overBudget ? " ⚠️ OVER BUDGET" : ""}`,
  ].join("\n");
}

/**
 * Validate that BU values are sane (non-negative integers where applicable).
 */
export function validateBuValue(value: number, fieldName: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer, got: ${value}`);
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be non-negative, got: ${value}`);
  }
}

// ============================================================================
// Future Hooks (documented, not yet implemented)
// ============================================================================

/**
 * TODO(Tier 2): Apply hard modifiers from primitives to BU calculations.
 * E.g., a primitive with `target: "character.buCostMultiplier"` could
 * scale the cost of subsequent primitives.
 */

/**
 * TODO(Tier 3): Effect composition — when a capability uses an effect,
 * add the effect's primitive BU costs to the capability total.
 * This is currently handled in capabilities.ts (separate module).
 */
