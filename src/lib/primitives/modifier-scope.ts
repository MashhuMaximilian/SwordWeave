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
  DICE_VALUES,
  DURATION_VALUES,
  validateScope,
} from "./target-scope";

// =============================================================================
// MODIFIER TARGET — the canonical-3-axis short labels for the form dropdown
// =============================================================================

/**
 * Every primitive row's "What changes?" dropdown is one of these values.
 * Compared to the legacy `ModifierTarget` (dotted strings like
 * "character.attribute.physical"), these are short axis labels —
 * the specific value is captured separately in `targetValue`.
 */
export const MODIFIER_TARGETS = [
  // Physical/Mental/Magical axis (consolidated)
  "attribute",
  // Physical/Mental/Magical defense DC axis (consolidated)
  "defense_dc",
  // Land/Fly/Swim speed axis (consolidated)
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
  // Positional / narrative
  "action_range",
  "target_count",
  "area_size",
  "duration",
  "strain",
  "item_slot_cost",
  "scene_pace",
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
    target: "defense_dc",
    defaultScope: { layer: "METRIC", values: ["DEFENSE_ROLL"] },
  },
  "character.defense.mentalDc": {
    target: "defense_dc",
    defaultScope: { layer: "METRIC", values: ["DEFENSE_ROLL"] },
  },
  "character.defense.magicalDc": {
    target: "defense_dc",
    defaultScope: { layer: "METRIC", values: ["DEFENSE_ROLL"] },
  },
  "character.movement.land": {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["LAND_SPEED"] },
  },
  "character.movement.fly": {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["FLY_SPEED"] },
  },
  "character.movement.swim": {
    target: "speed",
    defaultScope: { layer: "METRIC", values: ["SWIM_SPEED"] },
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
    target: "action_range",
    defaultScope: { layer: "NARROW_FOCUS", values: [] },
  },
  "action.targetCount": {
    target: "target_count",
    defaultScope: { layer: "NARROW_FOCUS", values: [] },
  },
  "action.areaSize": {
    target: "area_size",
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
    | "checklist-with-free-text"
    | "radio-granularity";
  /** Curated values to show as checkboxes (or radio options). */
  readonly options?: readonly string[];
  /** Free-text placeholder when widget involves free-text input. */
  readonly freeTextPlaceholder?: string;
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
    target: "defense_dc",
    label: "Defense DC",
    layer: "METRIC",
    widget: "checklist",
    // Reuse the DC/Defense metric scope. The form presents these as
    // "Physical / Mental / Magical" (the attribute-keyed axes) for
    // human-readability even though the canonical metric value is
    // DEFENSE_ROLL.
    options: ["PHYSICAL", "MENTAL", "MAGICAL"],
  },
  speed: {
    target: "speed",
    label: "Speed",
    layer: "METRIC",
    widget: "checklist",
    options: ["LAND_SPEED", "FLY_SPEED", "SWIM_SPEED"],
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
    target: "skill_practice_check",
    label: "Skill / Practice Check",
    layer: null, // depends on granularity — populate at render time
    widget: "radio-granularity",
    options: PRACTICES,
    freeTextPlaceholder: "Awareness (Smell), Fieldcraft (Tracking), ...",
  },
  proficiency_bonus: {
    target: "proficiency_bonus",
    label: "Proficiency Bonus",
    layer: "METRIC",
    widget: "none",
  },
  action_roll: {
    target: "action_roll",
    label: "Action Roll",
    layer: "METRIC",
    widget: "none",
  },
  damage_healing_output: {
    target: "damage_healing_output",
    label: "Damage / Healing Output",
    layer: "DICE",
    widget: "checklist",
    options: DICE_VALUES,
  },
  action_range: {
    target: "action_range",
    label: "Action Range",
    layer: "NARROW_FOCUS",
    widget: "checklist-with-free-text",
    options: ["Self", "Touch", "Near", "Far", "Line of Sight", "Global"],
    freeTextPlaceholder: "Other range description",
  },
  target_count: {
    target: "target_count",
    label: "Target Count",
    layer: "NARROW_FOCUS",
    widget: "checklist-with-free-text",
    options: ["Single", "2", "4", "8", "AoE", "All"],
    freeTextPlaceholder: "Other target-count description",
  },
  area_size: {
    target: "area_size",
    label: "Area Size",
    layer: "NARROW_FOCUS",
    widget: "checklist-with-free-text",
    options: ["5 ft", "15 ft", "30 ft", "60 ft", "Room", "Scene"],
    freeTextPlaceholder: "Other area-size description",
  },
  duration: {
    target: "duration",
    label: "Duration",
    layer: "DURATION",
    widget: "checklist",
    options: DURATION_VALUES,
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
 * Build a TargetScopeLite from a single free-text narrow focus.
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
      const layer = (ts as Record<string, unknown>)["layer"] ?? null;
      const raw = (ts as Record<string, unknown>)["values"];
      const values = Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === "string")
        : [];
      if (typeof layer === "string" || layer === null) {
        return {
          layer: (layer as ScopeLayer | null) ?? null,
          values,
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
    const granularityRaw = md["granularity"];
    const granularity =
      typeof granularityRaw === "string" &&
      (SKILL_PRACTICE_GRANULARITIES as readonly string[]).includes(granularityRaw)
        ? (granularityRaw as SkillPracticeGranularity)
        : null;
    const freeTextRaw =
      target === "skill_practice_check" &&
      scope?.layer === "NARROW_FOCUS"
        ? (scope.values[0] ?? null)
        : null;
    return {
      target,
      granularity:
        target === "skill_practice_check" ? (granularity ?? "broad") : null,
      targetValues: scope?.values ?? [],
      freeTextNarrowFocus: freeTextRaw,
    };
  }
  // Legacy dotted fallback.
  const migration = LEGACY_TARGET_MIGRATIONS[targetRaw];
  if (migration) {
    return {
      target: migration.target,
      granularity:
        migration.target === "skill_practice_check" ? "broad" : null,
      targetValues: [...migration.defaultScope.values],
      freeTextNarrowFocus: null,
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

  if (args.target === "skill_practice_check") {
    const granularity =
      args.granularity ??
      (args.targetValues.length > 0 ? "broad" : "broad");
    if (granularity === "narrow") {
      scope = buildScopeFromNarrowFocus(args.freeTextNarrowFocus ?? "");
    } else {
      scope = buildScopeFromValues("PRACTICE", args.targetValues);
    }
    return {
      target: args.target,
      metadata: {
        targetScope: scope,
        granularity,
      },
    };
  }

  // For all other targets: use the spec's layer + the supplied values.
  scope = buildScopeFromValues(spec.layer, args.targetValues);
  return {
    target: args.target,
    metadata: {
      targetScope: scope,
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
