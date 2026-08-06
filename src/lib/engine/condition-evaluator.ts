/**
 * condition-evaluator.ts — Phase 8.I i2.6 (Mashu 2026-08-06)
 *
 * Runtime evaluator for v1 ModifierCondition shapes. The /atelier
 * form persists `condition` as one of four v1 variants
 * (preset, tags, compound, narrative) — only the first three are
 * auto-evaluated by the engine. Narrative conditions are
 * GM-triggered hints (the engine returns true and the GM sees
 * the text on the sheet).
 *
 * The evaluator takes:
 *   - the stored `ModifierCondition` (parsed from the DB or
 *     in-flight from the form), and
 *   - a `ConditionContext` describing the runtime state of the
 *     slotted character (and optionally the target / scene for
 *     cross-axis checks)
 *
 * It returns:
 *   - `true` if the condition passes (modifier fires)
 *   - `false` if the condition fails (modifier is filtered out)
 *
 * For predicates (`vitality_pct < 0.5`, `proficient_in(prowess)`,
 * `block_value > 5`) the evaluator reads the runtime context
 * directly. Predicate authoring is a Phase 5 UI concern — for
 * Phases 1-4 we write stored conditions by hand for the MVP
 * primitives (Broad Familiarity, Focused Presence, etc.).
 *
 * Custom variables (Block value, fortune points, anything the
 * player adds to the character sheet) are read from
 * `ctx.character.custom` / `ctx.target?.custom` / `ctx.scene?.custom`.
 * They are NOT in the DB — they're resolved at sheet-render time.
 */

import type { ModifierCondition } from "@/types/condition";
import { ALL_PRACTICES, ALL_ATTRIBUTES, type AttributeKey } from "@/types/modifier";
import type { PracticeKey } from "@/types/modifier";

// =============================================================================
// Runtime context
// =============================================================================

/**
 * The 10 canonical practice names. Used as keys for character state
 * (each value is the practice score, e.g. Prowess = 5 + PB bonus).
 */
export type PracticeState = Readonly<Record<PracticeKey, number>>;

/**
 * The 3 canonical attribute names.
 */
export type AttributeState = Readonly<{
  physical: number;
  mental: number;
  magical: number;
}>;

/**
 * The slotted character's runtime state. Read from the character
 * sheet at the moment of evaluation.
 */
export interface CharacterConditionState {
  /** Current HP. */
  readonly vitality: number;
  /** Max HP at the moment of evaluation. */
  readonly vitalityMax: number;
  /** Save DC after all modifiers. */
  readonly saveDc: number;
  /** Block value after all modifiers. */
  readonly blockValue: number;
  /** Per-attribute score (3 attrs). */
  readonly attributes: AttributeState;
  /** Per-practice score (10 practices). */
  readonly practices: PracticeState;
  /** Proficiency flags. Each entry is a practice name (one of
   *  10), an attribute name (one of 3), or a custom proficiency
   *  string (e.g. "painting", "thieves_tools"). The character
   *  gains a set membership when they slot a Proficiency primitive
   *  for that target, or via the planned extra-FAB layer on the
   *  character sheet (Phase 8.I i2.6 follow-on). */
  readonly proficiencies: ReadonlySet<string>;
  /** Boolean flags the player has set on the character (e.g.
   *  "prone", "stunned", "sick", "wounded"). These are managed
   *  via the planned extra-FAB layer on the character sheet
   *  (Phase 8.I i2.6 follow-on). */
  readonly flags: ReadonlySet<string>;
  /** User-defined variables. Resolved on the character sheet,
   *  not in the DB. Examples: `custom_fortune_points`,
   *  `custom_block_value`, `custom_kill_count`. */
  readonly custom: Readonly<Record<string, number | boolean>>;
}

/**
 * The target of an action / roll / attack. Optional — many
 * modifiers only need self-state. When present, this is the
 * entity being targeted.
 */
export interface TargetConditionState {
  /** Tags set on the target (e.g. "prone", "stunned",
   *  "flanking", "in_melee"). */
  readonly tags: ReadonlySet<string>;
  /** User-defined variables on the target. */
  readonly custom: Readonly<Record<string, number | boolean>>;
}

/**
 * The ambient scene state. Tags describe environmental conditions.
 */
export interface SceneConditionState {
  readonly tags: ReadonlySet<string>;
  readonly custom: Readonly<Record<string, number | boolean>>;
}

/**
 * Bundles all three axes. Pass only what the caller can provide.
 * Missing axes default to "always-true" (i.e. never block).
 */
export interface ConditionContext {
  readonly character: CharacterConditionState;
  readonly target?: TargetConditionState;
  readonly scene?: SceneConditionState;
  /**
   * Phase 8.I i2.6 — engine hint: which practice / attribute
   * is currently being resolved. Used by dynamic-preset
   * predicates like `actor:not_proficient` (the engine checks
   * proficiency against this practice without the author
   * needing to spell out `not_proficient_in(<practice>)` for
   * every primitive).
   *
   * Optional. When omitted, dynamic presets fail-closed.
   */
  readonly currentPractice?: PracticeKey | null;
  /** Same pattern for per-attribute walks. Reserved for future
   *  per-attribute modifier aggregation (Phase 8.I i2.6+). */
  readonly currentAttribute?: AttributeKey | null;
}

// =============================================================================
// Predicate variants — runtime checks the engine understands
// =============================================================================

/**
 * Comparison operators a predicate can use. Symmetric vs.
 * asymmetric operators are both supported — the engine reads
 * them as labeled (no commutative transform).
 */
export type PredicateOperator = "<" | "<=" | ">" | ">=" | "=" | "≠" | "between";

/**
 * A single runtime check the engine can evaluate. Stored in
 * the v1 `predicate` variant of ModifierCondition (added in
 * this phase).
 *
 * Examples:
 *   {kind:"stat", axis:"self", stat:"vitality_pct", op:"<", value:0.5}
 *   {kind:"stat", axis:"self", stat:"vitality", op:"<", value:10}
 *   {kind:"stat", axis:"self", stat:"block_value", op:">", value:5}
 *   {kind:"flag", axis:"self", flag:"proficient_in(prowess)"}
 *   {kind:"flag", axis:"self", flag:"not_proficient_in(fieldcraft)"}
 *   {kind:"flag", axis:"self", flag:"is_prone"}
 *   {kind:"tag", axis:"target", tag:"prone"}
 *   {kind:"tag", axis:"scene", tag:"dim"}
 *
 * The `axis` says which axis of the ConditionContext to read
 * (character / target / scene). The `kind` says which kind of
 * check (numeric comparison / boolean flag / descriptive tag).
 */
export type ConditionPredicate =
  | {
      readonly kind: "stat";
      readonly axis: "self" | "target" | "scene";
      /** Stat reference — see `ALL_STATS` for the canonical names. */
      readonly stat: string;
      readonly op: PredicateOperator;
      readonly value: number;
      /** For `between` only. */
      readonly valueHigh?: number;
    }
  | {
      readonly kind: "flag";
      readonly axis: "self" | "target" | "scene";
      readonly flag: string;
    }
  | {
      readonly kind: "tag";
      readonly axis: "self" | "target" | "scene";
      readonly tag: string;
    };

/**
 * Canonical stat names the engine recognizes. UI dropdowns can
 * use this list for the "Character stats" pill section.
 */
export const ALL_STATS = [
  // self-only
  "vitality",
  "vitality_pct",
  "vitality_max",
  "save_dc",
  "block_value",
  // self-only — attributes
  "physical",
  "mental",
  "magical",
  // self-only — practices
  "prowess",
  "finesse",
  "fieldcraft",
  "awareness",
  "reason",
  "knowledge",
  "influence",
  "mysticism",
  "communion",
  "intuition",
  // any axis — custom variables live here
] as const;

export type StatKey = (typeof ALL_STATS)[number];

/**
 * Canonical character flag names. The picker renders these as
 * clickable chips.
 */
export const ALL_FLAGS = [
  // self — proficiency
  "proficient_in(prowess)",
  "proficient_in(finesse)",
  "proficient_in(fieldcraft)",
  "proficient_in(awareness)",
  "proficient_in(reason)",
  "proficient_in(knowledge)",
  "proficient_in(influence)",
  "proficient_in(mysticism)",
  "proficient_in(communion)",
  "proficient_in(intuition)",
  "not_proficient_in(prowess)",
  "not_proficient_in(finesse)",
  "not_proficient_in(fieldcraft)",
  "not_proficient_in(awareness)",
  "not_proficient_in(reason)",
  "not_proficient_in(knowledge)",
  "not_proficient_in(influence)",
  "not_proficient_in(mysticism)",
  "not_proficient_in(communion)",
  "not_proficient_in(intuition)",
  // self — status
  "is_prone",
  "is_stunned",
  "is_bleeding",
  "is_frightened",
  "is_blinded",
  "is_charmed",
  "is_grappled",
  "is_restrained",
  "is_sick",
  "is_wounded",
  "is_damaged_last_round",
] as const;

// =============================================================================
// Engine entry points
// =============================================================================

/**
 * Evaluate a v1 condition against a runtime context.
 *
 * Returns `true` for `null` and `narrative` conditions (always-fire
 * safety). Returns `false` only when a predicate (stat / flag / tag
 * / compound) fails.
 *
 * Resolves predicates against the appropriate axis of the context.
 * If the axis is missing (e.g. self predicate but target is the only
 * axis provided), the predicate fails-closed (returns false).
 */
export function evaluateCondition(
  condition: ModifierCondition | null | undefined,
  ctx: ConditionContext,
): boolean {
  if (condition === null || condition === undefined) return true;
  switch (condition.kind) {
    case "preset":
      // Legacy preset keys like "actor-below-half-hp" — keep their
      // pre-i2.6 evaluator. The MVP doesn't add new preset keys;
      // new use cases use the predicate variant instead.
      return evaluatePreset(condition.presetKey, ctx);
    case "tags":
      // The compound variant auto-emits when pill + operator chains
      // exist, but plain `tags` rows still come through. Treat each
      // tag as a self-axis tag check — ALL must match (implicit AND).
      return evaluateTagsAsPillChain(condition.customTags, ctx);
    case "compound":
      return evaluateCompound(condition.tokens, ctx);
    case "narrative":
      // Narrative = GM-triggered hint. Never blocks.
      return true;
  }
}

// =============================================================================
// Preset evaluator (legacy keys)
// =============================================================================

function evaluatePreset(
  presetKey: string,
  ctx: ConditionContext,
): boolean {
  // Map legacy preset keys to runtime checks. All read character
  // state except `target-*` which need a target.
  switch (presetKey) {
    case "actor-below-half-hp":
    case "target-below-half-hp": {
      const axis = presetKey.startsWith("actor-") ? ctx.character : ctx.target;
      if (!axis) return false;
      // For actor: read character.vitality / character.vitalityMax
      if (presetKey.startsWith("actor-")) {
        return ctx.character.vitality / Math.max(1, ctx.character.vitalityMax) < 0.5;
      }
      // For target: read target.custom.hp_pct (target must
      // expose this via its custom map).
      const pct = Number(axis.custom["hp_pct"] ?? 1);
      return pct < 0.5;
    }
    case "actor-prone":
      return ctx.character.flags.has("is_prone");
    case "actor-stance":
      return ctx.character.flags.has("has_stance");
    case "actor-damaged-last-round":
      return ctx.character.flags.has("is_damaged_last_round");
    case "target-prone":
      return !!ctx.target?.tags.has("prone");
    case "target-grappled":
      return !!ctx.target?.tags.has("grappled");
    case "target-frightened":
      return !!ctx.target?.tags.has("frightened");
    case "target-stunned":
      return !!ctx.target?.tags.has("stunned");
    case "target-bleeding":
      return !!ctx.target?.tags.has("bleeding");
    case "target-has-cover":
      return !!ctx.target?.tags.has("has_cover");
    case "scene-dim":
      return !!ctx.scene?.tags.has("dim");
    case "scene-loud":
      return !!ctx.scene?.tags.has("loud");
    case "scene-has-obstacles":
      return !!ctx.scene?.tags.has("has_obstacles");
    case "scene-sacred":
      return !!ctx.scene?.tags.has("sacred");
    case "scene-hazardous":
      return !!ctx.scene?.tags.has("hazardous");
    default:
      // Unknown preset — fail-closed.
      return false;
  }
}

// =============================================================================
// Compound evaluator (pills + AND/OR operators)
// =============================================================================

/**
 * Evaluate a compound tokens array. Structure: [pill, op, pill, op, …, pill].
 * Returns the boolean value of the AND/OR chain.
 *
 * Each pill is either:
 *   - a `stat` predicate (encoded as `self:<stat> <op> <value>`)
 *   - a `flag` predicate (encoded as `self:<flag>` or `target:<flag>`)
 *   - a `tag` predicate (encoded as `target:<tag>` / `scene:<tag>`)
 *
 * For MVP the encoding reuses the same `<axis>:<label>` shape the
 * existing condition parser understands. Phase 5 will add a proper
 * UI for picking each predicate kind.
 */
function evaluateCompound(
  tokens: readonly string[],
  ctx: ConditionContext,
): boolean {
  if (tokens.length === 0) return true;
  // Evaluate each pill to a boolean.
  const pillResults: boolean[] = [];
  const opResults: ("AND" | "OR" | null)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (i % 2 === 0) {
      // pill slot
      pillResults.push(evaluatePillToken(t, ctx));
    } else {
      // operator slot
      opResults.push(t === "OR" ? "OR" : "AND");
    }
  }
  // Reduce left-associatively.
  let acc = pillResults[0]!;
  for (let i = 1; i < pillResults.length; i++) {
    const op = opResults[i - 1] ?? "AND";
    acc = op === "OR" ? acc || pillResults[i]! : acc && pillResults[i]!;
  }
  return acc;
}

/**
 * Evaluate a single `tags` shape as an implicit-AND pill chain.
 * Tags are read as `axis:label` strings (e.g. "actor:prone").
 */
function evaluateTagsAsPillChain(
  tags: readonly string[],
  ctx: ConditionContext,
): boolean {
  if (tags.length === 0) return true;
  return tags.every((t) => evaluatePillToken(t, ctx));
}

/**
 * Evaluate a single `<axis>:<payload>` pill token against the
 * appropriate runtime axis. The payload format depends on the
 * pill kind:
 *
 *   - "self:unconscious"            → character.flags.has("unconscious")
 *   - "self:proficient_in(prowess)"  → proficiencies.has("prowess")
 *   - "self:not_proficient"          → !proficiencies.has(currentPractice)
 *   - "self:stat|vitality|<|0.5"     → stat comparison
 *
 * The legacy axes are recognized ("actor" aliases to "self";
 * "target" reads target.tags; "scene" reads scene.tags). All
 * tag-style pills are read as descriptive tags.
 */
function evaluatePillToken(
  token: string,
  ctx: ConditionContext,
): boolean {
  const sep = token.indexOf(":");
  if (sep < 0) return false;
  const axis = token.slice(0, sep);
  const payload = token.slice(sep + 1);

  // Stat comparison path: payload starts with "stat|...".
  // (Encoded by the picker's buildCondition → serializeConditionPill.)
  if (payload.startsWith("stat|")) {
    if (axis === "target") {
      if (!ctx.target) return false;
      return evaluateStatTokenPayload(payload, {
        custom: ctx.target.custom,
      });
    }
    if (axis === "scene") {
      if (!ctx.scene) return false;
      return evaluateStatTokenPayload(payload, {
        custom: ctx.scene.custom,
      });
    }
    // self or actor
    return evaluateStatTokenPayload(payload, ctx.character);
  }

  // Standard pill — flag / proficiency / tag.
  switch (axis) {
    case "self":
      return checkSelfFlag(
        payload,
        ctx.character,
        ctx.currentPractice,
        ctx.currentAttribute,
      );
    case "actor":
      // Alias for self — backwards compat with v1 preset semantics.
      return checkSelfFlag(
        payload,
        ctx.character,
        ctx.currentPractice,
        ctx.currentAttribute,
      );
    case "target":
      return ctx.target?.tags.has(payload) ?? false;
    case "scene":
      return ctx.scene?.tags.has(payload) ?? false;
    default:
      return false;
  }
}

/**
 * Evaluate a stat-comparison pill payload against a stat source.
 * Payload shape: "stat|<statName>|<op>|<value>[|<valueHigh>]".
 * The "stat|" prefix has already been stripped by the caller.
 */
function evaluateStatTokenPayload(
  payload: string,
  source:
    | { custom: Readonly<Record<string, number | boolean>> }
    | CharacterConditionState,
): boolean {
  // Strip "stat|" prefix if not already done by caller.
  let body = payload.startsWith("stat|") ? payload.slice(5) : payload;
  // Parse [statName, op, value, valueHigh?].
  const parts = body.split("|");
  if (parts.length < 3) return false;
  const statName = parts[0]!;
  const op = parts[1]!;
  const v1 = Number(parts[2]);
  if (!Number.isFinite(v1)) return false;
  const v2 = parts[3] !== undefined ? Number(parts[3]) : v1;

  // Resolve the actual stat value.
  let actual: number | undefined;
  if ("vitality" in source || "practices" in source) {
    // It's a CharacterConditionState.
    actual = readCharacterStat(statName, source as CharacterConditionState);
  } else {
    const v = (source as { custom: Readonly<Record<string, number | boolean>> }).custom[statName];
    actual = typeof v === "number" ? v : undefined;
  }
  if (actual === undefined) return false;

  switch (op) {
    case "<": return actual < v1;
    case "<=": return actual <= v1;
    case ">": return actual > v1;
    case ">=": return actual >= v1;
    case "=": return actual === v1;
    case "!=": return actual !== v1;
    case "between": return actual >= v1 && actual <= v2;
    default: return false;
  }
}

/**
 * Resolve a self-axis flag against the character's flag set +
 * proficiency set. Returns true iff the named flag is set.
 *
 * Recognized flag patterns:
 *   - "proficient_in(<practice>)"    — character has that proficiency
 *   - "not_proficient_in(<practice>)" — character does NOT have it
 *   - "is_<status>"                  — character has that status
 *   - "has_<something>"              — character has that boolean
 */
function checkSelfFlag(
  label: string,
  character: CharacterConditionState,
  currentPractice: PracticeKey | null | undefined,
  currentAttribute: AttributeKey | null | undefined = null,
): boolean {
  // Grouped proficiency checks (Phase 8.I i2.6 — Mashu 2026-08-06).
  // `all_practices` / `all_saves` aggregate over every member of
  // the relevant axis. `all_practices` returns true iff the
  // character is/isn't proficient in EVERY practice; `all_saves`
  // does the same for saves (currently modeled as 3 attribute
  // saves — full save math comes in a later phase).
  if (label === "proficient_in(all_practices)") {
    return ALL_PRACTICES.every((p) => character.proficiencies.has(p));
  }
  if (label === "not_proficient_in(all_practices)") {
    return ALL_PRACTICES.every((p) => !character.proficiencies.has(p));
  }
  if (label === "proficient_in(all_saves)") {
    return ALL_ATTRIBUTES.every((a) => character.proficiencies.has(`save_${a}`));
  }
  if (label === "not_proficient_in(all_saves)") {
    return ALL_ATTRIBUTES.every((a) => !character.proficiencies.has(`save_${a}`));
  }
  if (label.startsWith("proficient_in(")) {
    const practice = label.slice("proficient_in(".length, -1);
    return character.proficiencies.has(practice);
  }
  if (label.startsWith("not_proficient_in(")) {
    const practice = label.slice("not_proficient_in(".length, -1);
    return !character.proficiencies.has(practice);
  }
  if (label.startsWith("proficient_in_attribute(")) {
    const attr = label.slice("proficient_in_attribute(".length, -1);
    if (attr === "any") {
      if (!currentAttribute) return false;
      return character.proficiencies.has(currentAttribute);
    }
    return character.proficiencies.has(attr);
  }
  if (label.startsWith("not_proficient_in_attribute(")) {
    const attr = label.slice("not_proficient_in_attribute(".length, -1);
    if (attr === "any") {
      if (!currentAttribute) return false;
      return !character.proficiencies.has(currentAttribute);
    }
    return !character.proficiencies.has(attr);
  }
  // Phase 8.I i2.6 (Mashu 2026-08-06): dynamic proficiency check.
  // Authors can write `actor:not_proficient` (no parens) and the
  // engine evaluates it against the practice currently being
  // rolled (currentPractice). Used by Broad Familiarity.
  if (label === "not_proficient") {
    if (!currentPractice) return false;
    return !character.proficiencies.has(currentPractice);
  }
  if (label === "proficient") {
    if (!currentPractice) return false;
    return character.proficiencies.has(currentPractice);
  }
  // Otherwise treat as a straight character flag.
  // Phase 8.I i2.7: the new atoms (combat_action, equipped:<key>,
  // damage_taken:<key>, etc.) flow through this path as flags.
  // The character sheet FAB layer will set/clear these flags at
  // appropriate events (combat round start, item equip, damage).
  return character.flags.has(label);
}

// =============================================================================
// Predicate evaluator (Phase 5 UI produces these)
// =============================================================================

/**
 * Evaluate a single predicate against a context. Public so the UI
 * (Phase 5) can preview "what would this condition return right
 * now?" in the picker.
 */
export function evaluatePredicate(
  predicate: ConditionPredicate,
  ctx: ConditionContext,
): boolean {
  switch (predicate.kind) {
    case "stat":
      return evaluateStatPredicate(predicate, ctx);
    case "flag":
      return evaluateFlagPredicate(predicate, ctx);
    case "tag":
      return evaluateTagPredicate(predicate, ctx);
  }
}

function evaluateStatPredicate(
  p: Extract<ConditionPredicate, { kind: "stat" }>,
  ctx: ConditionContext,
): boolean {
  const axis = resolveAxis(p.axis, ctx);
  if (!axis) return false;
  const actual = readStat(p.stat, axis);
  if (actual === undefined) return false;
  switch (p.op) {
    case "<":
      return actual < p.value;
    case "<=":
      return actual <= p.value;
    case ">":
      return actual > p.value;
    case ">=":
      return actual >= p.value;
    case "=":
      return actual === p.value;
    case "≠":
      return actual !== p.value;
    case "between": {
      const high = p.valueHigh ?? p.value;
      return actual >= p.value && actual <= high;
    }
  }
}

function evaluateFlagPredicate(
  p: Extract<ConditionPredicate, { kind: "flag" }>,
  ctx: ConditionContext,
): boolean {
  if (p.axis === "self") {
    return checkSelfFlag(
      p.flag,
      ctx.character,
      ctx.currentPractice,
      ctx.currentAttribute,
    );
  }
  if (p.axis === "target") {
    return ctx.target?.tags.has(p.flag) ?? false;
  }
  return ctx.scene?.tags.has(p.flag) ?? false;
}

function evaluateTagPredicate(
  p: Extract<ConditionPredicate, { kind: "tag" }>,
  ctx: ConditionContext,
): boolean {
  if (p.axis === "self") {
    return ctx.character.flags.has(p.tag);
  }
  if (p.axis === "target") {
    return ctx.target?.tags.has(p.tag) ?? false;
  }
  return ctx.scene?.tags.has(p.tag) ?? false;
}

// =============================================================================
// Context axis resolution + stat reading
// =============================================================================

type ResolvedAxis = {
  /** The character's stat map (or target/scene custom) for numeric reads. */
  readonly character?: CharacterConditionState;
  readonly target?: TargetConditionState;
  readonly scene?: SceneConditionState;
};

function resolveAxis(
  axis: "self" | "target" | "scene",
  ctx: ConditionContext,
): ResolvedAxis | null {
  if (axis === "self") return { character: ctx.character };
  if (axis === "target") return ctx.target ? { target: ctx.target } : null;
  if (axis === "scene") return ctx.scene ? { scene: ctx.scene } : null;
  return null;
}

/**
 * Read a stat value from an axis. Returns `undefined` when the
 * stat name isn't recognized on that axis.
 */
function readStat(
  stat: string,
  axis: ResolvedAxis,
): number | undefined {
  if (axis.character) {
    return readCharacterStat(stat, axis.character);
  }
  if (axis.target) {
    const v = axis.target.custom[stat];
    return typeof v === "number" ? v : undefined;
  }
  if (axis.scene) {
    const v = axis.scene.custom[stat];
    return typeof v === "number" ? v : undefined;
  }
  return undefined;
}

function readCharacterStat(
  stat: string,
  character: CharacterConditionState,
): number | undefined {
  switch (stat) {
    case "vitality":
      return character.vitality;
    case "vitality_max":
      return character.vitalityMax;
    case "vitality_pct":
      return character.vitality / Math.max(1, character.vitalityMax);
    case "save_dc":
      return character.saveDc;
    case "block_value":
      return character.blockValue;
    case "physical":
    case "mental":
    case "magical":
      return character.attributes[stat];
    case "prowess":
    case "finesse":
    case "fieldcraft":
    case "awareness":
    case "reason":
    case "knowledge":
    case "influence":
    case "mysticism":
    case "communion":
    case "intuition":
      return character.practices[stat];
    case "attack_bonus":
      // MVP alias — the engine math is the same as save_dc until the
      // proper attack_roll math is wired in a later phase.
      return character.saveDc;
    case "physical_save":
    case "mental_save":
    case "magical_save": {
      // MVP: save DC = 8 + proficiency bonus. The full save math
      // (8 + attribute + prof + save modifiers) lives in
      // aggregateCharacterSheet's defense_dc walk; we don't have
      // that wired here, so we approximate with 8 + PB.
      return 8 + Math.floor((character.vitalityMax + 30) / 20);
    }
    case "any_save":
      return Math.max(
        character.attributes.physical,
        character.attributes.mental,
        character.attributes.magical,
      );
    case "all_saves":
      return Math.min(
        character.attributes.physical,
        character.attributes.mental,
        character.attributes.magical,
      );
    case "any_attribute":
      return Math.max(
        character.attributes.physical,
        character.attributes.mental,
        character.attributes.magical,
      );
    case "all_attributes":
      return Math.min(
        character.attributes.physical,
        character.attributes.mental,
        character.attributes.magical,
      );
    case "any_practice":
      return Math.max(...Object.values(character.practices));
    case "all_practices":
      return Math.min(...Object.values(character.practices));

    // Phase 8.I i2.7 — new atoms from the canonical PDFs.
    // These resolve against the character's custom variable map
    // for now (the engine math for these targets isn't wired yet).
    // The character sheet FAB layer will populate character.custom
    // with the right values when those targets get real math.

    case "speed":
      // Encumbrance / Combat Rhythm — per locomotion type. MVP
      // alias for a generic speed number; full per-locomotion
      // math comes when the FAB layer is wired.
      return typeof character.custom["speed"] === "number"
        ? character.custom["speed"]
        : 30;
    case "carry_capacity":
      return typeof character.custom["carry_capacity"] === "number"
        ? character.custom["carry_capacity"]
        : 40;
    case "load":
      return typeof character.custom["load"] === "number"
        ? character.custom["load"]
        : 0;
    case "complexity":
      return typeof character.custom["complexity"] === "number"
        ? character.custom["complexity"]
        : 0;
    case "upkeep_cost":
      // Generic upkeep — read from custom. For per-capability
      // upkeep (upkeep_cost:fire_shield), the engine checks
      // character.custom["upkeep_cost:fire_shield"] via the
      // default fallthrough.
      return typeof character.custom["upkeep_cost"] === "number"
        ? character.custom["upkeep_cost"]
        : 0;

    // Tag enums — for stat comparisons, we map the enum value
    // to a numeric tier so comparisons like `actor:size == LARGE`
    // (encoded as `actor:stat|size|==|4`) work. Tiers ascend
    // from TINY (0) to GARGANTUAN (5).
    case "size": {
      const tier: Readonly<Record<string, number>> = {
        TINY: 0,
        SMALL: 1,
        MEDIUM: 2,
        LARGE: 3,
        HUGE: 4,
        GARGANTUAN: 5,
      };
      const v = character.custom["size"];
      if (typeof v === "number") return v;
      return 2; // default Medium
    }
    case "source_type": {
      // Map enum to numeric tier (physical=1, magical=2, psychic=3).
      const v = character.custom["source_type"];
      if (typeof v === "number") return v;
      return 1;
    }

    default: {
      // Custom variable — resolved on the character sheet, not the DB.
      // Covers: equip_slot:<key>, damage_type:<key>,
      // maintained_capability:<key>, upkeep_cost:<key>,
      // combat_action (boolean — handled separately as flag).
      const v = character.custom[stat];
      return typeof v === "number" ? v : undefined;
    }
  }
}
