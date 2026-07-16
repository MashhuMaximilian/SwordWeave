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
  OP_SPECS,
  OP_VALUE_TYPE_MATRIX,
  type ModifierOperation,
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
 * Rules (Phase 7.5 v3):
 *   - Add/Subtract/Multiply/Divide: number tokens (incl. runtime
 *     tokens like +physical) AND dice tokens. valueKind filters
 *     to literal numbers or dice expressions.
 *   - Min/Max: number OR text/keyword (custom pills). NOT dice.
 *   - Set To: number, text, dice, OR boolean (stored as
 *     behavior tokens named "true"/"false").
 *   - Grant/Revoke: number, text, OR dice.
 */
export function allowedTokenKinds(
  op: ModifierOperation,
  valueKind: FormValueKind,
): { kinds: ReadonlySet<ValueToken["kind"]>; biasMode: boolean } {
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
  // Set To: number / text / dice / boolean.
  if (op === "set") {
    if (valueKind === "number") {
      return { kinds: new Set<ValueToken["kind"]>(["number"]), biasMode: false };
    }
    if (valueKind === "dice") {
      return { kinds: new Set<ValueToken["kind"]>(["dice"]), biasMode: false };
    }
    // boolean (rendered as a chip-pair "true"/"false") and
    // text (custom behavior pills) both use behavior tokens.
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