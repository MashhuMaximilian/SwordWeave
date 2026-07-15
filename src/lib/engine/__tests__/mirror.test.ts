import { describe, it, expect } from "vitest";
import {
  resolveMirrorEffect,
  resolveEffectiveModifierValue,
  resolveResistanceMultiplier,
  isMirroredSlot,
  isUserCostVector,
  readMirrorMeta,
} from "../mirror";

describe("resolveMirrorEffect — VARIABLE_VECTOR (sign flip)", () => {
  it("flips a +5 modifier on the target when the slot is mirrored", () => {
    const out = resolveMirrorEffect("VARIABLE_VECTOR", true, 5);
    expect(out.targetValue).toBe(-5);
    expect(out.userCost).toBeNull();
  });

  it("flips a negative value too (for pre-applied penalty rows)", () => {
    const out = resolveMirrorEffect("VARIABLE_VECTOR", true, -3);
    expect(out.targetValue).toBe(3);
    expect(out.userCost).toBeNull();
  });

  it("passes through when the slot is NOT mirrored", () => {
    const out = resolveMirrorEffect("VARIABLE_VECTOR", false, 5);
    expect(out.targetValue).toBe(5);
    expect(out.userCost).toBeNull();
  });

  it("coerces numeric strings to numbers", () => {
    const out = resolveMirrorEffect("VARIABLE_VECTOR", true, "7");
    expect(out.targetValue).toBe(-7);
  });

  it("ignores non-numeric values (treats them as 0)", () => {
    const out = resolveMirrorEffect("VARIABLE_VECTOR", true, true);
    // Object.is(-0, 0) is false; for arithmetic purposes -0 === 0, so
    // we use toBe+0 to absorb the negative-zero case.
    expect(Object.is(out.targetValue, 0) || out.targetValue === 0).toBe(true);
  });
});

describe("resolveMirrorEffect — STRUCTURAL_FAULT (defensive twin)", () => {
  it("preserves magnitude so the resolver can label it as vulnerability", () => {
    const out = resolveMirrorEffect("STRUCTURAL_FAULT", true, 1);
    expect(out.targetValue).toBe(1);
    expect(out.userCost).toBeNull();
  });

  it("passes through when the slot is NOT mirrored", () => {
    const out = resolveMirrorEffect("STRUCTURAL_FAULT", false, 1);
    expect(out.targetValue).toBe(1);
  });
});

describe("resolveMirrorEffect — COST_INSTABILITY (extra cost on user)", () => {
  it("preserves the magnitude on the target value", () => {
    const out = resolveMirrorEffect("COST_INSTABILITY", true, 12);
    expect(out.targetValue).toBe(12);
  });

  it("imposes a user-cost block (extra_strain from canonical example)", () => {
    const out = resolveMirrorEffect("COST_INSTABILITY", true, 12);
    expect(out.userCost).not.toBeNull();
    expect(out.userCost?.kind).toBe("extra_strain");
    expect(out.userCost?.magnitude).toBe(12);
  });

  it("passes through when the slot is NOT mirrored (no user cost)", () => {
    const out = resolveMirrorEffect("COST_INSTABILITY", false, 12);
    expect(out.targetValue).toBe(12);
    expect(out.userCost).toBeNull();
  });
});

describe("resolveMirrorEffect — STANDARD_ONLY (bookkeeping)", () => {
  it("passes through unmodified for both mirror states", () => {
    expect(resolveMirrorEffect("STANDARD_ONLY", true, 4).targetValue).toBe(4);
    expect(resolveMirrorEffect("STANDARD_ONLY", false, 4).targetValue).toBe(4);
    expect(resolveMirrorEffect("STANDARD_ONLY", true, 4).userCost).toBeNull();
  });

  it("falls through to pass-through on unknown vector strings", () => {
    expect(resolveMirrorEffect("UNKNOWN_VECTOR", true, 7).targetValue).toBe(7);
  });
});

describe("resolveResistanceMultiplier — canonical stacking rule", () => {
  it("returns 1.0 when neither resistance nor vulnerability is present", () => {
    expect(resolveResistanceMultiplier(0, 0)).toBe(1.0);
  });

  it("returns 0.5 with only resistance", () => {
    expect(resolveResistanceMultiplier(1, 0)).toBe(0.5);
    expect(resolveResistanceMultiplier(5, 0)).toBe(0.5);
  });

  it("returns 2.0 with only vulnerability", () => {
    expect(resolveResistanceMultiplier(0, 2)).toBe(2.0);
  });

  it("returns 1.0 (cancel out) when both resistance and vulnerability apply to the same damage", () => {
    expect(resolveResistanceMultiplier(1, 1)).toBe(1.0);
    expect(resolveResistanceMultiplier(2, 1)).toBe(1.0);
    expect(resolveResistanceMultiplier(3, 2)).toBe(1.0);
  });

  it("stacking rule: strongest single modifier passes through (caller picks max)", () => {
    expect(resolveResistanceMultiplier(2, 0)).toBe(0.5);
  });
});

describe("isMirroredSlot / isUserCostVector helpers", () => {
  it("isMirroredSlot correctly reads is_mirrored boolean", () => {
    expect(isMirroredSlot({ is_mirrored: true })).toBe(true);
    expect(isMirroredSlot({ is_mirrored: false })).toBe(false);
    expect(isMirroredSlot({})).toBe(false);
  });

  it("isUserCostVector matches COST_INSTABILITY only", () => {
    expect(isUserCostVector("COST_INSTABILITY")).toBe(true);
    expect(isUserCostVector("VARIABLE_VECTOR")).toBe(false);
    expect(isUserCostVector("STRUCTURAL_FAULT")).toBe(false);
    expect(isUserCostVector("STANDARD_ONLY")).toBe(false);
  });
});

describe("resolveEffectiveModifierValue", () => {
  it("applies VARIABLE_VECTOR sign flip when primitive is mirrorable and slot is mirrored", () => {
    const result = resolveEffectiveModifierValue(
      { mirror_vector: "VARIABLE_VECTOR" },
      { is_mirrored: true },
      { kind: "modify", target: "max_vitality", operation: "add", value: 4 },
    );
    expect(result.targetValue).toBe(-4);
    expect(result.userCost).toBeNull();
    expect(result.vector).toBe("VARIABLE_VECTOR");
  });

  it("passes through when the slot is NOT mirrored", () => {
    const result = resolveEffectiveModifierValue(
      { mirror_vector: "VARIABLE_VECTOR" },
      { is_mirrored: false },
      { kind: "modify", target: "max_vitality", operation: "add", value: 4 },
    );
    expect(result.targetValue).toBe(4);
    expect(result.vector).toBe("VARIABLE_VECTOR");
  });

  it("defaults to STANDARD_ONLY when mirror_vector is null", () => {
    const result = resolveEffectiveModifierValue(
      { mirror_vector: null },
      { is_mirrored: true },
      { kind: "modify", target: "max_vitality", operation: "add", value: 4 },
    );
    expect(result.targetValue).toBe(4);
    expect(result.userCost).toBeNull();
    expect(result.vector).toBe("STANDARD_ONLY");
  });

  it("passes through when modifier has metadata.mirror.optedOut=true", () => {
    const result = resolveEffectiveModifierValue(
      { mirror_vector: "VARIABLE_VECTOR" },
      { is_mirrored: true },
      {
        kind: "modify",
        target: "max_vitality",
        operation: "add",
        value: 4,
        metadata: { mirror: { optedOut: true } },
      },
    );
    expect(result.targetValue).toBe(4);
    expect(result.userCost).toBeNull();
  });

  it("returns the resolved vector alongside the value", () => {
    const v = resolveEffectiveModifierValue(
      { mirror_vector: "STRUCTURAL_FAULT" },
      { is_mirrored: true },
      { kind: "modify", target: "defense", operation: "multiply", value: 0.5 },
    );
    expect(v.vector).toBe("STRUCTURAL_FAULT");
    expect(v.targetValue).toBe(0.5);
  });
});

describe("readMirrorMeta", () => {
  it("returns null when modifier has no metadata.mirror", () => {
    expect(readMirrorMeta({ kind: "modify", target: "x", operation: "add", value: 1 })).toBeNull();
  });

  it("reads optedOut flag", () => {
    expect(readMirrorMeta({
      kind: "modify",
      target: "x",
      operation: "add",
      value: 1,
      metadata: { mirror: { optedOut: true } },
    })?.optedOut).toBe(true);
  });

  it("reads exposureNotes string", () => {
    expect(readMirrorMeta({
      kind: "modify",
      target: "x",
      operation: "add",
      value: 1,
      metadata: { mirror: { exposureNotes: "this flips to a vulnerability" } },
    })?.exposureNotes).toBe("this flips to a vulnerability");
  });
});
