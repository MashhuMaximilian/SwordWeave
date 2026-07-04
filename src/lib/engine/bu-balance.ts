/**
 * BU balance engine — Phase 4.
 *
 * Tracks how much BU a character has spent across all sources.
 *
 * Total character BU progression cap (HARD):
 *   max_progression_bu = starting_bu + (level - 1) * 5 + dm_bonus_bu
 *
 * Item BU does NOT count toward progression cap (per Q3 Mashu).
 */

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
export const BU_PER_LEVEL = 5;

/**
 * Compute the maximum progression BU for a character.
 */
export function computeProgressionPool(
  startingBu: number,
  level: number,
  dmBonusBu: number,
): number {
  return startingBu + (level - 1) * BU_PER_LEVEL + dmBonusBu;
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
 */
export function formatBUBalanceLine(b: BUBalance): string {
  const levelAward = (b.level - 1) * BU_PER_LEVEL;
  return `${b.progressionSpent}/${b.progressionPool} BU spent · L${b.level} · Pool ${b.progressionPool} BU (${25 + 0} start + ${levelAward} level + ${b.dmBonusBu} DM bonus)`;
}