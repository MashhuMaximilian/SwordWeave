/**
 * equation-resolver.test.ts — Phase 8.I i2.5 (Mashu 2026-08-05)
 *
 * Tests for equation evaluation: mixed expressions with runtime
 * tokens, paren groups, dice, math operators, and keyword tags.
 *
 * The user (Mashu) flagged that equations can mix expressions
 * — `PB + (level / 4) [fire]` mixes runtime tokens (PB, level),
 * math (/4), and tags ([fire]). The resolver must handle all
 * three.
 */
import { describe, expect, it } from "vitest";
import { resolveEquation } from "../equation-resolver";
import type { Operand } from "@/types/modifier";
import type { ResolveContext } from "../runtime-resolver";

const ctx: ResolveContext = {
  level: 17,
  pb: 6, // L17: 2 + floor(16/4) = 6
  // Resolver uses engine's canonical attribute keys: physical | mental | magical
  // (the form's "magical" chip is normalized at lookup time).
  attributes: { physical: 5, mental: 4, magical: 3 } as never,
  practices: {
    awareness: 11,
    fieldcraft: 9,
    influence: 7,
    reason: 10,
    mysticism: 8,
    knowledge: 6,
    communion: 5,
    prowess: 12,
    finesse: 7,
    intuition: 6,
  },
  behaviorVariables: { blockValue: 6 },
};

describe("resolveEquation — basic arithmetic (Phase 8.I i2.5)", () => {
  it("empty operands returns 0", () => {
    expect(resolveEquation([], ctx)).toEqual({ numeric: 0, tags: [] });
  });

  it("single number operand", () => {
    const ops: Operand[] = [{ op: "+", value: { kind: "number", value: 5 } }];
    expect(resolveEquation(ops, ctx)).toEqual({ numeric: 5, tags: [] });
  });

  it("two number operands with + op", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 5 } },
      { op: "+", value: { kind: "number", value: 3 } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(8);
  });

  it("two number operands with - op", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 10 } },
      { op: "-", value: { kind: "number", value: 3 } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(7);
  });

  it("multiplication", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 6 } },
      { op: "*", value: { kind: "number", value: 2 } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(12);
  });

  it("division", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 10 } },
      { op: "/", value: { kind: "number", value: 2 } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(5);
  });

  it("division by zero is safe (no crash, returns accumulator)", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 10 } },
      { op: "/", value: { kind: "number", value: 0 } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(10);
  });

  it("percent op (X% Y): 10 + 10% × 2 = 10 + 10*0.1 = 11", () => {
    // "10% 2" semantics: 2 is 10% of 10. So result is 10 + (10 * 0.1) = 11.
    // Wait — let me re-check. The op % means "rightOperand is X% of left".
    // So accumulator (10) gets + (10 * rightOperand) = 10 + 10*0.1 = 11.
    // But the user might want "10% of 2" semantics: 10 * 0.1 * 2 = 2.
    // Let's see what we implemented: `accumulator + accumulator * rightOperand`.
    // For our test case: accumulator=10, rightOperand=0.1 (i.e. "10%").
    // result = 10 + 10*0.1 = 11. That matches "X% of accumulator".
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 10 } },
      { op: "%", value: { kind: "number", value: 0.1 } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(11);
  });
});

describe("resolveEquation — runtime tokens (Phase 8.I i2.5)", () => {
  it("PB token resolves", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "derived", which: "pb" } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(6);
  });

  it("PB + 2", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "derived", which: "pb" } },
      { op: "+", value: { kind: "number", value: 2 } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(8);
  });

  it("LEVEL token resolves", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "derived", which: "level" } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(17);
  });

  it("/physical/ token resolves to attribute", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "attribute", attribute: "physical" } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(5);
  });

  it("/awareness/ token resolves to practice", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "practice", practice: "awareness" } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(11);
  });

  it("/blockValue/ token resolves to behavior variable", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "behavior", name: "blockValue" } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(6);
  });
});

describe("resolveEquation — dice (Phase 8.I i2.5)", () => {
  it("2d6 averages to 7", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "dice", expression: "2d6" } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(7);
  });

  it("1d20+5 averages to 15.5", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "dice", expression: "1d20+5" } },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(15.5);
  });

  it("dice + PB chip", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "dice", expression: "1d6" } },
      { op: "+", value: { kind: "derived", which: "pb" } },
    ];
    // 1d6 avg = 3.5, PB = 6 → 9.5
    expect(resolveEquation(ops, ctx).numeric).toBe(9.5);
  });
});

describe("resolveEquation — keyword tags (Phase 8.I i2.5)", () => {
  it("keyword operand contributes 0 numeric and adds tag", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 5 } },
      { op: "+", value: { kind: "keyword", text: "fire" } },
    ];
    const r = resolveEquation(ops, ctx);
    expect(r.numeric).toBe(5);
    expect(r.tags).toEqual(["fire"]);
  });

  it("multiple keyword tags preserved", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "number", value: 3 } },
      { op: "+", value: { kind: "keyword", text: "fire" } },
      { op: "+", value: { kind: "keyword", text: "piercing" } },
    ];
    const r = resolveEquation(ops, ctx);
    expect(r.numeric).toBe(3);
    expect(r.tags).toEqual(["fire", "piercing"]);
  });
});

describe("resolveEquation — paren groups (Phase 8.I i2.5)", () => {
  it("paren group: (10 + 5) = 15", () => {
    const ops: Operand[] = [
      {
        op: "+",
        value: {
          kind: "paren",
          operands: [
            { op: "+", value: { kind: "number", value: 10 } },
            { op: "+", value: { kind: "number", value: 5 } },
          ],
        },
      },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(15);
  });

  it("Mashu's example: PB + (level / 4) [fire]", () => {
    const ops: Operand[] = [
      { op: "+", value: { kind: "derived", which: "pb" } },
      {
        op: "+",
        value: {
          kind: "paren",
          operands: [
            { op: "+", value: { kind: "derived", which: "level" } },
            { op: "/", value: { kind: "number", value: 4 } },
          ],
        },
      },
      { op: "+", value: { kind: "keyword", text: "fire" } },
    ];
    const r = resolveEquation(ops, ctx);
    // PB = 6, (level/4) = 17/4 = 4.25. 6 + 4.25 = 10.25.
    expect(r.numeric).toBe(10.25);
    expect(r.tags).toEqual(["fire"]);
  });

  it("nested paren groups: (10 + (5 - 2)) = 13", () => {
    const ops: Operand[] = [
      {
        op: "+",
        value: {
          kind: "paren",
          operands: [
            { op: "+", value: { kind: "number", value: 10 } },
            {
              op: "+",
              value: {
                kind: "paren",
                operands: [
                  { op: "+", value: { kind: "number", value: 5 } },
                  { op: "-", value: { kind: "number", value: 2 } },
                ],
              },
            },
          ],
        },
      },
    ];
    expect(resolveEquation(ops, ctx).numeric).toBe(13);
  });

  it("tag inside paren group bubbles up", () => {
    const ops: Operand[] = [
      {
        op: "+",
        value: {
          kind: "paren",
          operands: [
            { op: "+", value: { kind: "number", value: 5 } },
            { op: "+", value: { kind: "keyword", text: "inner" } },
          ],
        },
      },
    ];
    const r = resolveEquation(ops, ctx);
    expect(r.numeric).toBe(5);
    expect(r.tags).toEqual(["inner"]);
  });
});

describe("resolveEquation — full Mashu example (Phase 8.I i2.5)", () => {
  it("PB + (level / 4) [fire] resolves correctly", () => {
    // The user's exact example.
    const ops: Operand[] = [
      { op: "+", value: { kind: "derived", which: "pb" } },
      {
        op: "+",
        value: {
          kind: "paren",
          operands: [
            { op: "+", value: { kind: "derived", which: "level" } },
            { op: "/", value: { kind: "number", value: 4 } },
          ],
        },
      },
      { op: "+", value: { kind: "keyword", text: "fire" } },
    ];
    const r = resolveEquation(ops, ctx);
    // At L17 (PB=6, level=17): 6 + 17/4 = 6 + 4.25 = 10.25
    expect(r.numeric).toBe(10.25);
    expect(r.tags).toContain("fire");
  });
});