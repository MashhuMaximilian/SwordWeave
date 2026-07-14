/**
 * target-scope.test.ts — Canonical scope vocabulary, validation, and DB round-trip
 */
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  PRACTICES,
  STANDALONE_METRICS,
  SCOPE_LAYERS,
  PROBABILITY_BIAS_TIER_SPEC,
  PROBABILITY_BIAS_TIER_COSTS,
  buildScope,
  validateScope,
  serializeForDB,
  parseFromDB,
  scopeForBiasTier,
  targetScopeSchema,
  type TargetScope,
} from "../target-scope";

describe("ATTRIBUTES canonical", () => {
  it("matches BU Market canonical list", () => {
    expect(ATTRIBUTES).toEqual(["PHYSICAL", "MENTAL", "MAGICAL"]);
  });
});

describe("PRACTICES canonical (10 named, distributed)", () => {
  it("contains the 10 canonical practice names", () => {
    expect(PRACTICES).toHaveLength(10);
  });

  it("Physical practices: PROWESS, FINESSE, FIELDCRAFT", () => {
    expect(PRACTICES.slice(0, 3)).toEqual(["PROWESS", "FINESSE", "FIELDCRAFT"]);
  });

  it("Mental practices: AWARENESS, REASON, KNOWLEDGE, INFLUENCE", () => {
    expect(PRACTICES.slice(3, 7)).toEqual([
      "AWARENESS",
      "REASON",
      "KNOWLEDGE",
      "INFLUENCE",
    ]);
  });

  it("Magical/Abstract practices: MYSTICISM, COMMUNION, INTUITION", () => {
    expect(PRACTICES.slice(7)).toEqual([
      "MYSTICISM",
      "COMMUNION",
      "INTUITION",
    ]);
  });
});

describe("SCOPE_LAYERS includes DICE, ALL, and the standard 4", () => {
  it("contains ATTRIBUTE, PRACTICE, NARROW_FOCUS, METRIC, DICE, DURATION, ALL", () => {
    expect(new Set(SCOPE_LAYERS)).toEqual(
      new Set([
        "ATTRIBUTE",
        "PRACTICE",
        "NARROW_FOCUS",
        "METRIC",
        "DICE",
        "DURATION",
        "ALL",
      ]),
    );
  });
});

describe("PROBABILITY_BIAS_TIER_SPEC (canonical tier-to-scope coupling)", () => {
  it("Tier I → NARROW_FOCUS, defaultBuCost 3", () => {
    expect(PROBABILITY_BIAS_TIER_SPEC.I.layer).toBe("NARROW_FOCUS");
    expect(PROBABILITY_BIAS_TIER_SPEC.I.defaultBuCost).toBe(3);
    expect(PROBABILITY_BIAS_TIER_SPEC.I.fixed).toBe(true);
  });

  it("Tier II → PRACTICE (with ATTRIBUTE alternative), defaultBuCost 6", () => {
    expect(PROBABILITY_BIAS_TIER_SPEC.II.layer).toBe("PRACTICE");
    expect(PROBABILITY_BIAS_TIER_SPEC.II.alternativeLayer).toBe("ATTRIBUTE");
    expect(PROBABILITY_BIAS_TIER_SPEC.II.defaultBuCost).toBe(6);
  });

  it("Tier III → ATTRIBUTE, defaultBuCost 12", () => {
    expect(PROBABILITY_BIAS_TIER_SPEC.III.layer).toBe("ATTRIBUTE");
    expect(PROBABILITY_BIAS_TIER_SPEC.III.defaultBuCost).toBe(12);
  });

  it("Tier IV → DICE / D20, defaultBuCost 20", () => {
    expect(PROBABILITY_BIAS_TIER_SPEC.IV.layer).toBe("DICE");
    expect(PROBABILITY_BIAS_TIER_SPEC.IV.defaultValue).toBe("D20");
    expect(PROBABILITY_BIAS_TIER_SPEC.IV.defaultBuCost).toBe(20);
  });

  it("PROBABILITY_BIAS_TIER_COSTS matches the spec defaults", () => {
    expect(PROBABILITY_BIAS_TIER_COSTS).toEqual({
      I: 3,
      II: 6,
      III: 12,
      IV: 20,
    });
  });
});

describe("scopeForBiasTier", () => {
  it("Tier I → NARROW_FOCUS / null", () => {
    expect(scopeForBiasTier("I")).toEqual({ layer: "NARROW_FOCUS", value: null });
  });

  it("Tier IV → DICE / D20", () => {
    expect(scopeForBiasTier("IV")).toEqual({ layer: "DICE", value: "D20" });
  });
});

describe("buildScope", () => {
  it("defaults to no scope when called with no args", () => {
    expect(buildScope()).toEqual({ layer: null, value: null });
  });

  it("accepts null layer for no-scope", () => {
    expect(buildScope(null)).toEqual({ layer: null, value: null });
  });

  it("preserves layer-only construction (per-purchase pick)", () => {
    expect(buildScope("PRACTICE")).toEqual({ layer: "PRACTICE", value: null });
  });

  it("preserves layer + value", () => {
    expect(buildScope("PRACTICE", "AWARENESS")).toEqual({
      layer: "PRACTICE",
      value: "AWARENESS",
    });
  });

  it("normalizes undefined value to null", () => {
    expect(buildScope("NARROW_FOCUS", undefined)).toEqual({
      layer: "NARROW_FOCUS",
      value: null,
    });
  });
});

describe("validateScope — permissive", () => {
  it("null scope is ok (verbs, domains, structures)", () => {
    expect(validateScope(null).ok).toBe(true);
  });

  it("no-scope object is ok", () => {
    expect(validateScope({ layer: null }).ok).toBe(true);
  });

  it("ATTRIBUTE with valid attribute value is ok", () => {
    expect(validateScope({ layer: "ATTRIBUTE", value: "PHYSICAL" }).ok).toBe(true);
  });

  it("ATTRIBUTE with unknown value is rejected", () => {
    const r = validateScope({ layer: "ATTRIBUTE", value: "SPIRITUAL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown attribute/);
  });

  it("PRACTICE with valid practice is ok", () => {
    expect(validateScope({ layer: "PRACTICE", value: "AWARENESS" }).ok).toBe(true);
  });

  it("PRACTICE with unknown practice is rejected", () => {
    const r = validateScope({ layer: "PRACTICE", value: "LEADERSHIP" });
    expect(r.ok).toBe(false);
  });

  it("PRACTICE with null value is ok + soft hint (per-purchase pick)", () => {
    const r = validateScope({ layer: "PRACTICE", value: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.soft).toMatch(/practice picked/i);
  });

  it("NARROW_FOCUS value is free-form and always valid (non-empty string)", () => {
    expect(
      validateScope({ layer: "NARROW_FOCUS", value: "Awareness (Smell)" }).ok,
    ).toBe(true);
    expect(
      validateScope({ layer: "NARROW_FOCUS", value: "Fieldcraft (Mountains)" }).ok,
    ).toBe(true);
    // Even custom ones (this is the open-foundry promise):
    expect(
      validateScope({ layer: "NARROW_FOCUS", value: "Reason (Rune Tracing)" }).ok,
    ).toBe(true);
  });

  it("NARROW_FOCUS rejects empty/whitespace string", () => {
    expect(validateScope({ layer: "NARROW_FOCUS", value: "   " }).ok).toBe(false);
    expect(validateScope({ layer: "NARROW_FOCUS", value: "" }).ok).toBe(false);
  });

  it("DICE / D20 is ok", () => {
    expect(validateScope({ layer: "DICE", value: "D20" }).ok).toBe(true);
  });

  it("DICE with unknown dice is rejected", () => {
    expect(validateScope({ layer: "DICE", value: "D666" }).ok).toBe(false);
  });

  it("ALL layer accepts anything (value ignored, soft note)", () => {
    const r = validateScope({ layer: "ALL", value: "ignored" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.soft).toBeTruthy();
  });

  it("Unknown layer is rejected", () => {
    expect(validateScope({ layer: "TOTALLY_MADE_UP", value: null }).ok).toBe(false);
  });

  it("Non-object scope is rejected", () => {
    expect(validateScope("foo").ok).toBe(false);
    expect(validateScope(42).ok).toBe(false);
  });
});

describe("serializeForDB / parseFromDB round-trip", () => {
  it("null scope → null in DB", () => {
    expect(serializeForDB(null)).toBe(null);
    expect(serializeForDB(undefined)).toBe(null);
  });

  it("null layer → null in DB (no-scope is no-scope)", () => {
    expect(serializeForDB({ layer: null, value: null })).toBe(null);
  });

  it("structured scope → JSON string in DB", () => {
    expect(serializeForDB({ layer: "PRACTICE", value: "AWARENESS" })).toBe(
      '{"layer":"PRACTICE","value":"AWARENESS"}',
    );
  });

  it("parseFromDB null → no-scope", () => {
    expect(parseFromDB(null)).toEqual({ layer: null, value: null });
    expect(parseFromDB("")).toEqual({ layer: null, value: null });
  });

  it("parseFromDB JSON → structured scope", () => {
    expect(parseFromDB('{"layer":"PRACTICE","value":"AWARENESS"}')).toEqual({
      layer: "PRACTICE",
      value: "AWARENESS",
    });
  });

  it("round-trip: serialize → parse returns equivalent", () => {
    const original: TargetScope = { layer: "NARROW_FOCUS", value: "Awareness (Smell)" };
    expect(parseFromDB(serializeForDB(original))).toEqual(original);
  });

  it("round-trip with null value", () => {
    const original: TargetScope = { layer: "PRACTICE", value: null };
    expect(parseFromDB(serializeForDB(original))).toEqual(original);
  });

  it("malformed JSON doesn't crash parseFromDB", () => {
    expect(parseFromDB("{not json")).toEqual({ layer: null, value: null });
  });
});

describe("targetScopeSchema (zod)", () => {
  it("accepts a structured PRACTICE scope", () => {
    expect(targetScopeSchema.safeParse({ layer: "PRACTICE", value: "AWARENESS" }).success).toBe(
      true,
    );
  });

  it("accepts null (no scope)", () => {
    expect(targetScopeSchema.safeParse(null).success).toBe(true);
  });

  it("accepts undefined", () => {
    expect(targetScopeSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects unknown layer", () => {
    expect(
      targetScopeSchema.safeParse({ layer: "NOPE", value: null }).success,
    ).toBe(false);
  });

  it("rejects NARROW_FOCUS with empty string value", () => {
    expect(
      targetScopeSchema.safeParse({ layer: "NARROW_FOCUS", value: "" }).success,
    ).toBe(false);
  });
});

describe("STANDALONE_METRICS", () => {
  it("includes HP, ATTACK, SAVE, DC, REACTION_SLOT, MOVEMENT", () => {
    expect(STANDALONE_METRICS).toContain("HP");
    expect(STANDALONE_METRICS).toContain("ATTACK");
    expect(STANDALONE_METRICS).toContain("SAVE");
    expect(STANDALONE_METRICS).toContain("CHARACTER_DC");
    expect(STANDALONE_METRICS).toContain("REACTION_SLOT");
    expect(STANDALONE_METRICS).toContain("MOVEMENT_SPEED");
  });
});
