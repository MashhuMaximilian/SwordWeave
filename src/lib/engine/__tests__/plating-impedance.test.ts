// Plating + add/subtract impedance
import { describe, it, expect } from "vitest";
import { resolveModifiers } from "../resolve-modifiers";

describe("Plating floor + modifier add/subtract impedance", () => {
  it("Plating floor 10 + add 5 should clamp at 10", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        // Plating (Floor 10 from MANIFEST)
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
            // NO metadata (matches DB)
          }],
        },
      ],
    });
    console.log("Floor10 only totals:", r.totals["skill_practice_check.awareness"]);
    expect(r.totals["skill_practice_check.awareness"]).toBe(10);
  });

  it("Plating floor 10 + add 5 to awareness (where practice is already 5)", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        // Plating floor 10
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
        // Add 5 to awareness
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
            metadata: {
              targetScope: { layer: "PRACTICE", values: ["AWARENESS"] },
            },
          }],
        },
      ],
    });
    console.log("Floor10 + add 5 awareness:", r.totals["skill_practice_check.awareness"]);
    // Practice base ≈ 0 or so. After add 5 = 5. After floor 10 = 10. Wait,
    // floor 10 = max(total, 10). So if total < 10, set to 10. Should be 10.
    expect(r.totals["skill_practice_check.awareness"]).toBe(10);
  });

  it("add 15 + Plating floor 10 should still be 15 (floor only clamps at 10)", () => {
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
            metadata: {
              targetScope: { layer: "PRACTICE", values: ["AWARENESS"] },
            },
          }],
        },
      ],
    });
    console.log("add 15 + floor 10 awareness:", r.totals["skill_practice_check.awareness"]);
    expect(r.totals["skill_practice_check.awareness"]).toBe(15);
  });

  it("Plating floor 10 + subtract 3 (should clamp at 10, subtract ignored)", () => {
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
            metadata: {
              targetScope: { layer: "PRACTICE", values: ["AWARENESS"] },
            },
          }],
        },
      ],
    });
    console.log("floor 10 + subtract 3 awareness:", r.totals["skill_practice_check.awareness"]);
    // subtract 3 from 0 = -3. floor 10 max(-3, 10) = 10. Should be 10.
    expect(r.totals["skill_practice_check.awareness"]).toBe(10);
  });
});
