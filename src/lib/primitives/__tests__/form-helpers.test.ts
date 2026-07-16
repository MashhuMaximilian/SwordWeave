// =============================================================================
// Phase 7.5 v3 — Modifier form UI behavior tests.
//
// Tests the pure helpers extracted to form-helpers.ts. These
// functions drive the form's decision logic (allowed token
// kinds per op, effective mirrorability, value-type labels,
// hidden Value Type select).
//
// Without a DOM renderer (jsdom/testing-library not installed),
// this is the testable surface of the form. The component itself
// is verified via visual inspection in the dev server.
//
// v3 changes:
//   - Removed bias and toggle ops (no more biasMode or hidden
//     Value Type select).
//   - 9 ops × 4 value types.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  allowedTokenKinds,
  allowedValueTypes,
  effectiveMirrorable,
  hidesValueTypeSelect,
  OPERATION_LABELS,
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

describe("allowedTokenKinds — Phase 7.5 v3", () => {
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

      it(`${op} + text valueKind → fallback to number (text not allowed)`, () => {
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

      it(`${op} + dice → fallback to behavior (dice not allowed)`, () => {
        expect(allowedTokenKinds(op, "dice").kinds).toEqual(new Set(["behavior"]));
      });
    }
  });

  describe("Set To (universal setter — number / text / dice / boolean)", () => {
    it("set + number → number tokens", () => {
      expect(allowedTokenKinds("set", "number").kinds).toEqual(new Set(["number"]));
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
  it("Add allows number + dice", () => {
    expect(allowedValueTypes("add")).toEqual(["number", "dice"]);
  });

  it("Min allows number + text (NOT dice)", () => {
    expect(allowedValueTypes("min")).toEqual(["number", "text"]);
    expect(allowedValueTypes("min")).not.toContain("dice");
  });

  it("Set allows number + text + dice + boolean", () => {
    const types = allowedValueTypes("set");
    expect(types).toContain("number");
    expect(types).toContain("text");
    expect(types).toContain("dice");
    expect(types).toContain("boolean");
  });

  it("Grant/Revoke allow number + text + dice", () => {
    expect(allowedValueTypes("grant")).toEqual(["number", "text", "dice"]);
    expect(allowedValueTypes("revoke")).toEqual(["number", "text", "dice"]);
  });
});

describe("Form UX integration scenarios (Phase 7.5 v3)", () => {
  it("Add + number: chip-stack accepts only number tokens", () => {
    const { kinds } = allowedTokenKinds("add", "number");
    expect(kinds).toEqual(new Set(["number"]));
    expect(kinds.has("attribute")).toBe(false);
    expect(kinds.has("practice")).toBe(false);
    expect(kinds.has("dice")).toBe(false);
  });

  it("Min + text: chip-stack accepts behavior tokens for custom text", () => {
    // e.g. "max target size = Large" → "max" + "Large" (behavior token)
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

  it("Grant + dice: chip-stack accepts dice tokens for damage/healing", () => {
    // e.g. "grant damage resistance 1d4" → grant + behavior:damage_resistance + dice:1d4
    const { kinds } = allowedTokenKinds("grant", "dice");
    expect(kinds).toEqual(new Set(["dice"]));
  });
});