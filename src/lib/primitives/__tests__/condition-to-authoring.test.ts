/**
 * condition-to-authoring.test.ts — Phase 8.I i2.5h-fix (Mashu 2026-08-06)
 *
 * Tests for the new conditionToAuthoring() helper that converts a
 * stored ModifierCondition back to the form's ConditionAuthoring
 * shape. The previous loader only read legacy fields, dropping
 * any condition saved via the new picker.
 */
import { describe, it, expect } from "vitest";
import { conditionToAuthoring } from "@/lib/primitives/condition";

describe("conditionToAuthoring", () => {
  it("returns an empty authoring for null/undefined", () => {
    expect(conditionToAuthoring(null)).toEqual({
      categories: [],
      pills: [],
      operators: [],
      narrative: "",
      includeTags: false,
    });
    expect(conditionToAuthoring(undefined)).toEqual({
      categories: [],
      pills: [],
      operators: [],
      narrative: "",
      includeTags: false,
    });
  });

  it("converts {kind: 'tags', customTags} to pills + categories", () => {
    const result = conditionToAuthoring({
      kind: "tags",
      customTags: ["actor:stunned", "target:prone"],
    });
    expect(result.pills).toEqual([
      { category: "actor", label: "stunned" },
      { category: "target", label: "prone" },
    ]);
    expect(result.categories).toEqual(["actor", "target"]);
    expect(result.operators).toEqual([]);
    expect(result.includeTags).toBe(true);
  });

  it("converts {kind: 'tags', customTags} with single tag", () => {
    const result = conditionToAuthoring({
      kind: "tags",
      customTags: ["actor:not_proficient"],
    });
    expect(result.pills).toEqual([
      { category: "actor", label: "not_proficient" },
    ]);
    expect(result.categories).toEqual(["actor"]);
  });

  it("converts {kind: 'compound', tokens} to pills + operators", () => {
    const result = conditionToAuthoring({
      kind: "compound",
      tokens: ["actor:stunned", "AND", "target:prone"],
    });
    expect(result.pills).toEqual([
      { category: "actor", label: "stunned" },
      { category: "target", label: "prone" },
    ]);
    expect(result.operators).toEqual(["AND"]);
    expect(result.categories).toEqual(["actor", "target"]);
    expect(result.includeTags).toBe(true);
  });

  it("converts {kind: 'preset', presetKey} to single pill", () => {
    const result = conditionToAuthoring({
      kind: "preset",
      presetKey: "target-prone",
    });
    expect(result.pills).toEqual([
      { category: "target", label: "prone" },
    ]);
    expect(result.categories).toEqual(["target"]);
  });

  it("converts {kind: 'narrative', text} to narrative-only", () => {
    const result = conditionToAuthoring({
      kind: "narrative",
      text: "during a full moon",
    });
    expect(result.pills).toEqual([]);
    expect(result.operators).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.narrative).toBe("during a full moon");
    expect(result.includeTags).toBe(false);
  });

  it("converts legacy {key: 'target-prone', value: '...'} to narrative + target category", () => {
    // The legacy format uses "category-label" with a hyphen. The
    // form's conditionAuthoringFromLegacy already maps this to a
    // narrative-only authoring with the appropriate category.
    const result = conditionToAuthoring({
      key: "target-prone",
      operator: "equals",
      value: "actor is prone",
    });
    expect(result.categories).toEqual(["target"]);
    expect(result.pills).toEqual([]);
    expect(result.narrative).toBe("actor is prone");
  });

  it("filters out tags with unknown categories", () => {
    const result = conditionToAuthoring({
      kind: "tags",
      customTags: ["actor:stunned", "unknown:foo", "target:prone"],
    });
    expect(result.pills).toEqual([
      { category: "actor", label: "stunned" },
      { category: "target", label: "prone" },
    ]);
    expect(result.categories).toEqual(["actor", "target"]);
  });

  it("handles {kind: 'tags'} with malformed tags (no colon) — narrative captures raw tags", () => {
    // Phase 8.I i2.5h-fix: when ALL tags are malformed, the
    // narrative captures the raw customTags list so the user
    // doesn't lose their authoring intent. When SOME tags are
    // valid, narrative stays empty (the valid ones become pills).
    const result = conditionToAuthoring({
      kind: "tags",
      customTags: ["malformed_tag", "actor:stunned"],
    });
    expect(result.pills).toEqual([
      { category: "actor", label: "stunned" },
    ]);
    // Mixed malformed/valid: narrative is empty (valid ones
    // already represented as pills). The malformed tag is
    // dropped — there's no safe way to render it.
    expect(result.narrative).toBe("");
  });
});
