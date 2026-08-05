/**
 * modifier-translator.ts — Phase 8.I i2.5h (Mashu 2026-08-06)
 *
 * Single source of truth for modifier save/load round-trips.
 *
 * The form's `ModifierDraft` and the stored `HardModifier` use
 * DIFFERENT representations of the same value. This module is
 * the only place that knows how to translate between them.
 *
 * ## Design contract
 *
 * The chip stack (`ModifierDraft.tokens: ValueToken[]`) is the
 * canonical UI-side representation. The cached `value` string
 * and `valueKind` enum are DERIVED from the chip stack on every
 * render. They are NOT independent fields.
 *
 * The stored `HardModifier.value` is the canonical DB-side
 * representation. For non-equation modes, it's the FIRST chip
 * (a typed-token object). For equation mode, it's the first
 * OPERAND's value (also a typed-token object). The full operand
 * array goes to `metadata.operands`.
 *
 * Why this matters: the previous implementation derived the
 * stored value by re-parsing the cached `value` string through
 * classifyTypedValue. This was fragile — any time the cached
 * string was empty or mismatched (which happens constantly in
 * equation mode, and happens once when the user first opens
 * the form to edit), the parser returned 0 or a stale token.
 * The token is now the source of truth; the string is just a
 * render cache.
 *
 * ## Functions
 *
 * - `toStoredValue(draft)` — translate ModifierDraft.value to HardModifier.value
 * - `toStoredMetadata(draft)` — produce metadata (operands/valueKind/etc.)
 * - `fromStoredValue(stored)` — translate HardModifier.value back to tokens/valueKind/value
 * - `tokenKindToValueKind(kind)` — map a token's kind to the form's valueKind enum
 * - `valueKindToOperandsRule(valueKind)` — for the form's equation-mode transitions
 */

import type { ValueToken, Operand, OperandValue } from "@/types/modifier";

// =============================================================================
// ValueKind enum (form-side)
// =============================================================================

export type ValueKind =
  | "number"
  | "text"
  | "dice"
  | "boolean"
  | "equation";

// =============================================================================
// Token kind → ValueKind
// =============================================================================

/**
 * Map a typed token's kind to the form's `valueKind` enum. The form
 * uses this on reload to choose which UI mode to render (number
 * field, text field, dice field, etc.).
 */
export function tokenKindToValueKind(
  kind: ValueToken["kind"] | "paren" | "unknown",
): ValueKind {
  switch (kind) {
    case "number":
    case "derived":
    case "attribute":
    case "practice":
    case "behavior":
    case "runtime":
      return "number";
    case "dice":
      return "dice";
    case "keyword":
      return "text";
    case "paren":
    case "unknown":
    default:
      return "number";
  }
}

// =============================================================================
// Operands → Tokens (for equation-mode load)
// =============================================================================

/**
 * Convert an Operand[] to a flat ValueToken[] for the chip stack.
 * Paren groups are flattened (the chip stack doesn't show parens).
 * Keywords are kept (they show as [keyword] chips).
 */
export function operandsToTokens(operands: readonly Operand[]): ValueToken[] {
  const tokens: ValueToken[] = [];
  for (const op of operands) {
    flattenOperand(op.value, tokens);
  }
  return tokens;
}

function flattenOperand(value: OperandValue, out: ValueToken[]): void {
  if (value.kind === "paren") {
    for (const inner of value.operands) {
      flattenOperand(inner.value, out);
    }
    return;
  }
  // Each non-paren OperandValue IS already a ValueToken (the type
  // unions are structurally identical).
  out.push(value as ValueToken);
}

// =============================================================================
// TokenValue → OperandValue (for equation-mode save)
// =============================================================================

/**
 * Convert a ValueToken to an OperandValue. Most tokens are
 * structurally identical; this function exists to centralize the
 * type coercion so the operand array always uses OperandValue.
 */
export function tokenToOperandValue(token: ValueToken): OperandValue {
  // ValueToken and OperandValue have structurally identical shapes
  // for non-paren kinds. Cast is safe.
  return token as unknown as OperandValue;
}

// =============================================================================
// Serialize first token → display string (for the cached value field)
// =============================================================================

/**
 * Serialize a single typed token to a display string. Used by the
 * form to keep `modifier.value` in sync with `modifier.tokens`.
 */
export function serializeToken(token: ValueToken): string {
  switch (token.kind) {
    case "number":       return String(token.value);
    case "derived":      return token.which;
    case "attribute":    return token.attribute;
    case "practice":     return token.practice;
    case "behavior":     return token.name;
    case "dice":         return token.expression;
    case "keyword":      return `[${token.text}]`;
    case "runtime":      return `/${token.name}/`;
  }
}

export function serializeFirstToken(tokens: readonly ValueToken[]): string {
  const first = tokens[0];
  if (!first) return "";
  return serializeToken(first);
}

/**
 * Serialize an Operand[] to a human-readable equation string.
 * Used by the form's cached `value` field when in equation mode.
 *
 * Example:
 *   [{op:"+", value:{kind:"number",value:2}}, {op:"*", value:{kind:"derived",which:"pb"}}]
 *   → "2 * PB"
 */
export function serializeOperandsAsExpression(operands: readonly Operand[]): string {
  if (operands.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < operands.length; i++) {
    const op = operands[i];
    if (!op) continue;
    const val = operandValueToString(op.value);
    if (i === 0) {
      // First operand's leading op is implicit
      parts.push(val);
    } else {
      parts.push(` ${op.op} ${val}`);
    }
  }
  return parts.join("");
}

function operandValueToString(value: OperandValue): string {
  if (value.kind === "paren") {
    const inner = serializeOperandsAsExpression(value.operands);
    return `(${inner})`;
  }
  if (value.kind === "number") return String(value.value);
  if (value.kind === "derived") {
    return value.which === "pb_half" ? "PB/2" : value.which.toUpperCase();
  }
  if (value.kind === "attribute") return value.attribute;
  if (value.kind === "practice") return value.practice;
  if (value.kind === "behavior") return `behavior:${value.name}`;
  if (value.kind === "dice") return `#${value.expression}#`;
  if (value.kind === "keyword") return `[${value.text}]`;
  if (value.kind === "runtime") return `/${value.name}/`;
  return "?";
}
