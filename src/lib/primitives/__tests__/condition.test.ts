import { describe, expect, it } from "vitest";

import {
  buildCondition,
  conditionToBadges,
  legacyConditionProjection,
  migrateLegacyCondition,
  parseCondition,
  presetLabel,
} from "@/lib/primitives/condition";
import {
  CONDITION_PRESETS,
  CONDITION_PRESET_KEYS,
  type ConditionPresetKey,
} from "@/types/condition";

// =============================================================================
// Catalog
// =============================================================================

describe("CONDITION_PRESETS catalog", () => {
  it("contains exactly 16 entries", () => {
    expect(CONDITION_PRESETS).toHaveLength(16);
  });

  it("has 7 target, 5 scene, 4 actor presets", () => {
    const counts = CONDITION_PRESETS.reduce<Record<string, number>>(
      (acc, p) => {
        acc[p.category] = (acc[p.category] ?? 0) + 1;
        return acc;
      },
      {},
    );
    expect(counts["target"]).toBe(7);
    expect(counts["scene"]).toBe(5);
    expect(counts["actor"]).toBe(4);
  });

  it("has unique keys", () => {
    const keys = CONDITION_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every key is in CONDITION_PRESET_KEYS set", () => {
    for (const p of CONDITION_PRESETS) {
      expect(CONDITION_PRESET_KEYS.has(p.key)).toBe(true);
    }
  });

  it("every preset has a non-empty label", () => {
    for (const p of CONDITION_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
    }
  });
});

describe("presetLabel", () => {
  it("returns the catalog label for known keys", () => {
    expect(presetLabel("target-prone")).toBe("Target is Prone");
    expect(presetLabel("actor-stance")).toBe("Actor has Stance (custom)");
  });

  it("returns null for unknown keys", () => {
    expect(presetLabel("not-a-real-key")).toBeNull();
  });
});

// =============================================================================
// parseCondition — new shapes
// =============================================================================

describe("parseCondition (new shapes)", () => {
  it("returns null for null / undefined / empty", () => {
    expect(parseCondition(null)).toBeNull();
    expect(parseCondition(undefined)).toBeNull();
    expect(parseCondition({})).toBeNull();
  });

  it("parses a preset variant", () => {
    const result = parseCondition({
      kind: "preset",
      presetKey: "target-prone",
      customTags: ["and pinned"],
    });
    expect(result).toEqual({
      kind: "preset",
      presetKey: "target-prone",
      customTags: ["and pinned"],
    });
  });

  it("defaults customTags to empty when omitted on preset", () => {
    const result = parseCondition({
      kind: "preset",
      presetKey: "target-prone",
    });
    expect(result).toEqual({
      kind: "preset",
      presetKey: "target-prone",
      customTags: [],
    });
  });

  it("throws on unknown presetKey", () => {
    expect(() =>
      parseCondition({ kind: "preset", presetKey: "fake-key" }),
    ).toThrow("unknown presetKey: fake-key");
  });

  it("parses a narrative variant", () => {
    const result = parseCondition({
      kind: "narrative",
      text: "during a full moon",
    });
    expect(result).toEqual({ kind: "narrative", text: "during a full moon" });
  });

  it("parses a tags variant", () => {
    const result = parseCondition({
      kind: "tags",
      customTags: ["when wounded", "and alone"],
    });
    expect(result).toEqual({
      kind: "tags",
      customTags: ["when wounded", "and alone"],
    });
  });

  it("treats empty tags variant as null", () => {
    expect(parseCondition({ kind: "tags", customTags: [] })).toBeNull();
  });

  it("throws on unknown kind", () => {
    expect(() => parseCondition({ kind: "banana" })).toThrow(
      "unknown condition kind",
    );
  });

  it("throws on non-object input", () => {
    expect(() => parseCondition("hello")).toThrow("condition must be");
    expect(() => parseCondition(42)).toThrow("condition must be");
  });

  it("throws on preset with non-string presetKey", () => {
    expect(() =>
      parseCondition({ kind: "preset", presetKey: 42 }),
    ).toThrow("preset condition requires presetKey: string");
  });

  it("throws on preset with non-string[] customTags", () => {
    expect(() =>
      parseCondition({
        kind: "preset",
        presetKey: "target-prone",
        customTags: [1, 2],
      }),
    ).toThrow("preset condition customTags must be string[]");
  });

  it("throws on narrative with non-string text", () => {
    expect(() => parseCondition({ kind: "narrative", text: 7 })).toThrow(
      "narrative condition requires text: string",
    );
  });

  it("throws on tags with non-string[] customTags", () => {
    expect(() =>
      parseCondition({ kind: "tags", customTags: ["ok", 99] }),
    ).toThrow("tags condition customTags must be string[]");
  });
});

// =============================================================================
// parseCondition — legacy migration
// =============================================================================

describe("parseCondition (legacy shape)", () => {
  it("migrates a legacy row whose key matches a preset", () => {
    const result = parseCondition({
      key: "target-prone",
      operator: "equals",
      value: "prone",
    });
    expect(result).toEqual({
      kind: "preset",
      presetKey: "target-prone",
      customTags: [],
    });
  });

  it("migrates a legacy row whose key does NOT match — narrative fallback", () => {
    const result = parseCondition({
      key: "skill.context",
      operator: "equals",
      value: "tracking-creatures",
    });
    expect(result).toEqual({
      kind: "narrative",
      text: "tracking-creatures",
    });
  });

  it("legacy migration falls back to the key when value is not a string", () => {
    const result = parseCondition({
      key: "weird-key",
      operator: "exists",
      value: true,
    });
    expect(result).toEqual({ kind: "narrative", text: "weird-key" });
  });

  it("legacy migration with no value uses the key as text", () => {
    const result = parseCondition({
      key: "no-value-key",
      operator: "exists",
    });
    expect(result).toEqual({ kind: "narrative", text: "no-value-key" });
  });

  it("legacy migration with empty key returns null", () => {
    expect(parseCondition({ key: "", operator: "equals" })).toBeNull();
  });
});

// =============================================================================
// migrateLegacyCondition (direct)
// =============================================================================

describe("migrateLegacyCondition", () => {
  it("returns null for empty key", () => {
    expect(migrateLegacyCondition({ key: "" })).toBeNull();
  });

  it("known key → preset variant, no customTags", () => {
    expect(migrateLegacyCondition({ key: "scene-dim" })).toEqual({
      kind: "preset",
      presetKey: "scene-dim",
      customTags: [],
    });
  });

  it("unknown key → narrative variant from value when string", () => {
    expect(
      migrateLegacyCondition({ key: "foo", operator: "x", value: "bar" }),
    ).toEqual({ kind: "narrative", text: "bar" });
  });

  it("unknown key → narrative variant from key when value not string", () => {
    expect(migrateLegacyCondition({ key: "foo", value: 42 })).toEqual({
      kind: "narrative",
      text: "foo",
    });
  });

  it("all 16 catalog keys migrate to preset variant (round-trip)", () => {
    for (const p of CONDITION_PRESETS) {
      const result = migrateLegacyCondition({ key: p.key });
      expect(result).toEqual({
        kind: "preset",
        presetKey: p.key,
        customTags: [],
      });
    }
  });
});

// =============================================================================
// buildCondition
// =============================================================================

describe("buildCondition", () => {
  it("preset → preset variant, customTags trimmed and emptied of blanks", () => {
    const result = buildCondition({
      presetKey: "target-prone",
      customTags: ["  and pinned  ", "", "  "],
      narrative: "ignored",
      includeTags: false,
    });
    expect(result).toEqual({
      kind: "preset",
      presetKey: "target-prone",
      customTags: ["and pinned"],
    });
  });

  it("preset path DROPS narrative (preset wins)", () => {
    const result = buildCondition({
      presetKey: "actor-stance",
      customTags: [],
      narrative: "this should be dropped",
      includeTags: true,
    });
    expect(result).toEqual({
      kind: "preset",
      presetKey: "actor-stance",
      customTags: [],
    });
  });

  it("includeTags=true with non-empty tags and no preset → tags variant", () => {
    const result = buildCondition({
      presetKey: null,
      customTags: ["when wounded"],
      narrative: "",
      includeTags: true,
    });
    expect(result).toEqual({
      kind: "tags",
      customTags: ["when wounded"],
    });
  });

  it("includeTags=true but empty tags → narrative if any, else null", () => {
    expect(
      buildCondition({
        presetKey: null,
        customTags: [],
        narrative: "",
        includeTags: true,
      }),
    ).toBeNull();
    expect(
      buildCondition({
        presetKey: null,
        customTags: [],
        narrative: "during a storm",
        includeTags: true,
      }),
    ).toEqual({ kind: "narrative", text: "during a storm" });
  });

  it("includeTags=false with tags but no preset and no narrative → null", () => {
    expect(
      buildCondition({
        presetKey: null,
        customTags: ["when wounded"],
        narrative: "",
        includeTags: false,
      }),
    ).toBeNull();
  });

  it("narrative-only path (no preset, no tags, no includeTags) → narrative variant", () => {
    expect(
      buildCondition({
        presetKey: null,
        customTags: [],
        narrative: "  at midnight  ",
        includeTags: false,
      }),
    ).toEqual({ kind: "narrative", text: "at midnight" });
  });

  it("narrative + includeTags=false + tags → narrative folds tags in as prefix", () => {
    expect(
      buildCondition({
        presetKey: null,
        customTags: ["when wounded", "alone"],
        narrative: "in the dark",
        includeTags: false,
      }),
    ).toEqual({
      kind: "narrative",
      text: "when wounded, alone — in the dark",
    });
  });

  it("narrative + includeTags=true + tags → narrative wins (tags empty after trimming OR tags win first)", () => {
    // includeTags=true with non-empty tags wins via rule 2 → tags variant
    expect(
      buildCondition({
        presetKey: null,
        customTags: ["alone"],
        narrative: "in the dark",
        includeTags: true,
      }),
    ).toEqual({ kind: "tags", customTags: ["alone"] });
  });

  it("all empty → null", () => {
    expect(
      buildCondition({
        presetKey: null,
        customTags: [],
        narrative: "",
        includeTags: false,
      }),
    ).toBeNull();
    expect(
      buildCondition({
        presetKey: null,
        customTags: [],
        narrative: "   ",
        includeTags: true,
      }),
    ).toBeNull();
  });

  it("all 16 preset keys round-trip through buildCondition", () => {
    for (const p of CONDITION_PRESETS) {
      const result = buildCondition({
        presetKey: p.key as ConditionPresetKey,
        customTags: [],
        narrative: "",
        includeTags: false,
      });
      expect(result).toEqual({
        kind: "preset",
        presetKey: p.key,
        customTags: [],
      });
    }
  });
});

// =============================================================================
// conditionToBadges
// =============================================================================

describe("conditionToBadges", () => {
  it("null → empty array", () => {
    expect(conditionToBadges(null)).toEqual([]);
  });

  it("preset → preset badge + tag badges", () => {
    const badges = conditionToBadges({
      kind: "preset",
      presetKey: "target-prone",
      customTags: ["and pinned", "helpless"],
    });
    expect(badges).toEqual([
      { kind: "preset", label: "Target is Prone" },
      { kind: "tag", label: "and pinned" },
      { kind: "tag", label: "helpless" },
    ]);
  });

  it("preset with no customTags → only the preset badge", () => {
    expect(
      conditionToBadges({
        kind: "preset",
        presetKey: "scene-dim",
        customTags: [],
      }),
    ).toEqual([{ kind: "preset", label: "Scene is Dim" }]);
  });

  it("preset with unknown key (shouldn't happen, but defensive) → falls back to key string", () => {
    // Cast through unknown to bypass the type system for this test.
    const badges = conditionToBadges({
      kind: "preset",
      presetKey: "ghost-key" as ConditionPresetKey,
      customTags: [],
    });
    expect(badges[0]).toEqual({ kind: "preset", label: "ghost-key" });
  });

  it("tags variant → all tags, no preset anchor", () => {
    expect(
      conditionToBadges({ kind: "tags", customTags: ["solo", "injured"] }),
    ).toEqual([
      { kind: "tag", label: "solo" },
      { kind: "tag", label: "injured" },
    ]);
  });

  it("narrative variant → single italic-style entry", () => {
    expect(
      conditionToBadges({ kind: "narrative", text: "during a full moon" }),
    ).toEqual([{ kind: "narrative", label: "during a full moon" }]);
  });
});

// =============================================================================
// End-to-end smoke: legacy → migrate → parse → buildCondition round trip
// =============================================================================

describe("end-to-end smoke", () => {
  it("legacy row → parse → badges renders a preset", () => {
    const parsed = parseCondition({
      key: "target-prone",
      operator: "equals",
      value: true,
    });
    expect(parsed).toEqual({
      kind: "preset",
      presetKey: "target-prone",
      customTags: [],
    });
    const badges = conditionToBadges(parsed);
    expect(badges[0]).toEqual({ kind: "preset", label: "Target is Prone" });
  });

  it("legacy row with unknown key → parse → badges renders narrative", () => {
    const parsed = parseCondition({
      key: "skill.context",
      operator: "equals",
      value: "tracking-creatures",
    });
    const badges = conditionToBadges(parsed);
    expect(badges).toEqual([
      { kind: "narrative", label: "tracking-creatures" },
    ]);
  });

  it("buildCondition → parseCondition round-trips for all 3 variants", () => {
    // preset
    const preset = buildCondition({
      presetKey: "actor-stance",
      customTags: ["aggressive"],
      narrative: "ignored",
      includeTags: false,
    });
    expect(parseCondition(preset)).toEqual(preset);

    // tags
    const tags = buildCondition({
      presetKey: null,
      customTags: ["solo"],
      narrative: "",
      includeTags: true,
    });
    expect(parseCondition(tags)).toEqual(tags);

    // narrative
    const narrative = buildCondition({
      presetKey: null,
      customTags: [],
      narrative: "full moon",
      includeTags: false,
    });
    expect(parseCondition(narrative)).toEqual(narrative);
  });
});
// =============================================================================
// legacyConditionProjection (Phase-7-Q-B / D-prime)
// =============================================================================

describe("legacyConditionProjection", () => {
  it("returns the empty triple for null / undefined / non-object input", () => {
    expect(legacyConditionProjection(undefined)).toEqual({
      key: "",
      operator: "equals",
      value: "",
    });
    expect(legacyConditionProjection(null)).toEqual({
      key: "",
      operator: "equals",
      value: "",
    });
    expect(legacyConditionProjection("nope")).toEqual({
      key: "",
      operator: "equals",
      value: "",
    });
  });

  it("passes through the legacy {key, operator, value} triple", () => {
    expect(
      legacyConditionProjection({
        key: "skill.context",
        operator: "equals",
        value: "tracking-creatures",
      }),
    ).toEqual({
      key: "skill.context",
      operator: "equals", // v1 doesn't evaluate; coerced
      value: "tracking-creatures",
    });
  });

  it("coerces legacy numeric / boolean values to strings", () => {
    expect(
      legacyConditionProjection({ key: "hp-pct", operator: "less-than", value: 50 }),
    ).toEqual({ key: "hp-pct", operator: "equals", value: "50" });
    expect(
      legacyConditionProjection({ key: "flag", operator: "exists", value: true }),
    ).toEqual({ key: "flag", operator: "equals", value: "true" });
  });

  it("drops `value` when undefined on legacy shape", () => {
    const out = legacyConditionProjection({
      key: "flag",
      operator: "exists",
    });
    expect(out.key).toBe("flag");
    expect(out.operator).toBe("equals");
    expect(out.value).toBe("");
  });

  it("projects preset variant → presetKey as key, value empty", () => {
    expect(
      legacyConditionProjection({
        kind: "preset",
        presetKey: "target-prone",
        customTags: [],
      }),
    ).toEqual({ key: "target-prone", operator: "equals", value: "" });
  });

  it("projects narrative variant → text as value, key empty", () => {
    expect(
      legacyConditionProjection({ kind: "narrative", text: "full moon" }),
    ).toEqual({ key: "", operator: "equals", value: "full moon" });
  });

  it("projects tags variant → joined customTags as value", () => {
    expect(
      legacyConditionProjection({
        kind: "tags",
        customTags: ["smell", "fog", "by moon"],
      }),
    ).toEqual({
      key: "",
      operator: "equals",
      value: "smell, fog, by moon",
    });
  });

  it("filters non-string entries from tags.customTags", () => {
    expect(
      legacyConditionProjection({
        kind: "tags",
        customTags: ["a", 1, "b", null, "c"],
      }),
    ).toEqual({ key: "", operator: "equals", value: "a, b, c" });
  });

  it("returns empty triple for unknown shape", () => {
    expect(legacyConditionProjection({ foo: "bar" })).toEqual({
      key: "",
      operator: "equals",
      value: "",
    });
  });
});
