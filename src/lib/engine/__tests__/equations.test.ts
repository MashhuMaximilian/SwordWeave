// =============================================================================
// Phase 7.5 v4 — Equation resolver tests.
//
// Tests resolveEquation: takes Operand[] and produces an
// EquationResolution (numeric, tags, warnings). The resolver
// is pure (no character context) — runtime tokens (attribute,
// practice, derived) and dice expressions stay as
// structure/dice outputs to be filled in at slot time.
// =============================================================================

import { describe, expect, it } from "vitest";
import type { Operand } from "@/types/modifier";
import {
  operandsFromTokens,
  renderEquation,
  tokensFromOperands,
  type Operator,
} from "@/types/modifier";
import { resolveEquation } from "../equations";

// =============================================================================
// Helper builders
// =============================================================================

const num = (value: number, op: Operator = "+"): Operand => ({
  op, value: { kind: "number", value },
});
const diceOp = (expression: string, op: Operator = "+"): Operand => ({
  op, value: { kind: "dice", expression },
});
const attr = (a: "physical" | "mental" | "magic-abstract", op: Operator = "+"): Operand => ({
  op, value: { kind: "attribute", attribute: a },
});
const derivedOp = (which: "pb" | "pb_half" | "level", op: Operator = "+"): Operand => ({
  op, value: { kind: "derived", which },
});
const practice = (p: string, op: Operator = "+"): Operand => ({
  op, value: { kind: "practice", practice: p as never },
});
const keyword = (text: string, op: Operator = "+"): Operand => ({
  op, value: { kind: "keyword", text },
});
const paren = (operands: readonly Operand[], op: Operator = "+"): Operand => ({
  op, value: { kind: "paren", operands },
});

// =============================================================================
// Basic arithmetic
// =============================================================================

describe("resolveEquation — basic arithmetic", () => {
  it("single number → number", () => {
    const r = resolveEquation([num(5)]);
    expect(r.numeric).toEqual({ kind: "number", value: 5 });
    expect(r.tags).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("addition", () => {
    const r = resolveEquation([num(2), num(3, "+")]);
    expect(r.numeric).toEqual({ kind: "number", value: 5 });
  });

  it("subtraction", () => {
    const r = resolveEquation([num(10), num(3, "-")]);
    expect(r.numeric).toEqual({ kind: "number", value: 7 });
  });

  it("multiplication", () => {
    const r = resolveEquation([num(4), num(5, "*")]);
    expect(r.numeric).toEqual({ kind: "number", value: 20 });
  });

  it("division", () => {
    const r = resolveEquation([num(10), num(2, "/")]);
    expect(r.numeric).toEqual({ kind: "number", value: 5 });
  });

  it("division by zero warns + skips", () => {
    const r = resolveEquation([num(10), num(0, "/")]);
    expect(r.numeric).toEqual({ kind: "number", value: 10 });
    expect(r.warnings).toContain("Division by zero — operand skipped.");
  });

  it("percent: 100 * 50% → 50 (not 100.5)", () => {
    // Note: percent treats the operand as a multiplier/100.
    // So "100 + 50%" applies 50/100 = 0.5 to the accumulator,
    // giving 100 + 0.5 = 100.5? No — the design is:
    //   a + b% means a * (b/100) added to a.
    // But my applyOp treats "% b" as "a * (b/100)", which
    // gives 100 * 0.5 = 50 as the result of the % op applied
    // to 100. The user expectation "10% × PB" gives 0.1 × PB.
    // So 100 + 50% should give 100 * 0.5 = 50 (the % op
    // REPLACES the running value with a% of it).
    // Actually that's confusing. Let me clarify:
    //   - If the user writes "100 + 50%", they probably mean
    //     100 + (50% of 100) = 100 + 50 = 150.
    //   - If the user writes "PB * 10%", they mean
    //     PB * 0.1 = 0.1 × PB.
    // These are two different things. The current applyOp
    // collapses both to "a * (b/100)" which is the multiply
    // case, not the additive case.
    //
    // Decision: in v4, `%` is the MULTIPLY semantic — it's
    // a shorthand for "multiply by N/100". Additive percent
    // is "a + a * (b/100)" which is "a * (1 + b/100)" — we'd
    // need a separate operator for that. For now `%` means
    // multiply by percent.
    const r = resolveEquation([num(100), num(50, "%")]);
    // 100 → 100 * 0.5 = 50
    expect(r.numeric).toEqual({ kind: "number", value: 50 });
  });

  it("percent for fractional: 200 + 25% → 50 (200 * 0.25)", () => {
    const r = resolveEquation([num(200), num(25, "%")]);
    expect(r.numeric).toEqual({ kind: "number", value: 50 });
  });
});

// =============================================================================
// Left-to-right (no precedence)
// =============================================================================

describe("resolveEquation — left-to-right evaluation", () => {
  it("2 + 3 * 4 = 20 (NOT 14) — no precedence", () => {
    const r = resolveEquation([num(2), num(3, "+"), num(4, "*")]);
    expect(r.numeric).toEqual({ kind: "number", value: 20 });
  });

  it("10 - 2 - 1 = 7 (NOT 9) — left-to-right", () => {
    const r = resolveEquation([num(10), num(2, "-"), num(1, "-")]);
    expect(r.numeric).toEqual({ kind: "number", value: 7 });
  });
});

// =============================================================================
// Paren groups
// =============================================================================

describe("resolveEquation — paren groups", () => {
  it("PB + (2 * 3) = PB + 6 (paren overrides L-to-R)", () => {
    const r = resolveEquation([
      derivedOp("pb"),
      paren([num(2), num(3, "*")], "+"),
    ]);
    // PB resolves to structure, paren resolves to number 6.
    // structure + number → structure (can't reduce).
    expect(r.numeric.kind).toBe("structure");
    expect(r.numeric.kind === "structure" ? r.numeric.preview : "").toContain("(");
  });

  it("nested parens: PB + (level / 4) + 2", () => {
    const r = resolveEquation([
      derivedOp("pb"),
      paren([derivedOp("level"), num(4, "/")], "+"),
      num(2, "+"),
    ]);
    expect(r.numeric.kind).toBe("structure");
  });

  it("empty paren warns + skips (treated as 0)", () => {
    const r = resolveEquation([
      num(5),
      paren([], "+"),
    ]);
    // Empty paren resolves to 0; 5 + 0 = 5.
    expect(r.numeric).toEqual({ kind: "number", value: 5 });
  });
});

// =============================================================================
// Mixed dice + number
// =============================================================================

describe("resolveEquation — dice + number", () => {
  it("2d6 + 3 → '2d6+3' dice expression", () => {
    const r = resolveEquation([diceOp("2d6"), num(3, "+")]);
    expect(r.numeric).toEqual({ kind: "dice", expression: "2d6+3" });
  });

  it("2d6 - 1 → '2d6-1'", () => {
    const r = resolveEquation([diceOp("2d6"), num(1, "-")]);
    expect(r.numeric).toEqual({ kind: "dice", expression: "2d6-1" });
  });

  it("2 + 2d6 → structure (can't lead dice with number)", () => {
    const r = resolveEquation([num(2), diceOp("2d6", "+")]);
    expect(r.numeric.kind).toBe("structure");
  });

  it("dice × dice → structure (unusual)", () => {
    const r = resolveEquation([diceOp("1d6"), diceOp("1d4", "*")]);
    expect(r.numeric.kind).toBe("structure");
  });
});

// =============================================================================
// Runtime tokens (attribute, practice, derived, behavior)
// =============================================================================

describe("resolveEquation — runtime tokens", () => {
  it("PB alone → structure (can't resolve without character context)", () => {
    const r = resolveEquation([derivedOp("pb")]);
    expect(r.numeric.kind).toBe("structure");
  });

  it("PB + 2 → structure (PB keeps it unreduced)", () => {
    const r = resolveEquation([derivedOp("pb"), num(2, "+")]);
    expect(r.numeric.kind).toBe("structure");
  });

  it("physical + mental → structure (attribute tokens)", () => {
    const r = resolveEquation([attr("physical"), attr("mental", "+")]);
    expect(r.numeric.kind).toBe("structure");
  });

  it("awareness → structure (practice token)", () => {
    const r = resolveEquation([practice("awareness")]);
    expect(r.numeric.kind).toBe("structure");
  });
});

// =============================================================================
// Keywords (tags)
// =============================================================================

describe("resolveEquation — keywords (tags)", () => {
  it("2d6 + [fire] → dice expr + tag", () => {
    const r = resolveEquation([
      diceOp("2d6"),
      keyword("fire"),
    ]);
    // Note: keyword operand without explicit operator; we
    // treat its op as tag-passthrough.
    expect(r.numeric).toEqual({ kind: "dice", expression: "2d6" });
    expect(r.tags).toContain("fire");
  });

  it("PB + 2 + 2d6 + [piercing] → structure + tag", () => {
    const r = resolveEquation([
      derivedOp("pb"),
      num(2, "+"),
      diceOp("2d6", "+"),
      keyword("piercing"),
    ]);
    expect(r.tags).toContain("piercing");
  });

  it("mixed numeric + keyword paren warns", () => {
    const r = resolveEquation([
      paren([
        num(2),
        keyword("fire"),
      ]),
      num(3, "+"),
    ]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Render equation (display string)
// =============================================================================

describe("renderEquation", () => {
  it("simple sum", () => {
    expect(renderEquation([num(2), num(3, "+")])).toBe("2 + 3");
  });

  it("PB + 2 - level/4", () => {
    expect(renderEquation([
      derivedOp("pb"),
      num(2, "+"),
      derivedOp("level", "-"),
      num(4, "/"),
    ])).toBe("PB + 2 − level ÷ 4");
  });

  it("paren group: PB + (level/4)", () => {
    expect(renderEquation([
      derivedOp("pb"),
      paren([derivedOp("level"), num(4, "/")], "+"),
    ])).toBe("PB + (level ÷ 4)");
  });

  it("tag rendered as [fire]", () => {
    expect(renderEquation([
      diceOp("2d6"),
      keyword("fire"),
    ])).toBe("2d6 [fire]");
  });

  it("empty equation", () => {
    expect(renderEquation([])).toBe("");
  });
});

// =============================================================================
// Migration round-trip (legacy tokens[] ↔ new operands[])
// =============================================================================

describe("operandsFromTokens / tokensFromOperands", () => {
  it("migrate tokens → operands", () => {
    const operands = operandsFromTokens([
      { kind: "derived", which: "pb" },
      { kind: "number", value: 2 },
    ]);
    expect(operands).toEqual([
      { op: "+", value: { kind: "derived", which: "pb" } },
      { op: "+", value: { kind: "number", value: 2 } },
    ]);
  });

  it("round-trip: tokens → operands → tokens (lossy on parens)", () => {
    const tokens = [
      { kind: "derived", which: "pb" } as const,
      { kind: "number", value: 2 } as const,
    ];
    const operands = operandsFromTokens(tokens);
    const back = tokensFromOperands(operands);
    expect(back).toEqual(tokens);
  });

  it("keyword tokens preserved", () => {
    const operands = operandsFromTokens([
      { kind: "number", value: 5 },
      { kind: "keyword", text: "fire" },
    ]);
    expect(operands[1]).toEqual({
      op: "+",
      value: { kind: "keyword", text: "fire" },
    });
  });
});