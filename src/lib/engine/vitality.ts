/**
 * Vitality engine — Phase 4.
 *
 * Per Notion: Vitality = (10 + PB) × Level + BU modifiers + cap modifiers.
 */

import { proficiencyBonus } from "./practices";
import { resolveMirrorEffect } from "./mirror";

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
 * Phase 8.2 batch 10: per Mashu 2026-07-23 "we already have
 * somewhere what operations have mirrors and what is the mirror
 * of which operation... something about modifiers in primitives
 * whatever". That source of truth is mirror.ts (the canonical
 * Mirror-Vector Architecture), which defines 4 vectors:
 *
 *   - STANDARD_ONLY     — pass-through. Mirror = no change.
 *   - VARIABLE_VECTOR   — sign-flip numeric. +10 mirror = -10.
 *   - STRUCTURAL_FAULT  — defensive → vulnerability (same
 *                         magnitude, opposite polarity for
 *                         resistance/damage buckets).
 *   - COST_INSTABILITY  — target unchanged, user pays extra
 *                         (e.g. +1 Strain / cast, 2× vitality).
 *
 * For vitality roll-ups we map these as:
 *   - STANDARD_ONLY     → mirror = no change
 *   - VARIABLE_VECTOR   → mirror = sign-flip (-buCost)
 *   - STRUCTURAL_FAULT  → mirror = sign-flip (resistance becomes
 *                         vulnerability; same magnitude)
 *   - COST_INSTABILITY  → mirror = no change for stat roll-up
 *                         (the cost lands elsewhere — we don't
 *                         try to model Strain in vitality_max)
 */
export function computeVitalityModifiersFromPrimitives(
  primitives: ReadonlyArray<{
    readonly buCost: number;
    readonly category: string;
    readonly name: string;
    /** Phase 8.2 batch 10: see doc above. Optional for back-compat. */
    readonly isMirrored?: boolean;
    /** Phase 8.2 batch 10: mirror vector per mirror.ts. Optional. */
    readonly mirrorVector?: string;
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
      // Phase 8.2 batch 10: route through the canonical resolver
      // so each mirror vector is handled correctly. Resolver
      // returns targetValue which for STANDARD_ONLY =
      // base; for VARIABLE_VECTOR / STRUCTURAL_FAULT =
      // -base; for COST_INSTABILITY = base (the cost lands on
      // the user, not the stat). That replaces the previous
      // blanket sign-flip which was wrong for STANDARD_ONLY
      // (mirror would have incorrectly subtracted).
      const resolved = resolveMirrorEffect(
        p.mirrorVector ?? "STANDARD_ONLY",
        p.isMirrored === true,
        base,
      );
      return {
        source: p.name,
        amount: resolved.targetValue,
      };
    });
}