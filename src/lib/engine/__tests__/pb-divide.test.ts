// PB divide / PB rescale deep dive
import { describe, it, expect } from "vitest";
import { resolveModifiers } from "../resolve-modifiers";

describe("PB divide propagation to PB-token primitives", () => {
  it("'PB + 2' primitive on Intuition + PB /2 condition should give 4 (level/2+2/2)", () => {
    // Three slots:
    // - PB Half Intuition: contributes (PB/2) to intuition
    // - Condition: divide PB by 2
    // Result expected: PB = 3 (was 6, divided by 2). Intuition = 3/2 = 1.5 → 2 (roundUp).
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        // PB Half Intuition (resolves to PB/2 = 3)
        {
          primitiveId: 16138,
          name: "PB Half Intuition",
          category: "PRACTICE_PROGRESSION_AUGMENT",
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
            value: { kind: "derived", which: "pb_half" } as never,
            metadata: {
              targetScope: { layer: "PRACTICE", values: ["INTUITION"] },
            },
          }],
        },
        // Condition: divide PB by 2
        {
          primitiveId: -1,
          name: "Divide PB",
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
            target: "proficiency_bonus",
            operation: "divide",
            value: 2,
          }],
        },
      ],
    });
    console.log("totals.proficiency_bonus:", r.totals["proficiency_bonus"]);
    console.log("totals.skill_practice_check.intuition:", r.totals["skill_practice_check.intuition"]);
    console.log("byTarget.intuition:", JSON.stringify(r.byTarget["skill_practice_check.intuition"], null, 2));
  });

  it("'PB' primitive (not PB Half) + PB /2 should rescale", () => {
    const r = resolveModifiers({
      characterId: "t",
      level: 18,
      pb: 6,
      proficientAttribute: "physical",
      attributes: { physical: 4, mental: 4, magical: 2 },
      slots: [
        {
          primitiveId: 9999,
          name: "Adds PB to Intuition",
          category: "PRACTICE_PROGRESSION_AUGMENT",
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
            value: { kind: "derived", which: "pb" } as never,
            metadata: {
              targetScope: { layer: "PRACTICE", values: ["INTUITION"] },
            },
          }],
        },
        {
          primitiveId: -1,
          name: "Divide PB",
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
            target: "proficiency_bonus",
            operation: "divide",
            value: 2,
          }],
        },
      ],
    });
    console.log("byTarget after /2:", JSON.stringify(r.byTarget["skill_practice_check.intuition"], null, 2));
    console.log("totals.intuition:", r.totals["skill_practice_check.intuition"]);
  });
});
