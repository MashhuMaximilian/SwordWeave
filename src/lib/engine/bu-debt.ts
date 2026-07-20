/**
 * bu-debt.ts — Phase 7 Mirror debt model (character creation / template).
 *
 * The canonical debt rule, locked from the BU Market page §'Mirror-Vector
 * Architecture' + the user's debt-model clarification:
 *
 *   "When slotted in capability and effects it's same cost whether
 *    mirrored or not. In heritage and character creation, a mirrored
 *    primitive adds to debt. I have starting budget 25 BU at lvl 1.
 *    I take a mirrored primitive that costs 4BU. I get the effects
 *    of that, and I now have 29 total BU to spend (25+4). But based
 *    on level we have those thresholds. Not cumulative. Like lvl 2-4
 *    have -8 but max debt. Lvl 2 or lvl 4 is still max -8 not -8 per
 *    level."
 *
 * Translation into engine rules:
 *
 *   1. baseBudget(level) — the canonical bracket budget. Defaults to
 *      the Phase-4 progression pool (25 + (level-1)*5) but the *mirror
 *      debt* ceiling is a separate bracket-aware threshold that grows
 *      by level bracket, not per level. See MAX_MIRROR_DEBT_BY_LEVEL.
 *
 *   2. Mirror debt expansion — a mirrored slot at character-creation
 *      or template level adds its buCost to the player's available
 *      budget. The player must spend that additional budget on
 *      something — they can't bank it. The mechanic is "I'll take
 *      this drawback to afford more elsewhere."
 *
 *   3. Volatility ceiling — bracket-based, NOT cumulative. Lvl 2-4
 *      share the same -8 BU debt ceiling. Lvl 5-8 share -16. Etc.
 *
 *   4. Constraint: totalSpent <= totalAvailable. The character must
 *      not exceed the debt-adjusted budget. Standard slots and
 *      mirrored slots both contribute to totalSpent (mirrored slots
 *      also contribute to totalAvailable, so the net cost is buCost
 *      but the *capacity* expands).
 *
 * This file is pure functions only. The character-creation /
 * template UI calls into it.
 */

import { computeProgressionPool, BU_PER_LEVEL } from "./bu-balance";

/**
 * Mirror debt ceilings, bracket-based (NOT cumulative per level).
 *
 * Lvl 1: 0 (no debt allowed at character creation).
 * Lvl 2-4: -8 BU debt.
 * Lvl 5-8: -16 BU debt.
 * Lvl 9-12: -24 BU debt.
 * Lvl 13-16: -32 BU debt.
 * Lvl 17-20: -40 BU debt.
 */
export const MAX_MIRROR_DEBT_BY_LEVEL: ReadonlyArray<{
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly maxMirrorDebtBu: number;
}> = [
  { minLevel: 1, maxLevel: 1, maxMirrorDebtBu: 0 },
  { minLevel: 2, maxLevel: 4, maxMirrorDebtBu: 8 },
  { minLevel: 5, maxLevel: 8, maxMirrorDebtBu: 16 },
  { minLevel: 9, maxLevel: 12, maxMirrorDebtBu: 24 },
  { minLevel: 13, maxLevel: 16, maxMirrorDebtBu: 32 },
  { minLevel: 17, maxLevel: 20, maxMirrorDebtBu: 40 },
];

/**
 * Look up the bracket ceiling for a given level.
 */
export function getMirrorDebtCeiling(level: number): number {
  for (const bracket of MAX_MIRROR_DEBT_BY_LEVEL) {
    if (level >= bracket.minLevel && level <= bracket.maxLevel) {
      return bracket.maxMirrorDebtBu;
    }
  }
  // Out-of-range level: clamp to highest bracket.
  return MAX_MIRROR_DEBT_BY_LEVEL[MAX_MIRROR_DEBT_BY_LEVEL.length - 1]!
    .maxMirrorDebtBu;
}

export interface SlotInput {
  /** Whether this slot was acquired in mirrored form. */
  readonly is_mirrored?: boolean;
  /** The base BU cost of the underlying primitive. */
  readonly buCost: number;
  /**
   * The canonical mirror BU credit. In the canonical model this is
   * equal to buCost (so the mirror credit equals the spend). We
   * accept it as a parameter so future overrides (DM-grant) flow
   * through cleanly.
   */
  readonly mirrorBuCredit?: number;
}

/**
 * Compute the mirror debt expansion: how much extra budget the
 * mirrored slots add to the player's available pool.
 *
 * Returns the *positive* expansion number. A character with no
 * mirrored slots gets 0 expansion.
 */
export function computeMirrorDebtExpansion(
  slots: readonly SlotInput[],
): number {
  let expansion = 0;
  for (const slot of slots) {
    if (slot.is_mirrored !== true) continue;
    // Canonical default: mirror_bu_credit = buCost. The expansion
    // is the credit value, since the player effectively trades
    // "accepting the mirror's behavioral trade-off" for
    // "buCost in extra budget to spend on other slots."
    const credit = slot.mirrorBuCredit ?? slot.buCost;
    expansion += Math.max(0, credit);
  }
  return expansion;
}

export interface MirrorDebtAccount {
  /** Level of the character (1-20). */
  readonly level: number;
  /** Starting BU at character creation (canonical default 25 at L1). */
  readonly startingBu: number;
  /** DM bonus BU (additional budget the DM grants). */
  readonly dmBonusBu?: number;
  /** All slots the character has acquired. */
  readonly slots: readonly SlotInput[];
}

export interface MirrorDebtBreakdown {
  /** Base progression pool (Phase-4 model). */
  readonly basePool: number;
  /** Mirror-debt expansion from mirrored slots. */
  readonly mirrorDebtExpansion: number;
  /** Total available budget (base + mirror expansion). */
  readonly totalAvailable: number;
  /** Total spent (sum of buCost across all slots). */
  readonly totalSpent: number;
  /** Whether the character is over the debt-adjusted budget. */
  readonly overBudget: boolean;
  /** Mirror-debt bracket ceiling for the level. */
  readonly mirrorDebtCeiling: number;
  /** Mirror-debt used (sum of mirror_bu_credit for mirrored slots). */
  readonly mirrorDebtUsed: number;
  /** Whether the mirror-debt is exceeded. */
  readonly mirrorDebtExceeded: boolean;
  /** Optional warning string. */
  readonly warning?: string;
}

/**
 * Compute the full mirror-debt breakdown for a character-creation or
 * template-level purchase.
 *
 * Pre-condition: every slot's buCost and (if mirrored) mirrorBuCredit
 * are already populated. Pure function — does not read from DB or
 * produce side effects.
 */
export function computeMirrorDebt(
  account: MirrorDebtAccount,
): MirrorDebtBreakdown {
  const basePool = computeProgressionPool(
    account.startingBu,
    account.level,
    account.dmBonusBu ?? 0,
  );
  const mirrorDebtExpansion = computeMirrorDebtExpansion(account.slots);
  const totalAvailable = basePool + mirrorDebtExpansion;
  const totalSpent = account.slots.reduce((sum, s) => sum + s.buCost, 0);
  const overBudget = totalSpent > totalAvailable;
  const mirrorDebtCeiling = getMirrorDebtCeiling(account.level);
  const mirrorDebtUsed = computeMirrorDebtExpansion(account.slots);
  const mirrorDebtExceeded = mirrorDebtUsed > mirrorDebtCeiling;

  const warning = mirrorDebtExceeded
    ? `Mirror debt ${mirrorDebtUsed} BU exceeds level-${account.level} bracket ceiling ${mirrorDebtCeiling} BU.`
    : overBudget
      ? `Total spent ${totalSpent} BU exceeds available budget ${totalAvailable} BU.`
      : undefined;

  return {
    basePool,
    mirrorDebtExpansion,
    totalAvailable,
    totalSpent,
    overBudget,
    mirrorDebtCeiling,
    mirrorDebtUsed,
    mirrorDebtExceeded,
    ...(warning ? { warning } : {}),
  };
}

/**
 * Compute a per-level bracket summary. Useful for the character-creation
 * UI to show the player "you can take up to -8 BU of mirror debt at
 * this level."
 */
export interface MirrorDebtBracketInfo {
  readonly level: number;
  readonly ceiling: number;
  readonly used: number;
  readonly remaining: number;
  readonly bracketLabel: string;
}

export function describeMirrorDebtBracket(
  level: number,
  mirrorDebtUsed: number,
): MirrorDebtBracketInfo {
  const ceiling = getMirrorDebtCeiling(level);
  const remaining = Math.max(0, ceiling - mirrorDebtUsed);
  const bracket = MAX_MIRROR_DEBT_BY_LEVEL.find(
    (b) => level >= b.minLevel && level <= b.maxLevel,
  );
  const bracketLabel = bracket
    ? `L${bracket.minLevel}${bracket.minLevel === bracket.maxLevel ? "" : `-${bracket.maxLevel}`}`
    : `L${level}+`;
  return {
    level,
    ceiling,
    used: mirrorDebtUsed,
    remaining,
    bracketLabel,
  };
}

/**
 * Re-export for callers that need the bracket-based BU/level growth
 * (separate from the per-level progression award).
 */
export const BRACKET_BU_PER_LEVEL = BU_PER_LEVEL;
