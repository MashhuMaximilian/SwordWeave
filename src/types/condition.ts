/**
 * SwordWeave Condition v1 (Q-B road, July 2026)
 *
 * Replaces the old inline `ModifierCondition` triple (key/operator/value)
 * with a discriminated union. The intent of the rewrite:
 *
 *   - The author of a primitive/capability/effect should not need to
 *     know what legal condition keys exist or how to phrase them.
 *     A preset picker handles the common cases; a free-text pill list
 *     handles the rest.
 *
 *   - The character sheet displays conditions as badges next to the
 *     modifier. The DM adjudicates at the table; the engine does not
 *     evaluate conditions at runtime in v1. The structured preset
 *     shape exists so future engine work (Q2 option A — runtime
 *     evaluation) can be added without a second schema migration.
 *
 *   - Two layers coexist:
 *
 *       - "preset": a named baseline mechanic. Ships with v1 starter
 *         list. Each preset is one of a closed set of canonical names
 *         from `CONDITION_PRESETS`. Author can pick from this list;
 *         the picker UI can suggest chips but does not restrict
 *         authoring to the closed set.
 *
 *       - "narrative": free-text description of when the modifier
 *         applies. Shown verbatim on the character sheet. The DM
 *         reads it. Engine does not evaluate.
 *
 *   - "pills" (the user-editable free-text tags the user mentioned)
 *     live on the preset variant as `customTags: readonly string[]`.
 *     The starter preset picker shows the canonical name as a chip;
 *     the author can add their own chips alongside. Pills are
 *     display-only — they do not become presets.
 *
 * Migration from the old shape (`{key, operator, value}`):
 *   - If `key` matches a known canonical preset → migrate to
 *     `{kind: "preset", presetKey, customTags: []}`
 *   - Otherwise → migrate to `{kind: "narrative", text: <value>}` so
 *     no authoring intent is lost. The migration is lossy on
 *     `operator` because we're not evaluating in v1; the old
 *     `operator` field is dropped.
 *
 * See `docs/phase-7/condition-v1-design.md` for the full rationale
 * (TBD — written in the schema PR).
 */

// =============================================================================
// Canonical preset catalog (v1)
// =============================================================================

/**
 * Category used to group presets in the picker UI.
 *
 * "target" — about the target of the modifier (the entity being
 * affected: the enemy in an attack, the ally being healed, etc.)
 *
 * "scene" — about the world state (lighting, terrain, ambient).
 *
 * "actor" — about the entity using the modifier (the character
 * themselves, e.g. "I am below half HP").
 */
export type ConditionPresetCategory = "target" | "scene" | "actor";

/**
 * Canonical preset keys.
 *
 * These are the **closed set** of preset identifiers the engine
 * recognizes for future runtime evaluation. The picker UI can
 * present any of these as starter chips, but the author is free to
 * add their own custom pills (which are display-only).
 *
 * Naming: lowercase, hyphenated, descriptive. The display name is
 * derived via `conditionPresetLabel()` in
 * `src/lib/primitives/condition-presets.ts`.
 */
export type ConditionPresetKey =
  // Target state (7)
  | "target-bleeding"
  | "target-below-half-hp"
  | "target-has-cover"
  | "target-prone"
  | "target-grappled"
  | "target-frightened"
  | "target-stunned"
  // Scene state (5)
  | "scene-dim"
  | "scene-loud"
  | "scene-has-obstacles"
  | "scene-sacred"
  | "scene-hazardous"
  // Actor state (4)
  | "actor-below-half-hp"
  | "actor-prone"
  | "actor-stance"
  | "actor-damaged-last-round";

/**
 * One entry in the canonical catalog. Used to drive the picker UI
 * (category grouping, label text, chip ordering) and as the source
 * of truth for `ConditionPresetKey`.
 */
export interface ConditionPresetEntry {
  /** The canonical key. Must be one of `ConditionPresetKey`. */
  readonly key: ConditionPresetKey;
  /** Grouping for the picker. */
  readonly category: ConditionPresetCategory;
  /** Display label for the chip (e.g. "Target < 50% HP"). */
  readonly label: string;
  /**
   * Optional human-friendly note shown on hover in the picker.
   * Helps the author decide which preset fits their intent.
   */
  readonly hint?: string;
}

/**
 * The v1 catalog. Order within each category is the chip order in
 * the picker. Add new presets here when a real use case appears —
 * not before.
 */
export const CONDITION_PRESETS: readonly ConditionPresetEntry[] = [
  // Target state
  { key: "target-bleeding",         category: "target", label: "Target is Bleeding",         hint: "Target has the Bleeding condition active." },
  { key: "target-below-half-hp",    category: "target", label: "Target < 50% HP",            hint: "Target's current HP is below half their maximum." },
  { key: "target-has-cover",        category: "target", label: "Target has Cover",           hint: "Target benefits from Cover (half or three-quarters)." },
  { key: "target-prone",            category: "target", label: "Target is Prone",            hint: "Target is currently Prone." },
  { key: "target-grappled",         category: "target", label: "Target is Grappled",         hint: "Target is currently Grappled (escape DC check applies)." },
  { key: "target-frightened",       category: "target", label: "Target is Frightened",       hint: "Target is under the Frightened condition." },
  { key: "target-stunned",          category: "target", label: "Target is Stunned",          hint: "Target is Stunned (incapacitated, can't move, speaks falteringly)." },
  // Scene state
  { key: "scene-dim",               category: "scene",  label: "Scene is Dim",               hint: "Dim light: lightly obscured for the relevant sight." },
  { key: "scene-loud",              category: "scene",  label: "Scene is Loud",              hint: "Loud ambient noise: hearing-based checks may have disadvantage." },
  { key: "scene-has-obstacles",     category: "scene",  label: "Scene has Obstacles",        hint: "Physical obstacles between positions (e.g. low wall, rubble)." },
  { key: "scene-sacred",            category: "scene",  label: "Scene is Sacred",            hint: "Location is consecrated / hallowed ground for the relevant faith." },
  { key: "scene-hazardous",         category: "scene",  label: "Scene is Hazardous",         hint: "Environmental hazard present (fire, gas, falling rocks, etc)." },
  // Actor state
  { key: "actor-below-half-hp",     category: "actor",  label: "Actor < 50% HP",             hint: "The acting character's current HP is below half their maximum." },
  { key: "actor-prone",             category: "actor",  label: "Actor is Prone",             hint: "The acting character is currently Prone." },
  { key: "actor-stance",            category: "actor",  label: "Actor has Stance (custom)",  hint: "The acting character is in a named stance (e.g. Defensive, Aggressive, Whirlwind)." },
  { key: "actor-damaged-last-round",category: "actor",  label: "Actor is Damaged Last Round",hint: "The acting character took damage during the previous round." },
] as const;

/**
 * The set of valid preset keys, derived from the catalog. Useful for
 * runtime validation in the parser.
 */
export const CONDITION_PRESET_KEYS: ReadonlySet<string> = new Set(
  CONDITION_PRESETS.map((p) => p.key),
);

// =============================================================================
// ModifierCondition v1 shape
// =============================================================================

/**
 * The new `ModifierCondition` shape. Replaces the old
 * `{key, operator, value}` triple.
 *
 * Discriminated on `kind` so the engine and the character sheet can
 * route on the variant without runtime sniffing.
 */
export type ModifierCondition =
  /**
   * The author picked a baseline mechanic preset (or several), and
   * optionally added custom display pills of their own.
   *
   * `presetKey` is always one of the canonical keys — the picker
   * enforces this for "preset" chips. If the author only added
   * custom pills and no canonical preset, this variant is invalid
   * and the parser will return a `narrative` variant instead.
   */
  | {
      readonly kind: "preset";
      readonly presetKey: ConditionPresetKey;
      /**
       * Optional free-text tags the author added. Display-only;
       * never evaluated by the engine. Empty by default.
       *
       * Example: a "Target < 50% HP" preset with a custom pill
       * "and wounded last turn" — the pill shows next to the
       * preset badge on the character sheet for the DM to see,
       * but the engine only knows the preset.
       */
      readonly customTags: readonly string[];
    }
  /**
   * The author wrote a free-text description. Shown verbatim on the
   * character sheet. The DM reads it. The engine does not evaluate.
   *
   * Use this when:
   *   - The intent doesn't match any preset
   *   - The author wants full narrative control
   *   - The legacy `{key, operator, value}` migrated and the
   *     `key` did not match a known preset
   */
  | {
      readonly kind: "narrative";
      readonly text: string;
    }
  /**
   * The author wants only custom free-text pills (no canonical
   * preset anchor). Display-only on the character sheet.
   *
   * This is the "I'll roll my own" path. Use it when the author
   * knows their use case doesn't fit any preset but they still
   * want structured badges (multiple short tags) rather than a
   * single block of narrative text.
   *
   * At least one tag must be non-empty (the parser enforces this
   * and treats all-empty as `null`).
   */
  | {
      readonly kind: "tags";
      readonly customTags: readonly string[];
    };

// =============================================================================
// Authoring helpers (for the picker UI)
// =============================================================================

/**
 * What the picker UI emits to the form. This is the **authoring
 * input** — it can carry a preset, custom tags, a narrative
 * escape hatch, and the `includeTags` flag all simultaneously, so
 * the form can show the right controls and the parser can route
 * to the right `ModifierCondition` variant.
 *
 * Routing rules (implemented in `buildCondition`):
 *
 *   1. If `presetKey` is set → `preset` variant. `customTags` ride
 *      along on the preset. Narrative is dropped (the preset
 *      already carries the mechanic intent; see design notes).
 *
 *   2. Else if `includeTags` is true AND at least one custom tag
 *      is non-empty → `tags` variant. The author explicitly opted
 *      into "I want pills but no preset" mode.
 *
 *   3. Else if `narrative` (trimmed) is non-empty → `narrative`
 *      variant. Single block of text, no structured badges.
 *
 *   4. Else → `null` (no condition).
 *
 * The `includeTags` flag exists so the picker can show a checkbox
 * like "Show these as separate badges on the character sheet?" —
 * without it, the author can't distinguish between "I typed these
 * tags but they should just be narrative text" and "I want these
 * as separate pills." When false, customTags are folded into the
 * narrative text at render time.
 */
export interface ConditionAuthoring {
  /**
   * Selected categories the condition applies to. Empty array means
   * "no categories chosen" — the author may still carry customTags
   * or narrative. Multiple selections allowed.
   */
  readonly categories: readonly ConditionPresetCategory[];
  /**
   * User-authored pills, free-form text. Can be empty. Pills are
   * associated with the selected categories via the same shape
   * {category, label} so the picker can render them bucketed.
   */
  readonly customPills: readonly { category: ConditionPresetCategory; label: string }[];
  readonly narrative: string;
  /**
   * Author's choice: when no category is picked, should the
   * customPills render as separate badges (true) or be folded
   * into the narrative text (false)? Default false.
   *
   * Ignored when `categories` is non-empty (category path always
   * renders customPills as separate pills by definition).
   */
  readonly includeTags: boolean;
}

// =============================================================================
// Legacy / migration support
// =============================================================================

/**
 * The pre-v1 shape. Kept here so the migration function has a
 * single source of truth for the old type, and so the parser can
 * still accept old payloads (backwards compat for un-migrated DB
 * rows or in-flight client requests).
 *
 * Marked deprecated — internal-only, not exported from the
 * package barrel.
 *
 * @deprecated Use `ModifierCondition` from this file. This type
 * exists only for migration of pre-v1 data.
 */
export interface LegacyModifierCondition {
  readonly key: string;
  readonly operator: string;
  readonly value?: unknown;
}
