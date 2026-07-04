/**
 * Vitality engine — Phase 4.
 *
 * Per Notion: Vitality = (10 + PB) × Level + BU modifiers + cap modifiers.
 */

import { proficiencyBonus } from "./practices";

export interface VitalityModifier {
  readonly source: string;
  readonly amount: number;
}

/**
 * Compute max vitality for a character.
 *
 * @param level Character level (1-20)
 * @param modifiers Extra modifiers from primitives/items/etc
 */
export function computeMaxVitality(
  level: number,
  modifiers: ReadonlyArray<VitalityModifier> = [],
): number {
  const base = (10 + proficiencyBonus(level)) * level;
  const modTotal = modifiers.reduce((t, m) => t + m.amount, 0);
  return base + modTotal;
}

/**
 * Compute vitality bonus from a list of primitives (e.g. from race/bg/items).
 *
 * Each primitive has a hardModifiers array; filter for vitality-affecting ones.
 * This is a simplified version — full version uses modifiers.ts engine.
 */
export function computeVitalityModifiersFromPrimitives(
  primitives: ReadonlyArray<{
    readonly buCost: number;
    readonly category: string;
    readonly name: string;
  }>,
): ReadonlyArray<VitalityModifier> {
  // Heuristic: vitality-boosting primitives have "vitality" in name or category
  return primitives
    .filter(
      (p) =>
        p.name.toLowerCase().includes("vitality") ||
        p.name.toLowerCase().includes("hp") ||
        p.name.toLowerCase().includes("health") ||
        p.name.toLowerCase().includes("tough"),
    )
    .map((p) => ({
      source: p.name,
      amount: p.buCost, // approximation: BU cost ≈ vitality bonus
    }));
}