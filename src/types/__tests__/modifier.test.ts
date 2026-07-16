// =============================================================================
// Unit tests for the Phase 7.5 modifier types.
//
// Covers:
//   - OP_VALUE_TYPE_MATRIX: per-op allowed value types
//   - OP_SPECS: chirality + mirror behavior
//   - applyMirror: pure mirror function
//   - parseValueField: raw → ValueToken[] coercion
//   - serializeValueField: ValueToken[] → raw
//   - tokenLabel: human-readable labels
//   - isDiceExpression / isBehaviorLike: string heuristics
//   - parseBehaviorTarget / formatBehaviorTarget: behavior names
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  ALL_ATTRIBUTES,
  ALL_DERIVED,
  ALL_PRACTICES,
  CANONICAL_DICE,
  OP_SPECS,
  OP_VALUE_TYPE_MATRIX,
  applyMirror,
  defaultTargetsForAxis,
  formatBehaviorTarget,
  isBehaviorLike,
  isDiceExpression,
  migrateOperation,
  parseBehaviorTarget,
  parseValueField,
  serializeValueField,
  tokenLabel,
  type ModifierOperation,
  type ValueToken,
} from "../modifier";

describe("OP_VALUE_TYPE_MATRIX (Phase 7.5 v4 — adds equation)", () => {
  it("Add/Subtract/Multiply/Divide allow number, dice, and equation", () => {
    for (const op of ["add", "subtract", "multiply", "divide"] as const) {
      expect(OP_VALUE_TYPE_MATRIX[op]).toEqual([
        "number", "dice", "equation",
      ]);
    }
  });

  it("Set To allows number, text, dice, boolean, equation (universal setter)", () => {
    expect(OP_VALUE_TYPE_MATRIX.set).toEqual([
      "number", "text", "dice", "boolean", "equation",
    ]);
  });

  it("Min/Max allow number, text, equation (NOT dice)", () => {
    expect(OP_VALUE_TYPE_MATRIX.min).toEqual(["number", "text", "equation"]);
    expect(OP_VALUE_TYPE_MATRIX.max).toEqual(["number", "text", "equation"]);
  });

  it("Grant/Revoke allow number, text, dice, equation", () => {
    expect(OP_VALUE_TYPE_MATRIX.grant).toEqual([
      "number", "text", "dice", "equation",
    ]);
    expect(OP_VALUE_TYPE_MATRIX.revoke).toEqual([
      "number", "text", "dice", "equation",
    ]);
  });

  it("Toggle and Bias are removed in v3", () => {
    expect(OP_VALUE_TYPE_MATRIX).not.toHaveProperty("toggle");
    expect(OP_VALUE_TYPE_MATRIX).not.toHaveProperty("bias");
  });

  it("equation is in every op's allowed value types (v4)", () => {
    for (const op of ["add", "subtract", "multiply", "divide",
                      "min", "max", "set", "grant", "revoke"] as const) {
      expect(OP_VALUE_TYPE_MATRIX[op]).toContain("equation");
    }
  });

  it("Verify no op has 'text' AND 'dice' as a SINGLE combined type", () => {
    expect(OP_VALUE_TYPE_MATRIX.set).toContain("text");
    expect(OP_VALUE_TYPE_MATRIX.set).toContain("dice");
    expect(OP_VALUE_TYPE_MATRIX.min).not.toContain("dice");
    expect(OP_VALUE_TYPE_MATRIX.add).toContain("dice");
    expect(OP_VALUE_TYPE_MATRIX.add).not.toContain("text");
  });
});

describe("OP_SPECS — chirality", () => {
  it("Set is the only non-mirrorable op", () => {
    for (const op of Object.keys(OP_SPECS) as ModifierOperation[]) {
      const expected = op === "set" ? false : true;
      expect(OP_SPECS[op].mirrorable).toBe(expected);
    }
  });

  it("Add <-> Subtract (mirror flips sign)", () => {
    expect(OP_SPECS.add.mirrorOp).toBe("subtract");
    expect(OP_SPECS.subtract.mirrorOp).toBe("add");
    expect(OP_SPECS.add.mirrorFlipsSign).toBe(true);
    expect(OP_SPECS.subtract.mirrorFlipsSign).toBe(true);
  });

  it("Multiply <-> Divide (mirror inverts value to reciprocal)", () => {
    expect(OP_SPECS.multiply.mirrorOp).toBe("divide");
    expect(OP_SPECS.divide.mirrorOp).toBe("multiply");
    expect(OP_SPECS.multiply.mirrorInvertsValue).toBe(true);
    expect(OP_SPECS.divide.mirrorInvertsValue).toBe(true);
  });

  it("Min <-> Max (mirror flips op, value stays)", () => {
    expect(OP_SPECS.min.mirrorOp).toBe("max");
    expect(OP_SPECS.max.mirrorOp).toBe("min");
    expect(OP_SPECS.min.mirrorFlipsValue).toBe(false);
  });

  it("Grant <-> Revoke (mirror flips op, value stays)", () => {
    expect(OP_SPECS.grant.mirrorOp).toBe("revoke");
    expect(OP_SPECS.revoke.mirrorOp).toBe("grant");
  });

  it("v3: Toggle and Bias removed from OP_SPECS", () => {
    expect(OP_SPECS).not.toHaveProperty("toggle");
    expect(OP_SPECS).not.toHaveProperty("bias");
  });
});

describe("applyMirror", () => {
  it("Add(+5) mirrors to Subtract(-5)", () => {
    const result = applyMirror("add", 5);
    expect(result).toEqual({ op: "subtract", value: -5 });
  });

  it("Subtract(-3) mirrors to Add(+3)", () => {
    const result = applyMirror("subtract", -3);
    expect(result).toEqual({ op: "add", value: 3 });
  });

  it("Multiply(2) mirrors to Divide(0.5)", () => {
    const result = applyMirror("multiply", 2);
    expect(result).toEqual({ op: "divide", value: 0.5 });
  });

  it("Divide(0.5) mirrors to Multiply(2)", () => {
    const result = applyMirror("divide", 0.5);
    expect(result).toEqual({ op: "multiply", value: 2 });
  });

  it("Min(0) mirrors to Max(0)", () => {
    const result = applyMirror("min", 0);
    expect(result).toEqual({ op: "max", value: 0 });
  });

  it("Grant('grappled') mirrors to Revoke('grappled')", () => {
    const result = applyMirror("grant", "grappled");
    expect(result).toEqual({ op: "revoke", value: "grappled" });
  });

  // v3: Toggle and Bias removed. Set handles boolean changes.
  // Bias handled via grant/revoke on behavior:advantage / disadvantage.

  it("Set throws (not mirrorable)", () => {
    expect(() => applyMirror("set", 5)).toThrow(/not mirrorable/);
  });

  it("Multiply(0) mirror falls back to keeping 0 (1/0 is undefined)", () => {
    // The mirror of "multiply by 0" is mathematically undefined.
    // The form should warn the author about multiplying by zero
    // before saving. The runtime keeps the value as-is when the
    // reciprocal is not representable.
    const result = applyMirror("multiply", 0);
    expect(result.op).toBe("divide");
    expect(result.value).toBe(0);
  });

  it("Multiply(Infinity) mirror falls back to keeping Infinity", () => {
    const result = applyMirror("multiply", Infinity);
    expect(result.op).toBe("divide");
    expect(result.value).toBe(Infinity);
  });
});

describe("parseValueField — auto-coercion", () => {
  it("returns empty for null and undefined", () => {
    expect(parseValueField(null)).toEqual([]);
    expect(parseValueField(undefined)).toEqual([]);
  });

  it("parses a number into a number token", () => {
    expect(parseValueField(5)).toEqual([{ kind: "number", value: 5 }]);
    expect(parseValueField(-3)).toEqual([{ kind: "number", value: -3 }]);
    expect(parseValueField(0)).toEqual([{ kind: "number", value: 0 }]);
  });

  it("parses a boolean into a behavior token (true/false)", () => {
    expect(parseValueField(true)).toEqual([{ kind: "behavior", name: "true" }]);
    expect(parseValueField(false)).toEqual([{ kind: "behavior", name: "false" }]);
  });

  it("parses 'advantage' and 'disadvantage' as behavior tokens (v3: bias op is gone)", () => {
    expect(parseValueField("advantage")).toEqual([{ kind: "behavior", name: "advantage" }]);
    expect(parseValueField("disadvantage")).toEqual([{ kind: "behavior", name: "disadvantage" }]);
  });

  it("parses dice expressions", () => {
    expect(parseValueField("1d4")).toEqual([{ kind: "dice", expression: "1d4" }]);
    expect(parseValueField("2d6+3")).toEqual([{ kind: "dice", expression: "2d6+3" }]);
    expect(parseValueField("3d8-1")).toEqual([{ kind: "dice", expression: "3d8-1" }]);
  });

  it("parses 'behavior:NAME' as a behavior token", () => {
    expect(parseValueField("behavior:darkvision")).toEqual([
      { kind: "behavior", name: "darkvision" },
    ]);
  });

  it("parses bare attributes as attribute tokens", () => {
    for (const attr of ALL_ATTRIBUTES) {
      expect(parseValueField(attr)).toEqual([{ kind: "attribute", attribute: attr }]);
    }
  });

  it("'magic' alone is a practice token (no attribute conflict)", () => {
    expect(parseValueField("magic")).toEqual([
      { kind: "practice", practice: "magic" },
    ]);
  });

  it("'magic-abstract' is the canonical Magic/Abstract attribute token", () => {
    expect(parseValueField("magic-abstract")).toEqual([
      { kind: "attribute", attribute: "magic-abstract" },
    ]);
  });

  it("parses bare practices as practice tokens", () => {
    for (const practice of ALL_PRACTICES) {
      expect(parseValueField(practice)).toEqual([{ kind: "practice", practice }]);
    }
  });

  it("parses derived constants (pb, pb_half, level)", () => {
    expect(parseValueField("pb")).toEqual([{ kind: "derived", which: "pb" }]);
    expect(parseValueField("pb_half")).toEqual([{ kind: "derived", which: "pb_half" }]);
    expect(parseValueField("level")).toEqual([{ kind: "derived", which: "level" }]);
  });

  it("parses bare single-word text as a behavior token", () => {
    expect(parseValueField("darkvision")).toEqual([
      { kind: "behavior", name: "darkvision" },
    ]);
  });

  it("parses multi-word text as a behavior token with the whole string as name", () => {
    expect(parseValueField("mana pool regen")).toEqual([
      { kind: "behavior", name: "mana pool regen" },
    ]);
  });

  it("parses an array of mixed values", () => {
    expect(parseValueField(["physical", "+", 2])).toEqual([
      { kind: "attribute", attribute: "physical" },
      { kind: "behavior", name: "+" },
      { kind: "number", value: 2 },
    ]);
  });

  it("passes through already-structured token arrays", () => {
    const tokens: ValueToken[] = [
      { kind: "attribute", attribute: "physical" },
      { kind: "number", value: 4 },
    ];
    expect(parseValueField(tokens)).toEqual(tokens);
  });

  it("skips null values in arrays", () => {
    expect(parseValueField([5, null, 10])).toEqual([
      { kind: "number", value: 5 },
      { kind: "number", value: 10 },
    ]);
  });
});

describe("serializeValueField — round-trip", () => {
  it("number token serializes back to its number", () => {
    expect(serializeValueField([{ kind: "number", value: 5 }])).toEqual([5]);
  });

  it("attribute token serializes back to its name", () => {
    expect(
      serializeValueField([{ kind: "attribute", attribute: "physical" }]),
    ).toEqual(["physical"]);
  });

  it("dice token serializes back to its expression", () => {
    expect(
      serializeValueField([{ kind: "dice", expression: "2d6+3" }]),
    ).toEqual(["2d6+3"]);
  });

  it("behavior token serializes back to 'behavior:NAME'", () => {
    expect(
      serializeValueField([{ kind: "behavior", name: "darkvision" }]),
    ).toEqual(["behavior:darkvision"]);
  });

  it("round-trips through parse → serialize", () => {
    const original = ["physical", 5];
    const tokens = parseValueField(original);
    const serialized = serializeValueField(tokens);
    // Re-parse to confirm canonical round-trip
    const reParsed = parseValueField(serialized);
    expect(reParsed).toEqual(tokens);
  });
});

describe("tokenLabel", () => {
  it("renders attributes lowercase", () => {
    expect(tokenLabel({ kind: "attribute", attribute: "physical" })).toBe("physical");
  });

  it("renders practices lowercase", () => {
    expect(tokenLabel({ kind: "practice", practice: "awareness" })).toBe("awareness");
  });

  it("renders pb_half as 'PB/2' (special case)", () => {
    expect(tokenLabel({ kind: "derived", which: "pb_half" })).toBe("PB/2");
  });

  it("renders pb as 'PB'", () => {
    expect(tokenLabel({ kind: "derived", which: "pb" })).toBe("PB");
  });

  it("renders level as 'LEVEL'", () => {
    expect(tokenLabel({ kind: "derived", which: "level" })).toBe("LEVEL");
  });

  it("renders dice expressions verbatim", () => {
    expect(tokenLabel({ kind: "dice", expression: "2d6+3" })).toBe("2d6+3");
  });

  it("renders numbers as their string form", () => {
    expect(tokenLabel({ kind: "number", value: 4 })).toBe("4");
    expect(tokenLabel({ kind: "number", value: -3 })).toBe("-3");
  });

  it("renders behaviors by name", () => {
    expect(tokenLabel({ kind: "behavior", name: "darkvision" })).toBe("darkvision");
  });
});

describe("isDiceExpression", () => {
  it("accepts canonical dice", () => {
    for (const d of CANONICAL_DICE) expect(isDiceExpression(d)).toBe(true);
  });

  it("accepts compound dice with modifiers", () => {
    expect(isDiceExpression("2d6+3")).toBe(true);
    expect(isDiceExpression("3d8-1")).toBe(true);
  });

  it("rejects non-dice strings", () => {
    expect(isDiceExpression("darkvision")).toBe(false);
    expect(isDiceExpression("1")).toBe(false);
    expect(isDiceExpression("d6")).toBe(false);
  });
});

describe("isBehaviorLike", () => {
  it("accepts single-word lowercase identifiers", () => {
    expect(isBehaviorLike("darkvision")).toBe(true);
    expect(isBehaviorLike("mana_pool")).toBe(true);
    expect(isBehaviorLike("KB-Shift")).toBe(true);
  });

  it("rejects multi-word strings", () => {
    expect(isBehaviorLike("mana pool")).toBe(false);
    expect(isBehaviorLike("has darkvision")).toBe(false);
  });

  it("rejects strings starting with a digit", () => {
    expect(isBehaviorLike("2d6")).toBe(false);
    expect(isBehaviorLike("1")).toBe(false);
  });

  it("rejects strings with special chars", () => {
    expect(isBehaviorLike("mana+pool")).toBe(false);
    expect(isBehaviorLike("KB/Shift")).toBe(false);
  });
});

describe("behavior target parsing", () => {
  it("parseBehaviorTarget extracts name from 'behavior:NAME'", () => {
    expect(parseBehaviorTarget("behavior:darkvision")).toBe("darkvision");
    expect(parseBehaviorTarget("behavior:mana_pool")).toBe("mana_pool");
  });

  it("parseBehaviorTarget returns null for non-behavior targets", () => {
    expect(parseBehaviorTarget("character.attribute.physical")).toBe(null);
    expect(parseBehaviorTarget("behavior:")).toBe(null);
    expect(parseBehaviorTarget("behavior: ")).toBe(null);
  });

  it("formatBehaviorTarget wraps name with prefix", () => {
    expect(formatBehaviorTarget("darkvision")).toBe("behavior:darkvision");
  });

  it("round-trips through parse + format", () => {
    const name = "mana_pool_regen";
    expect(parseBehaviorTarget(formatBehaviorTarget(name))).toBe(name);
  });
});

describe("defaultTargetsForAxis", () => {
  it("attribute returns the 3 attribute targets", () => {
    expect(defaultTargetsForAxis("attribute")).toEqual([
      "character.attribute.physical",
      "character.attribute.mental",
      "character.attribute.magical",
    ]);
  });

  it("defense returns the 3 defense targets", () => {
    expect(defaultTargetsForAxis("defense")).toEqual([
      "character.defense.physicalDc",
      "character.defense.mentalDc",
      "character.defense.magicalDc",
    ]);
  });

  it("vitality returns the 2 vitality targets", () => {
    expect(defaultTargetsForAxis("vitality")).toEqual([
      "character.maxVitality",
      "character.currentVitality",
    ]);
  });

  it("trigger-hook and state-tag return 'free' (no canonical targets)", () => {
    expect(defaultTargetsForAxis("trigger-hook")).toBe("free");
    expect(defaultTargetsForAxis("state-tag")).toBe("free");
  });

  it("behavior returns 'behavior' (free-form text input)", () => {
    expect(defaultTargetsForAxis("behavior")).toBe("behavior");
  });
});

describe("migrateOperation (Phase 7.5 v3 — back-compat)", () => {
  it("'toggle' → 'set' with boolean value coerced", () => {
    expect(migrateOperation("toggle", true)).toEqual({ op: "set", value: "true" });
    expect(migrateOperation("toggle", false)).toEqual({ op: "set", value: "false" });
    expect(migrateOperation("toggle", "true")).toEqual({ op: "set", value: "true" });
  });

  it("'bias' → 'grant' with advantage/disadvantage coerced", () => {
    expect(migrateOperation("bias", "advantage")).toEqual({ op: "grant", value: "advantage" });
    expect(migrateOperation("bias", "disadvantage")).toEqual({ op: "grant", value: "disadvantage" });
  });

  it("non-legacy ops pass through unchanged", () => {
    expect(migrateOperation("add", 5)).toEqual({ op: "add", value: "5" });
    expect(migrateOperation("grant", "darkvision")).toEqual({ op: "grant", value: "darkvision" });
  });

  it("'undefined' legacy values get safe defaults", () => {
    expect(migrateOperation("toggle", undefined).op).toBe("set");
    expect(migrateOperation("bias", undefined).op).toBe("grant");
  });
});