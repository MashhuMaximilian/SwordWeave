/**
 * BU balance engine — Phase 4, updated Phase 8.1 batch 10g.
 *
 * Tracks how much BU a character has spent across all sources.
 *
 * Total character BU progression cap (HARD):
 *   max_progression_bu = max(starting_bu, cumulative(level)) + dm_bonus_bu
 *
 * The max() lets either input drive the cap: in "By Level" mode
 * starting_bu is canonically 25 and cumulative(level) wins for any
 * level >= 1; in "By BU" mode starting_bu is the user's typed value
 * and (typically) wins over the canon for the implied level. The
 * cumulative formula is the canon from the BU Market doc:
 *   cumulative(L) = 25 + 10*(L-1) + 4*k*(k+1)/2 where k = floor(L/4)
 * which is implemented in @/lib/engine/bu.ts as cumulativeBuForLevel.
 *
 * Item BU does NOT count toward progression cap (per Q3 Mashu).
 */

import { cumulativeBuForLevel } from "./bu";

export interface BUAccount {
  readonly startingBu: number;
  readonly buSpent: number;
  readonly level: number;
  readonly dmBonusBu: number;
  readonly itemBuSpent: number; // separate, displayed but not capped
}

export interface BUBalance {
  readonly progressionSpent: number;
  readonly progressionPool: number;
  readonly progressionRemaining: number;
  readonly progressionPercent: number;
  readonly itemBuSpent: number;
  readonly level: number;
  readonly dmBonusBu: number;
  readonly overBudget: boolean;
  readonly warning?: string;
}

export const RECOMMENDED_RACE_BU_CAP = 12;
export const RECOMMENDED_BACKGROUND_BU_CAP = 8;

/**
 * Phase 8.1 batch 10g (Mashu 2026-07-22): the per-level growth is
 * NO LONGER a flat 5 BU. The canon formula is +10 BU per level plus
 * a +level spike every 4 levels. This constant is kept as a
 * backwards-compatible alias of the old value (5) so that legacy
 * imports keep working, but new code should call
 * cumulativeBuForLevel() directly instead. Will be removed in a
 * future cleanup batch.
 *
 * @deprecated Use cumulativeBuForLevel from ./bu for the canon formula.
 */
export const BU_PER_LEVEL = 5;

/**
 * Compute the maximum progression BU for a character. Phase 8.1
 * batch 10g: takes the max of the user-declared starting_bu and
 * the level-derived cumulative budget, plus any DM bonus.
 *
 * Examples:
 *   computeProgressionPool(25, 1, 0) = max(25, 25) = 25
 *   computeProgressionPool(25, 5, 0) = max(25, 69) = 69
 *   computeProgressionPool(25, 4, 0) = max(25, 59) = 59
 *   computeProgressionPool(200, 10, 0) = max(200, 127) = 200
 *   computeProgressionPool(200, 10, 5) = max(200, 127) + 5 = 205
 */
export function computeProgressionPool(
  startingBu: number,
  level: number,
  dmBonusBu: number,
): number {
  return Math.max(startingBu, cumulativeBuForLevel(level)) + dmBonusBu;
}

/**
 * Compute full BU balance breakdown for UI display.
 *
 * Format:
 *   [████████░░░░░░░░░░░░] 12/25 BU spent · L5 · Pool 50 BU (25 start + 20 level + 5 DM bonus)
 */
export function computeBUBalance(account: BUAccount): BUBalance {
  const pool = computeProgressionPool(
    account.startingBu,
    account.level,
    account.dmBonusBu,
  );
  const remaining = pool - account.buSpent;
  const percent = pool > 0 ? Math.round((account.buSpent / pool) * 100) : 0;
  const overBudget = remaining < 0;

  return {
    progressionSpent: account.buSpent,
    progressionPool: pool,
    progressionRemaining: remaining,
    progressionPercent: percent,
    itemBuSpent: account.itemBuSpent,
    level: account.level,
    dmBonusBu: account.dmBonusBu,
    overBudget,
    ...(overBudget
      ? { warning: `BU spent exceeds progression cap by ${-remaining}` }
      : {}),
  };
}

/**
 * Check if race/BG BU exceeds recommended caps. Returns warnings.
 * Soft cap: just warnings, no rejection.
 */
export function checkTemplateBUWarnings(
  raceBu: number,
  backgroundBu: number,
): ReadonlyArray<string> {
  const warnings: string[] = [];
  if (raceBu > RECOMMENDED_RACE_BU_CAP) {
    warnings.push(
      `Race BU (${raceBu}) exceeds recommended cap (${RECOMMENDED_RACE_BU_CAP})`,
    );
  }
  if (backgroundBu > RECOMMENDED_BACKGROUND_BU_CAP) {
    warnings.push(
      `Background BU (${backgroundBu}) exceeds recommended cap (${RECOMMENDED_BACKGROUND_BU_CAP})`,
    );
  }
  return warnings;
}

/**
 * Validate hard caps. Returns null if OK, or error string.
 *
 * @param enforceTemplateCaps If true, race/bg BU caps are HARD enforced
 */
export function validateHardCaps(
  account: BUAccount,
  raceBu: number,
  backgroundBu: number,
  enforceTemplateCaps: boolean,
): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];

  const pool = computeProgressionPool(
    account.startingBu,
    account.level,
    account.dmBonusBu,
  );
  if (account.buSpent > pool) {
    errors.push(
      `BU spent (${account.buSpent}) exceeds progression cap (${pool})`,
    );
  }

  if (enforceTemplateCaps) {
    if (raceBu > RECOMMENDED_RACE_BU_CAP) {
      errors.push(
        `Race BU (${raceBu}) exceeds hard cap (${RECOMMENDED_RACE_BU_CAP})`,
      );
    }
    if (backgroundBu > RECOMMENDED_BACKGROUND_BU_CAP) {
      errors.push(
        `Background BU (${backgroundBu}) exceeds hard cap (${RECOMMENDED_BACKGROUND_BU_CAP})`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Format BU balance for display (one-line summary).
 *
 * Phase 8.1 batch 10g: the per-level award isn't a flat `(L-1)*5`
 * anymore — it's the cumulative growth from L1 to the current level
 * (cumulative(L) - 25 = (L-1)*10 + 4*k*(k+1)/2). We render the
 * "start" and "level" split the same way as before so existing
 * users see a familiar line, but the math is correct now.
 */
export function formatBUBalanceLine(b: BUBalance): string {
  const startPortion = Math.min(25, b.progressionPool - b.dmBonusBu);
  const levelAward = b.progressionPool - b.dmBonusBu - startPortion;
  return `${b.progressionSpent}/${b.progressionPool} BU spent · L${b.level} · Pool ${b.progressionPool} BU (${startPortion} start + ${levelAward} level + ${b.dmBonusBu} DM bonus)`;
}