// =============================================================================
// Unit tests for the ConditionPicker adapter helpers.
//
// Phase 7 Q-B m4: authoring shape changed from { categories,
// customPills, narrative, includeTags } to { categories, pills,
// operators, narrative, includeTags }. Helpers must reflect the
// new shape.
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
      pills: [],
      operators: [],
      narrative: "",
      includeTags: false,
    });
  });

  it("falls back to narrative variant carrying the legacy value", () => {
    expect(
      conditionAuthoringFromLegacy("skill.context", "equals", "tracking-creatures"),
    ).toEqual({
      categories: [],
      pills: [],
      operators: [],
      narrative: "tracking-creatures",
      includeTags: false,
    });
  });

  it("falls back to the key when value is empty", () => {
    expect(conditionAuthoringFromLegacy("foo", "exists", "")).toEqual({
      categories: [],
      pills: [],
      operators: [],
      narrative: "foo",
      includeTags: false,
    });
  });

  it("maps a target-* legacy key to the target category", () => {
    expect(
      conditionAuthoringFromLegacy("target-prone", "equals", ""),
    ).toEqual({
      categories: ["target"],
      pills: [],
      operators: [],
      narrative: "target-prone",
      includeTags: false,
    });
  });

  it("maps a scene-* legacy key to the scene category", () => {
    expect(
      conditionAuthoringFromLegacy("scene-dim", "equals", ""),
    ).toEqual({
      categories: ["scene"],
      pills: [],
      operators: [],
      narrative: "scene-dim",
      includeTags: false,
    });
  });

  it("maps an actor-* legacy key to the actor category (display label: Self)", () => {
    expect(
      conditionAuthoringFromLegacy("actor-stance", "equals", ""),
    ).toEqual({
      categories: ["actor"],
      pills: [],
      operators: [],
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
        pills: [],
        operators: [],
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
        pills: [{ category: "target", label: "Prone" }],
        operators: [],
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
        pills: [],
        operators: [],
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

  it("falls back to the joined pills when narrative is empty", () => {
    expect(
      legacyFieldsFromAuthoring({
        categories: ["target", "actor"],
        pills: [
          { category: "target", label: "Prone" },
          { category: "actor", label: "Stunned" },
        ],
        operators: ["OR"],
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