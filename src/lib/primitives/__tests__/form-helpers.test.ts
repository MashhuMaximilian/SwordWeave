// =============================================================================
// M4 tests — Phase 7.5 modifier form UI behavior.
//
// Tests the pure helpers extracted to form-helpers.ts. These
// functions drive the form's decision logic (allowed token kinds
// per op, effective mirrorability, value-type labels, hidden
// Value Type select).
//
// Without a DOM renderer (jsdom/testing-library not installed),
// this is the testable surface of the form. The component itself
// is verified via visual inspection in the dev server.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  allowedTokenKinds,
  allowedValueTypes,
  effectiveMirrorable,
  hidesValueTypeSelect,
  valueTypeLabel,
} from "../form-helpers";

describe("allowedTokenKinds — Phase 7.5 v2", () => {
  describe("Add/Subtract/Multiply/Divide (number + dice only)", () => {
    for (const op of ["add", "subtract", "multiply", "divide"] as const) {
      it(`${op} + number valueKind → number tokens`, () => {
        const { kinds, biasMode } = allowedTokenKinds(op, "number");
        expect(kinds).toEqual(new Set(["number"]));
        expect(biasMode).toBe(false);
      });

      it(`${op} + dice valueKind → dice tokens`, () => {
        const { kinds, biasMode } = allowedTokenKinds(op, "dice");
        expect(kinds).toEqual(new Set(["dice"]));
        expect(biasMode).toBe(false);
      });

      it(`${op} + text valueKind → empty (not allowed)`, () => {
        // Text isn't allowed for these ops. Helper falls back
        // to empty (number) — the form should hide the text
        // valueKind option in the first place.
        const { kinds } = allowedTokenKinds(op, "text");
        expect(kinds).toEqual(new Set(["number"]));
      });
    }
  });

  describe("Min/Max (number + text, NOT dice)", () => {
    for (const op of ["min", "max"] as const) {
      it(`${op} + number → number tokens`, () => {
        expect(allowedTokenKinds(op, "number").kinds).toEqual(new Set(["number"]));
      });

      it(`${op} + text → behavior tokens`, () => {
        expect(allowedTokenKinds(op, "text").kinds).toEqual(new Set(["behavior"]));
      });

      it(`${op} + dice → fallback (dice not allowed)`, () => {
        // Dice isn't in the matrix for min/max. Helper falls back.
        expect(allowedTokenKinds(op, "dice").kinds).toEqual(new Set(["behavior"]));
      });
    }
  });

  describe("Set To (universal setter)", () => {
    it("set + number → number tokens", () => {
      expect(allowedTokenKinds("set", "number").kinds).toEqual(new Set(["number"]));
    });

    it("set + dice → dice tokens", () => {
      expect(allowedTokenKinds("set", "dice").kinds).toEqual(new Set(["dice"]));
    });

    it("set + text → behavior tokens", () => {
      expect(allowedTokenKinds("set", "text").kinds).toEqual(new Set(["behavior"]));
    });

    it("set + boolean → behavior tokens (T/F)", () => {
      // Set To + boolean: stores as behavior tokens with name
      // "true" or "false".
      expect(allowedTokenKinds("set", "boolean").kinds).toEqual(new Set(["behavior"]));
    });
  });

  describe("Grant/Revoke (number + text + dice)", () => {
    for (const op of ["grant", "revoke"] as const) {
      it(`${op} + number → number tokens`, () => {
        expect(allowedTokenKinds(op, "number").kinds).toEqual(new Set(["number"]));
      });

      it(`${op} + dice → dice tokens`, () => {
        expect(allowedTokenKinds(op, "dice").kinds).toEqual(new Set(["dice"]));
      });

      it(`${op} + text → behavior tokens`, () => {
        expect(allowedTokenKinds(op, "text").kinds).toEqual(new Set(["behavior"]));
      });
    }
  });

  describe("Bias (binary dropdown, no chip-stack)", () => {
    it("bias → biasMode=true, empty kinds", () => {
      const { kinds, biasMode } = allowedTokenKinds("bias", "number");
      expect(biasMode).toBe(true);
      expect(kinds.size).toBe(0);
    });

    it("bias + any valueKind → still biasMode", () => {
      // Bias ignores valueKind — op drives the form.
      expect(allowedTokenKinds("bias", "text").biasMode).toBe(true);
      expect(allowedTokenKinds("bias", "boolean").biasMode).toBe(true);
    });
  });

  describe("Toggle (True/False select, no chip-stack)", () => {
    it("toggle → no chip-stack", () => {
      const { kinds, biasMode } = allowedTokenKinds("toggle", "boolean");
      expect(kinds.size).toBe(0);
      expect(biasMode).toBe(false);
    });
  });
});

describe("effectiveMirrorable (Phase 7.5 v2 — op drives mirrorability)", () => {
  it("Set To is never mirrorable (permission-locked)", () => {
    expect(effectiveMirrorable("set")).toBe(false);
  });

  it("Toggle is mirrorable (value flips T↔F)", () => {
    expect(effectiveMirrorable("toggle")).toBe(true);
  });

  it("Bias is mirrorable (value flips advantage↔disadvantage)", () => {
    expect(effectiveMirrorable("bias")).toBe(true);
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

describe("hidesValueTypeSelect (Toggle + Bias don't show the dropdown)", () => {
  it("Toggle hides the Value Type select", () => {
    expect(hidesValueTypeSelect("toggle")).toBe(true);
  });

  it("Bias hides the Value Type select", () => {
    expect(hidesValueTypeSelect("bias")).toBe(true);
  });

  it("All other ops show the Value Type select", () => {
    expect(hidesValueTypeSelect("add")).toBe(false);
    expect(hidesValueTypeSelect("subtract")).toBe(false);
    expect(hidesValueTypeSelect("multiply")).toBe(false);
    expect(hidesValueTypeSelect("divide")).toBe(false);
    expect(hidesValueTypeSelect("min")).toBe(false);
    expect(hidesValueTypeSelect("max")).toBe(false);
    expect(hidesValueTypeSelect("set")).toBe(false);
    expect(hidesValueTypeSelect("grant")).toBe(false);
    expect(hidesValueTypeSelect("revoke")).toBe(false);
  });
});

describe("valueTypeLabel (UI display strings)", () => {
  it("Number", () => expect(valueTypeLabel("number")).toBe("Number"));
  it("Text / Keyword", () => expect(valueTypeLabel("text")).toBe("Text / Keyword"));
  it("Dice", () => expect(valueTypeLabel("dice")).toBe("Dice"));
  it("True / False", () => expect(valueTypeLabel("boolean")).toBe("True / False"));
  it("Bias", () => expect(valueTypeLabel("bias-value")).toBe("Bias"));
});

describe("allowedValueTypes (passes through to OP_VALUE_TYPE_MATRIX)", () => {
  it("Add allows number + dice", () => {
    expect(allowedValueTypes("add")).toEqual(["number", "dice"]);
  });

  it("Min allows number + text (NOT dice)", () => {
    expect(allowedValueTypes("min")).toEqual(["number", "text"]);
    expect(allowedValueTypes("min")).not.toContain("dice");
  });

  it("Set allows everything except bias-value", () => {
    const types = allowedValueTypes("set");
    expect(types).toContain("number");
    expect(types).toContain("text");
    expect(types).toContain("dice");
    expect(types).toContain("boolean");
    expect(types).not.toContain("bias-value");
  });

  it("Toggle allows only boolean", () => {
    expect(allowedValueTypes("toggle")).toEqual(["boolean"]);
  });

  it("Bias allows only bias-value", () => {
    expect(allowedValueTypes("bias")).toEqual(["bias-value"]);
  });
});

describe("Form UX integration scenarios (combined)", () => {
  it("Add + number: chip-stack accepts only number tokens (no attribute/practice/dice)", () => {
    const { kinds } = allowedTokenKinds("add", "number");
    expect(kinds).toEqual(new Set(["number"]));
    expect(kinds.has("attribute")).toBe(false);
    expect(kinds.has("practice")).toBe(false);
    expect(kinds.has("dice")).toBe(false);
  });

  it("Min + text: chip-stack accepts behavior tokens for custom text", () => {
    // e.g. "set max target size = Large" → "max" + "Large" (behavior token)
    const { kinds } = allowedTokenKinds("max", "text");
    expect(kinds).toEqual(new Set(["behavior"]));
    expect(kinds.has("number")).toBe(false);
    expect(kinds.has("dice")).toBe(false);
  });

  it("Set + boolean: chip-stack accepts behavior tokens named 'true' or 'false'", () => {
    // e.g. "set is_blind to True" → "set" + "is_blind" via behavior token with name "true"
    const { kinds } = allowedTokenKinds("set", "boolean");
    expect(kinds).toEqual(new Set(["behavior"]));
  });

  it("Bias: chip-stack hidden, biasMode=true (binary dropdown)", () => {
    const { kinds, biasMode } = allowedTokenKinds("bias", "bias-value");
    expect(biasMode).toBe(true);
    expect(kinds.size).toBe(0);
  });

  it("Toggle: chip-stack hidden, Value Type select hidden, True/False select renders", () => {
    expect(allowedTokenKinds("toggle", "boolean").kinds.size).toBe(0);
    expect(hidesValueTypeSelect("toggle")).toBe(true);
  });
});