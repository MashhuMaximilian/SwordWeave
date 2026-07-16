// =============================================================================
// Phase 7.5 v3 (post-UI-rev) — Modifier form UI behavior tests.
//
// Tests the pure helpers extracted to form-helpers.ts. These
// functions drive the form's decision logic (allowed token kinds
// per op, input classification per (op, valueKind), effective
// mirrorability, value-type labels).
//
// Without a DOM renderer (jsdom/testing-library not installed),
// this is the testable surface of the form. The component itself
// is verified via visual inspection in the dev server.
//
// v3 (post-UI-rev) changes from v3:
//   - Number-value ops now ALSO expose attribute/practice/derived
//     runtime token kinds (so +physical / +PB / +awareness are
//     one-click chips in the picker, not just text the user must
//     type).
//   - classifyTypedValue added: typed text classifies by the
//     current (op, valueKind) instead of becoming a behavior
//     token by default.
//   - NUMBER_SHORTCUTS / isBooleanValueType / showsNumberShortcuts
//     added for the new quick-pick chip rows.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  allowedTokenKinds,
  allowedValueTypes,
  classifyTypedValue,
  effectiveMirrorable,
  hidesValueTypeSelect,
  isBooleanValueType,
  NUMBER_SHORTCUTS,
  OPERATION_LABELS,
  showsNumberShortcuts,
  valueTypeLabel,
} from "../form-helpers";

describe("OPERATION_LABELS (Phase 7.5 v3 — 9 ops)", () => {
  it("has exactly 9 operations", () => {
    expect(OPERATION_LABELS.length).toBe(9);
  });

  it("includes the standard arithmetic ops", () => {
    const values = OPERATION_LABELS.map((o) => o.value);
    expect(values).toContain("add");
    expect(values).toContain("subtract");
    expect(values).toContain("multiply");
    expect(values).toContain("divide");
  });

  it("includes min/max/set/grant/revoke", () => {
    const values = OPERATION_LABELS.map((o) => o.value);
    expect(values).toContain("min");
    expect(values).toContain("max");
    expect(values).toContain("set");
    expect(values).toContain("grant");
    expect(values).toContain("revoke");
  });

  it("does NOT include toggle or bias (removed in v3)", () => {
    const values = OPERATION_LABELS.map((o) => o.value);
    expect(values).not.toContain("toggle");
    expect(values).not.toContain("bias");
  });

  it("has unique values", () => {
    const values = OPERATION_LABELS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("allowedTokenKinds — Phase 7.5 v3 (post-UI-rev)", () => {
  describe("Add/Subtract/Multiply/Divide", () => {
    for (const op of ["add", "subtract", "multiply", "divide"] as const) {
      it(`${op} + number → number + runtime tokens (attr/practice/derived)`, () => {
        const { kinds, biasMode } = allowedTokenKinds(op, "number");
        // v3-rev: runtime tokens are exposed so users can compose
        // "+ 2 + physical" without typing.
        expect(kinds).toEqual(new Set(["number", "attribute", "practice", "derived"]));
        expect(biasMode).toBe(false);
      });

      it(`${op} + dice → dice tokens`, () => {
        const { kinds, biasMode } = allowedTokenKinds(op, "dice");
        expect(kinds).toEqual(new Set(["dice"]));
        expect(biasMode).toBe(false);
      });

      it(`${op} + text → behavior tokens (custom names)`, () => {
        const { kinds } = allowedTokenKinds(op, "text");
        expect(kinds).toEqual(new Set(["behavior"]));
      });
    }
  });

  describe("Min/Max", () => {
    for (const op of ["min", "max"] as const) {
      it(`${op} + number → number + runtime tokens`, () => {
        expect(allowedTokenKinds(op, "number").kinds).toEqual(
          new Set(["number", "attribute", "practice", "derived"]),
        );
      });

      it(`${op} + text → behavior tokens`, () => {
        expect(allowedTokenKinds(op, "text").kinds).toEqual(new Set(["behavior"]));
      });

      it(`${op} + dice → behavior tokens (fallback)`, () => {
        // Min/Max don't allow dice — fall back to behavior.
        expect(allowedTokenKinds(op, "dice").kinds).toEqual(new Set(["behavior"]));
      });
    }
  });

  describe("Set To (universal setter)", () => {
    it("set + number → number + runtime tokens", () => {
      expect(allowedTokenKinds("set", "number").kinds).toEqual(
        new Set(["number", "attribute", "practice", "derived"]),
      );
    });

    it("set + dice → dice tokens", () => {
      expect(allowedTokenKinds("set", "dice").kinds).toEqual(new Set(["dice"]));
    });

    it("set + text → behavior tokens", () => {
      expect(allowedTokenKinds("set", "text").kinds).toEqual(new Set(["behavior"]));
    });

    it("set + boolean → behavior tokens (T/F as behavior)", () => {
      // Boolean values are stored as behavior tokens named
      // "true" or "false" (no dedicated boolean token kind).
      expect(allowedTokenKinds("set", "boolean").kinds).toEqual(new Set(["behavior"]));
    });
  });

  describe("Grant/Revoke", () => {
    for (const op of ["grant", "revoke"] as const) {
      it(`${op} + number → number + runtime tokens`, () => {
        expect(allowedTokenKinds(op, "number").kinds).toEqual(
          new Set(["number", "attribute", "practice", "derived"]),
        );
      });

      it(`${op} + dice → dice tokens`, () => {
        expect(allowedTokenKinds(op, "dice").kinds).toEqual(new Set(["dice"]));
      });

      it(`${op} + text → behavior tokens`, () => {
        expect(allowedTokenKinds(op, "text").kinds).toEqual(new Set(["behavior"]));
      });
    }
  });

  describe("v3: no biasMode anywhere (bias op is gone)", () => {
    for (const op of ["add", "subtract", "multiply", "divide",
                     "min", "max", "set", "grant", "revoke"] as const) {
      it(`${op} + any valueKind → biasMode=false`, () => {
        for (const vt of ["number", "text", "dice", "boolean"] as const) {
          expect(allowedTokenKinds(op, vt).biasMode).toBe(false);
        }
      });
    }
  });
});

describe("isBooleanValueType — Set To + Boolean only", () => {
  it("true for set + boolean", () => {
    expect(isBooleanValueType("set", "boolean")).toBe(true);
  });
  it("false for other (op, valueKind) tuples", () => {
    expect(isBooleanValueType("set", "number")).toBe(false);
    expect(isBooleanValueType("set", "text")).toBe(false);
    expect(isBooleanValueType("set", "dice")).toBe(false);
    expect(isBooleanValueType("grant", "boolean")).toBe(false);
    expect(isBooleanValueType("revoke", "boolean")).toBe(false);
    expect(isBooleanValueType("add", "boolean")).toBe(false);
  });
});

describe("showsNumberShortcuts — number mode for all 9 ops", () => {
  it("true for every op with number valueKind", () => {
    for (const op of ["add", "subtract", "multiply", "divide",
                      "min", "max", "set", "grant", "revoke"] as const) {
      expect(showsNumberShortcuts(op, "number")).toBe(true);
    }
  });
  it("false for non-number valueKinds", () => {
    for (const vt of ["text", "dice", "boolean"] as const) {
      expect(showsNumberShortcuts("add", vt)).toBe(false);
    }
  });
});

describe("NUMBER_SHORTCUTS — common literal-number quick-picks", () => {
  it("includes the canonical positive/negative deltas", () => {
    expect(NUMBER_SHORTCUTS).toContain(1);
    expect(NUMBER_SHORTCUTS).toContain(2);
    expect(NUMBER_SHORTCUTS).toContain(3);
    expect(NUMBER_SHORTCUTS).toContain(5);
    expect(NUMBER_SHORTCUTS).toContain(10);
    expect(NUMBER_SHORTCUTS).toContain(-1);
    expect(NUMBER_SHORTCUTS).toContain(-2);
    expect(NUMBER_SHORTCUTS).toContain(-5);
  });
});

describe("classifyTypedValue — value-type-aware input classification", () => {
  describe("number mode", () => {
    it("numeric string → number token", () => {
      const r = classifyTypedValue("60", "add", "number");
      expect(r.token).toEqual({ kind: "number", value: 60 });
      expect(r.warning).toBeNull();
    });
    it("negative numeric → number token", () => {
      const r = classifyTypedValue("-2", "add", "number");
      expect(r.token).toEqual({ kind: "number", value: -2 });
    });
    it("decimal numeric → number token", () => {
      const r = classifyTypedValue("0.5", "multiply", "number");
      expect(r.token).toEqual({ kind: "number", value: 0.5 });
    });
    it("attribute name → attribute token", () => {
      const r = classifyTypedValue("physical", "add", "number");
      expect(r.token).toEqual({ kind: "attribute", attribute: "physical" });
      expect(r.warning).toBeNull();
    });
    it("practice name → practice token", () => {
      const r = classifyTypedValue("awareness", "add", "number");
      expect(r.token).toEqual({ kind: "practice", practice: "awareness" });
    });
    it("derived name → derived token", () => {
      const r = classifyTypedValue("pb", "add", "number");
      expect(r.token).toEqual({ kind: "derived", which: "pb" });
    });
    it("dice-looking string in number mode → number token + warning", () => {
      const r = classifyTypedValue("2d6", "add", "number");
      expect(r.token).toMatchObject({ kind: "number" });
      expect(r.warning).toMatch(/dice expression/i);
    });
    it("behavior-like string in number mode → behavior token (silent)", () => {
      // Clean behavior-like names silently become behavior tokens.
      // The warning fires only for non-behavior-like strings.
      const r = classifyTypedValue("darkvision", "add", "number");
      expect(r.token).toEqual({ kind: "behavior", name: "darkvision" });
      expect(r.warning).toBeNull();
    });
    it("non-behavior-like string in number mode → behavior token + warning", () => {
      // E.g. "60 ft darkvision" — multi-word, not behavior-like.
      const r = classifyTypedValue("60 ft darkvision", "add", "number");
      expect(r.token).toEqual({ kind: "behavior", name: "60 ft darkvision" });
      expect(r.warning).toMatch(/not a number/i);
    });
    it("empty string → null token", () => {
      expect(classifyTypedValue("", "add", "number").token).toBeNull();
    });
  });

  describe("dice mode", () => {
    it("dice expression → dice token", () => {
      const r = classifyTypedValue("2d10", "add", "dice");
      expect(r.token).toEqual({ kind: "dice", expression: "2d10" });
      expect(r.warning).toBeNull();
    });
    it("compound dice expression → dice token", () => {
      const r = classifyTypedValue("3d8+1", "set", "dice");
      expect(r.token).toEqual({ kind: "dice", expression: "3d8+1" });
    });
    it("plain number in dice mode → behavior token + warning", () => {
      const r = classifyTypedValue("2", "add", "dice");
      expect(r.token).toEqual({ kind: "behavior", name: "2" });
      expect(r.warning).toMatch(/not a dice expression/i);
    });
    it("behavior-like string in dice mode → behavior token", () => {
      const r = classifyTypedValue("darkvision", "add", "dice");
      expect(r.token).toEqual({ kind: "behavior", name: "darkvision" });
    });
  });

  describe("text mode", () => {
    it("any string → behavior token", () => {
      const r = classifyTypedValue("darkvision", "grant", "text");
      expect(r.token).toEqual({ kind: "behavior", name: "darkvision" });
      expect(r.warning).toBeNull();
    });
    it("multi-word string → behavior token", () => {
      const r = classifyTypedValue("60 ft darkvision", "grant", "text");
      expect(r.token).toEqual({ kind: "behavior", name: "60 ft darkvision" });
    });
  });

  describe("boolean mode (Set To only)", () => {
    it("'true' / 'yes' / '1' → true behavior token", () => {
      for (const s of ["true", "yes", "1", "TRUE", "Yes"]) {
        const r = classifyTypedValue(s, "set", "boolean");
        expect(r.token).toEqual({ kind: "behavior", name: "true" });
        expect(r.warning).toBeNull();
      }
    });
    it("'false' / 'no' / '0' → false behavior token", () => {
      for (const s of ["false", "no", "0", "FALSE", "No"]) {
        const r = classifyTypedValue(s, "set", "boolean");
        expect(r.token).toEqual({ kind: "behavior", name: "false" });
        expect(r.warning).toBeNull();
      }
    });
    it("arbitrary string → behavior token + warning", () => {
      const r = classifyTypedValue("maybe", "set", "boolean");
      expect(r.token).toEqual({ kind: "behavior", name: "maybe" });
      expect(r.warning).toMatch(/not a recognized boolean/i);
    });
  });
});

describe("effectiveMirrorable (Phase 7.5 v3 — op drives mirrorability)", () => {
  it("Set To is never mirrorable (permission-locked)", () => {
    expect(effectiveMirrorable("set")).toBe(false);
  });

  it("Add/Subtract/Multiply/Divide are mirrorable", () => {
    expect(effectiveMirrorable("add")).toBe(true);
    expect(effectiveMirrorable("subtract")).toBe(true);
    expect(effectiveMirrorable("multiply")).toBe(true);
    expect(effectiveMirrorable("divide")).toBe(true);
  });

  it("Min/Max are mirrorable", () => {
    expect(effectiveMirrorable("min")).toBe(true);
    expect(effectiveMirrorable("max")).toBe(true);
  });

  it("Grant/Revoke are mirrorable", () => {
    expect(effectiveMirrorable("grant")).toBe(true);
    expect(effectiveMirrorable("revoke")).toBe(true);
  });
});

describe("hidesValueTypeSelect (Phase 7.5 v3 — always false)", () => {
  it("All ops show the Value Type dropdown", () => {
    for (const op of ["add", "subtract", "multiply", "divide",
                     "min", "max", "set", "grant", "revoke"] as const) {
      expect(hidesValueTypeSelect(op)).toBe(false);
    }
  });
});

describe("valueTypeLabel (UI display strings — 4 types in v3)", () => {
  it("Number", () => expect(valueTypeLabel("number")).toBe("Number"));
  it("Text / Keyword", () => expect(valueTypeLabel("text")).toBe("Text / Keyword"));
  it("Dice", () => expect(valueTypeLabel("dice")).toBe("Dice"));
  it("True / False", () => expect(valueTypeLabel("boolean")).toBe("True / False"));
});

describe("allowedValueTypes (passes through to OP_VALUE_TYPE_MATRIX)", () => {
  it("Add allows number + dice + equation", () => {
    expect(allowedValueTypes("add")).toEqual(["number", "dice", "equation"]);
  });

  it("Min allows number + text + equation (NOT dice)", () => {
    expect(allowedValueTypes("min")).toEqual(["number", "text", "equation"]);
    expect(allowedValueTypes("min")).not.toContain("dice");
  });

  it("Set allows number + text + dice + boolean + equation", () => {
    const types = allowedValueTypes("set");
    expect(types).toContain("number");
    expect(types).toContain("text");
    expect(types).toContain("dice");
    expect(types).toContain("boolean");
    expect(types).toContain("equation");
  });

  it("Grant/Revoke allow number + text + dice + equation", () => {
    expect(allowedValueTypes("grant")).toEqual([
      "number", "text", "dice", "equation",
    ]);
    expect(allowedValueTypes("revoke")).toEqual([
      "number", "text", "dice", "equation",
    ]);
  });
});

describe("Form UX integration scenarios (Phase 7.5 v3 post-UI-rev)", () => {
  it("Add + number: chip-stack accepts number + runtime tokens (the fix for Mashu's '+ physical' case)", () => {
    const { kinds } = allowedTokenKinds("add", "number");
    expect(kinds.has("number")).toBe(true);
    expect(kinds.has("attribute")).toBe(true);
    expect(kinds.has("practice")).toBe(true);
    expect(kinds.has("derived")).toBe(true);
    expect(kinds.has("dice")).toBe(false);
  });

  it("Grant + dice: chip-stack accepts dice tokens for damage/healing", () => {
    const { kinds } = allowedTokenKinds("grant", "dice");
    expect(kinds).toEqual(new Set(["dice"]));
  });

  it("Set + boolean: chip-stack accepts behavior tokens for true/false (rendered as quick-pick chips)", () => {
    const { kinds } = allowedTokenKinds("set", "boolean");
    expect(kinds).toEqual(new Set(["behavior"]));
    expect(isBooleanValueType("set", "boolean")).toBe(true);
  });

  it("Typing '60' in Number mode → number token (not behavior token — Mashu's bug)", () => {
    const r = classifyTypedValue("60", "add", "number");
    expect(r.token).toEqual({ kind: "number", value: 60 });
    expect(r.token?.kind).not.toBe("behavior");
  });

  it("Typing 'physical' in Number mode → attribute token (Mashu's '+ physical' flow)", () => {
    const r = classifyTypedValue("physical", "add", "number");
    expect(r.token).toEqual({ kind: "attribute", attribute: "physical" });
  });

  it("Typing 'true' in Boolean mode → behavior:true token (Mashu's T/F flow)", () => {
    const r = classifyTypedValue("true", "set", "boolean");
    expect(r.token).toEqual({ kind: "behavior", name: "true" });
  });

  it("Typing '2d10' in Dice mode → dice token (Mashu's '2d10 in custom input' flow)", () => {
    const r = classifyTypedValue("2d10", "set", "dice");
    expect(r.token).toEqual({ kind: "dice", expression: "2d10" });
  });
});