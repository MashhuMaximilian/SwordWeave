/**
 * equation-resolver.ts — Phase 8.I i2.5 (Mashu 2026-08-05)
 *
 * Resolve an equation expression (Operand[]) against character
 * state. An equation is an arithmetic expression with mixed
 * operands — runtime tokens (PB, /physical/), dice (2d6+3),
 * numbers, and tag-style keywords ([fire]). The resolver walks
 * the operand array, resolves each operand, applies operators,
 * and returns the final number (plus a list of preserved tags).
 *
 * Example: PB + (level / 4) [fire]
 *   operands: [
 *     {op: "+", value: {kind: "derived", which: "pb"}},
 *     {op: "+", value: {kind: "paren", operands: [
 *       {op: "+", value: {kind: "derived", which: "level"}},
 *       {op: "/", value: {kind: "number", value: 4}}
 *     ]}},
 *     {op: "+", value: {kind: "keyword", text: "fire"}},
 *   ]
 *   → numeric: PB + (level/4) = pb + (level/4)
 *   → tags: ["fire"]
 *
 * The form's `toHardModifier` writes the full operands array to
 * `metadata.operands` for Value Type = equation. The engine
 * reads them here.
 *
 * See: docs/phase-8/PHASE-8-I-ASSESSMENT-2026-08-05.md (i2.5)
 */

import type { Operand, OperandValue, Operator } from "@/types/modifier";
import { resolveToken, type ResolveContext } from "./runtime-resolver";

// =============================================================================
// Public types
// =============================================================================

export interface EquationResult {
  /** The numeric result of the expression. */
  readonly numeric: number;
  /** Preserved keyword tags ([fire], [piercing], etc.). */
  readonly tags: readonly string[];
}

// =============================================================================
// Single-operand resolution
// =============================================================================

/**
 * Resolve a single OperandValue to a number. Recursive for
 * `paren` groups (which contain nested Operand[]).
 */
function resolveOperandValue(
  value: OperandValue,
  ctx: ResolveContext,
): number {
  switch (value.kind) {
    case "number":
      return value.value;
    case "dice":
      return resolveToken({ kind: "dice", expression: value.expression }, ctx);
    case "attribute":
      return resolveToken({ kind: "attribute", attribute: value.attribute }, ctx);
    case "practice":
      return resolveToken({ kind: "practice", practice: value.practice }, ctx);
    case "derived":
      return resolveToken({ kind: "derived", which: value.which }, ctx);
    case "behavior":
      return resolveToken({ kind: "behavior", name: value.name }, ctx);
    case "keyword":
      return 0; // tags contribute 0 to the numeric accumulator
    case "runtime":
      return resolveToken(
        { kind: "runtime", name: value.name, hint: value.hint },
        ctx,
      );
    case "paren":
      // Recursive: a paren group is itself a list of operands.
      // Tags inside paren groups are preserved at the inner level
      // and bubbled up via the EquationResult.
      const inner = resolveEquation(value.operands, ctx);
      return inner.numeric;
  }
}

// =============================================================================
// Operator application
// =============================================================================

/**
 * Apply a single arithmetic operator to two numbers. Returns
 * the new accumulator value. For percentages (e.g. "10%"),
 * treats the right operand as a fraction of the LEFT operand.
 */
function applyOperator(
  accumulator: number,
  op: Operator,
  rightOperand: number,
): number {
  switch (op) {
    case "+":
      return accumulator + rightOperand;
    case "-":
      return accumulator - rightOperand;
    case "*":
      return accumulator * rightOperand;
    case "/":
      if (rightOperand === 0) {
        // Division by zero — return accumulator unchanged (safe default).
        return accumulator;
      }
      return accumulator / rightOperand;
    case "%":
      // "X% Y" semantics: Y is X% of the accumulator. E.g.
      // "+ 10% × PB" with accumulator=0 → 0 + (0 * 0.1) = 0.
      // With a prior accumulator of 10: 10 + (10 * 0.1) = 11.
      return accumulator + accumulator * rightOperand;
  }
}

// =============================================================================
// Equation resolution
// =============================================================================

/**
 * Resolve an equation (Operand[]) to a number + tags.
 *
 * Walks operands left-to-right:
 *   1. The first operand's op is conventionally "+" — the
 *      accumulator starts at 0 and the first value is added.
 *   2. For each subsequent operand, resolve the value and
 *      apply the op to the accumulator.
 *   3. Keyword operands ([fire]) contribute 0 to the numeric
 *      accumulator but are appended to the tags list.
 *   4. Paren groups are recursive — their inner numeric
 *      result is used as the operand's value, and any inner
 *      tags are bubbled up.
 *
 * Returns {numeric: 0, tags: []} for an empty operands list.
 */
export function resolveEquation(
  operands: readonly Operand[],
  ctx: ResolveContext,
): EquationResult {
  let numeric = 0;
  const tags: string[] = [];

  for (const operand of operands) {
    // Phase 8.L: pass the operand directly (not operand.value) —
    // the Operand type has `which` for derived/attribute, not
    // nested `value`. resolveOperandValue expects a ValueToken.
    const value = resolveOperandValue(operand as unknown as Parameters<typeof resolveOperandValue>[0], ctx);

    // Collect keywords (tags) — preserve them on the result.
    const opAsAny = operand as unknown as { kind: string; value?: string };
    if (opAsAny.kind === "keyword" && typeof opAsAny.value === "string") {
      tags.push(opAsAny.value);
    }

    // For paren groups, also collect any inner tags.
    if (opAsAny.kind === "paren") {
      const inner = resolveEquation(
        (operand as unknown as { operands: readonly typeof operand[] }).operands,
        ctx,
      );
      for (const tag of inner.tags) {
        tags.push(tag);
      }
      // value already includes the inner numeric, but we need
      // to apply the op to the OUTER accumulator.
      numeric = applyOperator(numeric, ((operand as unknown as { op?: string }).op ?? "+") as Parameters<typeof applyOperator>[1], inner.numeric);
    } else {
      numeric = applyOperator(numeric, ((operand as unknown as { op?: string }).op ?? "+") as Parameters<typeof applyOperator>[1], value);
    }
  }

  return { numeric, tags };
}

// =============================================================================
// Modifier-level integration
// =============================================================================

/**
 * Resolve a modifier's value, dispatching to either the runtime
 * resolver (for typed ValueTokens in mod.value) or the equation
 * resolver (for Operand[] in metadata.operands).
 *
 * If both are present, equation takes precedence (it's the
 * authoritative expression). Otherwise, plain numeric values
 * pass through unchanged.
 *
 * Returns {numeric, tags}. The tags are preserved on the
 * ModifierContribution for downstream display.
 */
export function resolveModifierValue(
  mod: {
    readonly value: unknown;
    readonly metadata?: Readonly<Record<string, unknown>>;
  },
  ctx: ResolveContext,
): EquationResult {
  // Try equation path first.
  const meta = mod.metadata as Record<string, unknown> | undefined;
  const operands = meta?.["operands"];
  if (Array.isArray(operands) && operands.length > 0) {
    return resolveEquation(operands as readonly Operand[], ctx);
  }

  // Fall back to single-token or plain numeric.
  const numeric = resolveTokenLike(mod.value, ctx);
  return { numeric, tags: [] };
}

/**
 * Like resolveToken but accepts a generic value (number, string,
 * boolean, or typed ValueToken). Wraps runtime-resolver's
 * resolveValue to keep callers consistent.
 */
function resolveTokenLike(
  value: unknown,
  ctx: ResolveContext,
): number {
  // Inline a minimal dispatch to avoid importing the bigger
  // resolveValue — we don't want to pull in JSON parsing here.
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && "kind" in value) {
    return resolveToken(value as never, ctx);
  }
  return 0;
}