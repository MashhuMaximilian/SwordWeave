/**
 * Tests for the Phase-7-E modifier-scope vocabulary and helpers.
 *
 * Covers:
 *   - `MODIFIER_TARGETS` / `MODIFIER_TARGET_SPEC` data shape.
 *   - `buildScopeFromValues` dedup + empty-handling.
 *   - `buildScopeFromNarrowFocus` empty-text handling.
 *   - `validateModifierScope` per-layer checks.
 *   - `resolveStoredScope` priority order (Phase-7-E vs legacy).
 *   - `selectionForModifier` legacy and Phase-7-E shapes.
 *   - `scopeForSelection` round-trips with selectionForModifier.
 *   - Legacy dotted-target migration map covers all 22 dotted entries.
 *   - Skill/Practice Check granularity round-trip.
 */
import { describe, expect, it } from "vitest";
import {
  MODIFIER_TARGETS,
  MODIFIER_TARGET_SPEC,
  LEGACY_TARGET_MIGRATIONS,
  buildScopeFromValues,
  buildScopeFromNarrowFocus,
  validateModifierScope,
  resolveStoredScope,
  selectionForModifier,
  scopeForSelection,
  type ModifierTarget,
} from "../modifier-scope";
import {
  ATTRIBUTES,
  PRACTICES,
  DICE_VALUES,
  DURATION_VALUES,
} from "../target-scope";

describe("MODIFIER_TARGETS enum", () => {
  it("has 16 entries (the trimmed-down dropdown)", () => {
    expect(MODIFIER_TARGETS.length).toBe(16);
  });

  it("consolidates the three Attribute variants into one entry", () => {
    expect(MODIFIER_TARGETS).toContain("attribute");
    expect(MODIFIER_TARGETS).not.toContain("attribute_physical");
    expect(MODIFIER_TARGETS).not.toContain("attribute_mental");
    expect(MODIFIER_TARGETS).not.toContain("attribute_magical");
  });

  it("consolidates the three DC variants into one entry", () => {
    expect(MODIFIER_TARGETS).toContain("defense_dc");
  });

  it("consolidates the three speed variants into one entry", () => {
    expect(MODIFIER_TARGETS).toContain("speed");
  });

  it("still includes single-axis entries", () => {
    expect(MODIFIER_TARGETS).toContain("max_vitality");
    expect(MODIFIER_TARGETS).toContain("current_vitality");
    expect(MODIFIER_TARGETS).toContain("proficiency_bonus");
    expect(MODIFIER_TARGETS).toContain("action_roll");
    expect(MODIFIER_TARGETS).toContain("skill_practice_check");
    expect(MODIFIER_TARGETS).toContain("damage_healing_output");
  });
});

describe("MODIFIER_TARGET_SPEC", () => {
  it("every modifier target has a spec entry", () => {
    for (const t of MODIFIER_TARGETS) {
      expect(MODIFIER_TARGET_SPEC[t]).toBeDefined();
      expect(MODIFIER_TARGET_SPEC[t].target).toBe(t);
      expect(MODIFIER_TARGET_SPEC[t].label).toBeTruthy();
    }
  });

  it("attribute target uses ATTRIBUTE layer with attribute checklist", () => {
    const spec = MODIFIER_TARGET_SPEC.attribute;
    expect(spec.layer).toBe("ATTRIBUTE");
    expect(spec.widget).toBe("checklist");
    expect(spec.options).toEqual(ATTRIBUTES);
  });

  it("defense_dc uses METRIC with Physical/Mental/Magical checklist", () => {
    const spec = MODIFIER_TARGET_SPEC.defense_dc;
    expect(spec.layer).toBe("METRIC");
    expect(spec.widget).toBe("checklist");
    expect(spec.options).toEqual(["PHYSICAL", "MENTAL", "MAGICAL"]);
  });

  it("speed uses METRIC with Land/Fly/Swim checklist", () => {
    const spec = MODIFIER_TARGET_SPEC.speed;
    expect(spec.layer).toBe("METRIC");
    expect(spec.widget).toBe("checklist");
    expect(spec.options).toEqual(["LAND_SPEED", "FLY_SPEED", "SWIM_SPEED"]);
  });

  it("skill_practice_check uses radio-granularity widget", () => {
    const spec = MODIFIER_TARGET_SPEC.skill_practice_check;
    expect(spec.widget).toBe("radio-granularity");
    expect(spec.options).toEqual(PRACTICES);
  });

  it("damage_healing_output uses DICE checklist", () => {
    const spec = MODIFIER_TARGET_SPEC.damage_healing_output;
    expect(spec.layer).toBe("DICE");
    expect(spec.widget).toBe("checklist");
    expect(spec.options).toEqual(DICE_VALUES);
  });

  it("duration uses DURATION checklist", () => {
    const spec = MODIFIER_TARGET_SPEC.duration;
    expect(spec.layer).toBe("DURATION");
    expect(spec.widget).toBe("checklist");
    expect(spec.options).toEqual(DURATION_VALUES);
  });

  it("strain has valueIsNumeric flag", () => {
    const spec = MODIFIER_TARGET_SPEC.strain;
    expect(spec.valueIsNumeric).toBe(true);
  });

  it("single-axis targets have widget=none (no Target Value picker)", () => {
    expect(MODIFIER_TARGET_SPEC.max_vitality.widget).toBe("none");
    expect(MODIFIER_TARGET_SPEC.current_vitality.widget).toBe("none");
    expect(MODIFIER_TARGET_SPEC.proficiency_bonus.widget).toBe("none");
    expect(MODIFIER_TARGET_SPEC.action_roll.widget).toBe("none");
  });
});

describe("buildScopeFromValues", () => {
  it("returns values array with empty list for no inputs", () => {
    const scope = buildScopeFromValues("ATTRIBUTE", []);
    expect(scope).toEqual({ layer: "ATTRIBUTE", values: [] });
  });

  it("preserves checked values", () => {
    const scope = buildScopeFromValues("ATTRIBUTE", ["PHYSICAL", "MAGICAL"]);
    expect(scope).toEqual({
      layer: "ATTRIBUTE",
      values: ["PHYSICAL", "MAGICAL"],
    });
  });

  it("dedupes duplicate values", () => {
    const scope = buildScopeFromValues("PRACTICE", [
      "AWARENESS",
      "AWARENESS",
      "REASON",
    ]);
    expect(scope.values).toEqual(["AWARENESS", "REASON"]);
  });

  it("drops empty strings", () => {
    const scope = buildScopeFromValues("METRIC", [
      "ATTACK_ROLL",
      "",
      "DEFENSE_ROLL",
    ]);
    expect(scope.values).toEqual(["ATTACK_ROLL", "DEFENSE_ROLL"]);
  });

  it("trims whitespace", () => {
    const scope = buildScopeFromValues("NARROW_FOCUS", ["  Awareness (Smell)  "]);
    expect(scope.values).toEqual(["Awareness (Smell)"]);
  });
});

describe("buildScopeFromNarrowFocus", () => {
  it("returns empty values for empty input", () => {
    const scope = buildScopeFromNarrowFocus("");
    expect(scope).toEqual({ layer: "NARROW_FOCUS", values: [] });
  });

  it("returns the trimmed single focus", () => {
    const scope = buildScopeFromNarrowFocus("  Awareness (Smell)  ");
    expect(scope).toEqual({
      layer: "NARROW_FOCUS",
      values: ["Awareness (Smell)"],
    });
  });
});

describe("validateModifierScope", () => {
  it("returns ok for null scope", () => {
    const r = validateModifierScope(null);
    expect(r.ok).toBe(true);
  });

  it("returns ok for null layer with values (positional/narrative)", () => {
    const r = validateModifierScope({ layer: null, values: [] });
    expect(r.ok).toBe(true);
  });

  it("accepts known ATTRIBUTE values", () => {
    const r = validateModifierScope({
      layer: "ATTRIBUTE",
      values: ["PHYSICAL", "MAGICAL"],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects unknown ATTRIBUTE values", () => {
    const r = validateModifierScope({
      layer: "ATTRIBUTE",
      values: ["UNKNOWN"],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts known PRACTICE values", () => {
    const r = validateModifierScope({
      layer: "PRACTICE",
      values: ["AWARENESS"],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects unknown PRACTICE values", () => {
    const r = validateModifierScope({
      layer: "PRACTICE",
      values: ["FAKE_PRACTICE"],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts free-form NARROW_FOCUS values", () => {
    const r = validateModifierScope({
      layer: "NARROW_FOCUS",
      values: ["Awareness (Smell)", "Fieldcraft (Tracking)"],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects empty NARROW_FOCUS values", () => {
    const r = validateModifierScope({
      layer: "NARROW_FOCUS",
      values: ["   "],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts known METRIC values", () => {
    expect(
      validateModifierScope({
        layer: "METRIC",
        values: ["HP", "ATTACK_ROLL"],
      }).ok,
    ).toBe(true);
  });

  it("accepts open-foundry METRIC values (LAND_SPEED, FLY_SPEED, etc.)", () => {
    expect(
      validateModifierScope({
        layer: "METRIC",
        values: ["LAND_SPEED", "FLY_SPEED", "SWIM_SPEED"],
      }).ok,
    ).toBe(true);
  });

  it("accepts known DICE values", () => {
    expect(
      validateModifierScope({ layer: "DICE", values: ["D20"] }).ok,
    ).toBe(true);
  });

  it("accepts known DURATION values", () => {
    expect(
      validateModifierScope({ layer: "DURATION", values: ["SCENE"] }).ok,
    ).toBe(true);
  });

  it("returns ok with empty values (means 'any')", () => {
    expect(
      validateModifierScope({ layer: "ATTRIBUTE", values: [] }).ok,
    ).toBe(true);
  });
});

describe("resolveStoredScope", () => {
  it("reads metadata.targetScope when present (Phase-7-E)", () => {
    const scope = resolveStoredScope({
      target: "attribute",
      metadata: {
        targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL", "MAGICAL"] },
      },
    });
    expect(scope).toEqual({
      layer: "ATTRIBUTE",
      values: ["PHYSICAL", "MAGICAL"],
    });
  });

  it("falls back to legacy dotted target", () => {
    const scope = resolveStoredScope({
      target: "character.attribute.physical",
      metadata: null,
    });
    expect(scope).toEqual({
      layer: "ATTRIBUTE",
      values: ["PHYSICAL"],
    });
  });

  it("prefers metadata over legacy (Phase-7-E wins)", () => {
    const scope = resolveStoredScope({
      target: "character.attribute.physical",
      metadata: {
        targetScope: { layer: "ATTRIBUTE", values: ["MENTAL"] },
      },
    });
    expect(scope?.values).toEqual(["MENTAL"]);
  });

  it("returns null for unknown target with no metadata", () => {
    const scope = resolveStoredScope({
      target: "totally.unknown",
      metadata: null,
    });
    expect(scope).toBeNull();
  });

  it("returns null for empty metadata and missing target", () => {
    const scope = resolveStoredScope({});
    expect(scope).toBeNull();
  });

  it("handles malformed metadata gracefully (no crash)", () => {
    const scope = resolveStoredScope({
      target: "attribute",
      metadata: { targetScope: "not-an-object" } as never,
    });
    expect(scope).toBeNull();
  });
});

describe("selectionForModifier", () => {
  it("extracts target + values from Phase-7-E shape", () => {
    const sel = selectionForModifier({
      target: "attribute",
      metadata: {
        targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] },
      },
    });
    expect(sel.target).toBe("attribute");
    expect(sel.targetValues).toEqual(["PHYSICAL"]);
    expect(sel.granularity).toBeNull();
    expect(sel.freeTextNarrowFocus).toBeNull();
  });

  it("extracts granularity for skill_practice_check broad", () => {
    const sel = selectionForModifier({
      target: "skill_practice_check",
      metadata: {
        targetScope: { layer: "PRACTICE", values: ["AWARENESS"] },
        granularity: "broad",
      },
    });
    expect(sel.target).toBe("skill_practice_check");
    expect(sel.granularity).toBe("broad");
    expect(sel.targetValues).toEqual(["AWARENESS"]);
  });

  it("extracts narrow-focus text from skill_practice_check narrow", () => {
    const sel = selectionForModifier({
      target: "skill_practice_check",
      metadata: {
        targetScope: {
          layer: "NARROW_FOCUS",
          values: ["Awareness (Smell)"],
        },
        granularity: "narrow",
      },
    });
    expect(sel.target).toBe("skill_practice_check");
    expect(sel.granularity).toBe("narrow");
    expect(sel.freeTextNarrowFocus).toBe("Awareness (Smell)");
  });

  it("infers legacy dotted form", () => {
    const sel = selectionForModifier({
      target: "character.skill",
    });
    expect(sel.target).toBe("skill_practice_check");
    expect(sel.granularity).toBe("broad");
  });

  it("handles unknown target by defaulting to action_roll", () => {
    const sel = selectionForModifier({ target: "ghost.target" });
    expect(sel.target).toBe("action_roll");
    expect(sel.targetValues).toEqual([]);
  });
});

describe("scopeForSelection (round-trip with selectionForModifier)", () => {
  it("round-trips attribute broad", () => {
    const sel = {
      target: "attribute" as ModifierTarget,
      targetValues: ["PHYSICAL", "MAGICAL"],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.target).toBe("attribute");
    expect(out.metadata.targetScope).toEqual({
      layer: "ATTRIBUTE",
      values: ["PHYSICAL", "MAGICAL"],
    });
    expect(out.metadata.granularity).toBeNull();

    // And reading it back:
    const back = selectionForModifier({
      target: out.target,
      metadata: {
        targetScope: {
          layer: out.metadata.targetScope.layer,
          values: [...out.metadata.targetScope.values],
        },
        ...(out.metadata.granularity
          ? { granularity: out.metadata.granularity }
          : {}),
      },
    });
    expect(back).toEqual({ ...sel, freeTextNarrowFocus: null });
  });

  it("round-trips skill_practice_check broad", () => {
    const sel = {
      target: "skill_practice_check" as ModifierTarget,
      targetValues: ["AWARENESS"],
      granularity: "broad" as const,
    };
    const out = scopeForSelection(sel);
    expect(out.metadata.targetScope).toEqual({
      layer: "PRACTICE",
      values: ["AWARENESS"],
    });
    expect(out.metadata.granularity).toBe("broad");
  });

  it("round-trips skill_practice_check narrow with custom focus text", () => {
    const sel = {
      target: "skill_practice_check" as ModifierTarget,
      targetValues: [],
      granularity: "narrow" as const,
      freeTextNarrowFocus: "Awareness (Smell)",
    };
    const out = scopeForSelection(sel);
    expect(out.metadata.targetScope).toEqual({
      layer: "NARROW_FOCUS",
      values: ["Awareness (Smell)"],
    });
    expect(out.metadata.granularity).toBe("narrow");
  });

  it("round-trips damage_healing_output with multiple dice", () => {
    const sel = {
      target: "damage_healing_output" as ModifierTarget,
      targetValues: ["D6", "D8"],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.metadata.targetScope).toEqual({
      layer: "DICE",
      values: ["D6", "D8"],
    });
  });

  it("round-trips speed multi-axis", () => {
    const sel = {
      target: "speed" as ModifierTarget,
      targetValues: ["FLY_SPEED", "SWIM_SPEED"],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.metadata.targetScope).toEqual({
      layer: "METRIC",
      values: ["FLY_SPEED", "SWIM_SPEED"],
    });
  });

  it("round-trips duration scene", () => {
    const sel = {
      target: "duration" as ModifierTarget,
      targetValues: ["SCENE"],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.metadata.targetScope).toEqual({
      layer: "DURATION",
      values: ["SCENE"],
    });
  });

  it("round-trips single-axis target with empty values", () => {
    const sel = {
      target: "max_vitality" as ModifierTarget,
      targetValues: [],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.metadata.targetScope.layer).toBe("METRIC");
    expect(out.metadata.targetScope.values).toEqual([]);
  });
});

describe("LEGACY_TARGET_MIGRATIONS covers all 22 dashed entries", () => {
  it("contains entries for every legacy dotted target", () => {
    const expectedLegacy = [
      "character.attribute.physical",
      "character.attribute.mental",
      "character.attribute.magical",
      "character.defense.physicalDc",
      "character.defense.mentalDc",
      "character.defense.magicalDc",
      "character.movement.land",
      "character.movement.fly",
      "character.movement.swim",
      "character.maxVitality",
      "character.currentVitality",
      "character.skill",
      "character.proficiencyBonus",
      "action.roll",
      "action.damage",
      "action.range",
      "action.targetCount",
      "action.areaSize",
      "action.duration",
      "action.strain",
      "item.slotCost",
      "scene.pace",
    ];
    for (const t of expectedLegacy) {
      expect(LEGACY_TARGET_MIGRATIONS[t]).toBeDefined();
    }
  });

  it("every migration maps to a canonical short target", () => {
    for (const [_, migration] of Object.entries(LEGACY_TARGET_MIGRATIONS)) {
      expect(MODIFIER_TARGETS).toContain(migration.target);
      expect(migration.defaultScope.layer === null ||
        ["ATTRIBUTE", "PRACTICE", "METRIC", "DICE", "DURATION", "NARROW_FOCUS"].includes(migration.defaultScope.layer as string)).toBe(true);
    }
  });
});
