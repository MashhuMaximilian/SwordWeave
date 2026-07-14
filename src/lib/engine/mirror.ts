/**
 * mirror.ts — Phase-7-Q-M runtime mirror resolution.
 *
 * The Mirror-Vector Architecture (canonical, BU Market page §'Mirror-Vector
 * Architecture' + 'Atomic Vector Toggle'): a primitive flagged
 * `isMirrorable=true` may be acquired by a character slot in *mirrored*
 * form. Mirroring inverts the primitive's effect at character-build time
 * (player pays the standard BU, the mirrored polarity is added to the
 * character's ledger).
 *
 * There are four canonical mirror vectors, each dictating HOW to invert
 * the modifier on resolution. Stats / defense / sheet subsystems call
 * `resolveMirrorEffect(...)` with the primitive's vector and the modifier
 * card's value, and they get back the inverted value + a tag telling
 * them which mirror semantic was applied.
 *
 * Vector semantics:
 *
 * | Vector             | Canonical meaning                                          |
 * |--------------------|------------------------------------------------------------|
 * | STANDARD_ONLY      | Bookkeeping only. The mirrored side is conceptually the    |
 * |                    | "negative" of the same row; the engine does not invoke a   |
 * |                    | runtime flip. (Used when the player narrative-owns the     |
 * |                    | mirrored side of a row that has no numeric/structural    |
 * |                    | counterpart to invert.)                                   |
 * | VARIABLE_VECTOR    | Sign flip. A "+1 Physical Defense" mirrored becomes a     |
 * |                    | "-1 Physical Defense" — applied as a +1 vulnerability.    |
 * |                    | Numerical primitives (Practice, Attribute, attack bonus, |
 * |                    | DC modifiers, Reaction Clash numbers, Stride Extension,   |
 * |                    | Vitality Core Augments) and canonical Strain buffers      |
 * |                    | use this.                                                  |
 * | STRUCTURAL_FAULT   | The mirrored primitive produces the *vulnerability twin* |
 * |                    | of the row. Damage Resistance / Vulnerability (canonical  |
 * |                    | 'largest single modifier; resistance + vuln to same      |
 * |                    | damage cancel out' rule applies at the resolver). For    |
 * |                    | defensive primitives, mirror = expose. For positive     |
 * |                    | buffs, the engine applies the inverse.                   |
 * | COST_INSTABILITY   | Mirroring a Strain/cost buffer installs the *unstable*    |
 * |                    | form: payload same direction but the user's own engine   |
 * |                    | sees extra friction (e.g. Heuristic Buffer mirror = +1   |
 * |                    | Strain on every cast). The modifier card on a             |
 * |                    | mirrored Cost-Instability row stays a numeric delta on |
 * |                    | the *target* (the antagonist); the *user* of the mirror  |
 * |                    | gets the cost.                                            |
 *
 * Times when the engine will read the mirror:
 *
 *   1. BU-balance: `calculatePrimitiveBu(...)` (in bu.ts) already handles
 *      the acquire-time cost. Negative on mirror, positive on standard.
 *      This file doesn't re-implement that.
 *
 *   2. Stat resolution: when applying a modifier from a mirrored slot to
 *      a target, invert per the vector.
 *
 *   3. Damage application: STRUCTURAL_FAULT Resistance mirrors become
 *      Vulnerability (`vulnerability×2`) and *only the strongest single*
 *      modifier from {resistance, vulnerability} applies (canonical
 *      stacking rule).
 *
 *   4. Cost-Instability mirrors: the modifier still applies to the
 *      TARGET (e.g. the enemy sees -X defense), but the user (the
 *      mirrored-via slot owner) gets a runtime penalty instead of a
 *      bonus.
 */

import type { HardModifier } from "@/types/swordweave";

/** Mirror vector taxonomy, mirrored from the DB enum. */
export type MirrorVector =
  | "STANDARD_ONLY"
  | "VARIABLE_VECTOR"
  | "STRUCTURAL_FAULT"
  | "COST_INSTABILITY";

export interface MirrorResolution {
  /**
   * The polarity the modifier takes on the *target*. For the mirrored
   * side of a primitive, this is what the modifier card turns into
   * when applied during a character slot's runtime effect.
   *
   *   - VARIABLE_VECTOR  →  sign-flipped numeric
   *   - STRUCTURAL_FAULT →  structural-vulnerability form
   *   - COST_INSTABILITY →  unchanged on target (cost lands on user)
   *   - STANDARD_ONLY    →  unchanged on target
   */
  readonly targetValue: number;

  /**
   * What happens to the *user* (the character slot owner) at runtime.
   * Empty by default. Populated only for vectors that impose cost.
   */
  readonly userCost: MirrorUserCost | null;
}

export interface MirrorUserCost {
  readonly kind: "extra_strain" | "double_vitality_cost" | "lose_reaction";
  readonly magnitude: number;
}

/**
 * Quick fault-line: is a mirror vector the kind that puts cost on the
 * user (COST_INSTABILITY) vs the kind that produces an inverted
 * target-side effect (VARIABLE_VECTOR / STRUCTURAL_FAULT)?
 */
export function isUserCostVector(vector: string): vector is "COST_INSTABILITY" {
  return vector === "COST_INSTABILITY";
}

/**
 * Numeric coercion that accepts the modifier's JsonValue storage.
 */
function numericValue(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Resolve the runtime effect of a modifier under a mirror vector.
 *
 * Inputs:
 *   - `vector`: the primitive's `mirror_vector` field (canonical taxonomy)
 *   - `isMirrored`: true if this modifier card came from a character
 *      slot acquired as `is_mirrored=true`
 *   - `modifierValue`: the modifier card's stored `value` (a number,
 *      dice expression string, or boolean)
 *
 * Output: MirrorResolution describing what the modifier becomes on
 * the *target* and what (if anything) lands as user-side cost.
 */
export function resolveMirrorEffect(
  vector: string,
  isMirrored: boolean,
  modifierValue: unknown,
): MirrorResolution {
  // Standard (non-mirrored) modifiers — pass-through. The modifier
  // acts exactly as stored. No inversion, no user-cost.
  if (!isMirrored) {
    const targetValue = numericValue(modifierValue) ?? 0;
    return { targetValue, userCost: null };
  }

  switch (vector) {
    case "VARIABLE_VECTOR":
    case "VARIABLE": {
      const v = numericValue(modifierValue) ?? 0;
      // Sign flip. A +5 Max HP modifier mirrored becomes -5, applied
      // to the target's Max HP. A -2 penalty mirrored becomes +2.
      return { targetValue: -v, userCost: null };
    }

    case "STRUCTURAL_FAULT": {
      const v = numericValue(modifierValue) ?? 0;
      // Defensive mirror: a +X damage resistance mirrored becomes
      // -X damage resistance (= +X vulnerability). The engine will
      // store this as a vulnerability modifier on the target's
      // ledger. A -X penalty mirrored becomes +X (cancellation
      // upstream; downstream callers may want to discard).
      //
      // For STRUCTURAL_FAULT we keep the magnitude (absolute) so
      // the resolver can drop it on the target. We rely on the call
      // site to label it "vulnerability" vs "penalty".
      return { targetValue: v, userCost: null };
    }

    case "COST_INSTABILITY": {
      const v = numericValue(modifierValue) ?? 0;
      // Canonical: "Heuristic Buffer mirror forces +1 Strain per
      // cast", "Vitality Shielding mirror forces 2× vitality cost".
      // The modifier card value stays a numeric (preserved) but
      // the user pays extra. The magnitude is the original numeric,
      // reused as the cost basis.
      return {
        targetValue: v,
        userCost: { kind: "extra_strain", magnitude: v },
      };
    }

    case "STANDARD_ONLY":
    default: {
      // Bookkeeping only. Mirroring of STANDARD_ONLY rows just
      // exists conceptually; the modifier's target-side effect
      // passes through unchanged.
      const v = numericValue(modifierValue) ?? 0;
      return { targetValue: v, userCost: null };
    }
  }
}

/**
 * Canonical Resistance / Vulnerability interaction rule (Notion page
 * §'Canonical Resistance Stacking Rule'): only the strongest single
 * modifier applies across {resistance, vulnerability} sets targeting
 * the same damage instance, and Resistance + Vulnerability to the
 * same damage cancel to full damage.
 *
 * The damage resolver collects:
 *   - all resistance-modifier values (>0 means halving magnitude; from
 *     a non-mirrored RESIST primitive on the target's ledger);
 *   - all vulnerability-modifier values (>0 means doubling; from a
 *     mirrored RESIST primitive on the target's ledger, OR from a
 *     directly-written vuln primitive like 'Vulnerability: Fire').
 *
 * Then call this function:
 *
 *   - `strongestResistance > 0, strongestVulnerability > 0` → cancel
 *     (full damage). Returns 1.0.
 *   - `strongestResistance > strongestVulnerability` → halve damage.
 *     Returns 0.5.
 *   - `strongestVulnerability > strongestResistance` → double
 *     damage. Returns 2.0.
 *   - `strongestResistance > 0` only → halve. Returns 0.5.
 *   - `strongestVulnerability > 0` only → double. Returns 2.0.
 *   - otherwise → 1.0.
 */
export function resolveResistanceMultiplier(
  strongestResistance: number,
  strongestVulnerability: number,
): number {
  if (strongestResistance > 0 && strongestVulnerability > 0) {
    // Both fire on the same damage: cancel. (canonical stacking rule)
    return 1.0;
  }
  if (strongestResistance > 0) {
    return 0.5;
  }
  if (strongestVulnerability > 0) {
    return 2.0;
  }
  return 1.0;
}

/**
 * Helper: did this modifier come from a mirrored slot? True when the
 * character-acquisition state carries `is_mirrored=true`.
 *
 * Stats resolvers that want to apply the mirror semantics should call
 * resolveMirrorEffect(primitive.mirror_vector, slot.is_mirrored,
 * modifier.value) before summing the modifier into a stat.
 */
export function isMirroredSlot(slot: { readonly is_mirrored?: boolean }): boolean {
  return slot.is_mirrored === true;
}

/**
 * The header signature that stats.ts and damage.ts can import.
 * Re-exporting to keep the public surface small.
 */
export type { HardModifier };

/**
 * Convenience: combine mirror resolution with number coercion.
 *
 * Stats resolvers that take a `HardModifier` from a character slot
 * should call this instead of touching `mod.value` directly.
 *
 *   result.effectiveValue  — the numeric value to apply to the
 *                              target (already sign-flipped if the
 *                              mirror is VARIABLE_VECTOR)
 *   result.userCost        — populated only for COST_INSTABILITY mirrors
 */
export function resolveEffectiveModifierValue(
  primitive: { readonly mirror_vector: string | null },
  slot: { readonly is_mirrored?: boolean },
  modifierValue: unknown,
): MirrorResolution {
  const vector = primitive.mirror_vector ?? "STANDARD_ONLY";
  return resolveMirrorEffect(vector, isMirroredSlot(slot), modifierValue);
}
