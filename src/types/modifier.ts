/**
 * Phase 7.5 v3 — Final modifier operation taxonomy + value-token
 * system.
 *
 * Three things:
 *
 *   1. `ModifierOperation` (9 ops) — the final vocabulary after
 *      removing `toggle` and `bias` from v2.
 *
 *   2. `OP_SPECS` + `OP_VALUE_TYPE_MATRIX` — the constraint
 *      matrix. Each op declares its allowed value types and
 *      mirror behavior (used by Phase 8 capability/affect layer;
 *      mirror logic is no longer in the primitive form).
 *
 *   3. `ValueToken` discriminated union — the runtime-resolvable
 *      value system. Each token has a `kind` and kind-specific
 *      payload; the character sheet engine resolves each token
 *      at slot time.
 *
 * Backwards compatibility:
 *   - Existing rows with `operation: "toggle"` or
 *     `operation: "bias"` are migrated via `migrateOperation()`.
 *   - Existing modifier rows with `value: number` still parse via
 *     `parseValueField` which auto-coerces plain numbers into
 *     `{kind: "number", value}` tokens.
 *   - Existing modifiers with `value: "grappled"` etc. parse as
 *     `{kind: "behavior", name: "grappled"}` tokens.
 */

// =============================================================================
// Operation taxonomy
// =============================================================================

/**
 * Phase 7.5 v3 — the final 9 ops. The original 10 ops from
 * `@/types/swordweave.ts` had `toggle` and `bias` added in v1/v2.
 * Both are removed in v3:
 *
 *   - `toggle` was redundant with `set` (set to true/false).
 *   - `bias` was replaced by `grant`/`revoke` on the canonical
 *     `behavior:advantage` and `behavior:disadvantage` chips.
 *
 * Backwards compat: existing rows in the DB with `operation:
 * "toggle"` or `operation: "bias"` are migrated to `set` and
 * `grant` respectively via `migrateOperation()`.
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
  | "revoke";

/**
 * Migrate legacy op strings to v3.
 *
 * - "toggle" → "set" (with value coerced to "true"/"false")
 * - "bias"   → "grant" (with value coerced to
 *               "behavior:advantage" or "behavior:disadvantage")
 */
export function migrateOperation(
  legacyOp: string,
  legacyValue: unknown,
): { op: ModifierOperation; value: string } {
  if (legacyOp === "toggle") {
    const v = String(legacyValue ?? "true").toLowerCase();
    return { op: "set", value: v === "false" ? "false" : "true" };
  }
  if (legacyOp === "bias") {
    const v = String(legacyValue ?? "advantage").toLowerCase();
    return {
      op: "grant",
      value: v === "disadvantage" ? "disadvantage" : "advantage",
    };
  }
  return { op: legacyOp as ModifierOperation, value: String(legacyValue ?? "") };
}

/**
 * Value type — the shape that the Value field is constrained to
 * for a given operation.
 *
 * Phase 7.5 v3: 4 value types. `bias-value` is gone (bias op
 * is gone too).
 *
 * - `number`   — int/float literal OR a runtime token
 *                (`+physical`, `+awareness`, `+PB`). Both
 *                resolve to numbers on the character sheet.
 * - `text`     — free text OR custom pills (custom behaviors
 *                the author names — `darkvision`, `mana_pool`,
 *                etc.) OR behavior tokens that resolve to text
 *                values.
 * - `dice`     — dice expressions only (`1d4`, `2d6+3`, `20d8`,
 *                custom).
 * - `boolean`  — `true` / `false`.
 *
 * The runtime token resolution (Phase 8) replaces tokens with
 * character-sheet values. Numbers resolve to numbers; text
 * tokens resolve to whatever the character has for that behavior;
 * dice expressions are rolled.
 */
export type ValueType =
  | "number"
  | "text"
  | "dice"
  | "boolean"
  // Phase 7.5 v4: equation Value Type. Author builds an
  // arithmetic expression using `Operand[]` (see OPERAND).
  // Combines numbers, runtime tokens, dice, and tag-style
  // keywords. Resolved at slot time by the engine.
  | "equation";

/**
 * Allowed value types per operation (Phase 7.5 v3).
 *
 * The form's Value Type dropdown filters to only the allowed
 * types when the user picks an op.
 */
export const OP_VALUE_TYPE_MATRIX: Readonly<
  Record<ModifierOperation, readonly ValueType[]>
> = {
  // Phase 7.5 v4: every op accepts "equation" — equations
  // resolve to a number/dice/text/keyword combination that's
  // valid for the op's semantics.
  //
  // Phase 7.5 v4-rev: min/max also accept "dice" so authors
  // can write "min 1d6 damage" or "max 2d10 healing" — useful
  // for capped random ranges. The dice type carries just the
  // die type (e.g. d6, d10); the count is decided by scaling
  // at runtime.
  add:      ["number", "dice", "equation"],
  subtract: ["number", "dice", "equation"],
  multiply: ["number", "dice", "equation"],
  divide:   ["number", "dice", "equation"],
  set:      ["number", "text", "dice", "boolean", "equation"],
  min:      ["number", "text", "dice", "equation"],
  max:      ["number", "text", "dice", "equation"],
  grant:    ["number", "text", "dice", "equation"],
  revoke:   ["number", "text", "dice", "equation"],
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
 *   - Set To: NOT mirrorable (permission-locked).
 *
 * Note: Toggle and Bias are gone in v3. Set To handles boolean
 * values. Grant/Revoke on behavior:advantage / behavior:disadvantage
 * chips replaces Bias.
 */
export interface ModifierOpSpec {
  readonly kind: ModifierOperation;
  readonly label: string;
  readonly mirrorable: boolean;
  /** The op that mirror swaps to. Null for non-mirrorable ops (Set To). */
  readonly mirrorOp: ModifierOperation | null;
  /** Whether the mirror op flips the value's sign (Add ↔ Subtract). */
  readonly mirrorFlipsSign: boolean;
  /** Whether the mirror inverts the value to its reciprocal (× ↔ ÷). */
  readonly mirrorInvertsValue: boolean;
  /**
   * Whether the mirror flips a boolean value. Used by the
   * capability/affect layer (Phase 8) when the parent capability
   * is invoked in a mirrored context. Not used by the primitive
   * form itself (mirroring is decided by the caller).
   */
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
    // Note: bias-value flipping (advantage/disadvantage) was
    // removed in v3 since the bias op itself was removed.
    // Behavior tokens can be flipped by re-authoring or via
    // Phase 8 capability/affect mirror logic.
  }
  return { op: nextOp, value: nextValue };
}

/**
 * The shape of a single Value field entry. The form's chip-stack
 * holds an array of these. Numbers, dice, text, booleans, and
 * tokens all fit in this union. (Bias-value removed in v3 since
 * the bias op is gone — advantage/disadvantage are now just
 * behavior tokens.)
 */
export type ModifierValue =
  | number
  | string
  | boolean
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
  | { readonly kind: "number"; readonly value: number }
  // Phase 7.5 v4: keyword operand. Tag-style text attached to an
  // expression (e.g. "fire" on a damage modifier). Not arithmetic —
  // it tags the modifier with a category. The engine reads
  // keyword operands as labels when resolving against typed
  // targets (damage output, defense type, etc.).
  | { readonly kind: "keyword"; readonly text: string }
  // Phase 7.5 v4: deferred runtime reference. The author types a
  // name (e.g. "blockValue") that doesn't currently exist as a
  // canonical token but the engine will resolve at slot time
  // against the character sheet (e.g. "the current block value
  // from this character's equipped shield"). The parser emits
  // these when the user types /value/ with a non-canonical inner
  // string, so the modifier can reference values that don't
  // exist yet at authoring time. The resolver soft-warns at
  // character-sheet render time if the runtime reference is
  // still unresolved (no warning — it's an open future slot).
  | { readonly kind: "runtime"; readonly name: string; readonly hint: "number" | "text" };

// =============================================================================
// OPERATORS — arithmetic operators for equation Value Type
// =============================================================================

/**
 * The 5 arithmetic operators for equation Value Type.
 *
 *   +   addition
 *   -   subtraction
 *   *   multiplication
 *   /   division
 *   %   percent (10% of preceding operand, e.g. "10% × PB"
 *       resolves to PB * 0.1). Useful for "10% × damage",
 *       "5% chance", etc. — closer to a DM's mental model than
 *       "multiply by 0.1" or "/10".
 *
 * No logical operators (&& || !), no comparisons, no
 * conditionals. Those belong to the Conditions UI, not the
 * modifier value. A modifier's value is a pure arithmetic
 * expression evaluated at slot time.
 *
 * Phase 8 may add `**` (power) and `min/max` if real use cases
 * come up; for v4 we keep it to these 5.
 */
export type Operator = "+" | "-" | "*" | "/" | "%";

export const ALL_OPERATORS: readonly Operator[] = ["+", "-", "*", "/", "%"];

export function operatorLabel(op: Operator): string {
  switch (op) {
    case "+": return "+";
    case "-": return "−";
    case "*": return "×";
    case "/": return "÷";
    case "%": return "%";
  }
}

/**
 * Whether this operator produces a numeric result (true for all
 * 5 — operators are arithmetic-only).
 */
export function isArithmetic(op: Operator): boolean {
  return true;
}

// =============================================================================
// OPERAND — a single (operator, value) pair in an equation
// =============================================================================

/**
 * One operand in an equation. The operator is the operation
 * applied to the value relative to the running accumulator:
 *
 *   [+ PB, - 2, / 4]   →   accumulator = (((PB) - 2) / 4)
 *   [+ 2d6, + PB]      →   accumulator = (2d6 + PB)
 *
 * Paren groups are represented as nested operands:
 *
 *   [+ PB, + (level/4)]   →
 *     [+ PB, + { kind:"paren", value:[ + level, / 4 ] }]
 *
 * The paren group's internal evaluation is recursive — see
 * resolveExpression in lib/engine/equations.ts.
 *
 * The first operand's operator is conventionally "+" (we don't
 * allow "starting" the equation with a non-+ op; the UI emits
 * + for the first chip and the resolver treats the first
 * operand's op as initial-direction).
 */
export interface Operand {
  readonly op: Operator;
  readonly value: OperandValue;
}

/**
 * The payload of an operand. Either a flat token (number, dice,
 * runtime reference, keyword) OR a paren group of nested
 * operands (recursion).
 *
 * Phase 7.5 v4: text operands (keyword) are tag-style — they
 * don't add to the numeric accumulator, they tag the modifier
 * with a category. The resolver carries them through to the
 * final result so the engine can apply them as labels.
 */
export type OperandValue =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "dice"; readonly expression: string }
  | { readonly kind: "attribute"; readonly attribute: AttributeKey }
  | { readonly kind: "practice"; readonly practice: PracticeKey }
  | { readonly kind: "derived"; readonly which: "pb" | "pb_half" | "level" }
  | { readonly kind: "behavior"; readonly name: string }
  | { readonly kind: "keyword"; readonly text: string }
  | { readonly kind: "runtime"; readonly name: string; readonly hint: "number" | "text" }
  | { readonly kind: "paren"; readonly operands: readonly Operand[] };

/**
 * Empty equation — used as the default for new modifiers in
 * equation mode.
 */
export const EMPTY_EQUATION: readonly Operand[] = [];

/**
 * Flatten operands to tokens (drops parens and keywords). Used
 * for migration of legacy rows that used `tokens: ValueToken[]`:
 * a row with `tokens: [PB, 2]` becomes `operands: [+ PB, + 2]`.
 */
export function operandsFromTokens(
  tokens: readonly ValueToken[],
): readonly Operand[] {
  return tokens.map((t) => ({ op: "+" as const, value: tToOperandValue(t) }));
}

function tToOperandValue(t: ValueToken): OperandValue {
  switch (t.kind) {
    case "number": return { kind: "number", value: t.value };
    case "dice": return { kind: "dice", expression: t.expression };
    case "attribute": return { kind: "attribute", attribute: t.attribute };
    case "practice": return { kind: "practice", practice: t.practice };
    case "derived": return { kind: "derived", which: t.which };
    case "behavior": return { kind: "behavior", name: t.name };
    case "keyword": return { kind: "keyword", text: t.text };
    case "runtime": return { kind: "runtime", name: t.name, hint: t.hint };
  }
}

/**
 * Flatten operands to tokens (parens and keywords dropped). Used
 * for legacy code paths that still expect `tokens: ValueToken[]`.
 */
export function tokensFromOperands(
  operands: readonly Operand[],
): readonly ValueToken[] {
  const out: ValueToken[] = [];
  for (const o of operands) {
    flattenOperand(o, out);
  }
  return out;
}

function flattenOperand(o: Operand, out: ValueToken[]): void {
  const v = o.value;
  switch (v.kind) {
    case "number": out.push({ kind: "number", value: v.value }); return;
    case "dice": out.push({ kind: "dice", expression: v.expression }); return;
    case "attribute": out.push({ kind: "attribute", attribute: v.attribute }); return;
    case "practice": out.push({ kind: "practice", practice: v.practice }); return;
    case "derived": out.push({ kind: "derived", which: v.which }); return;
    case "behavior": out.push({ kind: "behavior", name: v.name }); return;
    case "keyword": out.push({ kind: "keyword", text: v.text }); return;
    case "paren":
      for (const inner of v.operands) flattenOperand(inner, out);
      return;
  }
}

/**
 * Render an equation as a human-readable string. Used by the
 * equation chip preview, the JSON preview, and the live preview
 * sidebar.
 *
 *   [+ PB, + 2, - level, / 4]
 *     → "PB + 2 - level ÷ 4"
 *
 *   [+ PB, + {paren: [+ level, / 4]}]
 *     → "PB + (level ÷ 4)"
 *
 *   [+ 2d6, + PB, + keyword("fire")]
 *     → "2d6 + PB [fire]"
 */
export function renderEquation(operands: readonly Operand[]): string {
  if (operands.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < operands.length; i++) {
    const o = operands[i];
    if (!o) continue;
    const sym = operatorLabel(o.op);
    if (o.value.kind === "paren") {
      // First operand's operator is dropped if it's plain "+"
      const inner = renderEquation(o.value.operands);
      if (i === 0 && o.op === "+") {
        parts.push(`(${inner})`);
      } else {
        parts.push(`${sym} (${inner})`);
      }
      continue;
    }
    if (o.value.kind === "keyword") {
      // Keyword is tag-style; emit as [text] suffix.
      parts.push(`[${o.value.text}]`);
      continue;
    }
    const v = renderOperandValue(o.value);
    if (i === 0 && o.op === "+") {
      parts.push(v);
    } else {
      parts.push(`${sym} ${v}`);
    }
  }
  return parts.join(" ");
}

function renderOperandValue(v: OperandValue): string {
  switch (v.kind) {
    case "number": return String(v.value);
    case "dice": return v.expression;
    case "attribute": return v.attribute;
    case "practice": return v.practice;
    case "derived":
      // PB is canonically uppercase. PB/2 and level are kept
      // short.
      if (v.which === "pb") return "PB";
      if (v.which === "pb_half") return "PB/2";
      return v.which;
    case "behavior": return v.name;
    case "keyword": return `[${v.text}]`;
    case "runtime": return `/${v.name}/`;
    case "paren": return `(${renderEquation(v.operands)})`;
  }
}

/**
 * Phase 7.5 v4: classify which ValueType the operand value
 * produces — numeric (for arithmetic), tag (keyword), or
 * unsupported (mixed paren with tags, etc.).
 *
 *   number / dice / attribute / practice / derived / paren
 *     → "numeric"
 *   keyword
 *     → "tag"
 *   paren containing keyword
 *     → "mixed" (soft-warn — paren should be all-numeric)
 *
 * The resolver uses this to decide what to do with each operand.
 * Numeric operands feed the accumulator. Tag operands are
 * carried through but don't affect the numeric result.
 */
export type OperandKind = "numeric" | "tag" | "mixed";

export function operandKind(value: OperandValue): OperandKind {
  if (value.kind === "keyword") return "tag";
  if (value.kind === "paren") {
    let hasTag = false;
    let hasNumeric = false;
    for (const o of value.operands) {
      const k = operandKind(o.value);
      if (k === "tag") hasTag = true;
      else if (k === "numeric") hasNumeric = true;
      else if (k === "mixed") return "mixed";
    }
    if (hasTag && hasNumeric) return "mixed";
    if (hasTag) return "tag";
    return "numeric";
  }
  return "numeric";
}

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
 * The 7 die types available in SwordWeave. Just the type
 * ("d6", "d10") — the count prefix (1, 2, 3...) is decided at
 * runtime via scaling rules. Mashu's request: "we also need
 * in dice tags the dice type, maybe i just say add d6 (and
 * the number will be decided by scaling at runtime, or xd6
 * or xd10 (just the dice type so to say not a value per
 * se)". So this array is "d4, d6, d8, d10, d12, d20, d100"
 * — the canonical die types without a count.
 */
export const DICE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;

/**
 * Phase 7.5 v3: BIAS_VALUES is gone — the bias op was removed.
 * Advantage/disadvantage are now handled by grant/revoke on the
 * canonical behavior:advantage and behavior:disadvantage chips.
 * Kept here as a stub to make migrations visible.
 * @deprecated
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
 * Auto-coercion rules (Phase 7.5 v3):
 *   - number → `{kind: "number", value}`.
 *   - boolean → `{kind: "behavior", name: "true"|"false"}`.
 *   - "advantage" / "disadvantage" → `{kind: "behavior", name}`
 *     (used by grant/revoke since bias op is gone).
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
    // v3: boolean values are stored as behavior tokens named
    // "true" or "false". Set To interprets these back as booleans.
    return { kind: "behavior", name: raw ? "true" : "false" };
  }
  if (typeof raw !== "string") return null;
  // v3: "advantage"/"disadvantage" strings parse as behavior
  // tokens (since the bias op is gone). Used by grant/revoke.
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
    case "keyword": return `[${token.text}]`;
    case "runtime": return `/${token.name}/`;
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