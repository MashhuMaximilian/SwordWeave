// Multiple scenarios
import { describe, it, expect } from "vitest";
import { aggregateCharacterSheet } from "../sheet";

function fieldcraftInput(runtimeConditions: any[] = []) {
  return {
    characterId: "t",
    level: 18,
    attrPhysical: 4,
    attrMental: 4,
    attrMagical: 2,
    attrProficient: "PHYSICAL" as const,
    practiceSlices: null,
    startingBu: 200,
    buSpent: 0,
    dmBonusBu: 0,
    currentVitality: 288,
    size: "MEDIUM" as const,
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
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "add" as const,
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
    runtimeConditions,
  };
}

describe("PB rescale end-to-end through aggregateCharacterSheet", () => {
  it("Baseline: no conditions → fieldcraft = 4+6+6 = 16 (with floor/ceiling none)", () => {
    const r = aggregateCharacterSheet(fieldcraftInput([]));
    const f = r.practices.find((p) => p.practice === "fieldcraft");
    console.log("baseline fieldcraft:", f?.total);
    expect(f?.total).toBe(16); // slice=4, pb=6, primitive=6
  });

  it("+2 PB condition → fieldcraft = 4+8+8 = 20", () => {
    const r = aggregateCharacterSheet(fieldcraftInput([
      {
        title: "+2 PB",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "proficiency_bonus",
          operation: "add",
          value: 2,
        }],
      },
    ]));
    const f = r.practices.find((p) => p.practice === "fieldcraft");
    console.log("+2 PB fieldcraft:", f?.total);
    expect(f?.total).toBe(20); // slice=4, pb=8, primitive=8
  });

  it("Divide PB by 2 → fieldcraft = 4+3+3 = 10", () => {
    const r = aggregateCharacterSheet(fieldcraftInput([
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
    ]));
    const f = r.practices.find((p) => p.practice === "fieldcraft");
    console.log("divide PB fieldcraft:", f?.total);
    expect(f?.total).toBe(10); // slice=4, pb=3, primitive=3
  });

  it("Set PB to 5 → fieldcraft = 4+5+5 = 14", () => {
    const r = aggregateCharacterSheet(fieldcraftInput([
      {
        title: "Set PB 5",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "proficiency_bonus",
          operation: "set",
          value: 5,
        }],
      },
    ]));
    const f = r.practices.find((p) => p.practice === "fieldcraft");
    console.log("set PB 5 fieldcraft:", f?.total);
    expect(f?.total).toBe(14); // slice=4, pb=5, primitive=5
  });
});
