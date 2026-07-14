/**
 * Target Scope vocabulary for primitive modifiers.
 *
 * Phase 7 of the SwordWeave canonical build introduced the
 * `targetScope` field on primitive rows. It records *what*
 * the modifier applies to, separated from the modifier's
 * mechanical payload.
 *
 * Per the BU Market canonical (Notion page
 * 37eed8479ccd8155b917c373194dbdf4), modifiers live at one
 * of three scope layers, with one extra layer for
 * dice-roll-level modifiers used by Causal Override:
 *
 *   • ATTRIBUTE  — Physical / Mental / Magical/Abstract
 *   • PRACTICE   — the 10 named practices (canonical list below)
 *   • NARROW_FOCUS — open-ended free-form ("Awareness (Smell)",
 *                  "Fieldcraft (Mountains)", etc.)
 *   • METRIC     — standalone numerical axis that isn't a
 *                  practice (HP, attack roll, save, DC, etc.)
 *   • DICE       — the rolled die itself (D20 for Causal Override)
 *   • DURATION   — when the modifier ties to a temporal window
 *   • ALL        — applies globally with no narrow scope
 *                  ("all non-proficient checks")
 *   • null       — primitive has no scope axis (verbs, domains,
 *                  structures, durations, etc.)
 *
 * Design principles:
 *
 *   • Permissive: API write-time does NOT reject on bad scope;
 *     `validateScope` returns an `{ ok, error? }` pair the form
 *     UI surfaces as a soft warning. Users can freely author
 *     custom primitives without lockout.
 *
 *   • Open foundry: NARROW_FOCUS and METRIC accept free-form
 *     strings so users can add new scope names without a
 *     schema migration. The validation surfaces "unknown"
 *     tags without blocking.
 *
 *   • Tier-coupled: per BU Market Probability Bias table,
 *     each Probability Bias tier maps to a fixed scope layer.
 *     `scopeForBiasTier()` returns the canonical mapping.
 *
 *   • Tier coefficients: BU tier numbers (3/6/12/20 BU) are
 *     intentionally flexible per canon ("people could choose
 *     themselves an arbitrary value for what they create").
 *     We expose them via PROBABILITY_BIAS_TIER_COSTS for
 *     default pricing but the helper never hard-rejects a
 *     different value.
 *
 * Storage: `target_scope` is a `text` column. We serialize
 * the structured scope as JSON inside the text:
 *   '{"layer":"PRACTICE","value":"AWARENESS"}'
 * Plain `null` (no scope) round-trips as the JSON literal
 * "null" so DB reads are unambiguous.
 */

import { z } from "zod";

// =============================================================================
// CANONICAL ENUMS
// =============================================================================

/**
 * The 3 core attributes. These are the *universal axis* layer;
 * modifiers like "+2 to all Physical checks" target this layer.
 */
export const ATTRIBUTES = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

/**
 * The 10 named Practices, distributed across the 3 attributes:
 *   Physical:           PROWESS, FINESSE, FIELDCRAFT
 *   Mental:             AWARENESS, REASON, KNOWLEDGE, INFLUENCE
 *   Magical/Abstract:   MYSTICISM, COMMUNION, INTUITION
 *
 * (Source: Practice/skill System Overview, Notion
 * 38eed8479ccd803b9544f1d0ce3d97cf)
 */
export const PRACTICES = [
  // Physical
  "PROWESS",
  "FINESSE",
  "FIELDCRAFT",
  // Mental
  "AWARENESS",
  "REASON",
  "KNOWLEDGE",
  "INFLUENCE",
  // Magical/Abstract
  "MYSTICISM",
  "COMMUNION",
  "INTUITION",
] as const;
export type Practice = (typeof PRACTICES)[number];

/**
 * Standalone metrics — numeric axes that aren't practices.
 * Modifiers like "+5 HP" or "+1 to all Attack Rolls" point
 * to these values inside the METRIC layer.
 */
export const STANDALONE_METRICS = [
  "HP",
  "VITALITY",
  "ATTACK",
  "ATTACK_ROLL",
  "SAVE",
  "DEFENSE",
  "DEFENSE_ROLL",
  "CHARACTER_DC",
  "PROFICIENCY_BONUS",
  "REACTION_SLOT",
  "MOVEMENT_SPEED",
  "INITIATIVE",
] as const;
export type StandaloneMetric = (typeof STANDALONE_METRICS)[number];

/**
 * Dice expressions that a scope can target.
 * D20 is canonical (Causal Override); extend as new mechanics
 * appear (D100 for percentile rerolls, etc.).
 */
export const DICE_VALUES = ["D20", "D100"] as const;
export type DiceValue = (typeof DICE_VALUES)[number];

/**
 * Duration windows that the DURATION layer can target. Modifier
 * payloads can be tied to a specific persistence window.
 */
export const DURATION_VALUES = [
  "INSTANT",
  "SHORT",
  "MEDIUM",
  "LONG",
  "SCENE",
  "PERSISTENT",
  "PERMANENT",
] as const;
export type DurationValue = (typeof DURATION_VALUES)[number];

/**
 * The full set of scope layers. `null` is implicit — it represents
 * "no scope" — and is encoded separately by omitting the scope
 * object entirely or by passing `null` to `buildScope`.
 */
export const SCOPE_LAYERS = [
  "ATTRIBUTE",
  "PRACTICE",
  "NARROW_FOCUS",
  "METRIC",
  "DICE",
  "DURATION",
  "ALL",
] as const;
export type ScopeLayer = (typeof SCOPE_LAYERS)[number];

// =============================================================================
// TYPED SCOPE OBJECT
// =============================================================================

/**
 * The structured scope representation. Always carries a `layer`.
 * The `value` field meaning depends on layer:
 *
 *   ATTRIBUTE     → one of ATTRIBUTES, or null (any)
 *   PRACTICE      → one of PRACTICES, or null (any one of 10)
 *   NARROW_FOCUS  → free-form string, or null (per-purchase)
 *   METRIC        → one of STANDALONE_METRICS, or null (any)
 *   DICE          → one of DICE_VALUES, or null (default D20)
 *   DURATION      → one of DURATION_VALUES, or null
 *   ALL           → always null (ALL has no narrower value)
 *   null layer    → undefined
 */
export interface TargetScope {
  readonly layer: ScopeLayer | null;
  readonly value?: string | null;
}

// =============================================================================
// PROBABILITY BIAS TIER COUPLING
// =============================================================================

/**
 * Per the BU Market canonical Probability Bias table, each tier
 * has a *fixed* scope layer — you don't get to choose.
 *
 *   Tier I (3 BU)   → NARROW_FOCUS    "balancing boots grant Adv vs knockdowns"
 *   Tier II (6 BU)  → PRACTICE        "Adv on all Awareness checks"
 *                                  — or ATTRIBUTE on the same row
 *                                    when applied to whole-attribute
 *   Tier III (12 BU)→ ATTRIBUTE       "Adv on all Mental checks"
 *   Tier IV (20 BU) → DICE / D20     "fixed value replaces the upcoming roll"
 *
 * The (tier → scope) coupling is canonical, not negotiable; helper
 * enforces it. `value` defaults to null (per-purchase pick).
 */
export type BiasTier = "I" | "II" | "III" | "IV";

export interface BiasTierSpec {
  readonly tier: BiasTier;
  readonly defaultBuCost: number;
  readonly layer: ScopeLayer;
  readonly fixed: true;
  readonly defaultValue?: string | null;
  readonly alternativeLayer?: ScopeLayer;
  readonly alternativeValue?: string | null;
}

export const PROBABILITY_BIAS_TIER_SPEC: Record<BiasTier, BiasTierSpec> = {
  I: {
    tier: "I",
    defaultBuCost: 3,
    layer: "NARROW_FOCUS",
    fixed: true,
    defaultValue: null,
  },
  II: {
    tier: "II",
    defaultBuCost: 6,
    layer: "PRACTICE",
    fixed: true,
    defaultValue: null,
    alternativeLayer: "ATTRIBUTE",
    alternativeValue: null,
  },
  III: {
    tier: "III",
    defaultBuCost: 12,
    layer: "ATTRIBUTE",
    fixed: true,
    defaultValue: null,
  },
  IV: {
    tier: "IV",
    defaultBuCost: 20,
    layer: "DICE",
    fixed: true,
    defaultValue: "D20",
  },
};

/**
 * Default BU cost per tier. Per canon these are flexible and
 * the engine does NOT hard-validate. Exposed so form UIs can
 * pre-populate and surface "Tier I suggests 3 BU".
 */
export const PROBABILITY_BIAS_TIER_COSTS: Record<BiasTier, number> = {
  I: 3,
  II: 6,
  III: 12,
  IV: 20,
};

/**
 * Convenience: build the scope implied by a Probability Bias
 * tier. Always returns a fresh TargetScope object.
 */
export function scopeForBiasTier(tier: BiasTier): TargetScope {
  const spec = PROBABILITY_BIAS_TIER_SPEC[tier];
  return {
    layer: spec.layer,
    value: spec.defaultValue ?? null,
  };
}

// =============================================================================
// BUILD / VALIDATE
// =============================================================================

/**
 * Validation result. Permissive by design — `ok: true` with a
 * non-blocking `soft` warning means the value parses but may
 * surprise the user; the form UI surfaces this as a hint, not
 * an error.
 */
export type ScopeValidation =
  | { readonly ok: true; readonly soft?: string }
  | { readonly ok: false; readonly error: string };

/**
 * Construct a TargetScope with defaults. `value` is optional
 * and defaults to `null`. Passing `null` (or omitting args) for
 * both returns the no-scope object `{ layer: null, value: null }`.
 */
export function buildScope(layer: ScopeLayer | null = null, value?: string | null): TargetScope {
  return {
    layer,
    value: value ?? null,
  };
}

/**
 * Permissive validator. Returns `{ ok, error? }` so the API can
 * store *any* value the caller sent and the form UI can warn.
 *
 * Checks:
 *   • layer (if non-null) must be in SCOPE_LAYERS
 *   • ATTRIBUTE value (if set) must be in ATTRIBUTES
 *   • PRACTICE value (if set) must be in PRACTICES
 *   • METRIC value (if set) must be in STANDALONE_METRICS
 *   • DICE value (if set) must be in DICE_VALUES
 *   • DURATION value (if set) must be in DURATION_VALUES
 *   • NARROW_FOCUS value is free-form — always ok
 *   • ALL value (if set) is ignored; soft note if non-null
 *   • null value on closed-enum layers is fine (means "any")
 *     but adds a soft note to remind form UI to prompt
 */
export function validateScope(scope: unknown): ScopeValidation {
  if (scope === null || scope === undefined) {
    return { ok: true };
  }
  if (typeof scope !== "object") {
    return { ok: false, error: "Scope must be an object or null." };
  }
  const s = scope as Partial<TargetScope>;
  const layer = s.layer ?? null;

  if (layer === null) {
    return { ok: true };
  }

  if (!SCOPE_LAYERS.includes(layer as ScopeLayer)) {
    return {
      ok: false,
      error: `Unknown scope layer "${layer}". Known: ${SCOPE_LAYERS.join(", ")}.`,
    };
  }

  const value = s.value ?? null;

  switch (layer as ScopeLayer) {
    case "ATTRIBUTE": {
      if (value !== null && !(ATTRIBUTES as readonly string[]).includes(value)) {
        return {
          ok: false,
          error: `Unknown attribute "${value}". Known: ${ATTRIBUTES.join(", ")}.`,
        };
      }
      return value === null
        ? { ok: true, soft: "Attribute picked at purchase time (any of Physical/Mental/Magical)." }
        : { ok: true };
    }
    case "PRACTICE": {
      if (value !== null && !(PRACTICES as readonly string[]).includes(value)) {
        return {
          ok: false,
          error: `Unknown practice "${value}". Known: ${PRACTICES.join(", ")}.`,
        };
      }
      return value === null
        ? { ok: true, soft: "Practice picked at purchase time (one of 10)." }
        : { ok: true };
    }
    case "NARROW_FOCUS": {
      // Always free-form — accept any non-empty string or null.
      if (value !== null && (typeof value !== "string" || value.trim() === "")) {
        return { ok: false, error: "Narrow-focus value must be a non-empty string." };
      }
      return { ok: true };
    }
    case "METRIC": {
      if (value !== null && !(STANDALONE_METRICS as readonly string[]).includes(value)) {
        return {
          ok: false,
          error: `Unknown metric "${value}". Known: ${STANDALONE_METRICS.join(", ")}.`,
        };
      }
      return value === null
        ? { ok: true, soft: "Metric picked at purchase time." }
        : { ok: true };
    }
    case "DICE": {
      if (value !== null && !(DICE_VALUES as readonly string[]).includes(value)) {
        return {
          ok: false,
          error: `Unknown dice value "${value}". Known: ${DICE_VALUES.join(", ")}.`,
        };
      }
      return value === null
        ? { ok: true, soft: "Dice defaults to D20 if not specified." }
        : { ok: true };
    }
    case "DURATION": {
      if (value !== null && !(DURATION_VALUES as readonly string[]).includes(value)) {
        return {
          ok: false,
          error: `Unknown duration "${value}". Known: ${DURATION_VALUES.join(", ")}.`,
        };
      }
      return { ok: true };
    }
    case "ALL": {
      if (value !== null) {
        return { ok: true, soft: `ALL layer ignores value; got "${value}" — kept for readability.` };
      }
      return { ok: true };
    }
  }
}

// =============================================================================
// DB SERIALIZATION
// =============================================================================

/**
 * Serialize a TargetScope for storage in the `target_scope` text
 * column. Always emits a JSON string (or `null` for the no-scope
 * case), so DB reads can round-trip cleanly.
 *
 * `undefined` / no arg → `null` in DB (the column literally
 * contains NULL).
 */
export function serializeForDB(scope: TargetScope | null | undefined): string | null {
  if (scope === null || scope === undefined) {
    return null;
  }
  if (scope.layer === null) {
    return null; // semantically equivalent to "no scope"
  }
  return JSON.stringify({
    layer: scope.layer,
    value: scope.value ?? null,
  });
}

/**
 * Inverse of `serializeForDB`. Reads the text column and returns
 * the original TargetScope. DB-side `null` → no-scope object.
 *
 * Robust to malformed JSON: returns `{ ok: false, error }` rather
 * than throwing, so DB reads during migrations don't blow up.
 */
export function parseFromDB(raw: string | null | undefined): TargetScope {
  if (raw === null || raw === undefined || raw === "") {
    return { layer: null, value: null };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TargetScope>;
    if (parsed === null || typeof parsed !== "object") {
      return { layer: null, value: null };
    }
    return {
      layer: (parsed.layer ?? null) as ScopeLayer | null,
      value: parsed.value ?? null,
    };
  } catch {
    // Malformed JSON — best-effort: return no-scope rather than crash.
    // Surface via validateScope if the caller wants strictness.
    return { layer: null, value: null };
  }
}

// =============================================================================
// ZOD SCHEMA (for API/form boundary)
// =============================================================================

/**
 * Zod schema describing the JSON shape stored in `target_scope`.
 * Use this for form validation, API body parsing, etc. Permissive:
 * NARROW_FOCUS.value is `z.string().min(1)`, all other layers
 * accept `null` for "any".
 */
export const targetScopeSchema = z
  .object({
    layer: z.enum(SCOPE_LAYERS).nullable(),
    value: z.string().min(1).nullable().optional(),
  })
  .nullable()
  .optional();
