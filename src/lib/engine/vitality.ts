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
 *
 * Phase 8.2 batch 9: per Mashu 2026-07-23 "if I mirrored a primitive
 * that gives +10 vitality, the sheet applied +10 instead of treating
 * the mirror as its own operation". Mirror rule: a mirrored primitive
 * applies with the *inverted* operation of the base. For "add +10"
 * that means subtract 10 — the player pays BU debt for the slot but
 * gets the inverse benefit (high-stakes mirror = big tactical gamble).
 * So the formula is:
 *   base:    amount = buCost
 *   mirror:  amount = -buCost
 */
export function computeVitalityModifiersFromPrimitives(
  primitives: ReadonlyArray<{
    readonly buCost: number;
    readonly category: string;
    readonly name: string;
    /** Phase 8.2 batch 9: see doc above. Optional for back-compat. */
    readonly isMirrored?: boolean;
  }>,
): ReadonlyArray<VitalityModifier> {
  return primitives
    .filter(
      (p) =>
        p.name.toLowerCase().includes("vitality") ||
        p.name.toLowerCase().includes("hp") ||
        p.name.toLowerCase().includes("health") ||
        p.name.toLowerCase().includes("tough"),
    )
    .map((p) => {
      const base = p.buCost; // approximation: BU cost ≈ vitality bonus
      const amount = p.isMirrored === true ? -base : base;
      return {
        source: p.name,
        amount,
      };
    });
}