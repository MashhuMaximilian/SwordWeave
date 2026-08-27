/**
 * operator-symbol.tsx — Phase 8.L round 121 (Mashu 2026-08-26).
 *
 * Shared operator (op) + value rendering. Single source of truth
 * for the color-coded operator and the cleaned-up value format.
 *
 * Visual contract (per Mashu R118):
 *   - Operator: large, bold, color-coded per operation type
 *   - Value:    smaller, gray, bare positive (no leading +),
 *               negatives in parens, zero as "0"
 *
 * Example rendering: `+5` `−3` `×2` `÷3` `↑5` `↓7`
 */

export const OP_LABEL: Record<string, string> = {
  add: "+",
  subtract: "−",
  set: "=",
  min: "↑",
  max: "↓",
  multiply: "×",
  divide: "÷",
  grant: "grant",
  revoke: "revoke",
};

export const OP_COLOR: Record<string, string> = {
  add: "text-emerald-600 dark:text-emerald-400",
  subtract: "text-red-600 dark:text-red-400",
  multiply: "text-violet-600 dark:text-violet-400",
  divide: "text-amber-600 dark:text-amber-400",
  set: "text-yellow-600 dark:text-yellow-400",
  min: "text-emerald-600 dark:text-emerald-400",
  max: "text-red-600 dark:text-red-400",
  grant: "text-sky-600 dark:text-sky-400",
  revoke: "text-slate-600 dark:text-slate-400",
};

/** Bare positive numbers (no leading +); negatives in parens. */
export function formatOperandValue(
  n: number | null | undefined,
): string {
  if (n === null || n === undefined) return "";
  if (n === 0) return "0";
  if (n < 0) return `(${n})`;
  return String(n);
}

/** `+5` style (kept for places that want the explicit sign). */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n >= 0 ? `+${n}` : `${n}`;
}
