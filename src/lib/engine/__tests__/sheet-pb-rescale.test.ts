// Verify sheet.ts produces correct practice values when PB is modified
import { describe, it, expect } from "vitest";
import { aggregateCharacterSheet } from "../sheet";
import { proficiencyBonus } from "../practices";

describe("aggregateCharacterSheet with PB modification", () => {
  it("Practice should reflect condition-modified PB for PB-token primitives", () => {
    const result = aggregateCharacterSheet({
      characterId: "t",
      level: 18,
      attrPhysical: 4,
      attrMental: 4,
      attrMagical: 2,
      attrProficient: "PHYSICAL",
      practiceSlices: null,
      startingBu: 200,
      buSpent: 0,
      dmBonusBu: 0,
      currentVitality: 288,
      size: "MEDIUM",
      primitiveLinks: [
        {
          primitiveId: 14065,
          source: "MANIFEST",
          acquiredAtLevel: 1,
          isMirrored: false,
          primitive: {
            id: 14065,
            name: "Proficient Fieldcraft",
            category: "PRACTICE_PROGRESSION_AUGMENT",
            buCost: 0,
            isMirrorable: false,
            mirrorBuCredit: 0,
            hardModifiers: [{
              kind: "modify",
              target: "skill_practice_check",
              operation: "add",
              value: { kind: "derived", which: "pb" },
              metadata: {
                targetScope: { layer: "PRACTICE", values: ["FIELDCRAFT"] },
              },
            }],
          },
        },
      ],
      capabilityLinks: [],
      itemLinks: [],
      runtimeConditions: [
        {
          title: "Divide PB",
          active: true,
          modifiers: [{
            kind: "modify",
            target: "proficiency_bonus",
            operation: "divide",
            value: 2,
          }],
        },
      ],
    });
    const fieldcraft = result.practices.find((p) => p.practice === "fieldcraft");
    console.log("Level PB:", proficiencyBonus(18));
    console.log("Fieldcraft total:", fieldcraft?.total);
    expect(fieldcraft?.total).toBe(10);
  });
});
