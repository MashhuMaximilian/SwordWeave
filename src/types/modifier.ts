/**
 * Phase 7.5 — Modifier operation taxonomy + value-token system.
 *
 * Three things:
 *
 *   1. `ModifierOperation` (11 ops) — extends the existing union in
 *      `@/types/swordweave.ts` by adding `bias`. The original 10
 *      stay unchanged for backwards compat with existing rows.
 *
 *   2. `OP_SPECS` + `OP_VALUE_TYPE_MATRIX` — the chirality model.
 *      Each op declares its allowed value types, mirror behavior,
 *      and whether it's mirrorable at all. The form enforces
 *      these.
 *
 *   3. `ValueToken` discriminated union — the runtime-resolvable
 *      value system. Replaces the loose `value: JsonValue` on
 *      `HardModifier` with a structured token list. Each token
 *      has a `kind` and kind-specific payload; the character
 *      sheet engine resolves each token at slot time.
 *
 * Backwards compatibility:
 *   - Existing modifier rows with `value: number` still parse via
 *     `parseValueField` which auto-coerces plain numbers into
 *     `{kind: "number", value}` tokens.
 *   - The legacy `JsonValue` field is preserved as
 *     `legacyValue?: JsonValue` for old rows that haven't migrated
 *     yet. New writes use `tokens: ValueToken[]`.
 *   - Existing modifiers with `value: "grappled"` etc. parse as
 *     `{kind: "behavior", name: "grappled"}` tokens.
 */

// =============================================================================
// Operation taxonomy
// =============================================================================

/**
 * Phase 7.5 — extended from the original 10 ops in
 * `@/types/swordweave.ts`. Added `bias` (advantage/disadvantage).
 *
 * The 10 original ops are preserved verbatim for backwards compat
 * with existing rows in the DB.
 */
export type ModifierOperation =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "set"
  | "min"
  | "max"
  | "grant"
  | "revoke"
  | "toggle"
  | "bias";

/**
 * Value type — the shape that the Value field is constrained to
 * for a given operation.
 *
 * - `number`     — literal magnitude (`2`, `-1`, `3.5`).
 * - `text`       — free-form string (`"60 ft"`, `"silenced"`).
 *                  Used for behaviors and keywords.
 * - `dice`       — dice expression (`"1d4"`, `"2d6+3"`).
 * - `boolean`    — `true` / `false` (used by Toggle).
 * - `bias-value` — `"advantage"` | `"disadvantage"` (used by Bias).
 * - `token`      — runtime-resolvable token
 *                  (`physical`, `awareness`, `pb`, etc.).
 */
export type ValueType = "number" | "text" | "dice" | "boolean" | "bias-value" | "token";

/**
 * Allowed value types per operation. The form's Value Type
 * dropdown filters to only the allowed types when the user picks
 * an op.
 */
export const OP_VALUE_TYPE_MATRIX: Readonly<
  Record<ModifierOperation, readonly ValueType[]>
> = {
  add:      ["number", "token"],
  subtract: ["number", "token"],
  multiply: ["number", "token"],
  divide:   ["number", "token"],
  set:      ["number", "text", "dice", "token"],
  min:      ["number", "token"],
  max:      ["number", "token"],
  grant:    ["text", "dice"],
  revoke:   ["text", "dice"],
  toggle:   ["boolean"],
  bias:     ["bias-value"],
};

/**
 * Per-operation chirality + mirror behavior spec.
 *
 * The mirrorability rule is `(op × value_type) joint`:
 *   - All ops EXCEPT `set` are mirrorable when paired with their
 *     allowed value types.
 *   - `set` is permission-locked: never mirrorable, regardless of
 *     value type. There is no "set to negative X" or "set to
 *     inverse of X" that's a meaningful mirror.
 *
 * Mirror behavior:
 *   - Add ↔ Subtract: flip sign.
 *   - Multiply ↔ Divide: invert value (reciprocal).
 *   - Min ↔ Max: flip op, value stays.
 *   - Grant ↔ Revoke: flip op, value stays.
 *   - Toggle: flip value (T→F, F→T). Same op.
 *   - Bias: flip value ("advantage" ↔ "disadvantage"). Same op.
 */
export interface ModifierOpSpec {
  readonly kind: ModifierOperation;
  readonly label: string;
  readonly mirrorable: boolean;
  /** The op that mirror swaps to. Same op for Toggle / Bias. */
  readonly mirrorOp: ModifierOperation | null;
  /** Whether the mirror op flips the value's sign (Add ↔ Subtract). */
  readonly mirrorFlipsSign: boolean;
  /** Whether the mirror inverts the value to its reciprocal (× ↔ ÷). */
  readonly mirrorInvertsValue: boolean;
  /** Whether the mirror flips a boolean or bias-value (Toggle / Bias). */
  readonly mirrorFlipsValue: boolean;
}

export const OP_SPECS: Readonly<Record<ModifierOperation, ModifierOpSpec>> = {
  add: {
    kind: "add",
    label: "Add",
    mirrorable: true,
    mirrorOp: "subtract",
    mirrorFlipsSign: true,
    mirrorInvertsValue: false,
    mirrorFlipsValue: false,
  },
  subtract: {
    kind: "subtract",
    label: "Subtract",
    mirrorable: true,
    mirrorOp: "add",
    mirrorFlipsSign: true,
    mirrorInvertsValue: false,
    mirrorFlipsValue: false,
  },
  multiply: {
    kind: "multiply",
    label: "Multiply",
    mirrorable: true,
    mirrorOp: "divide",
    mirrorFlipsSign: false,
    mirrorInvertsValue: true,
    mirrorFlipsValue: false,
  },
  divide: {
    kind: "divide",
    label: "Divide",
    mirrorable: true,
    mirrorOp: "multiply",
    mirrorFlipsSign: false,
    mirrorInvertsValue: true,
    mirrorFlipsValue: false,
  },
  set: {
    kind: "set",
    label: "Set To",
    mirrorable: false,
    mirrorOp: null,
    mirrorFlipsSign: false,
    mirrorInvertsValue: false,
    mirrorFlipsValue: false,
  },
  min: {
    kind: "min",
    label: "Minimum",
    mirrorable: true,
    mirrorOp: "max",
    mirrorFlipsSign: false,
    mirrorInvertsValue: false,
    mirrorFlipsValue: false,
  },
  max: {
    kind: "max",
    label: "Maximum",
    mirrorable: true,
    mirrorOp: "min",
    mirrorFlipsSign: false,
    mirrorInvertsValue: false,
    mirrorFlipsValue: false,
  },
  grant: {
    kind: "grant",
    label: "Grant",
    mirrorable: true,
    mirrorOp: "revoke",
    mirrorFlipsSign: false,
    mirrorInvertsValue: false,
    mirrorFlipsValue: false,
  },
  revoke: {
    kind: "revoke",
    label: "Revoke",
    mirrorable: true,
    mirrorOp: "grant",
    mirrorFlipsSign: false,
    mirrorInvertsValue: false,
    mirrorFlipsValue: false,
  },
  toggle: {
    kind: "toggle",
    label: "Toggle",
    mirrorable: true,
    mirrorOp: "toggle",
    mirrorFlipsSign: false,
    mirrorInvertsValue: false,
    mirrorFlipsValue: true,
  },
  bias: {
    kind: "bias",
    label: "Bias",
    mirrorable: true,
    mirrorOp: "bias",
    mirrorFlipsSign: false,
    mirrorInvertsValue: false,
    mirrorFlipsValue: true,
  },
};

/**
 * Apply mirror to a (op, value) pair. Returns the mirrored op and
 * mirrored value. Pure function — used by the form's Mirror
 * toggle and by tests.
 */
export function applyMirror(
  op: ModifierOperation,
  value: ModifierValue,
): { readonly op: ModifierOperation; readonly value: ModifierValue } {
  const spec = OP_SPECS[op];
  if (!spec.mirrorable || spec.mirrorOp === null) {
    throw new Error(
      `applyMirror: operation '${op}' is not mirrorable (permission-locked).`,
    );
  }
  const nextOp = spec.mirrorOp;
  let nextValue: ModifierValue = value;
  if (spec.mirrorFlipsSign && typeof value === "number") {
    nextValue = -value;
  } else if (
    spec.mirrorInvertsValue &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value !== 0
  ) {
    nextValue = 1 / value;
  } else if (spec.mirrorFlipsValue) {
    if (value === true) nextValue = false;
    else if (value === false) nextValue = true;
    else if (value === "advantage") nextValue = "disadvantage";
    else if (value === "disadvantage") nextValue = "advantage";
  }
  return { op: nextOp, value: nextValue };
}

/**
 * The shape of a single Value field entry. The form's chip-stack
 * holds an array of these. Numbers, dice, text, booleans,
 * bias-values, and tokens all fit in this union.
 */
export type ModifierValue =
  | number
  | string
  | boolean
  | "advantage"
  | "disadvantage"
  | ValueToken;

// =============================================================================
// Value tokens — runtime-resolvable references
// =============================================================================

/**
 * Phase 7.5 — runtime-resolvable value tokens.
 *
 * Each token is a structured reference that the character sheet
 * engine resolves at slot time. The canonical vocabulary:
 *
 *   - 3 attributes:  physical, mental, magic
 *   - 10 practices:  awareness, fieldcraft, influence, reason,
 *                    vitality, lore, magic, combat, movement,
 *                    social (TBD from canon — see Open Question)
 *   - 3 derived:     pb, pb_half, level
 *
 * Custom tokens: open-ended. Author types any name and it
 * becomes a behavior token at runtime.
 */
export type ValueToken =
  | { readonly kind: "attribute"; readonly attribute: AttributeKey }
  | { readonly kind: "practice"; readonly practice: PracticeKey }
  | { readonly kind: "derived"; readonly which: "pb" | "pb_half" | "level" }
  | { readonly kind: "behavior"; readonly name: string }
  | { readonly kind: "dice"; readonly expression: string }
  | { readonly kind: "number"; readonly value: number };

/**
 * The 10 canonical Practices. Names TBD against the Notion canon
 * (page 37eed8479ccd813dab39dd57511a0c48 — "🎲 DM Quick Cost
 * Cheat Sheet" / Practice/skill page). Phase 7.5 uses these
 * defaults; Phase 8 reconciles against the canon.
 */
export type PracticeKey =
  | "awareness"
  | "fieldcraft"
  | "influence"
  | "reason"
  | "vitality"
  | "lore"
  | "magic"
  | "combat"
  | "movement"
  | "social";

export const ALL_PRACTICES: readonly PracticeKey[] = [
  "awareness",
  "fieldcraft",
  "influence",
  "reason",
  "vitality",
  "lore",
  "magic",
  "combat",
  "movement",
  "social",
];

/**
 * The 3 canonical attributes per the BU Market canon. The third
 * is canonically "Magic/Abstract" — we use the kebab form
 * `"magic-abstract"` for the token to disambiguate from the
 * `"magic"` Practice (which exists in `ALL_PRACTICES`).
 */
export const ALL_ATTRIBUTES = ["physical", "mental", "magic-abstract"] as const;

/**
 * Re-export the underlying string union as `"physical" | "mental"
 * | "magic-abstract"` for use in the `ValueToken.attribute` field.
 */
export type AttributeKey = (typeof ALL_ATTRIBUTES)[number];
export const ALL_DERIVED = ["pb", "pb_half", "level"] as const;

/**
 * Canonical dice sizes (per the BU Market canon's Intensity
 * Progression table). Quick-pick for the form's dice chip.
 */
export const CANONICAL_DICE = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20"] as const;

/**
 * Canonical Bias values for the Bias op's value field.
 */
export const BIAS_VALUES = ["advantage", "disadvantage"] as const;

/**
 * Heuristic to detect whether a string looks like a dice
 * expression. Accepts canonical (`1d4`) and compound (`2d6+3`,
 * `3d8-1`) forms.
 */
export function isDiceExpression(s: string): boolean {
  return /^\d+d\d+([+-]\d+)?$/i.test(s);
}

/**
 * Heuristic to detect whether a string looks like a single-word
 * behavior token. Lowercase letters, digits, underscores, hyphens.
 * Multi-word strings (with spaces) are NOT bare behaviors — they
 * need the `behavior:` prefix or they become text.
 */
export function isBehaviorLike(s: string): boolean {
  return /^[a-z][a-z0-9_-]*$/i.test(s);
}

// =============================================================================
// Value field parser — auto-coerces raw inputs into ValueToken[]
// =============================================================================

/**
 * Parse a raw value field (number, string, boolean, or array of
 * those) into a structured ValueToken[].
 *
 * Auto-coercion rules (Phase 7.5):
 *   - number → `{kind: "number", value}`.
 *   - boolean → kept as raw boolean (used by Toggle).
 *   - "advantage" / "disadvantage" → kept as bias-value string.
 *   - Dice expression ("1d4", "2d6+3") → `{kind: "dice"}`.
 *   - "behavior:NAME" → `{kind: "behavior", name: "NAME"}`.
 *   - "physical" | "mental" | "magic" → `{kind: "attribute"}`.
 *   - Practice keys → `{kind: "practice"}`.
 *   - "pb" | "pb_half" | "level" → `{kind: "derived"}`.
 *   - Bare single-word string → `{kind: "behavior", name}`.
 *   - Multi-word / symbolic text → `{kind: "behavior", name}`
 *     (treated as a custom behavior with the whole string as
 *     the name).
 *
 * Returns an empty array for `null`/`undefined`.
 */
export function parseValueField(raw: unknown): ValueToken[] {
  if (raw === null || raw === undefined) return [];
  // If it's already a structured array of tokens, pass through.
  if (Array.isArray(raw) && raw.every((r) => isTokenLike(r))) {
    return raw as ValueToken[];
  }
  const inputs = Array.isArray(raw) ? raw : [raw];
  const tokens: ValueToken[] = [];
  for (const item of inputs) {
    const coerced = coerceSingleValue(item);
    if (coerced !== null) tokens.push(coerced);
  }
  return tokens;
}

function isTokenLike(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj["kind"] === "string" &&
    [
      "attribute",
      "practice",
      "derived",
      "behavior",
      "dice",
      "number",
    ].includes(obj["kind"])
  );
}

function coerceSingleValue(raw: unknown): ValueToken | null {
  if (typeof raw === "number") return { kind: "number", value: raw };
  if (typeof raw === "boolean") {
    // Toggle's boolean value — wrap as a fake "token" that holds
    // the boolean. We don't have a boolean-token kind, so we
    // store as `{kind: "behavior", name: "true"|"false"}` to fit
    // the token shape. Toggle-specific parsing handles this.
    return { kind: "behavior", name: raw ? "true" : "false" };
  }
  if (typeof raw !== "string") return null;
  if (raw === "advantage" || raw === "disadvantage") {
    return { kind: "behavior", name: raw };
  }
  if (isDiceExpression(raw)) {
    return { kind: "dice", expression: raw };
  }
  if (raw.startsWith("behavior:")) {
    const name = raw.slice("behavior:".length).trim();
    if (name.length > 0) return { kind: "behavior", name };
    return null;
  }
  if (isBehaviorLike(raw)) {
    if ((ALL_ATTRIBUTES as readonly string[]).includes(raw)) {
      return { kind: "attribute", attribute: raw as AttributeKey };
    }
    if ((ALL_DERIVED as readonly string[]).includes(raw)) {
      return { kind: "derived", which: raw as "pb" | "pb_half" | "level" };
    }
    if ((ALL_PRACTICES as readonly string[]).includes(raw)) {
      return { kind: "practice", practice: raw as PracticeKey };
    }
    // Bare single-word text → behavior token.
    return { kind: "behavior", name: raw };
  }
  // Multi-word / symbolic text → behavior token with the whole
  // string as the name.
  return { kind: "behavior", name: raw };
}

/**
 * Serialize a ValueToken[] back to a flat array of raw values
 * for storage. Each token becomes its canonical raw form.
 */
export function serializeValueField(tokens: readonly ValueToken[]): unknown[] {
  return tokens.map(serializeSingleToken);
}

function serializeSingleToken(token: ValueToken): unknown {
  switch (token.kind) {
    case "attribute": return token.attribute;
    case "practice": return token.practice;
    case "derived": return token.which;
    case "behavior": return `behavior:${token.name}`;
    case "dice": return token.expression;
    case "number": return token.value;
  }
}

/**
 * Human-readable label for a token. Used in the form's chip-stack
 * and the character sheet's preview.
 */
export function tokenLabel(token: ValueToken): string {
  switch (token.kind) {
    case "attribute": return token.attribute;
    case "practice": return token.practice;
    case "derived":
      if (token.which === "pb_half") return "PB/2";
      return token.which.toUpperCase();
    case "behavior": return token.name;
    case "dice": return token.expression;
    case "number": return String(token.value);
  }
}

/**
 * All canonical token kinds (excluding "behavior" which is
 * user-extensible). Used for the form's autocomplete suggestions.
 */
export const SUGGESTED_TOKENS: readonly ValueToken[] = [
  ...ALL_ATTRIBUTES.map(
    (a): ValueToken => ({ kind: "attribute", attribute: a }),
  ),
  ...ALL_PRACTICES.map(
    (p): ValueToken => ({ kind: "practice", practice: p }),
  ),
  ...ALL_DERIVED.map(
    (d): ValueToken => ({ kind: "derived", which: d }),
  ),
  ...CANONICAL_DICE.map(
    (d): ValueToken => ({ kind: "dice", expression: d }),
  ),
];

// =============================================================================
// Modifier spec — full mirror of HardModifier with token-based value
// =============================================================================

/**
 * Phase 7.5 — extended modifier spec. The existing `HardModifier`
 * in `@/types/swordweave.ts` keeps the legacy `value: JsonValue`
 * field for backwards compat. New writes should use
 * `Phase75HardModifier` with `tokens: ValueToken[]`.
 *
 * The two shapes are interchangeable for serialization — old rows
 * parse their `value` field via `parseValueField` to migrate to
 * the new token shape on the next save.
 */
export interface Phase75HardModifier {
  readonly kind: "modify";
  readonly target: ModifierTarget | BehaviorTarget;
  readonly operation: ModifierOperation;
  readonly tokens: readonly ValueToken[];
  /** True if the primitive carrying this modifier is mirrorable.
   *  Derived from `OP_SPECS[operation].mirrorable` but stored
   *  explicitly for indexability. */
  readonly isMirrorable: boolean;
  readonly condition?: import("./condition").ModifierCondition | import("./condition").LegacyModifierCondition;
  readonly stacking?: ModifierStackingMode;
  readonly metadata?: Record<string, import("./swordweave").JsonValue>;
}

import type { ModifierTarget, ModifierStackingMode } from "./swordweave";
import type { LegacyModifierCondition } from "./condition";

/**
 * Behavior target — a free-form engine axis that the author
 * names. Stored as `"behavior:<name>"` so it's distinguishable
 * from the canonical target enums.
 *
 * Examples:
 *   - `"behavior:darkvision"` — primitive modifies darkvision.
 *   - `"behavior:mana_pool"` — primitive modifies mana pool.
 */
export type BehaviorTarget = `behavior:${string}`;

/**
 * Extract the behavior name from a `BehaviorTarget` string.
 * Returns `null` if the string isn't a valid behavior target.
 */
export function parseBehaviorTarget(target: string): string | null {
  if (!target.startsWith("behavior:")) return null;
  const name = target.slice("behavior:".length).trim();
  return name.length > 0 ? name : null;
}

/**
 * Format a behavior name into a `BehaviorTarget` string.
 */
export function formatBehaviorTarget(name: string): BehaviorTarget {
  return `behavior:${name}`;
}

/**
 * The "What changes" axis enumeration. Canonical options plus
 * `behavior:<name>` escape hatch.
 *
 * Stored on each modifier as `target` — canonical targets use the
 * `ModifierTarget` union, free-form behaviors use the
 * `BehaviorTarget` template literal.
 */
export type WhatChangesAxis =
  | "attribute"
  | "practice"
  | "action-roll"
  | "vitality"
  | "defense"
  | "movement"
  | "trigger-hook"
  | "state-tag"
  | "behavior";

export const CANONICAL_AXES: readonly WhatChangesAxis[] = [
  "attribute",
  "practice",
  "action-roll",
  "vitality",
  "defense",
  "movement",
  "trigger-hook",
  "state-tag",
  "behavior",
];

/**
 * Map a `WhatChangesAxis` to its canonical ModifierTarget
 * prefix. Used by the form when axis = "attribute" or "practice"
 * to narrow the target dropdown.
 */
export function defaultTargetsForAxis(
  axis: WhatChangesAxis,
): readonly ModifierTarget[] | "behavior" | "free" {
  switch (axis) {
    case "attribute":
      return [
        "character.attribute.physical",
        "character.attribute.mental",
        "character.attribute.magical",
      ] as const;
    case "practice":
      return ["character.skill"] as const;
    case "action-roll":
      return ["action.roll"] as const;
    case "vitality":
      return ["character.maxVitality", "character.currentVitality"] as const;
    case "defense":
      return [
        "character.defense.physicalDc",
        "character.defense.mentalDc",
        "character.defense.magicalDc",
      ] as const;
    case "movement":
      return [
        "character.movement.land",
        "character.movement.fly",
        "character.movement.swim",
      ] as const;
    case "trigger-hook":
    case "state-tag":
      return "free";
    case "behavior":
      return "behavior";
  }
}

/**
 * Re-export for ergonomic imports elsewhere.
 */
export type { ModifierTarget, ModifierStackingMode };