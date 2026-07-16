/**
 * Phase 7.5: Modifier form helper functions — pure, testable.
 *
 * Extracted from primitive-form.tsx so they can be unit tested
 * without rendering React components. Each helper is a pure
 * function that takes the form's current state and returns a
 * derived decision (allowed token kinds, effective mirrorability,
 * value-type label).
 *
 * v2 (Phase 7.5): value type constraints tightened per user
 * feedback. Text and Dice are SEPARATE value types. Min/Max
 * don't accept dice. Toggle has no Value Type field.
 */

import {
  OP_SPECS,
  OP_VALUE_TYPE_MATRIX,
  type ModifierOperation,
  type ValueToken,
  type ValueType,
} from "@/types/modifier";

/**
 * The form's legacy `valueKind` was a 3-option union
 * (number/text/boolean). Phase 7.5 v2 widened it to the full
 * `ValueType` enum. This type alias keeps the form's
 * ModifierDraft type narrower for storage compatibility.
 */
export type FormValueKind = ValueType;

/**
 * Map (op, valueKind) to the set of ValueToken kinds the
 * chip-stack should accept for the "add token" popover.
 *
 * Rules (Phase 7.5 v2):
 *   - Add/Subtract/Multiply/Divide: number tokens (incl. runtime
 *     tokens like +physical) AND dice tokens. valueKind filters
 *     to literal numbers or dice expressions.
 *   - Min/Max: number OR text/keyword (custom pills). NOT dice.
 *   - Set To: number, text, dice, OR boolean.
 *   - Grant/Revoke: number, text, OR dice.
 *   - Bias: only bias-value (binary dropdown).
 *   - Toggle: only boolean (True/False toggle).
 */
export function allowedTokenKinds(
  op: ModifierOperation,
  valueKind: FormValueKind,
): { kinds: ReadonlySet<ValueToken["kind"]>; biasMode: boolean } {
  // Bias op renders the bias picker regardless of valueKind.
  if (op === "bias") {
    return { kinds: new Set(), biasMode: true };
  }
  // Toggle renders a True/False toggle directly. Chip-stack
  // not used.
  if (op === "toggle") {
    return { kinds: new Set(), biasMode: false };
  }
  // Add/Subtract/Multiply/Divide: number + dice.
  if (
    op === "add" || op === "subtract" ||
    op === "multiply" || op === "divide"
  ) {
    if (valueKind === "number") {
      return { kinds: new Set<ValueToken["kind"]>(["number"]), biasMode: false };
    }
    if (valueKind === "dice") {
      return { kinds: new Set<ValueToken["kind"]>(["dice"]), biasMode: false };
    }
    return { kinds: new Set<ValueToken["kind"]>(["number"]), biasMode: false };
  }
  // Min/Max: number OR text/keyword. NOT dice.
  if (op === "min" || op === "max") {
    if (valueKind === "number") {
      return { kinds: new Set<ValueToken["kind"]>(["number"]), biasMode: false };
    }
    return { kinds: new Set<ValueToken["kind"]>(["behavior"]), biasMode: false };
  }
  // Set To: number / text / dice / boolean — all kinds accepted.
  if (op === "set") {
    if (valueKind === "number") {
      return { kinds: new Set<ValueToken["kind"]>(["number"]), biasMode: false };
    }
    if (valueKind === "dice") {
      return { kinds: new Set<ValueToken["kind"]>(["dice"]), biasMode: false };
    }
    // boolean and text both go through behavior tokens (with
    // the booleans as behavior tokens named "true"/"false").
    return { kinds: new Set<ValueToken["kind"]>(["behavior"]), biasMode: false };
  }
  // Grant/Revoke: number, text, or dice.
  if (op === "grant" || op === "revoke") {
    if (valueKind === "number") {
      return { kinds: new Set<ValueToken["kind"]>(["number"]), biasMode: false };
    }
    if (valueKind === "dice") {
      return { kinds: new Set<ValueToken["kind"]>(["dice"]), biasMode: false };
    }
    return { kinds: new Set<ValueToken["kind"]>(["behavior"]), biasMode: false };
  }
  // Fallback (shouldn't hit).
  return { kinds: new Set<ValueToken["kind"]>(["behavior"]), biasMode: false };
}

/**
 * Derive the modifier's effective mirrorability from the
 * current op. Set To is always non-mirrorable; everything else
 * follows OP_SPECS.
 *
 * (Phase 7.5 v2: valueKind no longer affects mirrorability —
 * only the op does. Set To is permission-locked regardless of
 * valueKind.)
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
    case "bias-value": return "Bias";
  }
}

/**
 * Whether the Value Type dropdown should be hidden for a given
 * op. Toggle and Bias don't have a Value Type field — the op
 * determines the value shape directly.
 */
export function hidesValueTypeSelect(op: ModifierOperation): boolean {
  return op === "toggle" || op === "bias";
}

/**
 * Allowed Value Types for a given op (passthrough to
 * OP_VALUE_TYPE_MATRIX). Used to populate the Value Type
 * dropdown.
 */
export function allowedValueTypes(op: ModifierOperation): readonly ValueType[] {
  return OP_VALUE_TYPE_MATRIX[op];
}