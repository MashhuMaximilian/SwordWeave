// Plating + add/subtract impedance
// Phase 8.L round 67 (Mashu 2026-08-20): Plating floor is
// ROLL constraint (informational), NOT a modifier clamp.
// The UI shows the floor as ⬆ indicator next to the practice
// total. Clamping the displayed total would hide the effect of
// conditions on practices that fall below the floor (e.g.
// exhausted -2 only visibly affects practices whose raw total
// exceeds the floor).
import { describe, it, expect } from "vitest";
import { resolveModifiers } from "../resolve-modifiers";

describe("Plating floor + modifier add/subtract impedance", () => {
  it("Plating floor 10 + 0 modifier: floor is informational, totals stay 0", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        {
          primitiveId: 15219,
          name: "Floor 10",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "min",
            value: 10,
          }],
        },
      ],
    });
    console.log("Floor10 only totals:", r.totals["skill_practice_check.awareness"]);
    expect(r.totals["skill_practice_check.awareness"]).toBe(0);
  });

  it("Plating floor 10 + add 5: floor is informational, totals = 5", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        {
          primitiveId: 15219,
          name: "Floor 10",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "min",
            value: 10,
          }],
        },
        {
          primitiveId: 9999,
          name: "Bonus",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "add",
            value: 5,
            metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } },
          }],
        },
      ],
    });
    console.log("Floor10 + add 5 awareness:", r.totals["skill_practice_check.awareness"]);
    expect(r.totals["skill_practice_check.awareness"]).toBe(5);
  });

  it("add 15 + Plating floor 10: floor is informational, totals = 15", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        {
          primitiveId: 15219,
          name: "Floor 10",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "min",
            value: 10,
          }],
        },
        {
          primitiveId: 9999,
          name: "Bonus",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "add",
            value: 15,
            metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } },
          }],
        },
      ],
    });
    console.log("add 15 + floor 10 awareness:", r.totals["skill_practice_check.awareness"]);
    expect(r.totals["skill_practice_check.awareness"]).toBe(15);
  });

  it("Plating floor 10 + subtract 3: floor is informational, totals = -3", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        {
          primitiveId: 15219,
          name: "Floor 10",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "min",
            value: 10,
          }],
        },
        {
          primitiveId: 9999,
          name: "Subtractor",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "subtract",
            value: 3,
            metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } },
          }],
        },
      ],
    });
    console.log("floor 10 + subtract 3 awareness:", r.totals["skill_practice_check.awareness"]);
    expect(r.totals["skill_practice_check.awareness"]).toBe(-3);
  });

  // Phase 8.L round 67: with floor as informational, exhausted -2
  // should affect ALL 10 practices (raw, not clamped).
  it("exhausted -2 with Plating: should affect all 10 practices, not just one", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        {
          primitiveId: 15219,
          name: "Floor 10",
          category: "CHARACTER_SHEET_AUGMENT",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "min",
            value: 10,
          }],
        },
        {
          primitiveId: -1,
          name: "exhausted",
          category: "RUNTIME_CONDITION",
          isMirrored: false,
          isMirrorable: false,
          mirrorVector: null,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          isToggledOff: false,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "add",
            value: -2,
            metadata: {
              targetScope: {
                layer: "PRACTICE",
                values: ["PROWESS", "FINESSE", "FIELDCRAFT", "AWARENESS", "REASON", "KNOWLEDGE", "INFLUENCE", "MYSTICISM", "COMMUNION", "INTUITION"],
              },
            },
          }],
        },
      ],
    });
    const practices = ["prowess", "finesse", "fieldcraft", "awareness", "reason", "knowledge", "influence", "mysticism", "communion", "intuition"];
    for (const p of practices) {
      expect(r.totals[`skill_practice_check.${p}`]).toBe(-2);
    }
  });
});
