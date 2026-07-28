/**
 * target-registry.ts — Phase 8.3f S2 (Mashu 2026-07-28)
 *
 * Canonical target registry. The single source of truth for what
 * `ModifierTarget` strings the engine recognizes, and the single
 * place that knows the canonical formulas for:
 *
 *   - Attribute modifier (d20 modifier for attacks/checks)
 *   - Save value       (d20 modifier when making a save)
 *   - Save DC          (threshold enemies must meet against you)
 *
 * If Phase 9 changes the save DC formula (e.g., 8 + PB instead of
 * 5 + PB), it's one file. Per Mashu 2026-07-28:
 *
 *   "Each character has a save DC = 5 + modifier of attribute
 *    you are proficient in (PB included) + primitives."
 *
 *   "save is a modifier + attribute + PB of proficient + from
 *    primitives modifiers."
 *
 *   "PB only added to saves for the attribute the character is
 *    proficient in. Save DC always uses PB (PB is global per
 *    character)."
 *
 * Targets are mirrored from `src/types/swordweave.ts` ModifierTarget
 * union. Kept here so the engine layer can import a typed map
 * without circular-importing the schema module.
 */

import type { HardModifier } from "@/types/swordweave";
import {
  type ResolvedCharacterInput,
  type ModifierContribution,
  resolveModifiers,
} from "./resolve-modifiers";

// =============================================================================
// Target constants
// =============================================================================

export const ATTR_TARGETS = {
  physical: "character.attribute.physical",
  mental: "character.attribute.mental",
  magical: "character.attribute.magical",
} as const;

export const SAVE_TARGETS = {
  physical: "character.defense.physicalDc",
  mental: "character.defense.mentalDc",
  magical: "character.defense.magicalDc",
} as const;

export const VITALITY_TARGETS = {
  max: "character.maxVitality",
  current: "character.currentVitality",
} as const;

export type Attribute = "physical" | "mental" | "magical";

// =============================================================================
// Per-attribute helpers
// =============================================================================

/**
 * Resolve the **attribute modifier** for a given attribute.
 *
 *   modifier = slice + primitive contributions
 *
 * IMPORTANT (Phase 8.3g, Mashu 2026-07-28): the DB stores attributes
 * as **slices** in [-1, +5] (schema check constraint:
 *   "characters_attr_sum_check": sum = 10, each ∈ [-1, 5])
 * The slice IS the modifier — no D&D-style `(attr-10)/2` transform.
 * Earlier code incorrectly applied the D&D formula to slice values,
 * which gave `PHYS=5 → -3` (wrong) instead of `PHYS=5 → 5` (correct
 * base, with primitive contributions added on top).
 *
 * "Primitive contributions" = sum of all HardModifier contributions
 * targeting `ATTR_TARGETS[attr]`, AFTER mirror flips and stacking.
 *
 * Returns the final integer (positive for high stats, negative for low).
 * `contributions` are the per-primitive attribution rows from the resolver
 * (empty if no primitive targets this attribute).
 */
export function resolveAttributeModifier(
  input: ResolvedCharacterInput,
  attr: Attribute,
): { total: number; contributions: readonly ModifierContribution[] } {
  // Phase 8.3g: slices are the base modifier directly. No division.
  const base = input.attributes[attr];
  const r = resolveModifiers(input);
  const primitives = r.totals[ATTR_TARGETS[attr]] ?? 0;
  const contributions = r.byTarget[ATTR_TARGETS[attr]] ?? [];
  return { total: base + primitives, contributions };
}

/**
 * Resolve the **save value** (the d20 modifier the character adds
 * when making a save against this attribute).
 *
 *   save = attribute modifier + (PB if proficient) + primitive contributions
 *
 * "Primitive contributions" target `SAVE_TARGETS[attr]`. Per Mashu:
 * PB is ONLY added for the attribute the character is proficient in
 * (or for no attribute if `proficientAttribute === null`).
 */
export function resolveSaveValue(
  input: ResolvedCharacterInput,
  attr: Attribute,
): { total: number; contributions: readonly ModifierContribution[] } {
  const mod = resolveAttributeModifier(input, attr);
  const r = resolveModifiers(input);
  const primitiveDelta = r.totals[SAVE_TARGETS[attr]] ?? 0;
  const primitiveContribs = r.byTarget[SAVE_TARGETS[attr]] ?? [];
  const pb = input.proficientAttribute === attr ? input.pb : 0;
  return {
    total: mod.total + pb + primitiveDelta,
    // Combine attr-mod contributions + save-target contributions so the
    // modal can show "why is this save value what it is".
    contributions: [
      ...mod.contributions.map((c) => ({
        ...c,
        provenance: { ...c.provenance, kind: c.provenance.kind },
      })),
      ...primitiveContribs,
    ],
  };
}

/**
 * Resolve the **save DC** (the threshold enemies must meet when
 * forcing a save on the character).
 *
 *   dc = 5 + PB + attribute modifier + primitive contributions
 *
 * Per Mashu: PB is always included (PB is global per character,
 * not proficiency-gated). The "5" is the canonical baseline.
 * Primitive contributions target `SAVE_TARGETS[attr]`.
 */
export function resolveSaveDc(
  input: ResolvedCharacterInput,
  attr: Attribute,
): { total: number; contributions: readonly ModifierContribution[] } {
  const mod = resolveAttributeModifier(input, attr);
  const r = resolveModifiers(input);
  const primitiveDelta = r.totals[SAVE_TARGETS[attr]] ?? 0;
  const primitiveContribs = r.byTarget[SAVE_TARGETS[attr]] ?? [];
  return {
    total: 5 + input.pb + mod.total + primitiveDelta,
    contributions: [...mod.contributions, ...primitiveContribs],
  };
}

/**
 * Resolve the **primary save DC** (the single DC for the character,
 * derived from the proficient attribute).
 *
 *   dc = 5 + PB + (proficient attribute modifier) + primitive contributions
 *
 * IMPORTANT (Phase 8.3g, Mashu 2026-07-28): the character has ONE save
 * DC, not three. The DC is computed from the **proficient** attribute
 * (the one that adds PB to saves). If `proficientAttribute` is null,
 * falls back to physical.
 *
 * Primitive contributions are taken from `SAVE_TARGETS[proficientAttr]`
 * — primitives that target the specific attribute's defense.
 *
 * Used by the Vitality card and Quick bar to display the single DC
 * inline with the vitality number.
 */
export function resolvePrimarySaveDc(
  input: ResolvedCharacterInput,
): { total: number; contributions: readonly ModifierContribution[]; attr: Attribute } {
  const attr: Attribute = input.proficientAttribute ?? "physical";
  return {
    attr,
    ...resolveSaveDc(input, attr),
  };
}

/**
 * Resolve all three saves at once. Used by the Vitality card and
 * the Quick Practices bar. NOTE: the per-attribute DC values are
 * exposed for debugging, but the **primary** save DC (for the
 * character) is always `resolvePrimarySaveDc()`'s output.
 */
export function resolveAllSaves(
  input: ResolvedCharacterInput,
): Record<Attribute, { total: number; dc: number }> {
  const out = {} as Record<Attribute, { total: number; dc: number }>;
  for (const attr of ["physical", "mental", "magical"] as const) {
    out[attr] = {
      total: resolveSaveValue(input, attr).total,
      dc: resolveSaveDc(input, attr).total,
    };
  }
  return out;
}

/**
 * Resolve the **maximum vitality** (the upper bound on the vitality track).
 *
 *   max = (10 + PB) × level + primitive contributions
 *
 * Primitive contributions target `VITALITY_TARGETS.max`. Per the math
 * doc (`System Mathematics & Global Formulas`): the baseline is
 * `(10 + PB) × level`. Augments (e.g. "Vitality Core Augment") are
 * injected as flat additives via `hard_modifiers[].target =
 * "character.maxVitality"`.
 */
export function resolveMaxVitality(
  input: ResolvedCharacterInput,
): { total: number; contributions: readonly ModifierContribution[] } {
  const baseline = (10 + input.pb) * input.level;
  const r = resolveModifiers(input);
  const primitiveDelta = r.totals[VITALITY_TARGETS.max] ?? 0;
  const contributions = r.byTarget[VITALITY_TARGETS.max] ?? [];
  return { total: baseline + primitiveDelta, contributions };
}

// =============================================================================
// Best practice totals
// =============================================================================

/**
 * Best practice totals — used by the Quick Practices bar. Each
 * practice contributes its slice to the attribute's "best" total.
 *
 *   practiceTotal = Math.floor((attr - 10) / 2) + PB (if proficient)
 *                   + max(practice contribution across all 3 practices)
 *
 * Per Mashu 2026-07-28: practices are sliced per attribute. We
 * compute the best slice (highest) and add it to the modifier.
 *
 * NOTE: The actual practice slice values come from the DB (via
 * `src/lib/engine/practices.ts`). This function expects the caller
 * to pass them in via `practiceSlices`. If you don't have them
 * yet, pass zeros — the result is just `attributeModifier +
 * (PB if proficient)`.
 */
export function resolveBestPracticeTotal(
  input: ResolvedCharacterInput,
  attr: Attribute,
  practiceSlices: { physical: number; mental: number; magical: number },
): { total: number; contributions: readonly ModifierContribution[] } {
  const mod = resolveAttributeModifier(input, attr);
  const pb = input.proficientAttribute === attr ? input.pb : 0;
  const bestSlice = Math.max(practiceSlices[attr], 0);
  return {
    total: mod.total + pb + bestSlice,
    contributions: mod.contributions,
  };
}

// =============================================================================
// Helper: pick out the modifiers targeting a specific target
// =============================================================================

/**
 * Filter the resolver's attribution list to just those targeting
 * a specific `ModifierTarget`. Used by provenance modals that
 * want to show one target at a time.
 */
export function contributionsForTarget(
  input: ResolvedCharacterInput,
  target: string,
): readonly ModifierContribution[] {
  return resolveModifiers(input).byTarget[target] ?? [];
}

// Suppress unused import warning for HardModifier type (kept for
// future expansion — e.g., custom-stat targets added here).
export type { HardModifier };