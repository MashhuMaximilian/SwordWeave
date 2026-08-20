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

  // Operand = { op: Operator, value: OperandValue }.
  // Each operand carries its own operator (no implicit "+" for the
  // first operand — it still uses its declared op). The first
  // operand's op is conventionally "+" but we don't enforce that;
  // we just start the accumulator at 0 and apply the op.
  for (let i = 0; i < operands.length; i++) {
    const operand = operands[i];
    if (!operand) continue;

    // Two operand shapes are supported:
    //   A. Canonical (types/modifier.ts Operand):
    //        { op: Operator, value: OperandValue }
    //   B. Sweep / legacy (sweep.test.ts): bare OperandValue with
    //      optional {operator: "+"} separator operands between
    //      values. Format:
    //        [{kind:"derived",which:"pb"}, {operator:"+"},
    //         {kind:"number",value:2}]
    //
    // Detect which format by checking for .op on the operand.
    const isCanonical = "op" in operand && typeof operand.op === "string";
    const isLegacySeparator = "operator" in operand;

    if (isLegacySeparator) {
      // Pure operator separator — no numeric contribution. The op
      // is captured when the next operand lands (see legacy path
      // below).
      continue;
    }

    if (isCanonical) {
      // Format A. Read operand.value.kind.
      const value = operand.value;
      const kind = value.kind;
      let resolved: number;
      if (kind === "keyword") {
        tags.push(value.text);
        resolved = 0;
      } else if (kind === "paren") {
        const inner = resolveEquation(value.operands, ctx);
        for (const tag of inner.tags) {
          tags.push(tag);
        }
        resolved = inner.numeric;
      } else {
        resolved = resolveOperandValue(value, ctx);
      }
      numeric = applyOperator(numeric, operand.op, resolved);
    } else {
      // Format B — bare OperandValue. Use operand.kind directly.
      // The operator for this value is whatever separator
      // precedes it (default "+"). For the first operand, use "+".
      let op: Operator = "+";
      // Look at previous operand for legacy separator's operator.
      if (i > 0) {
        const prev = operands[i - 1];
        if (prev && "operator" in prev && typeof prev.operator === "string") {
          op = prev.operator as Operator;
        }
      }

      // Operand IS an OperandValue in format B.
      const opValue = operand as unknown as OperandValue;
      const kind = (operand as { kind?: string }).kind;
      let resolved: number;
      if (kind === "keyword") {
        tags.push((operand as { text?: string }).text ?? "");
        resolved = 0;
      } else if (kind === "paren") {
        const inner = resolveEquation(
          (operand as { operands?: readonly Operand[] }).operands ?? [],
          ctx,
        );
        for (const tag of inner.tags) {
          tags.push(tag);
        }
        resolved = inner.numeric;
      } else {
        resolved = resolveOperandValue(opValue, ctx);
      }
      numeric = applyOperator(numeric, op, resolved);
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