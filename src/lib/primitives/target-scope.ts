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
 * Practice descriptions shown in the practice modal (Phase 8.L).
 * Sourced from the Practice/skill System Overview doc. Each entry
 * contains:
 *   - coreQuestion: the GM's "what is the central question" line
 *   - useWhen: short summary of when to apply
 *   - examples: 2-3 representative actions
 */
export const PRACTICE_DESCRIPTIONS: Record<Practice, {
  coreQuestion: string;
  short: string;
  description: string;
  mayInclude: readonly string[];
  examples: readonly string[];
  versus?: string;
}> = {
  PROWESS: {
    coreQuestion: "Can I generate or withstand enough physical force?",
    short: "Strength, athletic performance, endurance, bodily force, and physical resistance.",
    description: "Prowess represents strength, athletic performance, endurance, bodily force, and physical resistance. Use Prowess when the central question is whether the character can generate or withstand enough physical force.",
    mayInclude: ["Lifting, pushing, pulling, or breaking", "Climbing through strength or endurance", "Swimming against dangerous currents", "Running and jumping", "Grappling or restraining", "Resisting forced movement", "Enduring pain, exhaustion, deprivation, or severe weather", "Sustaining prolonged physical exertion"],
    examples: ["Holding a collapsing gate open", "Wrestling an enemy away from a lever", "Swimming through a flooded tunnel", "Breaking down a reinforced door", "Continuing to march after extreme exhaustion"],
  },
  FINESSE: {
    coreQuestion: "Can I execute this precisely or discreetly?",
    short: "Precision, coordination, balance, controlled movement, subtlety, and delicate physical execution.",
    description: "Finesse represents precision, coordination, balance, controlled movement, subtlety, and delicate physical execution. Use Finesse when the central question is whether the character can control their body precisely enough. Finesse describes controlled physical execution. It does not automatically provide knowledge of the environment or explain how a mechanism works.",
    mayInclude: ["Acrobatics and balance", "Stealth and silent movement", "Sleight of hand", "Lock manipulation", "Escaping restraints", "Delicate manual work", "Navigating unstable or narrow surfaces", "Precise bodily timing", "Concealing a physical action"],
    examples: ["Crossing a narrow beam", "Taking a key without being noticed", "Moving silently across broken glass", "Picking a mechanical lock", "Catching a fragile object before it falls", "Slipping free from tightly bound rope"],
  },
  FIELDCRAFT: {
    coreQuestion: "Can I operate effectively in this environment?",
    short: "Practical experience with terrain, wilderness, travel, tracking, weather, and survival.",
    description: "Fieldcraft represents practical experience with terrain, wilderness, travel, tracking, weather, and survival. Use Fieldcraft when the central question is whether the character knows how to operate effectively in this environment. Fieldcraft is practical and experiential. It does not cover academic ecological knowledge, supernatural communication with nature, or magical manipulation of terrain.",
    mayInclude: ["Tracking creatures or people", "Concealing or identifying trails", "Navigation", "Hunting and foraging", "Reading weather and terrain", "Selecting safe routes", "Establishing camps and shelters", "Preparing snares or practical wilderness tools", "Identifying environmental hazards through experience", "Managing prolonged journeys"],
    examples: ["Following tracks through a forest", "Finding a safe path across unstable ground", "Predicting an approaching storm", "Concealing the party's campsite", "Determining where an animal is likely to find water", "Establishing shelter before nightfall"],
  },
  AWARENESS: {
    coreQuestion: "What do I notice?",
    short: "Attention to immediate, observable reality.",
    description: "Awareness represents attention to immediate, observable reality. Use Awareness when the central question is what the character notices. Awareness discovers information. It does not automatically explain what the information means.",
    mayInclude: ["Seeing, hearing, or smelling subtle details", "Detecting hidden creatures or objects", "Searching an area", "Recognizing immediate danger", "Maintaining vigilance", "Noticing physical inconsistencies", "Detecting changes in the environment", "Observing visible behavior"],
    examples: ["Hearing movement behind a door", "Spotting disturbed dust near a floor tile", "Noticing someone reaching for a concealed weapon", "Finding a hidden compartment", "Detecting an approaching ambush", "Smelling smoke before seeing the fire"],
  },
  REASON: {
    coreQuestion: "What can I determine from the available information?",
    short: "Deduction, interpretation of evidence, technical analysis, diagnosis, and intellectual problem-solving.",
    description: "Reason represents deduction, interpretation of evidence, technical analysis, diagnosis, and intellectual problem-solving. Use Reason when the central question is what conclusion the character can derive from the available information. Reason does not create plans for the player. Players decide what their characters attempt. A Reason check may provide relevant information, identify constraints, or reveal likely consequences, but it does not tell the player the optimal action. Do not roll Reason to answer 'What should we do?' — roll Reason to answer 'What can my character determine before we decide what to do?'",
    mayInclude: ["Investigation and deduction", "Deciphering codes", "Reconstructing past events", "Diagnosing injuries or unfamiliar illnesses", "Understanding mechanisms", "Comparing contradictory accounts", "Identifying structural weaknesses", "Interpreting complex written arguments", "Solving character-facing intellectual problems"],
    examples: ["Reconstructing how a murder occurred", "Determining how a machine operates", "Breaking a written cipher", "Diagnosing an unfamiliar poison", "Finding the contradiction between two testimonies", "Determining why a damaged bridge is unstable"],
  },
  KNOWLEDGE: {
    coreQuestion: "What does my character already know?",
    short: "Education, memory, study, research, and accumulated factual familiarity.",
    description: "Knowledge represents education, memory, study, research, and accumulated factual familiarity. Use Knowledge when the central question is whether the character already knows something relevant. Knowledge retrieves existing information.",
    mayInclude: ["History", "Geography", "Cultures and institutions", "Laws and customs", "Languages", "Anatomy and medical theory", "Academic subjects", "Engineering principles", "Recognizing symbols, people, locations, or historical events", "Familiarity with mundane professions and technologies"],
    examples: ["Recalling which dynasty constructed a fortress", "Recognizing the symptoms of a known disease", "Remembering a kingdom's burial customs", "Identifying the language used in a manuscript", "Knowing the legal authority of a noble title", "Recognizing the uniform of a historical military order"],
    versus: "Knowledge versus Reason: Knowledge recognizes a known poison; Reason diagnoses an unfamiliar poison from its effects. Knowledge identifies the language in a book; Reason deciphers the code hidden inside the text. Knowledge recalls who built the fortress; Reason determines why its wall is collapsing.",
  },
  INFLUENCE: {
    coreQuestion: "Can I shape another person's response?",
    short: "Deliberate control over communication, presentation, attention, trust, emotion, fear, and social response.",
    description: "Influence represents deliberate control over communication, presentation, attention, trust, emotion, fear, and social response. Use Influence when the central question is whether the character can cause another person or audience to respond as intended. Influence does not make every social method identical. The declared intent determines the fictional method and consequences. Persuasion may create genuine agreement. Deception creates a false belief and risks discovery. Intimidation creates compliance but may cause fear or resentment. Performance shapes attention or emotion. The Practice is shared. The narrative result is not.",
    mayInclude: ["Persuasion", "Deception", "Intimidation", "Performance", "Negotiation", "Leadership", "Reassurance", "Social misdirection", "Commanding attention", "Concealing emotional intent"],
    examples: ["Convincing a guard to allow passage", "Maintaining a false identity", "Frightening an enemy into surrender", "Inspiring frightened civilians", "Negotiating a trade agreement", "Distracting a crowd through performance", "Calming an angry official"],
  },
  MYSTICISM: {
    coreQuestion: "What supernatural structure is operating here?",
    short: "Understanding of magical systems, supernatural forces, metaphysical structures, and reality-altering phenomena.",
    description: "Mysticism represents understanding of magical systems, supernatural forces, metaphysical structures, and reality-altering phenomena. Use Mysticism when the central question is what supernatural structure or force is operating here. Mysticism allows a character to recognize or understand magic. It does not automatically allow the character to cast, dispel, or reproduce the effect.",
    mayInclude: ["Magical theory", "Arcane symbols", "Enchantments and curses", "Supernatural anomalies", "Ritual structures", "Magical items", "Domains and metaphysical forces", "Wards and portals", "Dimensional phenomena", "Reality distortions"],
    examples: ["Identifying the function of a magical ward", "Determining which Domain shaped an effect", "Understanding the structure of a ritual", "Recognizing that an item is cursed", "Investigating a spatial anomaly", "Interpreting an arcane diagram"],
  },
  COMMUNION: {
    coreQuestion: "How do I relate to this living, sacred, or spiritual presence?",
    short: "Relationship, attunement, and understanding involving living, ecological, spiritual, or sacred systems.",
    description: "Communion represents relationship, attunement, and understanding involving living, ecological, spiritual, or sacred systems. Use Communion when the central question is how the character understands or relates to this being, presence, tradition, or living system. These Practices do not grant magical effects. Actual supernatural actions are constructed through Domains, Verbs, Capabilities, items, or other sources of narrative permission.",
    mayInclude: ["Animal behavior", "Plants and ecosystems", "Spirits and ancestors", "Religious practice", "Sacred traditions", "Divine presences", "Rituals as lived spiritual acts", "Calming or understanding nonhuman creatures", "Recognizing ecological or spiritual imbalance", "Interpreting sacred customs"],
    examples: ["Calming a frightened animal", "Understanding the behavior of a supernatural beast", "Recognizing that a forest has become spiritually disturbed", "Interpreting the meaning of a funeral rite", "Identifying whether a shrine is still spiritually active", "Recognizing signs associated with a local spirit"],
    versus: "Communion versus Knowledge: Knowledge recalls when a temple was constructed. Communion understands what its ritual means to worshippers. Knowledge identifies an animal species. Communion understands why the animal is distressed. Knowledge knows the recorded doctrine of a faith. Communion recognizes whether a sacred presence is responding.",
  },
  INTUITION: {
    coreQuestion: "What hidden meaning or emotion lies beneath the surface?",
    short: "Sensitivity to emotion, motive, hidden meaning, resonance, omens, and patterns that are not fully visible or logically established.",
    description: "Intuition represents sensitivity to emotion, motive, hidden meaning, resonance, omens, and patterns that are not fully visible or logically established. Use Intuition when the central question is what lies beneath what is being shown. Intuition reveals impressions, emotional truths, or hidden pressures. It does not provide perfect factual certainty or automatic lie detection. A successful Intuition check may reveal 'His confidence feels forced. He is concealing fear.' It should not automatically reveal 'He murdered the duke at midnight using a poisoned knife.'",
    mayInclude: ["Reading emotional states", "Sensing concealed motives", "Recognizing dishonesty or unease", "Interpreting dreams and omens", "Feeling supernatural resonance", "Recognizing meaningful patterns", "Sensing that something is fundamentally wrong", "Empathic understanding"],
    examples: ["Sensing that someone's anger is performed", "Recognizing that a character is afraid for someone else", "Feeling that an apparently ordinary room is spiritually wrong", "Interpreting the emotional meaning of a dream", "Recognizing tension between two people", "Sensing that an offer carries hidden desperation"],
  },
};

/**
 * Standalone metrics — numeric axes that aren't practices.
 * Modifiers like "+5 HP" or "+1 to all Attack Rolls" point
 * to these values inside the METRIC layer.
 *
 * Note on Speed: the previous Phase-7-E/UX2a split Speed into
 * 5 distinct values (walking/climbing/swimming/flying/burrowing)
 * as separate METRIC entries. After user feedback, those values
 * live inside the Speed target's widget (radio, picked at the
 * form layer) instead. We keep `WALKING_SPEED` etc. here for
 * DB-value compatibility — they are radio option labels, not
 * independent metric dimensions.
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
  // Speed locus options — populated at the form layer via the
  // Speed radio widget, then stored as the target's value.
  "WALKING_SPEED",
  "CLIMBING_SPEED",
  "SWIMMING_SPEED",
  "FLYING_SPEED",
  "BURROWING_SPEED",
  // Legacy single-axis value — kept so old saves round-trip;
  // not offered in the radio.
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
