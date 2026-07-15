// =============================================================================
// Unit tests for the ConditionPicker adapter helpers.
//
// The ConditionPicker component itself is a presentational React
// component; its rendering is exercised by manual QA + the snapshot
// tests in src/__tests__/snapshots/ (when present). The adapter
// helpers below are pure and worth pinning down: they translate
// between the form's legacy ModifierDraft fields and the new
// ConditionAuthoring shape.
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  conditionAuthoringFromLegacy,
  legacyFieldsFromAuthoring,
} from "../condition-picker";

describe("conditionAuthoringFromLegacy", () => {
  it("returns an empty authoring when all legacy fields are blank", () => {
    expect(conditionAuthoringFromLegacy("", "", "")).toEqual({
      presetKey: null,
      customTags: [],
      narrative: "",
      includeTags: false,
    });
  });

  it("falls back to narrative variant carrying the legacy value", () => {
    expect(
      conditionAuthoringFromLegacy("skill.context", "equals", "tracking-creatures"),
    ).toEqual({
      presetKey: null,
      customTags: [],
      narrative: "tracking-creatures",
      includeTags: false,
    });
  });

  it("falls back to the key when value is empty", () => {
    expect(conditionAuthoringFromLegacy("foo", "exists", "")).toEqual({
      presetKey: null,
      customTags: [],
      narrative: "foo",
      includeTags: false,
    });
  });
});

describe("legacyFieldsFromAuthoring", () => {
  it("returns the 'always' / empty legacy fields when authoring is empty", () => {
    expect(
      legacyFieldsFromAuthoring({
        presetKey: null,
        customTags: [],
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

  it("returns 'custom' with presetKey as the legacy key when a preset is set", () => {
    expect(
      legacyFieldsFromAuthoring({
        presetKey: "target-prone",
        customTags: [],
        narrative: "",
        includeTags: false,
      }),
    ).toEqual({
      conditionMode: "custom",
      conditionKey: "target-prone",
      conditionOperator: "equals",
      conditionValue: "",
    });
  });

  it("returns the narrative text as the legacy value when only narrative is set", () => {
    expect(
      legacyFieldsFromAuthoring({
        presetKey: null,
        customTags: [],
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

  it("prefers narrative over customTags when includeTags is false", () => {
    expect(
      legacyFieldsFromAuthoring({
        presetKey: null,
        customTags: ["alone", "wounded"],
        narrative: "in the dark",
        includeTags: false,
      }),
    ).toEqual({
      conditionMode: "custom",
      conditionKey: "",
      conditionOperator: "equals",
      conditionValue: "in the dark",
    });
  });

  it("joins customTags with commas when narrative is empty", () => {
    expect(
      legacyFieldsFromAuthoring({
        presetKey: null,
        customTags: ["alone", "wounded"],
        narrative: "",
        includeTags: true,
      }),
    ).toEqual({
      conditionMode: "custom",
      conditionKey: "",
      conditionOperator: "equals",
      conditionValue: "alone, wounded",
    });
  });
});