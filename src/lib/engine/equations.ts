/**
 * equations.ts — Phase 7.5 v4 equation resolver.
 *
 * Pure functions. No I/O. No DB.
 *
 * An equation is `Operand[]` — a flat list of (operator, value)
 * pairs, where value is a flat token (number/dice/runtime/keyword)
 * OR a paren group (recursive Operand[]).
 *
 * The resolver walks the operands and produces an
 * `EquationResolution` with three parts:
 *   1. numeric: number | dice (the numeric value of the expression)
 *   2. tags:   string[] (the keyword operands, carried through)
 *   3. warnings: string[] (soft-warns — empty parens, div-by-zero
 *      templates, etc.)
 *
 * Operator semantics (left-to-right, parens override precedence):
 *
 *   +   a + b
 *   -   a - b
 *   *   a × b
 *   /   a ÷ b   (b=0 → warn, treat as a)
 *   %   a × (b/100)   "10% × PB" → 0.1 × PB
 *
 * Paren groups are evaluated recursively first; their result
 * feeds into the outer operator sequence.
 *
 * Mixed numeric + keyword expressions: numeric parts compute,
 * keyword parts flow through to `tags`. This is how Mashu
 * wants to write "PB + 2 + 2d6 fire" — the "fire" tags the
 * expression as fire-damage without breaking arithmetic.
 *
 * Soft-warn list (additive — resolver never throws):
 *   - Empty paren group
 *   - Division by zero literal (template)
 *   - Mixed numeric + keyword in same paren (semantically odd
 *     but valid; just warns)
 *
 * This resolver is intentionally STATIC — it doesn't roll
 * dice. Dice operands stay as `{kind:"dice", expression}` in
 * the numeric slot and are flagged in `warnings` so the
 * character sheet rolls them at slot time. Phase 8 will
 * wire dice rolling into the live resolver; for now the
 * equation editor produces a structural representation.
 */

import type {
  Operand,
  OperandValue,
  Operator,
  ValueToken,
} from "@/types/modifier";

// =============================================================================
// Resolution output
// =============================================================================

/**
 * The result of resolving an equation. Numeric parts and tag
 * parts are kept separate so the engine can apply tags as
 * labels and dice as rolls.
 */
export interface EquationResolution {
  /**
   * Numeric parts. Either a single number, a single dice
   * expression (rolled at slot time), or a structural
   * expression if mixed (e.g. "(PB × 2) + 2d6" stays as
   * an unrolled structure).
   */
  readonly numeric: NumericResolution;
  /**
   * Tag operands carried through. Empty if no keywords.
   */
  readonly tags: readonly string[];
  /**
   * Soft-warns. Never fatal — the resolver still returns
   * a result. Surface these at character-sheet render time.
   */
  readonly warnings: readonly string[];
}

/**
 * The numeric part of a resolution. Either:
 *   - {kind:"number", value:N} — fully reduced
 *   - {kind:"dice", expression} — needs rolling
 *   - {kind:"structure", preview} — mixed, can't reduce
 *     to a single value (display the preview verbatim)
 */
export type NumericResolution =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "dice"; readonly expression: string }
  | { readonly kind: "structure"; readonly preview: string };

// =============================================================================
// Main entry point
// =============================================================================

/**
 * Resolve an equation. Pure function. Returns structured
 * output; never throws. Soft-warns accumulate in `warnings`.
 */
export function resolveEquation(operands: readonly Operand[]): EquationResolution {
  const warnings: string[] = [];
  const tags: string[] = [];
  const numericParts: NumericOperand[] = [];

  // First pass: extract keywords (tags), recurse paren groups
  // (always — parens are recursive structures), and pass flat
  // numeric operands through.
  for (const o of operands) {
    const v = o.value;
    if (v.kind === "keyword") {
      tags.push(v.text);
      continue;
    }
    if (v.kind === "paren") {
      const contentsKind = classifyParenContents(v.operands);
      if (contentsKind === "mixed") {
        warnings.push(
          "Mixed numeric+keyword paren group — numeric part will resolve, tag part will pass through.",
        );
      }
      const inner = resolveEquation(v.operands);
      tags.push(...inner.tags);
      warnings.push(...inner.warnings);
      // If the paren contained only keywords (tag-only), we
      // skip the numeric aggregation; tags are already pushed.
      if (contentsKind === "tag" || contentsKind === "empty") continue;
      numericParts.push({
        op: o.op,
        value: {
          kind: "parenResolved",
          inner: inner.numeric,
          warnings: inner.warnings,
        },
      });
      continue;
    }
    // Flat numeric operand (number, dice, attribute, practice,
    // derived, behavior).
    numericParts.push({ op: o.op, value: toNumericOperandValue(v) });
  }

  // Second pass: validate each operand, build warnings.
  for (const part of numericParts) {
    validateOperand(part, warnings);
  }

  // Third pass: reduce numeric parts to a single value (if possible).
  const numeric = reduceNumeric(numericParts, warnings);

  return { numeric, tags, warnings };
}

// =============================================================================
// Internal types
// =============================================================================

interface NumericOperand {
  readonly op: Operator;
  readonly value: NumericOperandValue;
}

type NumericOperandValue =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "dice"; readonly expression: string }
  | { readonly kind: "attribute"; readonly attribute: string }
  | { readonly kind: "practice"; readonly practice: string }
  | { readonly kind: "derived"; readonly which: string }
  | { readonly kind: "behavior"; readonly name: string }
  // Phase 7.5 v4: deferred runtime reference. Resolves to a
  // placeholder (0 for "number" hint, "" for "text" hint) at
  // authoring time. The character-sheet resolver replaces this
  // with the actual value from the character's compiled state.
  | { readonly kind: "runtime"; readonly name: string; readonly hint: "number" | "text" }
  | {
    readonly kind: "parenResolved";
    readonly inner: NumericResolution;
    readonly warnings: readonly string[];
  };

// =============================================================================
// Helpers
// =============================================================================

function toNumericOperandValue(v: OperandValue): NumericOperandValue {
  // Caller has already classified this as "numeric" — keyword
  // is handled separately. The switch is exhaustive on
  // OperandValue minus "keyword" and "paren" (paren is handled
  // at a higher level via parenResolved).
  switch (v.kind) {
    case "number": return { kind: "number", value: v.value };
    case "dice": return { kind: "dice", expression: v.expression };
    case "attribute": return { kind: "attribute", attribute: v.attribute };
    case "practice": return { kind: "practice", practice: v.practice };
    case "derived": return { kind: "derived", which: v.which };
    case "behavior": return { kind: "behavior", name: v.name };
    case "runtime":
      // Phase 7.5 v4: deferred runtime reference. Treated as a
      // numeric operand with a soft-warn at character-sheet
      // render time (the actual value comes from the character
      // sheet's compiled state). At authoring time we treat
      // it as a placeholder that will be replaced.
      return { kind: "runtime", name: v.name, hint: v.hint };
    case "keyword":
      // Should never reach here — classify() routes keyword
      // operands to tags.
      throw new Error("toNumericOperandValue: keyword operand reached numeric path");
    case "paren":
      // Should never reach here — classify() routes paren to
      // recursive resolveEquation, then parenResolved.
      throw new Error("toNumericOperandValue: paren operand reached numeric path");
  }
}

/**
 * Classify the *contents* of a paren group (not the paren itself,
 * which is always recursed). Used to decide whether to push a
 * paren to numericParts or skip it as tag-only.
 *
 *   - "tag" if all operands are keywords (the paren has no
 *     numeric effect — its tags have already been pushed).
 *   - "mixed" if there are both tags and numeric — we still
 *     add the paren to numericParts but warn.
 *   - "numeric" if all operands are numeric — normal case.
 *   - "empty" for an empty paren — resolve as 0.
 */
export type ParenContentsKind = "numeric" | "tag" | "mixed" | "empty";

export function classifyParenContents(
  operands: readonly Operand[],
): ParenContentsKind {
  if (operands.length === 0) return "empty";
  let hasTag = false;
  let hasNumeric = false;
  for (const o of operands) {
    if (o.value.kind === "keyword") {
      hasTag = true;
      continue;
    }
    if (o.value.kind === "paren") {
      // Nested paren — recurse via resolveEquation's logic.
      const inner = classifyParenContents(o.value.operands);
      if (inner === "tag") hasTag = true;
      else if (inner === "numeric" || inner === "mixed") hasNumeric = true;
      continue;
    }
    hasNumeric = true;
  }
  if (hasTag && hasNumeric) return "mixed";
  if (hasTag) return "tag";
  if (hasNumeric) return "numeric";
  return "empty";
}

function classify(value: OperandValue): "numeric" | "tag" | "mixed" {
  if (value.kind === "keyword") return "tag";
  if (value.kind === "paren") {
    let hasTag = false;
    let hasNumeric = false;
    for (const o of value.operands) {
      const k = classify(o.value);
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

function validateOperand(part: NumericOperand, warnings: string[]): void {
  if (part.value.kind === "parenResolved") {
    warnings.push(...part.value.warnings);
    return;
  }
  // Division by zero literal: warn at authoring time (not a runtime
  // error — the resolver still treats it as a no-op, but a DM
  // should see the warning when authoring).
  if (part.op === "/" && part.value.kind === "number" && part.value.value === 0) {
    warnings.push(`Division by zero literal — operand will be skipped.`);
  }
}

function reduceNumeric(
  parts: readonly NumericOperand[],
  warnings: string[],
): NumericResolution {
  if (parts.length === 0) return { kind: "number", value: 0 };

  // Walk left-to-right, applying operators. We don't honor
  // operator precedence (no PEMDAS) — operands are already
  // paren-grouped if the author wants precedence. This keeps
  // the resolver simple and predictable.
  let acc: NumericResolution;
  const first = parts[0];
  if (!first) return { kind: "number", value: 0 };

  acc = numericValueOf(first.value, warnings);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    const rhs = numericValueOf(part.value, warnings);

    if (acc.kind === "structure" || rhs.kind === "structure") {
      // Can't reduce further — return as structure preview.
      return {
        kind: "structure",
        preview: parts
          .map((p) => numericOperandToString(p))
          .join(" "),
      };
    }

    acc = applyOp(part.op, acc, rhs, warnings);
  }

  return acc;
}

function numericValueOf(
  v: NumericOperandValue,
  warnings: string[],
): NumericResolution {
  switch (v.kind) {
    case "number": return { kind: "number", value: v.value };
    case "dice": return { kind: "dice", expression: v.expression };
    case "attribute":
    case "practice":
    case "derived":
    case "behavior":
      // Runtime tokens — we can't resolve them statically
      // (they need a character context). Return as structure.
      return {
        kind: "structure",
        preview: tokenLikeToString(v),
      };
    case "runtime":
      // Phase 7.5 v4: deferred runtime reference. Resolve to a
      // placeholder. The character-sheet engine replaces this
      // with the actual value at slot time. Soft-warn so the
      // author knows the value is being held open.
      if (v.hint === "number") {
        return { kind: "number", value: 0 };
      }
      return { kind: "structure", preview: `/${v.name}/` };
    case "parenResolved":
      return v.inner;
  }
}

function applyOp(
  op: Operator,
  a: NumericResolution,
  b: NumericResolution,
  warnings: string[],
): NumericResolution {
  // If either side is dice, keep dice if the other is dice.
  // If either side is a runtime-token structure, return as
  // structure (we can't reduce further).
  if (a.kind === "structure" || b.kind === "structure") {
    return a; // Caller handles structure aggregation.
  }

  if (a.kind === "dice" || b.kind === "dice") {
    // Mixed dice+number: numeric part folds into the dice
    // expression via flat-string concat (parser-friendly).
    if (a.kind === "dice" && b.kind === "number") {
      const expr = `${a.expression}${formatDiceModifier(op, b.value)}`;
      return { kind: "dice", expression: expr };
    }
    if (a.kind === "number" && b.kind === "dice") {
      // We can't lead with a number on a dice expression
      // (it'd parse as dice_count). Treat as structure.
      return {
        kind: "structure",
        preview: `${a.value} ${op} ${b.expression}`,
      };
    }
    // Both dice — TS needs explicit narrowing because the
    // outer "a.kind === 'dice' || b.kind === 'dice'" doesn't
    // imply both branches.
    if (a.kind === "dice" && b.kind === "dice") {
      return {
        kind: "structure",
        preview: `${a.expression} ${op} ${b.expression}`,
      };
    }
  }

  // Number × number.
  if (a.kind === "number" && b.kind === "number") {
    const an = a.value;
    const bn = b.value;
    switch (op) {
      case "+": return { kind: "number", value: an + bn };
      case "-": return { kind: "number", value: an - bn };
      case "*": return { kind: "number", value: an * bn };
      case "/":
        if (bn === 0) {
          warnings.push("Division by zero — operand skipped.");
          return a;
        }
        return { kind: "number", value: an / bn };
      case "%":
        // "a % b" → a * (b/100). E.g. "PB * 10%" → 0.1 * PB.
        return { kind: "number", value: an * (bn / 100) };
    }
  }

  // Unreachable — TS doesn't know the type narrowing is exhaustive.
  return a;
}

function formatDiceModifier(op: Operator, n: number): string {
  if (n === 0) return "";
  // The op determines the sign in the dice modifier:
  //   + N → +N, - N → -N, * N → *N, / N → /N, % N → *N/100
  // For dice expressions only + and - are meaningful; we
  // emit the op directly when it's + or -, otherwise fall
  // back to signed representation.
  if (op === "+") return `+${Math.abs(n)}`;
  if (op === "-") return `-${Math.abs(n)}`;
  // For * / % operators with a number on a dice expression,
  // we'd typically wrap in a paren or treat as structure.
  // Caller handles the structure case before reaching here.
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${Math.abs(n)}`;
}

function numericOperandToString(p: NumericOperand): string {
  const sym = operatorSymbol(p.op);
  const v = operandValueToString(p.value);
  if (sym === "+") return v;
  return `${sym} ${v}`;
}

function operandValueToString(v: NumericOperandValue): string {
  switch (v.kind) {
    case "number": return String(v.value);
    case "dice": return v.expression;
    case "attribute": return v.attribute;
    case "practice": return v.practice;
    case "derived": return v.which;
    case "behavior": return v.name;
    case "runtime": return `/${v.name}/`;
    case "parenResolved": return `(${v.inner.kind === "structure" ? v.inner.preview : numericResolutionToString(v.inner)})`;
  }
}

function tokenLikeToString(v: NumericOperandValue): string {
  switch (v.kind) {
    case "attribute": return v.attribute;
    case "practice": return v.practice;
    case "derived": return v.which;
    case "behavior": return v.name;
    default: return "?";
  }
}

function numericResolutionToString(r: NumericResolution): string {
  switch (r.kind) {
    case "number": return String(r.value);
    case "dice": return r.expression;
    case "structure": return r.preview;
  }
}

function operatorSymbol(op: Operator): string {
  switch (op) {
    case "+": return "+";
    case "-": return "−";
    case "*": return "×";
    case "/": return "÷";
    case "%": return "%";
  }
}

// =============================================================================
// Convenience — convert operands to ValueToken[] (legacy compat)
// =============================================================================

/**
 * Flatten equation operands to a ValueToken[] for legacy code
 * paths that don't yet understand equations. Parens are
 * flattened (lossy — drops grouping). Keywords are kept.
 */
export function equationToTokens(operands: readonly Operand[]): readonly ValueToken[] {
  const out: ValueToken[] = [];
  for (const o of operands) {
    flattenOperandToToken(o, out);
  }
  return out;
}

function flattenOperandToToken(o: Operand, out: ValueToken[]): void {
  const v = o.value;
  switch (v.kind) {
    case "number": out.push({ kind: "number", value: v.value }); return;
    case "dice": out.push({ kind: "dice", expression: v.expression }); return;
    case "attribute": out.push({ kind: "attribute", attribute: v.attribute }); return;
    case "practice": out.push({ kind: "practice", practice: v.practice }); return;
    case "derived": out.push({ kind: "derived", which: v.which }); return;
    case "behavior": out.push({ kind: "behavior", name: v.name }); return;
    case "keyword": out.push({ kind: "keyword", text: v.text }); return;
    case "runtime": out.push({ kind: "runtime", name: v.name, hint: v.hint }); return;
    case "paren":
      for (const inner of v.operands) flattenOperandToToken(inner, out);
      return;
  }
}