/**
 * bu-debt.ts — Phase 7 Mirror debt model (character creation / template).
 *
 * A mirrored character-level primitive adds its credit to available
 * BU while increasing debt used. The debt ceiling follows the user's
 * 2026-09-24 progression table: 4 BU per four-level bracket.
 *
 * Translation into engine rules:
 *
 *   1. baseBudget(level) — the canonical bracket budget. Defaults to
 *      the level progression pool. The mirror debt ceiling follows
 *      four-level brackets; see maxBuDebtForLevel.
 *
 *   2. Mirror debt expansion — a mirrored slot at character-creation
 *      or template level adds its buCost to the player's available
 *      budget. The player must spend that additional budget on
 *      something — they can't bank it. The mechanic is "I'll take
 *      this drawback to afford more elsewhere."
 *
 *   3. Volatility ceiling — bracket-based, NOT cumulative. L1-4
 *      share the same -4 BU debt ceiling. L5-8 share -8. Etc.
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
import { maxBuDebtForLevel } from "./bu";

/**
 * Mirror debt ceilings, bracket-based (NOT cumulative per level).
 *
 * User-provided progression table (2026-09-24): L1-4 -4,
 * L5-8 -8, L9-12 -12, L13-16 -16, L17-20 -20, L21-24 -24.
 */
export const MAX_MIRROR_DEBT_BY_LEVEL: ReadonlyArray<{
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly maxMirrorDebtBu: number;
}> = [
  { minLevel: 1, maxLevel: 4, maxMirrorDebtBu: 4 },
  { minLevel: 5, maxLevel: 8, maxMirrorDebtBu: 8 },
  { minLevel: 9, maxLevel: 12, maxMirrorDebtBu: 12 },
  { minLevel: 13, maxLevel: 16, maxMirrorDebtBu: 16 },
  { minLevel: 17, maxLevel: 20, maxMirrorDebtBu: 20 },
  { minLevel: 21, maxLevel: 24, maxMirrorDebtBu: 24 },
];

/**
 * Look up the bracket ceiling for a given level.
 */
export function getMirrorDebtCeiling(level: number): number {
  return maxBuDebtForLevel(level);
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
  /** Level of the character (1+; supplied progression table covers 1-21). */
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
  const bracketStart = Math.floor((Math.max(1, level) - 1) / 4) * 4 + 1;
  const bracketLabel = bracket
    ? `L${bracket.minLevel}-${bracket.maxLevel}`
    : `L${bracketStart}-${bracketStart + 3}`;
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
