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
 */
export type VolatilityCeiling = {
  readonly levelBracket: "1" | "2-4" | "5-10" | "11-15" | "16+";
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
 * Max BU debt per character level, per the Leveling & Progression
 * Canon v1 (Notion page 37fed847-9ccd-80fb-a08b-c88bb715658a).
 *
 * Level 1 is the special case (-4 BU); all other levels fall into
 * one of four broader brackets. These are PER-LEVEL, not per-bracket.
 */
const MAX_DEBT_PER_LEVEL: ReadonlyArray<number> = [
  4, //  L1 — special case per canon
  8, 8, 8, //  L2 / L3 / L4
  12, 12, 12, 12, 12, 12, //  L5-L10
  16, 16, 16, 16, 16, //  L11-L15
  24, 24, 24, 24, 24, //  L16-L20
];

/**
 * Cumulative BU budget per character level (the total pool of BU a
 * character of that level should have access to). Straight lookup
 * from the canon table. The formula previously encoded in this file
 * (25 + 10*(L-1) + spike) does NOT match the canon exactly — the
 * canon bakes progression spikes into specific levels (L4, L8, L12,
 * L16, L20) but uses an offset pattern that differs from "applied
 * at the level it's listed" (e.g. L13 = 169 = L12 + 10 + 12-spike).
 * Rather than reproduce the offset math we use the canon table
 * directly — it's the source of truth.
 */
const CUMULATIVE_BU_PER_LEVEL: ReadonlyArray<number> = [
  25,   //  L1
  35,   //  L2
  45,   //  L3
  55,   //  L4
  69,   //  L5
  79,   //  L6
  89,   //  L7
  99,   //  L8
  117,  //  L9
  127,  //  L10
  137,  //  L11
  147,  //  L12
  169,  //  L13
  179,  //  L14
  189,  //  L15
  199,  //  L16
  225,  //  L17
  235,  //  L18
  245,  //  L19
  255,  //  L20
];

/** Maximum allowed character level (matches the canon table length). */
export const MAX_CHARACTER_LEVEL = 20;

/**
 * Look up the maximum allowed negative BU (volatility / debt) for a
 * given character level. Negative number — e.g. level 1 returns 4
 * (meaning the character can carry up to -4 BU debt).
 */
export function maxBuDebtForLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  if (level < 1) return 0;
  const v =
    level > MAX_CHARACTER_LEVEL
      ? MAX_DEBT_PER_LEVEL[MAX_CHARACTER_LEVEL - 1]
      : MAX_DEBT_PER_LEVEL[level - 1];
  return v ?? 0;
}

/**
 * Look up the cumulative BU threshold for a given character level —
 * the total pool of BU a character of that level should have access
 * to (per canon). Mirroring (negative BU) draws from the debt
 * capacity, NOT from this pool.
 */
export function cumulativeBuForLevel(level: number): number {
  if (!Number.isFinite(level)) return 25;
  if (level < 1) return 25;
  const v =
    level > MAX_CHARACTER_LEVEL
      ? CUMULATIVE_BU_PER_LEVEL[MAX_CHARACTER_LEVEL - 1]
      : CUMULATIVE_BU_PER_LEVEL[level - 1];
  return v ?? 25;
}

/**
 * Given a custom BU budget (set explicitly by the user, bypassing
 * level), return the implied level bracket — useful for telling the
 * user "this budget corresponds to roughly level N". Best-effort;
 * returns null if no level matches.
 */
export function levelForBuBudget(budget: number): number | null {
  if (!Number.isFinite(budget)) return null;
  for (let i = 0; i < CUMULATIVE_BU_PER_LEVEL.length; i++) {
    if (CUMULATIVE_BU_PER_LEVEL[i] === budget) return i + 1;
  }
  return null;
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
export function getVolatilityCeiling(level: number): VolatilityCeiling {
  const maxNegativeBu = maxBuDebtForLevel(level);
  let levelBracket: VolatilityCeiling["levelBracket"];
  let accessibleTier: string;
  if (level >= 16) {
    levelBracket = "16+";
    accessibleTier = "Tier IV+ (Apex)";
  } else if (level >= 11) {
    levelBracket = "11-15";
    accessibleTier = "Tier IV (Core Axes)";
  } else if (level >= 5) {
    levelBracket = "5-10";
    accessibleTier = "Tier III (Major)";
  } else if (level === 1) {
    levelBracket = "1";
    accessibleTier = "Tier I (Minor, special debt -4)";
  } else {
    levelBracket = "2-4";
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