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
 * Phase 8.2 batch 11: per Mashu 2026-07-23 "we already have
 * somewhere what operations have mirrors and what is the mirror
 * of which operation... something about modifiers in primitives
 * whatever". Per Phase 7.5 modifier-rebuild spec
 * (docs/phase-7/phase-7.5-modifier-rebuild-spec.md), mirror is
 * per-OPERATION on a modifier: Add↔Subtract sign-flip,
 * Multiply↔Divide reciprocal, Min↔Max, Grant↔Revoke. Mirror
 * toggles swap the op to its chiral pair via applyMirror() in
 * src/types/modifier.ts.
 *
 * For the v1 sheet roll-up using buCost as a proxy (hardModifiers
 * not yet wired), we model the buCost contribution as an implicit
 * Add op: mirroring flips the sign. This matches
 * OP_SPECS.add.mirrorOp = "subtract" + mirrorFlipsSign=true — same
 * rule the form's Mirror toggle uses in /sandbox/primitive-form.tsx.
 *
 * Mashu 2026-07-23 example: "if I mirrored a primitive that gives
 * +10 vitality, the sheet applied +10 instead of treating the
 * mirror as its own operation". With the implicit-Add model,
 * +10 vitality mirrored → -10 (Subtract). Max = base - 10.
 *
 * The older mirror.ts (with mirror_vector column) was the
 * Phase 7-Q-M design and is now superseded; it remains in the
 * codebase for legacy callers / historical tests but is not
 * used by the sheet roll-up.
 */
export function computeVitalityModifiersFromPrimitives(
  primitives: ReadonlyArray<{
    readonly buCost: number;
    readonly category: string;
    readonly name: string;
    /** True if this primitive slot is mirrored at the character level. */
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
      // Implicit Add op: mirror flips sign (Subtract).
      const amount = p.isMirrored === true ? -base : base;
      return {
        source: p.name,
        amount,
      };
    });
}