/**
 * Modifier-scope vocabulary for primitive modifiers.
 *
 * Phase 7-E rebuilds the "What changes?" dropdown so each modifier
 * carries an explicit Target Value (a multi-select / checklist) that
 * captures its scope axis. This file owns the data shape and the
 * render instructions that drive the form UI.
 *
 * Cooperates with `target-scope.ts`:
 *   - target-scope.ts: TargetScope { layer, value } per primitive row
 *   - modifier-scope.ts (this file): per-modifier-slot target + values
 *
 * A primitive with `target_scope = {layer, value}` declares *what
 * the primitive is for*. A modifier with
 * `metadata.targetScope = {layer, values[]}` declares *what specific
 * thing this instance modifies*. Same vocabulary; different lifecycle.
 */
import type { ScopeLayer, StandaloneMetric, Practice, Attribute, DurationValue, DiceValue } from "./target-scope";
import {
  ATTRIBUTES,
  PRACTICES,
  STANDALONE_METRICS,
  DURATION_VALUES,
  validateScope,
  DICE_VALUES,
} from "./target-scope";

// =============================================================================
// MODIFIER TARGET — the canonical-3-axis short labels for the form dropdown
// =============================================================================

/**
 * Every primitive row's "What changes?" dropdown is one of these values.
 * Compared to the legacy `ModifierTarget` (dotted strings like
 * "character.attribute.physical"), these are short axis labels —
 * the specific value is captured separately in `targetValue`.
 *
 * Phase-7-E/UX2a-r (revert): the previous attempt to give each
 * locomotion type its own dropdown entry was the wrong shape —
 * Speed is one axis with five locomotion values picked inside
 * via the radio widget. Five top-level entries would clutter
 * every Modifier card and force users to flip through axes to
 * find "Climbing Speed." Now Speed is one entry; locomotion
 * type is the radio choice.
 *
 * Phase-7-E/UX2b-r: action_shape_size renamed to "targeting".
 * "Shape + size" was accurate mechanically but felt like a
 * statistical term. "Targeting" reads as a player-facing verb.
 */
export const MODIFIER_TARGETS = [
  // Physical/Mental/Magical axis (consolidated)
  "attribute",
  // Physical/Mental/Magical defense DC axis (consolidated)
  "defense_dc",
  // Single Speed axis with five radio options inside (UX2a revert)
  "speed",
  // Single-axis metrics
  "max_vitality",
  "current_vitality",
  "proficiency_bonus",
  "action_roll",
  // Skill/practice (granularity split below)
  "skill_practice_check",
  // Damage/healing — dice layer
  "damage_healing_output",
  // Targeting — Shape + Size collapsed into one (UX2b)
  "targeting",
  // Duration
  "duration",
  "strain",
  "item_slot_cost",
  "scene_pace",
  // Phase 7.5: free-form behavior axis (escape hatch).
  // When this is selected, the form renders a text input for
  // the behavior name (e.g. "darkvision", "mana_pool").
  "behavior",
  // ===========================================================
  // Phase 8.I i2.7 (Mashu 2026-08-06) — new targets from the
  // Combat / Damage / Upkeep / Encumbrance canonical PDFs.
  // Each new target either carries a fixed enum (size,
  // source_type), a numeric axis (carry_capacity, complexity),
  // or an author-named `{key}` runtime ref (equip_slot,
  // damage_type, upkeep_cost, maintained_capability).
  // ===========================================================

  // Combat-action intent (Council Phase declaration).
  // Boolean — author can grant/deny the ability to declare
  // a main intent. Used by capability gating primitives.
  "combat_action",
  // Creature size tier (Tiny/Small/Medium/Large/Huge/Gargantuan).
  // Tag enum — author picks the target tier.
  "size",
  // Total carry capacity (Encumbrance PDF).
  // Numeric — capacity = size_capacity + 5×physical_modifier.
  "carry_capacity",
  // Equipment slot (Encumbrance PDF).
  // Author names the slot (e.g. equip_slot:0, equip_slot:weapon).
  // free-text widget — same pattern as `behavior`.
  "equip_slot",
  // Damage type identifier (Damage & Resistance PDF).
  // Author names the type (e.g. damage_type:fire, damage_type:ice).
  "damage_type",
  // Source type for damage / capabilities (Damage & Resistance PDF).
  // Tag enum — physical / magical / psychic.
  "source_type",
  // Per-capability upkeep cost (Upkeep & Interruption PDF).
  // Author names the capability instance.
  // numeric with author-named sub-target.
  "upkeep_cost",
  // Boolean flag indicating a capability is currently maintained
  // (Upkeep & Interruption PDF). Author names the capability.
  "maintained_capability",
  // Complexity score (Player Loop + Combat Rhythm PDFs).
  // Numeric — used for capability design and combat placement.
  "complexity",
] as const;
export type ModifierTarget = (typeof MODIFIER_TARGETS)[number];

/**
 * LEGACY TARGET MAP — preserves the previous dotted strings used by
 * HardModifier rows saved before Phase-7-E. Used only when reading
 * older data; new code should write the short axis form.
 *
 * Keyed by legacy dotted string → maps to the canonical short target
 * + a default single-axis scope if no metadata.targetScope is present.
 */
export const LEGACY_TARGET_MIGRATIONS: Record<
  string,
  { target: ModifierTarget; defaultScope: TargetScopeLite }
> = {
  "character.attribute.physical": {
    target: "attribute",
    defaultScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] },
  },
  "character.attribute.mental": {
    target: "attribute",
    defaultScope: { layer: "ATTRIBUTE", values: ["MENTAL"] },
  },
  "character.attribute.magical": {
    target: "attribute",
    defaultScope: { layer: "ATTRIBUTE", values: ["MAGICAL"] },
  },
  "character.defense.physicalDc": {
    // Phase 8.I i2.0 (Mashu 2026-08-05): legacy per-attribute
    // defense DC keys collapse into the single global Save DC axis.
    // The previous defaultScope.values=["DEFENSE_ROLL"] was mapped
    // to the old per-attribute axis; now there's no sub-target.
    target: "defense_dc",
    defaultScope: { layer: "METRIC", values: [] },
  },
  "character.defense.mentalDc": {
    target: "defense_dc",
    defaultScope: { layer: "METRIC", values: [] },
  },
  "character.defense.magicalDc": {
    target: "defense_dc",
    defaultScope: { layer: "METRIC", values: [] },
  },
  "character.movement.land": {
    // Phase-7-E/UX2a-r: legacy walking-speed modal lands on
    // the single "speed" axis with locomotion WALKING_SPEED as
    // the radio value (was 'speed' + LAND_SPEED — kept for
    // round-trip from very-old data).
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["WALKING_SPEED"] },
  },
  "character.movement.fly": {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["FLYING_SPEED"] },
  },
  "character.movement.swim": {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["SWIMMING_SPEED"] },
  },
  "character.movement.climb": {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["CLIMBING_SPEED"] },
  },
  "character.movement.burrow": {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["BURROWING_SPEED"] },
  },
  // Phase-7-E/UX2a-r bridge: data written when Speed was 5
  // separate axes (e.g. commits 5a3364e..5a78a2e) carried target
  // strings like "walking_speed". Load those back as the
  // single "speed" axis with locomotion WALKING_SPEED selected.
  walking_speed: {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["WALKING_SPEED"] },
  },
  climbing_speed: {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["CLIMBING_SPEED"] },
  },
  swimming_speed: {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["SWIMMING_SPEED"] },
  },
  flying_speed: {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["FLYING_SPEED"] },
  },
  burrowing_speed: {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["BURROWING_SPEED"] },
  },
  "character.maxVitality": {
    target: "max_vitality",
    defaultScope: { layer: "METRIC", values: [] }, // empty = any HP
  },
  "character.currentVitality": {
    target: "current_vitality",
    defaultScope: { layer: "METRIC", values: [] },
  },
  "character.skill": {
    target: "skill_practice_check",
    defaultScope: { layer: "PRACTICE", values: [] }, // empty = any
  },
  "character.proficiencyBonus": {
    target: "proficiency_bonus",
    defaultScope: { layer: "METRIC", values: ["PROFICIENCY_BONUS"] },
  },
  "action.roll": {
    target: "action_roll",
    defaultScope: { layer: "METRIC", values: ["ATTACK_ROLL"] },
  },
  "action.damage": {
    target: "damage_healing_output",
    defaultScope: { layer: "DICE", values: [] },
  },
  "action.range": {
    target: "targeting",
    defaultScope: { layer: "NARROW_FOCUS", values: [] },
  },
  "action.targetCount": {
    target: "targeting",
    defaultScope: { layer: "NARROW_FOCUS", values: [] },
  },
  "action.areaSize": {
    target: "targeting",
    defaultScope: { layer: "NARROW_FOCUS", values: [] },
  },
  // Phase-7-E/UX2b-r bridge: data written when the canonical name
  // was action_shape_size (commit 5a3364e onwards, before this
  // rename) reads back as the renamed "targeting" axis.
  action_shape_size: {
    target: "targeting",
    defaultScope: { layer: "NARROW_FOCUS", values: [] },
  },
  "action.duration": {
    target: "duration",
    defaultScope: { layer: "DURATION", values: [] },
  },
  "action.strain": {
    target: "strain",
    defaultScope: { layer: null, values: [] }, // null = no scope
  },
  "item.slotCost": {
    target: "item_slot_cost",
    defaultScope: { layer: null, values: [] },
  },
  "scene.pace": {
    target: "scene_pace",
    defaultScope: { layer: "NARROW_FOCUS", values: [] },
  },
  "entity.loadout": {
    // Legacy entry not in the new dropdown but accepted when loading
    // older rows to avoid breaking canonical saves.
    target: "item_slot_cost",
    defaultScope: { layer: null, values: [] },
  },
  // Phase 8.I i2.5e (Mashu 2026-08-05): legacy "behavior:<name>" targets.
  // Pre-i2.5c data saved behavior modifiers using the legacy dotted
  // form (e.g. "behavior:global_dc_modifier"). The form now uses
  // target="behavior" + metadata.behaviorName="<name>". Loading a
  // legacy row should map to the new shape so the form can re-edit it.
  //
  // We don't pre-fill defaultScope here — the form's free-text input
  // carries the actual behavior name (set via the behaviorName key
  // in metadata). See fromHardModifier in primitive-form.tsx.
};

// =============================================================================
// TARGET SCOPE — shape of the metadata stored on a HardModifier
// =============================================================================

/**
 * The compact scope shape we serialize on each HardModifier's metadata.
 *
 *   layer  — which canonical scope axis this modifier applies to.
 *   values — the checked values on that axis (multi-select).
 *            Empty array = "any" (broad). Single-element = "narrowed
 *            to that one value".
 *
 * Examples:
 *   { layer: "ATTRIBUTE", values: ["PHYSICAL", "MAGICAL"] }
 *     → affects Physical AND Magical attributes
 *   { layer: "PRACTICE", values: ["AWARENESS"] }
 *     → affects only Awareness checks
 *   { layer: "PRACTICE", values: [] }
 *     → affects all practices (broad)
 *   { layer: "NARROW_FOCUS", values: ["Awareness (Smell)"] }
 *     → affects one specific sub-focus
 *   { layer: null, values: [] }
 *     → no scope axis (positional/narrative)
 */
export interface TargetScopeLite {
  readonly layer: ScopeLayer | null;
  readonly values: readonly string[];
}

// =============================================================================
// SKILL/PRACTICE GRANULARITY — narrow-focus vs broad
// =============================================================================

/**
 * For the Skill / Practice Check line, the user chooses between:
 *   - BROAD: { layer: "PRACTICE", values: [...] } (any checked practice)
 *   - NARROW: { layer: "NARROW_FOCUS", values: ["Awareness (Smell)"] }
 */
export const SKILL_PRACTICE_GRANULARITIES = ["broad", "narrow"] as const;
export type SkillPracticeGranularity = (typeof SKILL_PRACTICE_GRANULARITIES)[number];

// =============================================================================
// PER-TARGET METADATA — what the form needs to render the right widget
// =============================================================================

/**
 * For each `ModifierTarget`, the form needs to know:
 *   - what layer we're targeting (so it can display it as a soft badge)
 *   - what widget to show for Target Value (multi-select checklist? free-text?)
 *   - the curated list of options, if any
 *   - whether free-text is allowed (for "Other:" escape hatches)
 *   - whether the value is preserved on the modifier (Dice list sizes,
 *     Speed types, etc. are stored as values; positional quantities live
 *     in the existing `value` field of HardModifier)
 */
export interface ModifierTargetSpec {
  readonly target: ModifierTarget;
  readonly label: string;
  readonly layer: ScopeLayer | null;
  readonly widget:
    | "none"
    | "checklist"
    | "free-text"
    | "checklist-with-free-text";
  /** Curated values to show as checkboxes (or radio options). */
  readonly options?: readonly string[];
  /** Free-text placeholder when widget involves free-text input. */
  readonly freeTextPlaceholder?: string;
  /**
   * Display labels keyed by canonical option value. Used by
   * checklist / radio widgets (e.g. Speed → "Walking" instead
   * of "WALKING_SPEED").
   */
  readonly optionLabels?: Readonly<Record<string, string>>;
  /**
   * True if this target is *just a numeric effect*, in which case the
   * Value field carries the number. Used for Strain / Item Slot Cost.
   */
  readonly valueIsNumeric?: boolean;
}

export const MODIFIER_TARGET_SPEC: Record<ModifierTarget, ModifierTargetSpec> = {
  attribute: {
    target: "attribute",
    label: "Attribute",
    layer: "ATTRIBUTE",
    widget: "checklist",
    options: ATTRIBUTES,
  },
  defense_dc: {
    // Phase 8.I i2.0 (Mashu 2026-08-05): per user feedback, there is
    // ONE global Save DC — not per-attribute. The form previously
    // exposed Physical/Mental/Magical sub-targets, which was wrong.
    // Migration: existing modifiers with sub-targets coerce to the
    // single axis (engine reads them all as contributions to the
    // single character.defense.saveDc number).
    target: "defense_dc",
    label: "Save DC",
    layer: "METRIC",
    widget: "none",
  },
  speed: {
    // Phase-7-E/UX2a-r + i2.7: Speed is one dropdown entry.
    // The five locomotion types are checklist options; "OTHER"
    // adds a free-text input for any non-canonical speed.
    target: "speed",
    label: "Speed",
    layer: "METRIC",
    widget: "checklist-with-free-text",
    options: [
      "WALKING_SPEED",
      "CLIMBING_SPEED",
      "SWIMMING_SPEED",
      "FLYING_SPEED",
      "BURROWING_SPEED",
      "OTHER",
    ],
    optionLabels: {
      WALKING_SPEED: "Walking",
      CLIMBING_SPEED: "Climbing",
      SWIMMING_SPEED: "Swimming",
      FLYING_SPEED: "Flying",
      BURROWING_SPEED: "Burrowing",
      OTHER: "Other",
    },
    freeTextPlaceholder:
      "Other locomotion (e.g. 'Tunneling', 'Phase')",
  },
  max_vitality: {
    target: "max_vitality",
    label: "Max Vitality",
    layer: "METRIC",
    widget: "none",
  },
  current_vitality: {
    target: "current_vitality",
    label: "Current Vitality",
    layer: "METRIC",
    widget: "none",
  },
  skill_practice_check: {
    // Phase-7-E/UX2-r3: skill_practice_check is now a pure
    // practice checklist — no broad/narrow radio. If the user
    // wants a narrow focus like "Awareness (Smell)" or
    // "Fieldcraft (Tracking)," they enter it in the Condition
    // field below, not as a granularity option in this widget.
    // Storage shape: PRACTICE layer, free-form value array.
    target: "skill_practice_check",
    label: "Skill / Practice Check",
    layer: "PRACTICE",
    widget: "checklist",
    options: PRACTICES,
  },
  proficiency_bonus: {
    target: "proficiency_bonus",
    label: "Proficiency Bonus",
    layer: "METRIC",
    widget: "none",
  },
  action_roll: {
    // Phase 8.I i2.0 + i2.7: action_roll has 5 sub-targets
    // (attack roll, 3 saves, other) plus a free-text input for
    // author-named axes (proficiencies, custom rolls).
    target: "action_roll",
    label: "Action Roll",
    layer: "METRIC",
    widget: "checklist-with-free-text",
    options: [
      "ATTACK_ROLL",
      "PHYSICAL_SAVE",
      "MENTAL_SAVE",
      "MAGICAL_SAVE",
      "OTHER",
    ],
    optionLabels: {
      ATTACK_ROLL: "Attack Roll",
      PHYSICAL_SAVE: "Physical Save",
      MENTAL_SAVE: "Mental Save",
      MAGICAL_SAVE: "Magical Save",
      OTHER: "Other",
    },
    freeTextPlaceholder:
      "Other action roll (e.g. 'Initiative', 'Profession check')",
  },
  damage_healing_output: {
    // Phase 7.5 v4: Damage / Healing Output has NO target value
    // widget. Mashu: modifiers carry their own dice and tags
    // (via the value field), so the target value checklist
    // was redundant — the modifier itself says "fire damage
    // 2d6+PB" and the engine doesn't need to filter by damage
    // type at the modifier level. The widget: "none" makes the
    // form show an explanatory placeholder instead of a
    // checklist.
    target: "damage_healing_output",
    label: "Damage / Healing Output",
    layer: "DICE",
    widget: "none",
  },
  targeting: {
    // Phase-7-E/UX2b: the three positional axes (Action Range /
    // Target Count / Area Size) collapse into one "Targeting"
    // axis. The Target Value widget picks the Shape (Single /
    // Multiple / Cone / Cube / Line / Sphere / Cylinder / Wall /
    // Star / Custom + free text); the existing Operation+Value
    // fields carry the magnitude (e.g. operation=set, value=20
    // → "20-ft Cone").
    //
    // Phase-7-E/UX2b-r: renamed "Action Shape & Size" → "Targeting"
    // because the previous name read like an analytics term. UX
    // feedback: terse player-facing verb reads better.
    target: "targeting",
    label: "Targeting",
    layer: "NARROW_FOCUS",
    widget: "checklist-with-free-text",
    options: [
      "Single Target",
      "Multiple Targets",
      "Cone",
      "Cube",
      "Line",
      "Sphere",
      "Cylinder",
      "Wall",
      "Star",
      "Custom",
    ],
    freeTextPlaceholder:
      "Other shape (e.g. 'Spike on Touch') — set Operation below to configure.",
  },
  // Phase-7-E/UX2b: legacy positional axes were removed entirely —
  // action_range, target_count, and area_size no longer exist in the
  // dropdown. LEGACY_TARGET_MIGRATIONS maps their dotted strings to
  // targeting when loading old data, but new code only uses
  // targeting. Keep the SPEC table focused on canonical targets
  // only.
  duration: {
    target: "duration",
    label: "Duration",
    layer: "DURATION",
    widget: "checklist-with-free-text",
    options: [...DURATION_VALUES, "OTHER"],
    optionLabels: {
      OTHER: "Other",
    },
    freeTextPlaceholder:
      "Other duration (e.g. 'Until next dawn', 'Until dismissed')",
  },
  strain: {
    target: "strain",
    label: "Strain",
    layer: null,
    widget: "free-text",
    freeTextPlaceholder: "Describe the strain cost",
    valueIsNumeric: true,
  },
  item_slot_cost: {
    target: "item_slot_cost",
    label: "Item Slot Cost",
    layer: null,
    widget: "none",
    valueIsNumeric: true,
  },
  scene_pace: {
    target: "scene_pace",
    label: "Scene Pace",
    layer: null,
    widget: "free-text",
    freeTextPlaceholder: "Round / Scene / Day / Custom",
  },
  // Phase 7.5: free-form behavior axis. The form renders a
  // text input for the behavior name. The runtime stores it
  // as a BehaviorTarget ("behavior:<name>") and the character
  // sheet resolves it against whatever behavior the character
  // has defined.
  behavior: {
    target: "behavior",
    label: "Behavior (custom)",
    layer: null,
    widget: "free-text",
    freeTextPlaceholder: "e.g. darkvision, mana_pool",
  },

  // ===========================================================
  // Phase 8.I i2.7 — new targets from canonical PDFs.
  // See docs/primitive-target-ontology.md for the canonical
  // mapping + scope-layer rules.
  // ===========================================================

  combat_action: {
    target: "combat_action",
    label: "Combat Action (intent)",
    layer: null,
    widget: "none",
  },
  size: {
    target: "size",
    label: "Size Tier",
    layer: null,
    widget: "checklist-with-free-text",
    options: [
      "TINY",
      "SMALL",
      "MEDIUM",
      "LARGE",
      "HUGE",
      "GARGANTUAN",
      "OTHER",
    ],
    optionLabels: {
      TINY: "Tiny",
      SMALL: "Small",
      MEDIUM: "Medium",
      LARGE: "Large",
      HUGE: "Huge",
      GARGANTUAN: "Gargantuan",
      OTHER: "Other",
    },
    freeTextPlaceholder:
      "Other size tier (e.g. 'Colossal', 'Gargantuan+')",
  },
  carry_capacity: {
    target: "carry_capacity",
    label: "Carry Capacity",
    layer: null,
    widget: "none",
    valueIsNumeric: true,
  },
  equip_slot: {
    target: "equip_slot",
    label: "Equip Slot",
    layer: null,
    widget: "free-text",
    freeTextPlaceholder: "e.g. 0, weapon, armor, ring1",
  },
  damage_type: {
    target: "damage_type",
    label: "Damage Type",
    layer: null,
    widget: "free-text",
    freeTextPlaceholder: "e.g. fire, ice, lightning, gravity, force",
  },
  source_type: {
    target: "source_type",
    label: "Source Type",
    layer: null,
    widget: "checklist-with-free-text",
    options: ["PHYSICAL", "MAGICAL", "MENTAL", "OTHER"],
    optionLabels: {
      PHYSICAL: "Physical",
      MAGICAL: "Magical",
      MENTAL: "Mental",
      OTHER: "Other",
    },
    freeTextPlaceholder:
      "Other source type (e.g. 'Divine', 'Psionic', 'Elemental')",
  },
  upkeep_cost: {
    target: "upkeep_cost",
    label: "Upkeep Cost",
    layer: null,
    widget: "free-text",
    freeTextPlaceholder: "e.g. fire_shield, mage_armor",
    valueIsNumeric: true,
  },
  maintained_capability: {
    target: "maintained_capability",
    label: "Maintained Capability",
    layer: null,
    widget: "free-text",
    freeTextPlaceholder: "e.g. fire_shield, mage_armor",
  },
  complexity: {
    target: "complexity",
    label: "Complexity",
    layer: null,
    widget: "none",
    valueIsNumeric: true,
  },
};

// =============================================================================
// SCOPE HELPERS — build / apply / infer for modifier metadata
// =============================================================================

/**
 * Build a TargetScopeLite from a checkbox-style multi-select.
 * Returns `{ values: [] }` if no boxes are checked (means "any").
 */
export function buildScopeFromValues(
  layer: ScopeLayer | null,
  values: readonly string[],
): TargetScopeLite {
  // De-dupe + drop empty strings to keep storage clean.
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      clean.push(t);
    }
  }
  return { layer, values: clean };
}

/**
 * Build a TargetScopeLite from a free-text narrow focus string.
 *
 * Phase-7-E/UX2-r3: legacy helper. Narrow focus moved to the
 * Condition field of the modifier card; new code should compose
 * conditions via `scopeForSelection(...).metadata.targetScope`
 * (`NARROW_FOCUS` layer, free text) or rely on the Condition
 * triple (`{key, operator, value}`) instead. Kept for backwards
 * compatibility with older code/tests that produced `NARROW_FOCUS`
 * scopes via this helper.
 */
export function buildScopeFromNarrowFocus(text: string): TargetScopeLite {
  const trimmed = text.trim();
  if (!trimmed) return { layer: "NARROW_FOCUS", values: [] };
  return { layer: "NARROW_FOCUS", values: [trimmed] };
}

/**
 * Validate a TargetScopeLite against the canonical `target-scope.ts`
 * vocabulary. Returns the same `{ ok, soft?, error? }` shape so the
 * form can surface warnings consistently.
 *
 * Layer is checked strictly; values are checked against the closed
 * vocab for that layer where applicable, and against open foundry
 * (free-form) for NARROW_FOCUS and METRIC.
 */
export function validateModifierScope(
  scope: TargetScopeLite | null | undefined,
): { ok: true; soft?: string } | { ok: false; error: string } {
  if (!scope || scope.layer === null) {
    return { ok: true };
  }
  // Delegate to the canonical validator for layer-level checks.
  const layerResult = validateScope({ layer: scope.layer, value: null });
  if (!layerResult.ok) {
    return { ok: false, error: layerResult.error };
  }

  // Per-layer value validation.
  const values = scope.values;
  if (values.length === 0) return { ok: true };

  for (const v of values) {
    switch (scope.layer) {
      case "ATTRIBUTE":
        if (!(ATTRIBUTES as readonly string[]).includes(v)) {
          return { ok: false, error: `Unknown attribute "${v}".` };
        }
        break;
      case "PRACTICE":
        if (!(PRACTICES as readonly string[]).includes(v)) {
          return { ok: false, error: `Unknown practice "${v}".` };
        }
        break;
      case "METRIC":
        // Open foundry — any string is OK, but log a soft note if it
        // isn't in the canonical list.
        if (!(STANDALONE_METRICS as readonly string[]).includes(v as StandaloneMetric)) {
          // Not an error; just a soft hint.
          break;
        }
        break;
      case "DICE":
        if (!(DICE_VALUES as readonly string[]).includes(v as DiceValue)) {
          return { ok: false, error: `Unknown dice value "${v}".` };
        }
        break;
      case "DURATION":
        if (!(DURATION_VALUES as readonly string[]).includes(v as DurationValue)) {
          return { ok: false, error: `Unknown duration "${v}".` };
        }
        break;
      case "NARROW_FOCUS":
        if (typeof v !== "string" || v.trim() === "") {
          return { ok: false, error: "Narrow-focus value must be a non-empty string." };
        }
        break;
      case "ALL":
        // ALL ignores values; soft note if non-empty.
        break;
    }
  }

  return { ok: true };
}

// =============================================================================
// LEGACY INFERENCE — read an old HardModifier and surface its scope
// =============================================================================

/**
 * Read a HardModifier's stored scope. Tries metadata.targetScope first
 * (Phase-7-E format), falls back to legacy `target` dotted-string
 * heuristic.
 *
 * Returns `null` (no scope) if neither path can resolve one — this can
 * happen for legacy rows whose target is missing or unrecognized.
 */
export function resolveStoredScope(modifier: {
  readonly target?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}): TargetScopeLite | null {
  // Phase-7-E shape first.
  const md = modifier.metadata;
  if (md && typeof md === "object") {
    const ts = (md as Record<string, unknown>)["targetScope"];
    if (ts && typeof ts === "object") {
      const tsObj = ts as Record<string, unknown>;
      const layer = tsObj["layer"] ?? null;
      // Phase-7-D-2: accept both `values: string[]` (canonical new
      // shape) and a singular `value: string` (legacy row format
      // already present in DB). The canonical shape carries both;
      // legacy shape has `value`, not `values`.
      const valuesRaw = tsObj["values"];
      const values: string[] = Array.isArray(valuesRaw)
        ? valuesRaw.filter((v): v is string => typeof v === "string")
        : [];
      let valuesFixed = values;
      if (valuesFixed.length === 0) {
        const singular = tsObj["value"];
        if (typeof singular === "string") {
          valuesFixed = [singular];
        }
      }
      if (typeof layer === "string" || layer === null) {
        return {
          layer: (layer as ScopeLayer | null) ?? null,
          values: valuesFixed,
        };
      }
    }
  }
  // Legacy target fallback.
  const target = modifier.target;
  if (typeof target === "string" && target in LEGACY_TARGET_MIGRATIONS) {
    const migration = LEGACY_TARGET_MIGRATIONS[target];
    if (migration) return migration.defaultScope;
  }
  return null;
}

// =============================================================================
// HELPERS — derive (target, granularity, targetValue) from a modifier
// =============================================================================

/**
 * From a stored modifier, produce:
 *   - target: the canonical short label
 *   - granularity: only set for skill_practice_check
 *   - targetValue: the stored values (array)
 *   - freeTextNarrowFocus: stored narrow-focus string (for skill N)
 *
 * Use this when initializing the form from a HardModifier (legacy or new).
 */
export interface ModifierFormSelection {
  readonly target: ModifierTarget;
  readonly granularity: SkillPracticeGranularity | null;
  readonly targetValues: readonly string[];
  readonly freeTextNarrowFocus: string | null;
}

export function selectionForModifier(modifier: {
  readonly target?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}): ModifierFormSelection {
  const targetRaw = modifier.target ?? "";
  // Phase-7-E first — short target is canonical.
  if ((MODIFIER_TARGETS as readonly string[]).includes(targetRaw)) {
    const target = targetRaw as ModifierTarget;
    const scope = resolveStoredScope(modifier);
    const md = (modifier.metadata ?? {}) as Record<string, unknown>;
    // Phase-7-E/UX2-r3: granularity is no longer surfaced by
    // the form. The metadata.granularity field is tolerated on
    // older modifiers (so round-trip doesn't lose data) but it
    // always maps to null at the selection level — the
    // broad/narrow radio is gone from the form, and narrow
    // focus is now a Condition field, not a Practice-axis knob.
    //
    // For skill_practice_check + NARROW_FOCUS scope, the legacy
    // data shape stores the narrow-focus text in
    // targetScope.values[0]. Carve that into freeTextNarrowFocus
    // and leave targetValues empty (the new form no longer
    // reads the NARROW_FOCUS layer's value as a checklist pick).
    const layer = scope?.layer ?? null;
    const narrowText =
      target === "skill_practice_check" && layer === "NARROW_FOCUS"
        ? (scope?.values[0] ?? null)
        : null;
    void md; // md kept temporarily for forward-compat with future schema fields
    return {
      target,
      granularity: null,
      // legacy NARROW_FOCUS layer scopes hold the focus text in
      // values[0]. Drop it from targetValues so the form
      // checklist reflects only true practice picks.
      targetValues:
        target === "skill_practice_check" && layer === "NARROW_FOCUS"
          ? []
          : scope?.values ?? [],
      freeTextNarrowFocus: narrowText,
    };
  }
  // Legacy dotted fallback.
  const migration = LEGACY_TARGET_MIGRATIONS[targetRaw];
  if (migration) {
    return {
      target: migration.target,
      granularity: null,
      targetValues: [...migration.defaultScope.values],
      freeTextNarrowFocus: null,
    };
  }
  // Phase 8.I i2.5e (Mashu 2026-08-05): legacy "behavior:<name>"
  // targets from pre-i2.5c data. Extract the name and route to the
  // new shape: target="behavior" with the name in
  // freeTextNarrowFocus. The fromHardModifier then writes
  // metadata.behaviorName on save.
  if (targetRaw.startsWith("behavior:")) {
    const behaviorName = targetRaw.slice("behavior:".length).trim();
    return {
      target: "behavior",
      granularity: null,
      targetValues: [],
      freeTextNarrowFocus: behaviorName.length > 0 ? behaviorName : null,
    };
  }
  // Unknown target — default to action.roll with no scope.
  return {
    target: "action_roll",
    granularity: null,
    targetValues: [],
    freeTextNarrowFocus: null,
  };
}

/**
 * Inverse of selectionForModifier. Builds a stored
 * `{ target, metadata }` representation for saving.
 *
 * The caller provides the modifier draft's `target`,
 * `targetValueValues` (multi-select), `granularity`, and optionally
 * `freeTextNarrowFocus` (when on skill_practice_check + narrow).
 *
 * Returns:
 *   - target: the canonical short label (always)
 *   - metadata.targetScope: the TargetScopeLite to store
 *   - metadata.granularity: only for skill_practice_check
 *
 * The original HardModifier { kind, operation, value, stacking, condition }
 * fields are the caller's to compose (we don't touch them).
 */
export function scopeForSelection(args: {
  readonly target: ModifierTarget;
  readonly targetValues: readonly string[];
  readonly granularity: SkillPracticeGranularity | null;
  readonly freeTextNarrowFocus?: string | null;
}): {
  readonly target: ModifierTarget;
  readonly metadata: {
    readonly targetScope: TargetScopeLite;
    readonly granularity: SkillPracticeGranularity | null;
  };
} {
  const spec = MODIFIER_TARGET_SPEC[args.target];
  let scope: TargetScopeLite;

  // Phase-7-E/UX2-r3: skill_practice_check used to have a broad /
  // narrow radio. Now it's a plain checklist (PRACTICE layer).
  // Narrow-focus forms (e.g. "Awareness (Smell)") live in the
  // Condition field below the modifier card, not in this widget.
  // So skill_practice_check now shares the same code path as
  // every other target.
  scope = buildScopeFromValues(spec.layer, args.targetValues);
  return {
    target: args.target,
    metadata: {
      targetScope: scope,
      // Preserved for backward compatibility with old metadata
      // blobs that still carry granularity; new writes always set
      // it to null (no granularity knob in the form anymore).
      granularity: null,
    },
  };
}

// =============================================================================
// RE-EXPORT for ergonomic imports
// =============================================================================

export type {
  ScopeLayer,
  StandaloneMetric,
  Practice,
  Attribute,
  DurationValue,
  DiceValue,
};
