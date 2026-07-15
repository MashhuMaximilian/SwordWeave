// =============================================================================
// Unit tests for the ConditionPicker adapter helpers.
//
// The ConditionPicker component itself is a presentational React
// component; its rendering is exercised by manual QA + the snapshot
// tests in src/__tests__/snapshots/ (when present). The adapter
// helpers below are pure and worth pinning down: they translate
// between the form's legacy ModifierDraft fields and the new
// ConditionAuthoring shape (Phase 7 Q-B m3: categories + per-category
// custom pills, no preset catalog as the primary input).
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  conditionAuthoringFromLegacy,
  legacyFieldsFromAuthoring,
} from "../condition-picker";

describe("conditionAuthoringFromLegacy", () => {
  it("returns an empty authoring when all legacy fields are blank", () => {
    expect(conditionAuthoringFromLegacy("", "", "")).toEqual({
      categories: [],
      customPills: [],
      narrative: "",
      includeTags: false,
    });
  });

  it("falls back to narrative variant carrying the legacy value", () => {
    expect(
      conditionAuthoringFromLegacy("skill.context", "equals", "tracking-creatures"),
    ).toEqual({
      categories: [],
      customPills: [],
      narrative: "tracking-creatures",
      includeTags: false,
    });
  });

  it("falls back to the key when value is empty", () => {
    expect(conditionAuthoringFromLegacy("foo", "exists", "")).toEqual({
      categories: [],
      customPills: [],
      narrative: "foo",
      includeTags: false,
    });
  });

  it("maps a target-* legacy key to the target category", () => {
    expect(
      conditionAuthoringFromLegacy("target-prone", "equals", ""),
    ).toEqual({
      categories: ["target"],
      customPills: [],
      narrative: "target-prone",
      includeTags: false,
    });
  });

  it("maps a scene-* legacy key to the scene category", () => {
    expect(
      conditionAuthoringFromLegacy("scene-dim", "equals", ""),
    ).toEqual({
      categories: ["scene"],
      customPills: [],
      narrative: "scene-dim",
      includeTags: false,
    });
  });

  it("maps an actor-* legacy key to the actor category (display label: Self)", () => {
    expect(
      conditionAuthoringFromLegacy("actor-stance", "equals", ""),
    ).toEqual({
      categories: ["actor"],
      customPills: [],
      narrative: "actor-stance",
      includeTags: false,
    });
  });
});

describe("legacyFieldsFromAuthoring", () => {
  it("returns the 'always' / empty legacy fields when authoring is empty", () => {
    expect(
      legacyFieldsFromAuthoring({
        categories: [],
        customPills: [],
        narrative: "",
        includeTags: false,
      }),
    ).toEqual({
      conditionMode: "always",
      conditionKey: "",
      conditionOperator: "equals",
      conditionValue: "",
    });
  });

  it("returns 'custom' with the first pill's category:label as the legacy key", () => {
    expect(
      legacyFieldsFromAuthoring({
        categories: ["target"],
        customPills: [{ category: "target", label: "Prone" }],
        narrative: "",
        includeTags: false,
      }),
    ).toEqual({
      conditionMode: "custom",
      conditionKey: "target:Prone",
      conditionOperator: "equals",
      conditionValue: "target:Prone",
    });
  });

  it("returns the narrative text as the legacy value when only narrative is set", () => {
    expect(
      legacyFieldsFromAuthoring({
        categories: [],
        customPills: [],
        narrative: "during a full moon",
        includeTags: false,
      }),
    ).toEqual({
      conditionMode: "custom",
      conditionKey: "",
      conditionOperator: "equals",
      conditionValue: "during a full moon",
    });
  });

  it("falls back to the joined customPills when narrative is empty", () => {
    expect(
      legacyFieldsFromAuthoring({
        categories: ["target", "actor"],
        customPills: [
          { category: "target", label: "Prone" },
          { category: "actor", label: "Stunned" },
        ],
        narrative: "",
        includeTags: false,
      }),
    ).toEqual({
      conditionMode: "custom",
      conditionKey: "target:Prone",
      conditionOperator: "equals",
      conditionValue: "target:Prone, actor:Stunned",
    });
  });
});