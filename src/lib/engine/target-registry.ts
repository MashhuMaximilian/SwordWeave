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

// Phase 8.3g v2 (Mashu 2026-07-28): the resolver populates
// totals + byTarget with the CANONICAL SHORT axis name
// (`attribute`, `defense_dc`, `max_vitality`, etc.) — NOT
// the legacy dotted form. The DB stores `target: "max_vitality"`
// (snake), so the resolver's `target` field is the snake
// form. Earlier code used the legacy dotted form
// (`character.maxVitality`) which never matched real DB
// data — so all primitive contributions were silently
// dropped, and the modal showed no modifiers (Tessy had
// 2 mirrored VCA primitives targeting max_vitality that
// the resolver never picked up because the lookup used
// the wrong key).
export const ATTR_TARGETS = {
  physical: "attribute",
  mental: "attribute",
  magical: "attribute",
} as const;

export const SAVE_TARGETS = {
  physical: "defense_dc",
  mental: "defense_dc",
  magical: "defense_dc",
} as const;

export const VITALITY_TARGETS = {
  max: "max_vitality",
  current: "current_vitality",
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
  // Phase 8.3g v2: the resolver stores attribute contribs under
  // the SCOPED key (`attribute.physical`, `attribute.mental`,
  // `attribute.magical`) — the unmodified `attribute` is the
  // aggregate that includes all 3 axes. Use the scoped form.
  // Phase 8.L round 54: totals["attribute.X"] now includes the
  // base attribute (seeded). Use it directly without re-adding
  // the base so multiply/divide work correctly.
  const r = resolveModifiers(input);
  const scopedTarget = `${ATTR_TARGETS[attr]}.${attr}`;
  const total = r.totals[scopedTarget] ?? input.attributes[attr];
  const contributions = r.byTarget[scopedTarget] ?? [];
  return { total, contributions };
}

/**
 * Resolve the **save value** (the d20 modifier the character adds
 * when making a save against this attribute).
 *
 *   save = attribute modifier + (PB if proficient) + primitive contributions
 *
 * "Primitive contributions" target the SCOPED save axis
 * (`defense_dc.physical` / `defense_dc.mental` / `defense_dc.magical`).
 * Per Mashu: PB is ONLY added for the proficient attribute.
 */
export function resolveSaveValue(
  input: ResolvedCharacterInput,
  attr: Attribute,
): { total: number; contributions: readonly ModifierContribution[] } {
  // Phase 8.3g v2 (Mashu 2026-07-28): the save VALUE is
  // the d20 modifier the character adds when making a
  // save — NOT the DC. The formula is just:
  //   save = attribute modifier + (PB if proficient)
  // The `defense_dc.<attr>` primitives bump the DC, not
  // the character's own save roll. Earlier code
  // incorrectly added the DC primitives to the save
  // value, which inflated it.
  const mod = resolveAttributeModifier(input, attr);
  const pb = input.proficientAttribute === attr ? input.pb : 0;
  return {
    total: mod.total + pb,
    contributions: mod.contributions,
  };
}

/**
 * Resolve the **save DC** (the threshold enemies must meet when
 * forcing a save on the character).
 *
 *   dc = 5 + PB + attribute modifier + primitive contributions
 *
 * Primitive contributions target the SCOPED save axis
 * (`defense_dc.<attr>`).
 */
export function resolveSaveDc(
  input: ResolvedCharacterInput,
  attr: Attribute,
): { total: number; contributions: readonly ModifierContribution[] } {
  const mod = resolveAttributeModifier(input, attr);
  const r = resolveModifiers(input);
  const scopedTarget = `${SAVE_TARGETS[attr]}.${attr}`;
  const primitiveDelta = r.totals[scopedTarget] ?? 0;
  const primitiveContribs = r.byTarget[scopedTarget] ?? [];
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
): { total: number; contributions: readonly ModifierContribution[]; attr: Attribute; scopedTarget: string } {
  const attr: Attribute = input.proficientAttribute ?? "physical";
  // Phase 8.3g v2 (Mashu 2026-07-28): the SCOPED target
  // (`defense_dc.mental`) is what the resolver actually
  // populates byTarget with. Looking up `defense_dc`
  // (unscoped) returns nothing for characters that only
  // have the scoped form. The modal uses `scopedTarget`
  // to find the per-primitive attribution list.
  const scopedTarget = `${SAVE_TARGETS[attr]}.${attr}`;
  const r = resolveModifiers(input);
  const mod = resolveAttributeModifier(input, attr);
  const primitiveDelta = r.totals[scopedTarget] ?? 0;
  const primitiveContribs = r.byTarget[scopedTarget] ?? [];
  return {
    attr,
    scopedTarget,
    total: 5 + input.pb + mod.total + primitiveDelta,
    contributions: [...mod.contributions, ...primitiveContribs],
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
//
// Phase 8.3g v4 (Mashu 2026-07-28): REMOVED.
// `resolveBestPracticeTotal` was used to compute a "best practice" that
// included the highest slice across the 3 practices of an attribute.
// With the new model (each practice = full attribute + PB + primitives),
// that's redundant — every practice under the same attribute has the
// same base. The PracticeRow data is computed in
// `src/lib/engine/practices.ts` and surfaced directly in the sheet.

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