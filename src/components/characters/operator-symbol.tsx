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

/** Convert resolver/storage identifiers into the language used on the sheet. */
export function humanizeMechanicalTarget(target: string): string {
  const normalized = target.trim().toLowerCase();
  const practice = normalized.match(/^skill_practice_check[.:]([a-z_]+)$/);
  if (practice) return `${toWords(practice[1] ?? "")} practice`;
  const attribute = normalized.match(/^attribute[.:]([a-z_]+)$/);
  if (attribute) return `${toWords(attribute[1] ?? "")} attribute`;
  const behavior = normalized.match(/^behavior[.:]([a-z_ ]+)$/);
  if (behavior) return `${toWords(behavior[1] ?? "")} behavior`;
  const labels: Record<string, string> = {
    skill_practice_check: "practice checks",
    action_roll: "action rolls",
    attack_roll: "attack rolls",
    attack_bonus: "attack bonus",
    save_dc: "save DC",
    proficiency_bonus: "proficiency bonus",
    max_vitality: "maximum Vitality",
  };
  return labels[normalized] ?? toWords(normalized);
}

function toWords(value: string): string {
  return value
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function operationVerb(operation: string): string {
  return ({
    add: "Adds",
    subtract: "Subtracts",
    set: "Sets",
    min: "Minimum",
    max: "Maximum",
    multiply: "Multiplies",
    divide: "Divides",
    grant: "Grants",
    revoke: "Revokes",
  } as Record<string, string>)[operation] ?? toWords(operation);
}

export function operationValue(
  operation: string,
  numericValue: number,
  keyword?: string | null,
): string {
  if (keyword) return toWords(keyword);
  if (operation === "add") return numericValue >= 0 ? `+${numericValue}` : String(numericValue);
  if (operation === "subtract") return String(Math.abs(numericValue));
  return String(numericValue);
}
