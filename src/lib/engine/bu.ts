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
 * Source: BU Market — Mirror-Vector Architecture, Tier-Matched Volatility Ceiling.
 *
 * Phase 8.1 batch 11 (Mashu 2026-07-22): the bracket boundaries
 * moved to 4-wide blocks matching the new debt rule. The string
 * labels are kept in the same shape ("L1-L4", "L5-L8", ...) so
 * consumers don't need to change, but the underlying math is now
 * uniform. The "L1" special case is gone.
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
 * Phase 8.1 batch 11 (Mashu 2026-07-22): The canon formula is the
 * source of truth, and there is NO upper level cap. The rules are:
 *
 *   - Each level grants +10 BU (linear growth from L1's 25).
 *   - Every 4 levels (L4, L8, L12, L16, L20, L24, ...) grants an
 *     additional +level BU spike (so L4 = +4, L8 = +8, L12 = +12,
 *     L16 = +16, L20 = +20, L24 = +24, ...).
 *   - These rules continue past L20 — a level-100 character simply
 *     keeps accumulating. There is no max.
 *
 *   cumulative(L) = 25 + 10*(L-1) + sum(spikes)
 *   where spike is awarded at L = 4k for k = 1..floor(L/4),
 *   spike value at level L = 4k is L itself (== 4k).
 *
 * The debt ceiling also has no upper cap. It follows the same
 * brackets used for levels 1-20 (L1 = 4, L2-4 = 8, L5-10 = 12,
 * L11-15 = 16, L16+ = 24) and stays at 24 for L16 and above.
 *
 * Earlier in batch 10 we tried to encode this as a static table,
 * but that required the table to be infinite and we capped at L20.
 * The formula is cleaner and matches the canon at every level.
 */

/**
 * Sum of progression spikes awarded at every 4th level up to and
 * including `level`. At L4k, the spike value equals 4k.
 *
 * Examples:
 *   spikesUpTo(3)  = 0   (no spikes yet)
 *   spikesUpTo(4)  = 4   (one spike of 4)
 *   spikesUpTo(8)  = 12  (4 + 8)
 *   spikesUpTo(12) = 24  (4 + 8 + 12)
 *   spikesUpTo(20) = 60  (4 + 8 + 12 + 16 + 20)
 *   spikesUpTo(24) = 84  (+ 24)
 */
function spikesUpTo(level: number): number {
  if (level < 4) return 0;
  // Sum of arithmetic progression 4, 8, 12, ..., 4*floor(L/4)
  // = 4 * sum(1..floor(L/4)) = 4 * k*(k+1)/2 where k = floor(L/4)
  const k = Math.floor(level / 4);
  return 4 * (k * (k + 1)) / 2;
}

/**
 * Compute the cumulative BU budget for a given character level.
 * No upper bound — works for any L >= 1.
 *
 * Examples:
 *   L1 = 25
 *   L2 = 35  (25 + 10)
 *   L4 = 59  (25 + 30 + 4 spike)
 *   L5 = 69
 *   L8 = 107 (25 + 70 + 4 + 8 spikes)
 *   L20 = 275
 *   L21 = 285
 *   L24 = 319 (25 + 230 + 4 + 8 + 12 + 16 + 20 + 24)
 */
export function cumulativeBuForLevel(level: number): number {
  if (!Number.isFinite(level)) return 25;
  if (level < 1) return 25;
  return 25 + 10 * (level - 1) + spikesUpTo(level);
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
 * Note: this is intentionally a search rather than a closed-form
 * solve because the spike pattern (every 4 levels) makes a closed
 * form awkward. The search is bounded by the level the user
 * actually typed; for arbitrary BU values we use the canonical
 * formula in reverse.
 */
export function levelForBuBudget(budget: number): number | null {
  if (!Number.isFinite(budget)) return null;
  if (budget < 25) return null;
  // Binary-search-like: try levels up to a reasonable cap. For very
  // large budgets we still find the answer because cumulative is
  // strictly monotonic. Cap at level 200 (~12.5k BU); beyond that
  // the search is pointless for UX feedback.
  for (let l = 1; l <= 200; l++) {
    if (cumulativeBuForLevel(l) === budget) return l;
    if (cumulativeBuForLevel(l) > budget) break;
  }
  return null;
}

/**
 * Phase 8.1 batch 11 (Mashu 2026-07-22): "implied" level for a
 * budget — the highest level L such that cumulativeBuForLevel(L)
 * is <= the typed budget. When the budget doesn't exactly match
 * a canon threshold, this gives the bracket the character would
 * slot into (e.g. 133 BU → L10, since 133 > 127 = L10 but < 137
 * = L11). Used by the footer so the Lvl pill doesn't get stuck
 * when the user is in "By BU" mode and types a non-canon value.
 *
 * Returns 1 for budgets below 25 (treats any valid budget as
 * "at least L1"). Caps at level 200 to match levelForBuBudget.
 */
export function impliedLevelForBudget(budget: number): number {
  if (!Number.isFinite(budget)) return 1;
  if (budget < 25) return 1;
  let best = 1;
  for (let l = 1; l <= 200; l++) {
    if (cumulativeBuForLevel(l) <= budget) {
      best = l;
    } else {
      break;
    }
  }
  return best;
}

/**
 * Per the BU Market canon (Notion):
 * - Level 1: -4 BU debt (special case)
 * - Levels 2-4: -8 BU debt
 * - Levels 5-10: -12 BU debt
 * - Levels 11-15: -16 BU debt
 * - Levels 16+: -24 BU debt
 *
 * Returns the maximum negative BU the character can run. Kept for
 * backwards compatibility with code that consumes
 * `getVolatilityCeiling` — now derived from maxBuDebtForLevel.
 */
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
    throw new Error(
      `Primitive "${primitive.name}" (id=${primitive.id}) is not mirrorable but is being used as mirrored.`,
    );
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