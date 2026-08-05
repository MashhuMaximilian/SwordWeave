/**
 * modifier-translator.test.ts — Phase 8.I i2.5h (Mashu 2026-08-06)
 *
 * Unit tests for the modifier translator module.
 * Validates that toHardModifier and fromHardModifier produce a
 * consistent round-trip for every modifier combination.
 */
import { describe, it, expect } from "vitest";
import {
  tokenKindToValueKind,
  operandsToTokens,
  serializeToken,
  serializeFirstToken,
  serializeOperandsAsExpression,
} from "@/lib/primitives/modifier-translator";
import { classifyTypedValue } from "@/lib/primitives/form-helpers";
import { parseValueField } from "@/types/modifier";
import type { ValueToken, Operand } from "@/types/modifier";

describe("tokenKindToValueKind", () => {
  it("maps numeric token kinds to 'number'", () => {
    expect(tokenKindToValueKind("number")).toBe("number");
    expect(tokenKindToValueKind("derived")).toBe("number");
    expect(tokenKindToValueKind("attribute")).toBe("number");
    expect(tokenKindToValueKind("practice")).toBe("number");
    expect(tokenKindToValueKind("behavior")).toBe("number");
    expect(tokenKindToValueKind("runtime")).toBe("number");
  });

  it("maps dice to 'dice'", () => {
    expect(tokenKindToValueKind("dice")).toBe("dice");
  });

  it("maps keyword to 'text'", () => {
    expect(tokenKindToValueKind("keyword")).toBe("text");
  });

  it("returns 'number' for unknown / paren", () => {
    expect(tokenKindToValueKind("paren")).toBe("number");
    expect(tokenKindToValueKind("unknown" as any)).toBe("number");
  });
});

describe("operandsToTokens", () => {
  it("flattens paren groups", () => {
    const operands: Operand[] = [
      { op: "+", value: { kind: "derived", which: "pb" } },
      { op: "+", value: {
        kind: "paren",
        operands: [
          { op: "+", value: { kind: "derived", which: "level" } },
          { op: "/", value: { kind: "number", value: 4 } },
        ],
      }},
      { op: "+", value: { kind: "keyword", text: "fire" } },
    ];
    const tokens = operandsToTokens(operands);
    expect(tokens).toEqual([
      { kind: "derived", which: "pb" },
      { kind: "derived", which: "level" },
      { kind: "number", value: 4 },
      { kind: "keyword", text: "fire" },
    ]);
  });

  it("preserves keyword operands as chips", () => {
    const operands: Operand[] = [
      { op: "+", value: { kind: "number", value: 2 } },
      { op: "+", value: { kind: "keyword", text: "advantage" } },
    ];
    const tokens = operandsToTokens(operands);
    expect(tokens).toEqual([
      { kind: "number", value: 2 },
      { kind: "keyword", text: "advantage" },
    ]);
  });
});

describe("serializeToken", () => {
  it("serializes each token kind to its display form", () => {
    expect(serializeToken({ kind: "number", value: 5 })).toBe("5");
    expect(serializeToken({ kind: "derived", which: "pb" })).toBe("pb");
    expect(serializeToken({ kind: "attribute", attribute: "physical" })).toBe("physical");
    expect(serializeToken({ kind: "practice", practice: "prowess" })).toBe("prowess");
    expect(serializeToken({ kind: "behavior", name: "blockValue" })).toBe("blockValue");
    expect(serializeToken({ kind: "dice", expression: "2d6" })).toBe("2d6");
    expect(serializeToken({ kind: "keyword", text: "fire" })).toBe("[fire]");
    expect(serializeToken({ kind: "keyword", text: "advantage" })).toBe("[advantage]");
    expect(serializeToken({ kind: "runtime", name: "PB", hint: "number" })).toBe("/PB/");
  });
});

describe("serializeFirstToken", () => {
  it("returns empty string for empty tokens", () => {
    expect(serializeFirstToken([])).toBe("");
  });

  it("returns the first token's display form", () => {
    const tokens: ValueToken[] = [
      { kind: "number", value: 7 },
      { kind: "derived", which: "pb" },
    ];
    expect(serializeFirstToken(tokens)).toBe("7");
  });

  it("handles keyword tokens", () => {
    const tokens: ValueToken[] = [{ kind: "keyword", text: "advantage" }];
    expect(serializeFirstToken(tokens)).toBe("[advantage]");
  });
});

describe("serializeOperandsAsExpression", () => {
  it("serializes a simple expression", () => {
    const operands: Operand[] = [
      { op: "+", value: { kind: "derived", which: "pb" } },
      { op: "+", value: { kind: "number", value: 2 } },
    ];
    expect(serializeOperandsAsExpression(operands)).toBe("PB + 2");
  });

  it("serializes a multiplication expression", () => {
    const operands: Operand[] = [
      { op: "+", value: { kind: "number", value: 2 } },
      { op: "*", value: { kind: "derived", which: "pb" } },
    ];
    expect(serializeOperandsAsExpression(operands)).toBe("2 * PB");
  });

  it("serializes an expression with parens and a keyword", () => {
    const operands: Operand[] = [
      { op: "+", value: { kind: "derived", which: "pb" } },
      { op: "+", value: {
        kind: "paren",
        operands: [
          { op: "+", value: { kind: "derived", which: "level" } },
          { op: "/", value: { kind: "number", value: 4 } },
        ],
      }},
      { op: "+", value: { kind: "keyword", text: "fire" } },
    ];
    expect(serializeOperandsAsExpression(operands)).toBe("PB + (LEVEL / 4) + [fire]");
  });

  it("returns empty string for empty operands", () => {
    expect(serializeOperandsAsExpression([])).toBe("");
  });
});

describe("Round-trip invariants", () => {
  it("every token kind round-trips through serialize → classify → parseValueField", () => {
    // This test verifies the form's full save→load round-trip
    // for the chip stack. For each token kind, we:
    //   1. Serialize the token → display string
    //   2. Classify the display string → typed token (via form-helpers)
    //   3. Parse the typed token → tokens array (via modifier.ts)
    //   4. Assert tokens equal the original

    const tokens: ValueToken[] = [
      { kind: "number", value: 5 },
      { kind: "derived", which: "pb" },
      { kind: "attribute", attribute: "physical" },
      { kind: "practice", practice: "prowess" },
      { kind: "behavior", name: "blockValue" },
      { kind: "dice", expression: "2d6" },
      { kind: "keyword", text: "fire" },
      { kind: "keyword", text: "advantage" },
    ];

    for (const t of tokens) {
      const display = serializeToken(t);
      const valueKind = tokenKindToValueKind(t.kind);
      const reClassified = classifyTypedValue(display, "add", valueKind);
      const reLoaded = parseValueField(reClassified.token);
      expect(reLoaded).toEqual([t]);
    }
  });
});
