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
  it("has 14 entries (UX2a-r + UX2b-r)", () => {
    // Phase-7-E/UX2a-r regression: 5 dedicated speed axes were a
    // mistake (cluttering the dropdown). Back to one "speed" axis
    // with locomotion options inside. UX2b-r renames
    // "action_shape_size" → "targeting". Net count after the pair:
    //   16 (Phase-7-E baseline)
    //   +1  (targeting takes the place of action_shape_size; net
    //        change on the dropdown entry count: 0 since action_
    //        shape_size is the same idea renamed)
    //   -4  (5 speed axes removed; "speed" added back, net -4)
    //   = 13 — but defense_dc and a few others were already at 16.
    // Real total: 15. Calc: attribute + defense_dc + speed +
    // max_vitality + current_vitality + proficiency_bonus +
    // action_roll + skill_practice_check + damage_healing_output +
    // targeting + duration + strain + item_slot_cost + scene_pace
    // + behavior (Phase 7.5 escape hatch).
    expect(MODIFIER_TARGETS.length).toBe(15);
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

  it("uses one Speed entry with locomotion inside (UX2a-r)", () => {
    // Phase-7-E/UX2a-r: 5 dedicated speed axes collapsed into
    // one "speed" entry. Locomotion values are radio options
    // inside the widget, not top-level dropdown entries.
    expect(MODIFIER_TARGETS).toContain("speed");
    expect(MODIFIER_TARGETS).not.toContain("walking_speed");
    expect(MODIFIER_TARGETS).not.toContain("climbing_speed");
    expect(MODIFIER_TARGETS).not.toContain("swimming_speed");
    expect(MODIFIER_TARGETS).not.toContain("flying_speed");
    expect(MODIFIER_TARGETS).not.toContain("burrowing_speed");
  });

  it("uses one Targeting entry (UX2b-r renamed from action_shape_size)", () => {
    expect(MODIFIER_TARGETS).toContain("targeting");
    // Legacy positional axes no longer in the dropdown.
    expect(MODIFIER_TARGETS).not.toContain("action_range");
    expect(MODIFIER_TARGETS).not.toContain("target_count");
    expect(MODIFIER_TARGETS).not.toContain("area_size");
    // Phase-7-E/UX2b-r: action_shape_size is removed from the
    // dropdown. Bridge entry in LEGACY_TARGET_MIGRATIONS reads
    // it back as "targeting".
    expect(MODIFIER_TARGETS).not.toContain("action_shape_size");
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

  it("speed uses METRIC with multi-select checklist (UX2a-r2)", () => {
    // Phase-7-E/UX2a-r2: Speed is one axis with five locomotion
    // options in a multi-select checklist widget. A single
    // modifier can affect one or more speeds simultaneously —
    // e.g. "+5 Walking and Swimming" — so a checkbox list, not a
    // radio.
    const spec = MODIFIER_TARGET_SPEC.speed;
    expect(spec.layer).toBe("METRIC");
    expect(spec.widget).toBe("checklist");
    expect(spec.options).toEqual([
      "WALKING_SPEED",
      "CLIMBING_SPEED",
      "SWIMMING_SPEED",
      "FLYING_SPEED",
      "BURROWING_SPEED",
    ]);
    // Display labels are required (the option values look like
    // "WALKING_SPEED" to a user).
    expect(spec.optionLabels?.["WALKING_SPEED"]).toBe("Walking");
    expect(spec.optionLabels?.["FLYING_SPEED"]).toBe("Flying");
  });

  it("targeting uses NARROW_FOCUS with shape checklist (UX2b-r)", () => {
    // Phase-7-E/UX2b-r: action_shape_size renamed to "targeting".
    const spec = MODIFIER_TARGET_SPEC.targeting;
    expect(spec.layer).toBe("NARROW_FOCUS");
    expect(spec.widget).toBe("checklist-with-free-text");
    expect(spec.options).toContain("Single Target");
    expect(spec.options).toContain("Cone");
    expect(spec.options).toContain("Custom");
  });

  it("skill_practice_check uses PRACTICE checklist (UX2-r3)", () => {
    // Phase-7-E/UX2-r3: skill_practice_check is now a plain
    // checklist (no broad/narrow radio). Narrow-focus forms
    // (e.g. 'Awareness (Smell)') live in the Condition field,
    // not the modifier card.
    const spec = MODIFIER_TARGET_SPEC.skill_practice_check;
    expect(spec.widget).toBe("checklist");
    expect(spec.layer).toBe("PRACTICE");
    expect(spec.options).toEqual(PRACTICES);
  });

  it("damage_healing_output uses DICE checklist (v4: widget is now 'none')", () => {
    const spec = MODIFIER_TARGET_SPEC.damage_healing_output;
    expect(spec.layer).toBe("DICE");
    // Phase 7.5 v4: modifiers carry their own dice and tags,
    // so no checklist is needed at the target-value level.
    expect(spec.widget).toBe("none");
    expect(spec.options).toBeUndefined();
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

  it("skill_practice_check ignores stored granularity (UX2-r3)", () => {
    // Phase-7-E/UX2-r3: granularity is no longer used in the
    // canonical layer for skill_practice_check. selectionForModifier
    // still TOLERATES the legacy field (some older metadata blobs
    // carry it) but always reads the practice layer from
    // targetScope. We do not surface "broad" / "narrow" anymore.
    const sel = selectionForModifier({
      target: "skill_practice_check",
      metadata: {
        targetScope: { layer: "PRACTICE", values: ["AWARENESS"] },
        granularity: "broad",
      },
    });
    expect(sel.target).toBe("skill_practice_check");
    expect(sel.targetValues).toEqual(["AWARENESS"]);
    // granularity in the response is always null now.
    expect(sel.granularity).toBeNull();
  });

  it("skill_practice_check with NARROW_FOCUS layer reads values[0]", () => {
    // Phase-7-E/UX2-r3: legacy narrow-focus data (NARROW_FOCUS
    // layer + free-text string in values[0]) still loads back
    // into freeTextNarrowFocus for round-trip. The form then
    // surfaces this as the Condition field's value rather than
    // a Practice-axis knob.
    const sel = selectionForModifier({
      target: "skill_practice_check",
      metadata: {
        targetScope: {
          layer: "NARROW_FOCUS",
          values: ["Awareness (Smell)"],
        },
      },
    });
    expect(sel.target).toBe("skill_practice_check");
    expect(sel.targetValues).toEqual([]);
    expect(sel.freeTextNarrowFocus).toBe("Awareness (Smell)");
  });

  it("infers legacy dotted form", () => {
    const sel = selectionForModifier({
      target: "character.skill",
    });
    expect(sel.target).toBe("skill_practice_check");
    // Phase-7-E/UX2-r3: granularity is always null at selection
    // level. The legacy "broad" default is gone from the form
    // surface but the canonical axis is unchanged.
    expect(sel.granularity).toBeNull();
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

  it("round-trips skill_practice_check with picked practices", () => {
    // Phase-7-E/UX2-r3: skill_practice_check is now a simple
    // checklist. granularity stays in the type for back-compat
    // serialization but scopeForSelection writes null. (The
    // legacy helper preserved the field for older saves; we
    // match the same behavior here for symmetry.)
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
    expect(out.metadata.granularity).toBeNull();
  });

  it("round-trips skill_practice_check with empty targetValues", () => {
    // Phase-7-E/UX2-r3: an empty practice checklist is the
    // canonical "any practice" case. granularity / narrow-focus
    // navigation moved to the Condition field.
    const sel = {
      target: "skill_practice_check" as ModifierTarget,
      targetValues: [],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.metadata.targetScope).toEqual({
      layer: "PRACTICE",
      values: [],
    });
  });

  it("rejects legacy narrow skill_practice_check on the write path", () => {
    // Phase-7-E/UX2-r3: skill_practice_check no longer has a
    // narrow pathway through this widget. Modifiers with a
    // narrow focus (e.g. "Awareness (Smell)") must use the
    // Condition field, not the modifier card widget. Writes
    // coming through scopeForSelection always carry null
    // granularity and store the focus text in metadata only
    // when an explicit future schema supports it.
    const sel = {
      target: "skill_practice_check" as ModifierTarget,
      targetValues: [],
      granularity: "narrow" as const,
      freeTextNarrowFocus: "Awareness (Smell)",
    };
    const out = scopeForSelection(sel);
    // granularity is forced to null on the write path
    expect(out.metadata.granularity).toBeNull();
    // targetScope is PRACTICE (not NARROW_FOCUS) — narrow
    // focus no longer touches this axis.
    expect(out.metadata.targetScope.layer).toBe("PRACTICE");
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

  it("round-trips speed axis with multiple locomotion checks", () => {
    // Phase-7-E/UX2a-r2: Speed is a multi-select checklist.
    // A single modifier can affect multiple locomotion types
    // simultaneously (e.g. "+5 Walking and Swimming").
    const sel = {
      target: "speed" as ModifierTarget,
      targetValues: ["WALKING_SPEED", "SWIMMING_SPEED"],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.target).toBe("speed");
    expect(out.metadata.targetScope).toEqual({
      layer: "METRIC",
      values: ["WALKING_SPEED", "SWIMMING_SPEED"],
    });
  });

  it("speed with empty targetValues means 'any' (engine interprets as no specific axis)", () => {
    // Phase-7-E/UX2a-r2: a Speed modifier with no locomotion
    // checked applies to whatever the engine resolves the speed
    // axis as (often 'all locomotion types' depending on rule
    // sheets). We just preserve the empty array; downstream
    // readers interpret it.
    const out = scopeForSelection({
      target: "speed" as ModifierTarget,
      targetValues: [],
      granularity: null,
    });
    expect(out.target).toBe("speed");
    expect(out.metadata.targetScope).toEqual({
      layer: "METRIC",
      values: [],
    });
  });

  it("round-trips targeting axis with multiple shape picks", () => {
    // Phase-7-E/UX2b: a Targeting modifier can pick multiple
    // shapes (e.g. Cone + Line for a "Linear AoE"). Magnitude
    // remains in operation/value, not the scope.
    const sel = {
      target: "targeting" as ModifierTarget,
      targetValues: ["Cone", "Line"],
      granularity: null,
    };
    const out = scopeForSelection(sel);
    expect(out.target).toBe("targeting");
    expect(out.metadata.targetScope).toEqual({
      layer: "NARROW_FOCUS",
      values: ["Cone", "Line"],
    });
  });

  it("round-trips legacy action_range/action.targetCount/action.areaSize to targeting", () => {
    // Phase-7-E/UX2b-r: data written under the legacy action.* keys
    // reads back as the unified "targeting" axis with empty values.
    for (const legacy of ["action.range", "action.targetCount", "action.areaSize"] as const) {
      const back = selectionForModifier({
        target: legacy,
        metadata: null,
      });
      expect(back.target).toBe("targeting");
    }
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
