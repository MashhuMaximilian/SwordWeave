/**
 * mirror.ts — Phase-7-Q-M runtime mirror resolution.
 *
 * The Mirror-Vector Architecture (canonical, BU Market page §'Mirror-Vector
 * Architecture' + 'Atomic Vector Toggle'): a primitive flagged
 * `isMirrorable=true` may be acquired by a character slot in *mirrored*
 * form. Mirroring inverts the modifier's effect at use time. The
 * primitive carries the canonical mirror vector (auto-derived from the
 * row's taxonomy; never edited in the form). The modifier carries an
 * optional opt-out flag (`modifier.metadata.mirror?.optedOut`) and an
 * optional author `exposureNotes` string for player-facing flavor.
 *
 * Each primitive houses AT MOST ONE modifier (atomic-payload rule,
 * enforced by DB CHECK constraint migration 0033). The slot's
 * `is_mirrored` flag is the player's runtime decision; the modifier
 * remains unaltered in DB — the slot's *use* of the modifier is what
 * gets mirrored.
 *
 * Vector semantics:
 *
 * | Vector             | Canonical meaning                                          |
 * |--------------------|------------------------------------------------------------|
 * | STANDARD_ONLY      | Pass-through. The modifier's effect is unchanged by        |
 * |                    | mirror; the slot just acquires the standard polarity.     |
 * | VARIABLE_VECTOR    | Sign flip. A "+5 Max HP" mirrored becomes "-5 Max HP" —   |
 * |                    | applied as a -5 HP modifier on the target's ledger.       |
 * |                    | Numerical primitives (Practice, Attribute, attack bonus, |
 * |                    | DC modifiers, Reaction Clash numbers, Stride Extension,   |
 * |                    | Vitality Core Augments, timing-window counters like     |
 * |                    | Reaction Slot) and canonical Strain buffers use this.    |
 * | STRUCTURAL_FAULT   | Mirroring exposes a vulnerability twin. The standard      |
 * |                    | row grants a defensive modifier (resistance or shield);   |
 * |                    | the mirror makes that defensive protection "load-bearing|
 * |                    | weakness" instead — same magnitude, opposite polarity.   |
 * |                    | Concrete canonical example: Damage Resistance rows.      |
 * |                    | Standard: "target takes 0.5× damage from this type."     |
 * |                    | Mirror: "target takes 2× damage from this type."         |
 * | COST_INSTABILITY   | Mirroring a Strain/cost buffer installs the *unstable*    |
 * |                    | form: the modifier card value still goes onto the        |
 * |                    | target's ledger (e.g., -X defense), but the user of the   |
 * |                    | mirror gets a runtime penalty (+1 Strain per cast, etc.).|
 * |                    | Canonical: Heuristic Buffer mirror, Vitality Shielding  |
 * |                    | mirror (the latter is the canonical "double vitality    |
 * |                    | cost" example).                                          |
 *
 * The damage-multiplier rule (Resistance/Vulnerability) is NOT a
 * generic "1×→2× flip on every primitive." It is SPECIFIC to the
 * defensive-resistance rows: their standard form is *0.5, mirror
 * form is *2. Other primitives do not produce multiplier modifiers.
 *
 * Times when the engine will read the mirror:
 *
 *   1. BU balance: at the effect / capability level, mirror does NOT
 *      change the slot's BU cost (canonical: "if I use normal or
 *      mirror it completely changes the effect of the effect of
 *      capability. If I have 3 primitives and play around with their
 *      mirroring they become completely different."). At the
 *      character-creation / template level, a mirrored slot adds
 *      buCost to the player's available budget (canonical debt model
 *      — "I take a mirrored primitive that costs 4BU. I now have
 *      29 total BU to spend (25+4)."). See bu-debt.ts for the
 *      budget-expansion math.
 *
 *   2. Stat resolution: when a modifier from a mirrored slot is
 *      applied to a target, the resolver calls resolveMirrorEffect
 *      to invert per the vector.
 *
 *   3. Damage application: STRUCTURAL_FAULT Resistance mirrors
 *      produce Vulnerability modifiers and the canonical
 *      resolveResistanceMultiplier rule applies.
 *
 *   4. Cost-Instability mirrors: the modifier still applies to the
 *      TARGET (e.g., the enemy sees -X defense), but the user
 *      (the mirrored-via slot owner) gets a runtime penalty instead
 *      of a bonus.
 */

import type { HardModifier, JsonValue } from "@/types/swordweave";

/** Mirror vector taxonomy, mirrored from the DB enum. */
export type MirrorVector =
  | "STANDARD_ONLY"
  | "VARIABLE_VECTOR"
  | "STRUCTURAL_FAULT"
  | "COST_INSTABILITY";

export interface MirrorResolution {
  /**
   * The polarity the modifier takes on the *target* when the slot is
   * mirrored.
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

  /**
   * Resolved vector. Lets the caller render the mirror preview
   * (which of the four vectors was applied).
   */
  readonly vector: MirrorVector;
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
export function isUserCostVector(
  vector: string,
): vector is "COST_INSTABILITY" {
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
 * Mirror metadata stored on a modifier's `metadata.mirror` field.
 * Optional. Authors may set this to opt the modifier OUT of its
 * primitive's default mirror behavior, or to attach free-text notes.
 */
export interface ModifierMirrorMeta {
  /**
   * If true, this modifier explicitly declines mirror inheritance
   * from its primitive. Useful for the rare case where a primitive
   * is canonically mirrorable but one specific modifier payload
   * shouldn't flip (see canonical opt-out rules in BU Market page).
   */
  readonly optedOut?: boolean;
  /**
   * Free-text player-facing flavor describing what the mirror
   * variant of this modifier does. Shown in the primitive preview
   * alongside the auto-rendered baseline.
   */
  readonly exposureNotes?: string;
}

/**
 * Helper to read the mirror metadata off a modifier's metadata field.
 * Returns null when the modifier has no mirror metadata.
 */
export function readMirrorMeta(
  modifier: HardModifier,
): ModifierMirrorMeta | null {
  const md = modifier.metadata;
  if (!md || typeof md !== "object") return null;
  const raw = (md as Record<string, JsonValue>)["mirror"];
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, JsonValue>;
  const result: ModifierMirrorMeta = {};
  if (typeof obj["optedOut"] === "boolean") {
    (result as { optedOut?: boolean }).optedOut = obj["optedOut"];
  }
  if (typeof obj["exposureNotes"] === "string") {
    (result as { exposureNotes?: string }).exposureNotes = obj["exposureNotes"];
  }
  return result;
}

/**
 * Resolve the runtime effect of a modifier under a mirror vector.
 *
 * Inputs:
 *   - `vector`: the modifier's resolved mirror vector. The vector is
 *      derived by the canonical taxonomy (BU Market page §'Atomic
 *      Vector Toggle') — the form doesn't expose it. Callers should
 *      pass the vector stored on the primitive row, or
 *      "STANDARD_ONLY" if the modifier opted out.
 *   - `isMirrored`: true if this modifier card came from a character
 *      slot acquired as `is_mirrored=true`.
 *   - `modifierValue`: the modifier card's stored `value` (a number,
 *      dice expression string, or boolean).
 *
 * Output: MirrorResolution describing what the modifier becomes on
 * the *target* and what (if anything) lands as user-side cost.
 */
export function resolveMirrorEffect(
  vector: string,
  isMirrored: boolean,
  modifierValue: unknown,
): MirrorResolution {
  const resolvedVector: MirrorVector = (
    ["STANDARD_ONLY", "VARIABLE_VECTOR", "STRUCTURAL_FAULT", "COST_INSTABILITY"] as const
  ).includes(vector as MirrorVector)
    ? (vector as MirrorVector)
    : "STANDARD_ONLY";

  // Standard (non-mirrored) modifiers — pass-through. The modifier
  // acts exactly as stored. No inversion, no user-cost.
  if (!isMirrored) {
    const targetValue = numericValue(modifierValue) ?? 0;
    return { targetValue, userCost: null, vector: resolvedVector };
  }

  switch (resolvedVector) {
    case "VARIABLE_VECTOR": {
      const v = numericValue(modifierValue) ?? 0;
      // Sign flip. A +5 Max HP modifier mirrored becomes -5, applied
      // to the target's Max HP. A -2 penalty mirrored becomes +2.
      return { targetValue: -v, userCost: null, vector: resolvedVector };
    }

    case "STRUCTURAL_FAULT": {
      const v = numericValue(modifierValue) ?? 0;
      // Defensive mirror: a +X damage resistance mirrored becomes
      // a -X damage resistance (= +X vulnerability). The engine
      // takes the magnitude and the resolveDamage resolver decides
      // which side to apply it on based on the vulnerability vs
      // resistance bucket. Magnitude preserved so the label can
      // flip.
      return { targetValue: v, userCost: null, vector: resolvedVector };
    }

    case "COST_INSTABILITY": {
      const v = numericValue(modifierValue) ?? 0;
      // Canonical: "Heuristic Buffer mirror forces +1 Strain per
      // cast", "Vitality Shielding mirror forces 2× vitality cost".
      // The modifier card value stays a numeric (preserved) but the
      // user pays extra. The magnitude is the original numeric,
      // reused as the cost basis.
      return {
        targetValue: v,
        userCost: { kind: "extra_strain", magnitude: v },
        vector: resolvedVector,
      };
    }

    case "STANDARD_ONLY":
    default: {
      const v = numericValue(modifierValue) ?? 0;
      return { targetValue: v, userCost: null, vector: resolvedVector };
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
 * This is SPECIFIC to STRUCTURAL_FAULT defensive primitives. Other
 * primitives do not produce damage multipliers.
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
export function isMirroredSlot(slot: {
  readonly is_mirrored?: boolean;
}): boolean {
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
 *   result.vector          — resolved mirror vector
 *
 * Behavior:
 *   - If `slot.is_mirrored=false` → pass-through with the modifier's
 *     stored value, vector returned unchanged.
 *   - If `slot.is_mirrored=true` and the modifier has
 *     `metadata.mirror.optedOut=true` → pass-through even though the
 *     slot is mirrored. The author explicitly opted out of mirror
 *     inheritance for this modifier.
 *   - Otherwise: resolve per vector.
 */
export function resolveEffectiveModifierValue(
  primitive: {
    /** Canonical mirror vector derived from the primitive's row. */
    readonly mirror_vector: string | null;
  },
  slot: { readonly is_mirrored?: boolean },
  modifier: HardModifier,
): MirrorResolution {
  const vector = primitive.mirror_vector ?? "STANDARD_ONLY";
  const mirrored = isMirroredSlot(slot);

  // If the modifier opts out, the slot's mirror state is ignored.
  const meta = readMirrorMeta(modifier);
  const optedOut = meta?.optedOut === true;

  if (optedOut) {
    const v = numericValue(modifier.value) ?? 0;
    const resolvedVector: MirrorVector = (
      ["STANDARD_ONLY", "VARIABLE_VECTOR", "STRUCTURAL_FAULT", "COST_INSTABILITY"] as const
    ).includes(vector as MirrorVector)
      ? (vector as MirrorVector)
      : "STANDARD_ONLY";
    return { targetValue: v, userCost: null, vector: resolvedVector };
  }

  return resolveMirrorEffect(vector, mirrored, modifier.value);
}
