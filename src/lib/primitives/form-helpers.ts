/**
 * Phase 7.5 v3 — Modifier form helper functions (pure, testable).
 *
 * Extracted from primitive-form.tsx so they can be unit tested
 * without rendering React components. Each helper is a pure
 * function that takes the form's current state and returns a
 * derived decision (allowed token kinds, effective
 * mirrorability, value-type label).
 *
 * v3 changes from v2:
 *   - Removed bias and toggle ops. Now 9 ops.
 *   - Removed bias-value ValueType. Now 4 value types.
 *   - Mirror logic still in OP_SPECS but unused at primitive
 *     level (mirror is decided by capability/affect layer).
 *   - hidesValueTypeSelect always returns false in v3 (all 9 ops
 *     use the Value Type dropdown).
 */

import {
  ALL_ATTRIBUTES,
  ALL_DERIVED,
  ALL_PRACTICES,
  isBehaviorLike,
  isDiceExpression,
  OP_SPECS,
  OP_VALUE_TYPE_MATRIX,
  type ModifierOperation,
  type OperandValue,
  type ValueToken,
  type ValueType,
} from "@/types/modifier";

/**
 * The form's stored valueKind is the canonical ValueType enum.
 */
export type FormValueKind = ValueType;

/**
 * Map (op, valueKind) to the set of ValueToken kinds the
 * chip-stack should accept for the "add token" popover.
 *
 * Rules (Phase 7.5 v3, post-UI-rev):
 *   - Add/Subtract/Multiply/Divide with valueKind=number:
 *       number + attribute + practice + derived.
 *       Runtime tokens (+physical, +PB, +awareness, ...) all show
 *       up so users can compose "+ 2 + physical" without typing.
 *   - Add/Subtract/Multiply/Divide with valueKind=dice:
 *       dice + the dice-adjacent input. (Behavior tokens NOT
 *       offered here — typing a name in dice mode classifies it
 *       as a dice expression if it matches the pattern, else it
 *       becomes a behavior token with a soft warning.)
 *   - Min/Max with valueKind=number: number + attribute +
 *       practice + derived (same as Add family).
 *   - Min/Max with valueKind=text: behavior only (text/keyword).
 *   - Set To with valueKind=number: number + attribute + practice
 *       + derived.
 *   - Set To with valueKind=dice: dice only.
 *   - Set To with valueKind=text: behavior only.
 *   - Set To with valueKind=boolean: behavior only — the popover
 *       ALSO surfaces [+ true] and [+ false] quick-pick chips.
 *   - Grant/Revoke with valueKind=number: number + attribute +
 *       practice + derived.
 *   - Grant/Revoke with valueKind=text: behavior only.
 *   - Grant/Revoke with valueKind=dice: dice only.
 *
 * The chip-stack uses this to decide which category sections to
 * render AND to decide how typed text in the custom input
 * classifies (via `classifyTypedValue` in token-chip-stack.tsx).
 */
export function allowedTokenKinds(
  op: ModifierOperation,
  valueKind: FormValueKind,
): { kinds: ReadonlySet<ValueToken["kind"]>; biasMode: boolean } {
  // Phase 7.5 v4: keyword tokens are ALWAYS allowed — the
  // SUB_CHOICE_KEYWORDS picker section needs to surface
  // keywords in number/dice/text/boolean modes too (e.g.
  // adding [walking] tag to a number-mode speed modifier,
  // or [fire] to a dice-mode damage modifier).
  //
  // Keyword tokens are tag-style: they don't carry numeric
  // weight, they're labels that the engine reads when
  // resolving against typed targets (damage output type,
  // speed type, etc.).
  const keywordKind: ValueToken["kind"] = "keyword";

  // Numeric-value ops: number + all runtime token categories.
  // The runtime tokens (attribute/practice/derived) resolve to
  // numbers on the character sheet, so they're valid here.
  if (
    op === "add" || op === "subtract" ||
    op === "multiply" || op === "divide"
  ) {
    if (valueKind === "number") {
      return {
        kinds: new Set<ValueToken["kind"]>([
          "number", "attribute", "practice", "derived", keywordKind,
        ]),
        biasMode: false,
      };
    }
    if (valueKind === "dice") {
      return {
        kinds: new Set<ValueToken["kind"]>(["dice", keywordKind]),
        biasMode: false,
      };
    }
    return { kinds: new Set<ValueToken["kind"]>(["behavior", keywordKind]), biasMode: false };
  }
  // Min/Max: number (with runtime tokens) OR text (behavior).
  if (op === "min" || op === "max") {
    if (valueKind === "number") {
      return {
        kinds: new Set<ValueToken["kind"]>([
          "number", "attribute", "practice", "derived", keywordKind,
        ]),
        biasMode: false,
      };
    }
    return { kinds: new Set<ValueToken["kind"]>(["behavior", keywordKind]), biasMode: false };
  }
  // Set To: full vocabulary.
  if (op === "set") {
    if (valueKind === "number") {
      return {
        kinds: new Set<ValueToken["kind"]>([
          "number", "attribute", "practice", "derived", keywordKind,
        ]),
        biasMode: false,
      };
    }
    if (valueKind === "dice") {
      return {
        kinds: new Set<ValueToken["kind"]>(["dice", keywordKind]),
        biasMode: false,
      };
    }
    // boolean + text both use behavior tokens (true/false are
    // behavior tokens named "true"/"false").
    return { kinds: new Set<ValueToken["kind"]>(["behavior", keywordKind]), biasMode: false };
  }
  // Grant/Revoke: number (with runtime tokens), text, or dice.
  if (op === "grant" || op === "revoke") {
    if (valueKind === "number") {
      return {
        kinds: new Set<ValueToken["kind"]>([
          "number", "attribute", "practice", "derived", keywordKind,
        ]),
        biasMode: false,
      };
    }
    if (valueKind === "dice") {
      return {
        kinds: new Set<ValueToken["kind"]>(["dice", keywordKind]),
        biasMode: false,
      };
    }
    return { kinds: new Set<ValueToken["kind"]>(["behavior", keywordKind]), biasMode: false };
  }
  // Fallback (shouldn't hit).
  return { kinds: new Set<ValueToken["kind"]>(["behavior", keywordKind]), biasMode: false };
}

/**
 * Convenience: should the popover surface the [+ true] / [+ false]
 * quick-pick chip pair? True only when (op, valueKind) is
 * Set To + Boolean.
 */
export function isBooleanValueType(
  op: ModifierOperation,
  valueKind: FormValueKind,
): boolean {
  return op === "set" && valueKind === "boolean";
}

/**
 * Should the popover surface quick-pick chips for common literal
 * numbers (1, 2, 3, 5, 10)? True for numeric ops with number
 * valueKind — saves the user from typing 2 every time.
 */
export function showsNumberShortcuts(
  op: ModifierOperation,
  valueKind: FormValueKind,
): boolean {
  if (valueKind !== "number") return false;
  return (
    op === "add" || op === "subtract" ||
    op === "multiply" || op === "divide" ||
    op === "min" || op === "max" ||
    op === "set" || op === "grant" || op === "revoke"
  );
}

/**
 * Common literal-number chips for the number quick-pick row.
 * Curated by Phase 7.5 v3 UX (Mashu's review).
 */
export const NUMBER_SHORTCUTS: readonly number[] = [-5, -2, -1, 1, 2, 3, 5, 10];

/**
 * Result of classifying a typed string into a token, plus
 * optional warning text for soft-warns (e.g. "this looks like
 * a behavior name but you're in number mode"). The chip-stack
 * surfaces the warning under the input so the user can decide
 * to keep or re-classify.
 */
export interface ClassifyResult {
  readonly token: ValueToken | null;
  readonly warning: string | null;
}

/**
 * Classify a typed string into a ValueToken, given the current
 * (op, valueKind). The classification is the source of truth for
 * "what does typing X in this field mean?" — every input in the
 * chip-stack funnels through this so behavior tokens don't leak
 * into number fields, dice expressions don't become behavior
 * tokens, etc.
 *
 * Rules:
 *   - number mode + numeric string → {kind:"number", value:N}.
 *   - number mode + dice-looking string → number token with a
 *     warning ("did you mean dice mode?").
 *   - number mode + attribute/practice/derived name → runtime
 *     token (the chip-stack's quick-pick buttons cover these
 *     too, but typing works).
 *   - number mode + anything else → behavior token with warning.
 *   - dice mode + dice-expression string → {kind:"dice", expr}.
 *   - dice mode + numeric string → behavior token with warning
 *     ("2 is not a dice expression; switch Value Type to
 *     Number?").
 *   - dice mode + non-matching string → behavior token with
 *     warning.
 *   - text mode + any string → behavior token (text/keyword).
 *   - boolean mode + "true" / "false" / "yes" / "no" / "1" / "0"
 *     → behavior token named "true" / "false".
 *   - boolean mode + anything else → behavior token with warning
 *     ("not a boolean; will be stored as text").
 */
export function classifyTypedValue(
  raw: string,
  op: ModifierOperation,
  valueKind: FormValueKind,
): ClassifyResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { token: null, warning: null };
  }

  // Number mode.
  if (valueKind === "number") {
    const num = Number(trimmed);
    if (Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { token: { kind: "number", value: num }, warning: null };
    }
    if (isDiceExpression(trimmed)) {
      return {
        token: { kind: "number", value: Number(trimmed.split("d")[1]) || 0 },
        warning: `Looks like a dice expression (${trimmed}). Switch Value Type to Dice?`,
      };
    }
    if ((ALL_ATTRIBUTES as readonly string[]).includes(trimmed)) {
      return { token: { kind: "attribute", attribute: trimmed as never }, warning: null };
    }
    if ((ALL_PRACTICES as readonly string[]).includes(trimmed)) {
      return { token: { kind: "practice", practice: trimmed as never }, warning: null };
    }
    if ((ALL_DERIVED as readonly string[]).includes(trimmed)) {
      return {
        token: { kind: "derived", which: trimmed as never },
        warning: null,
      };
    }
    if (isBehaviorLike(trimmed)) {
      return { token: { kind: "behavior", name: trimmed }, warning: null };
    }
    // Phase 7.5 v4-rev: handle bracket/delim syntax in
    // classifyTypedValue. Mashu: "/physical/ shouldn't
    // error here. those should not error here. But on
    // character sheet they are resolved and properly
    // computed. And we didn't get there yet. Here is
    // just the variables/syntax in build."
    //
    // The user might type /physical/ thinking the / /
    // delim is required. It's NOT required in number
    // mode (the parser is implicit), but we should
    // forgive the input and strip the delims rather
    // than warn. Re-run classification on the inner
    // string; if it's still unrecognizable, warn as
    // before.
        if (trimmed.startsWith("/") && trimmed.endsWith("/") && trimmed.length >= 3) {
      const inner = trimmed.slice(1, -1).trim();
      // Recurse on the inner string. The recursive
      // call will hit the attribute/practice/derived
      // checks and return cleanly. We discard the
      // warning from the recursive call (the user
      // explicitly used the runtime reference syntax,
      // so they're aware it's a reference).
      //
      // We lowercase the inner so /PB/ → "pb" → matches
      // the derived list (which is lowercase). The
      // inner for /physical/ stays lowercase, so it
      // matches the attribute list as-is.
      const innerLower = inner.toLowerCase();
      const innerResult = classifyTypedValue(innerLower, op, valueKind);
      if (innerResult.token) {
        return { token: innerResult.token, warning: null };
      }
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]") && trimmed.length >= 3) {
      // Tag/keyword — store as keyword token if the
      // inner is non-empty. No warning.
      const inner = trimmed.slice(1, -1).trim();
      if (inner.length > 0) {
        return { token: { kind: "keyword", text: inner }, warning: null };
      }
    }
    if (trimmed.startsWith("#") && trimmed.endsWith("#") && trimmed.length >= 3) {
      // Dice expression. In number mode this is a
      // mistake but we should still recognize it and
      // warn the user to switch to dice mode.
      const inner = trimmed.slice(1, -1).trim();
      if (isDiceExpression(inner)) {
        return {
          token: { kind: "behavior", name: inner },
          warning: `"${inner}" is a dice expression. Switch Value Type to Dice?`,
        };
      }
    }
    return {
      token: { kind: "behavior", name: trimmed },
      warning: `Not a number; stored as behavior token "${trimmed}".`,
    };
  }

  // Dice mode.
  if (valueKind === "dice") {
    if (isDiceExpression(trimmed)) {
      return { token: { kind: "dice", expression: trimmed }, warning: null };
    }
    // Strip # dice# delim convention — user might type
    // #2d6# thinking the syntax is required.
    if (trimmed.startsWith("#") && trimmed.endsWith("#") && trimmed.length >= 3) {
      const inner = trimmed.slice(1, -1).trim();
      if (isDiceExpression(inner)) {
        return { token: { kind: "dice", expression: inner }, warning: null };
      }
    }
    const num = Number(trimmed);
    if (Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      return {
        token: { kind: "behavior", name: trimmed },
        warning: `"${trimmed}" is a number, not a dice expression. Switch Value Type to Number?`,
      };
    }
    if (isBehaviorLike(trimmed)) {
      return { token: { kind: "behavior", name: trimmed }, warning: null };
    }
    return {
      token: { kind: "behavior", name: trimmed },
      warning: `Not a dice expression; stored as behavior token.`,
    };
  }

  // Boolean mode (only valid for Set To).
  if (valueKind === "boolean") {
    const lowered = trimmed.toLowerCase();
    if (lowered === "true" || lowered === "yes" || lowered === "1") {
      return { token: { kind: "behavior", name: "true" }, warning: null };
    }
    if (lowered === "false" || lowered === "no" || lowered === "0") {
      return { token: { kind: "behavior", name: "false" }, warning: null };
    }
    return {
      token: { kind: "behavior", name: trimmed },
      warning: `Not a recognized boolean; stored as behavior token "${trimmed}".`,
    };
  }

  // Text mode — anything becomes a behavior token. But
  // strip the [tag] convention so users who type
  // [fire] don't see the brackets in the chip.
  if (trimmed.startsWith("[") && trimmed.endsWith("]") && trimmed.length >= 3) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.length > 0) {
      return { token: { kind: "keyword", text: inner }, warning: null };
    }
  }
  return { token: { kind: "behavior", name: trimmed }, warning: null };
}

/**
 * Derive the modifier's effective mirrorability from the
 * current op. Set To is always non-mirrorable; everything else
 * follows OP_SPECS.
 *
 * Note: this is the OP-level mirrorability. In v3, mirror is
 * decided by the capability/affect layer (Phase 8), not by the
 * primitive. This function is kept for that future use.
 */
export function effectiveMirrorable(op: ModifierOperation): boolean {
  return OP_SPECS[op].mirrorable;
}

/**
 * Human-readable label for a ValueType. Used by the Value Type
 * dropdown.
 */
export function valueTypeLabel(vt: ValueType): string {
  switch (vt) {
    case "number": return "Number";
    case "text": return "Text / Keyword";
    case "dice": return "Dice";
    case "boolean": return "True / False";
    case "equation": return "Equation";
  }
}

/**
 * Whether the Value Type dropdown should be hidden for a given
 * op. In v3, all 9 ops show the Value Type dropdown. Returns
 * false for everything. Kept as a function for symmetry with
 * the spec and potential future op additions.
 */
export function hidesValueTypeSelect(_op: ModifierOperation): boolean {
  return false;
}

/**
 * Allowed Value Types for a given op (passthrough to
 * OP_VALUE_TYPE_MATRIX). Used to populate the Value Type
 * dropdown.
 */
export function allowedValueTypes(op: ModifierOperation): readonly ValueType[] {
  return OP_VALUE_TYPE_MATRIX[op];
}

/**
 * Canonical list of operations in display order. v3: 9 ops.
 */
export const OPERATION_LABELS: ReadonlyArray<{
  readonly value: ModifierOperation;
  readonly label: string;
}> = [
  { value: "add",      label: "Add" },
  { value: "subtract", label: "Subtract" },
  { value: "multiply", label: "Multiply" },
  { value: "divide",   label: "Divide" },
  { value: "min",      label: "Minimum" },
  { value: "max",      label: "Maximum" },
  { value: "set",      label: "Set To" },
  { value: "grant",    label: "Grant" },
  { value: "revoke",   label: "Revoke" },
];

// =============================================================================
// Sub-choice keyword suggestions
// =============================================================================

/**
 * Mashu: the value picker needs MORE suggestions beyond
 * attribute/practice/derived/dice. Every per-axis sub-choice in
 * MODIFIER_TARGET_SPEC should also appear as a tag-style
 * suggestion so the author can build modifiers like
 *
 *   target=damage_output, op=set, value=#2d6# [piercing]
 *   target=speed, op=add, value=/5/ [walking]
 *   target=defense_dc, op=set, value=/18/ [physical]
 *
 * without typing the keyword name. The KEYWORD_TOKENS list
 * collects every meaningful sub-choice label across all axes.
 *
 * Token classification:
 *   - "keyword"  → most labels (tag-only, not numeric)
 *   - "number"   → labels tied to numeric effects (HP, vitality)
 *
 * The picker renders these as `[name]` buttons alongside the
 * existing damage-type keyword presets. The author's picks
 * flow through the same parser as the custom input.
 */
export interface SubChoiceKeyword {
  /** Display label shown in the picker. */
  readonly label: string;
  /** Group for the picker's section heading. */
  readonly group: "Defense" | "Speed" | "Targeting" | "Duration" | "Vitality" | "Action";
}

export const SUB_CHOICE_KEYWORDS: readonly SubChoiceKeyword[] = [
  // Defense axes (defense_dc).
  { label: "Physical DC", group: "Defense" },
  { label: "Mental DC", group: "Defense" },
  { label: "Magical DC", group: "Defense" },
  // Speed axes (single axis with locomotion sub-choices).
  { label: "Walking Speed", group: "Speed" },
  { label: "Climbing Speed", group: "Speed" },
  { label: "Swimming Speed", group: "Speed" },
  { label: "Flying Speed", group: "Speed" },
  { label: "Burrowing Speed", group: "Speed" },
  // Targeting shapes.
  { label: "Single Target", group: "Targeting" },
  { label: "Multiple Targets", group: "Targeting" },
  { label: "Cone", group: "Targeting" },
  { label: "Cube", group: "Targeting" },
  { label: "Line", group: "Targeting" },
  { label: "Sphere", group: "Targeting" },
  { label: "Cylinder", group: "Targeting" },
  { label: "Wall", group: "Targeting" },
  { label: "Star", group: "Targeting" },
  // Duration windows.
  { label: "Instant", group: "Duration" },
  { label: "Short", group: "Duration" },
  { label: "Medium", group: "Duration" },
  { label: "Long", group: "Duration" },
  { label: "Persistent", group: "Duration" },
  { label: "Permanent", group: "Duration" },
  // Vitality / HP.
  { label: "Max Vitality", group: "Vitality" },
  { label: "Current Vitality", group: "Vitality" },
  // Action.
  { label: "Attack Roll", group: "Action" },
  { label: "Action Roll", group: "Action" },
  { label: "Proficiency Bonus", group: "Action" },
  { label: "Item Slot Cost", group: "Action" },
];

// =============================================================================
// Equation input parser — bracket/delim convention
// =============================================================================

/**
 * Parse a single string from the equation custom input into an
 * OperandValue, using bracket/delim conventions chosen to avoid
 * colliding with JSON, JS, or engine syntax.
 *
 * Conventions:
 *   [text]    → keyword operand (tag-style). The brackets are
 *               stripped; the inner text becomes the tag name.
 *               Examples: [fire], [piercing], [60 ft darkvision]
 *
 *   #expr#    → dice expression. The hash marks are stripped;
 *               the inner text must look like a standard dice
 *               expression (NdM[+-K]). Examples: #2d6#, #1d10+3#
 *
 *   /value/   → numeric. The slashes are stripped; the inner
 *               content is classified as either a literal
 *               number or a runtime token (attribute, practice,
 *               derived). Examples: /5/, /physical/, /level/,
 *               /PB/
 *
 * Anything else: legacy classification by content — falls back
 * to behavior tokens for unrecognized strings. This keeps the
 * custom input backwards-compatible with the chip-stack's
 * classifyTypedValue.
 *
 * The bracket/delim syntax lets the author type mixed-type
 * expressions:
 *
 *   "PB + /2/ + #2d6# + [fire]"
 *
 * resolves to operands [+ PB, + 2, + 2d6, + fire] without
 * needing separate inputs per type. The author stays in one
 * text field; the parser does the classification.
 */
export function parseEquationInput(raw: string): OperandValue {
  const t = raw.trim();

  // [tag] convention.
  if (t.startsWith("[") && t.endsWith("]") && t.length >= 3) {
    const inner = t.slice(1, -1).trim();
    if (inner.length > 0) return { kind: "keyword", text: inner };
  }

  // #dice# convention.
  if (t.startsWith("#") && t.endsWith("#") && t.length >= 3) {
    const inner = t.slice(1, -1).trim();
    if (isDiceExpression(inner)) {
      return { kind: "dice", expression: inner };
    }
    // #2d6# with a malformed inside — fall through to
    // legacy classification but the result is a behavior
    // token; the engine will treat it as text.
  }

  // /value/ convention.
  if (t.startsWith("/") && t.endsWith("/") && t.length >= 3) {
    const inner = t.slice(1, -1).trim();
    // Numeric literal?
    if (/^-?\d+(\.\d+)?$/.test(inner)) {
      return { kind: "number", value: Number(inner) };
    }
    // Runtime token? Match case-insensitively so /PB/,
    // /pb/, and /Pb/ all resolve to derived "pb".
    const innerLower = inner.toLowerCase();
    if ((ALL_ATTRIBUTES as readonly string[]).includes(innerLower)) {
      return { kind: "attribute", attribute: innerLower as never };
    }
    if ((ALL_PRACTICES as readonly string[]).includes(innerLower)) {
      return { kind: "practice", practice: innerLower as never };
    }
    if ((ALL_DERIVED as readonly string[]).includes(innerLower)) {
      return { kind: "derived", which: innerLower as never };
    }
    // Phase 7.5 v4: unrecognized /value/ — emit a runtime
    // token. The author may have typed something the engine
    // will resolve at slot time (e.g. /blockValue/ from an
    // equipped shield, /currentSpellSlots/ from a class
    // ability). We don't want to silently swallow it as a
    // behavior token — the runtime kind tells the engine
    // "this is a deferred reference, look it up in the
    // character sheet at slot time."
    return { kind: "runtime", name: innerLower, hint: "number" };
  }

  // Legacy classification (no brackets/hashes/slashes).
  if (/^\d+d\d+([+-]\d+)?$/i.test(t)) {
    return { kind: "dice", expression: t };
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return { kind: "number", value: Number(t) };
  }
  // Runtime tokens are case-insensitive ("PB" → "pb").
  const tLower = t.toLowerCase();
  if ((ALL_ATTRIBUTES as readonly string[]).includes(tLower)) {
    return { kind: "attribute", attribute: tLower as never };
  }
  if ((ALL_PRACTICES as readonly string[]).includes(tLower)) {
    return { kind: "practice", practice: tLower as never };
  }
  if ((ALL_DERIVED as readonly string[]).includes(tLower)) {
    return { kind: "derived", which: tLower as never };
  }
  if (isBehaviorLike(t)) {
    return { kind: "behavior", name: t };
  }
  return { kind: "behavior", name: t };
}