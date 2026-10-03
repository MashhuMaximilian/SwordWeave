import { cumulativeBuForLevel, maxBuDebtForLevel } from "@/lib/engine/bu";

export interface CreationBudgetInput {
  /** The chosen level, or the level implied by a custom BU budget. */
  level: number;
  /** Agreed positive budget, including any explicit DM bonus. */
  budget: number;
  positiveSpent: number;
  /** Positive magnitude of credit from mirrored purchases. */
  mirrorCredit: number;
  /** Also extends the next-level hard ceiling when explicitly granted. */
  dmBonusBu?: number;
}

/**
 * Allocate purchases to the agreed budget first, then drawback credit.
 * Remaining overflow needs DM agreement; only the next-level ceiling and
 * current-level debt ceiling prevent creation. Items use a separate ledger.
 */
export function creationBudget(input: CreationBudgetInput) {
  const budget = Math.max(0, input.budget);
  const positiveSpent = Math.max(0, input.positiveSpent);
  const credit = Math.max(0, input.mirrorCredit);
  const baseUsed = Math.min(positiveSpent, budget);
  const debtUsed = Math.min(Math.max(0, positiveSpent - budget), credit);
  const debtAvailable = credit - debtUsed;
  const overflow = Math.max(0, positiveSpent - budget - credit);
  const netSpent = positiveSpent - credit;
  const nextLevelBudget = cumulativeBuForLevel(input.level + 1) + Math.max(0, input.dmBonusBu ?? 0);
  const debtCeiling = maxBuDebtForLevel(input.level);
  const debtExceeded = credit > debtCeiling;
  const aboveNextLevel = netSpent > nextLevelBudget;
  return {
    baseUsed,
    debtUsed,
    debtAvailable,
    overflow,
    remaining: Math.max(0, budget - baseUsed) + debtAvailable,
    nextLevelBudget,
    netSpent,
    debtCeiling,
    debtExceeded,
    aboveNextLevel,
    needsDmApproval: overflow > 0,
    canCreate: !debtExceeded && !aboveNextLevel,
  };
}
