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
  readonly levelBracket: "1-4" | "5-10" | "11-15" | "16+";
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
 * Per the BU Market canon (Notion):
 * - Levels 1-4: Tier I & II (Minor / Standard), Max Volatility -8 BU
 * - Levels 5-10: Tier III (Major), Max Volatility -12 BU
 * - Levels 11-15: Tier IV (Core Axes), Max Volatility -16 BU
 * - Levels 16+: Tier IV+ (Apex), Max Volatility -24 BU
 */
export function getVolatilityCeiling(level: number): VolatilityCeiling {
  if (level >= 16) {
    return {
      levelBracket: "16+",
      maxNegativeBu: 24,
      accessibleTier: "Tier IV+ (Apex)",
    };
  }
  if (level >= 11) {
    return {
      levelBracket: "11-15",
      maxNegativeBu: 16,
      accessibleTier: "Tier IV (Core Axes)",
    };
  }
  if (level >= 5) {
    return {
      levelBracket: "5-10",
      maxNegativeBu: 12,
      accessibleTier: "Tier III (Major)",
    };
  }
  return {
    levelBracket: "1-4",
    maxNegativeBu: 8,
    accessibleTier: "Tier I & II (Minor / Standard)",
  };
}

// ============================================================================
// Character BU Budget
// ============================================================================

/**
 * Calculate a character's total BU budget from level.
 *
 * Formula (from System Mathematics + Leveling Canon v1):
 *   Total BU = 25 (at L1) + [10 × (L-1)] + Progression Spikes
 *
 * Progression Spikes (from Notion, applied at L4/8/12/16/20):
 *   L4  → +4 BU
 *   L8  → +8 BU
 *   L12 → +12 BU
 *   L16 → +16 BU
 *   L20 → +20 BU
 *
 * @param level - Character level (1-20 typically)
 * @returns Total BU budget for that level
 */
export function calculateBuBudget(level: number): number {
  if (level < 1) {
    return 0;
  }

  const base = 25 + 10 * (level - 1);

  // Progression spikes
  let spikes = 0;
  if (level >= 4) spikes += 4;
  if (level >= 8) spikes += 8;
  if (level >= 12) spikes += 12;
  if (level >= 16) spikes += 16;
  if (level >= 20) spikes += 20;

  return base + spikes;
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