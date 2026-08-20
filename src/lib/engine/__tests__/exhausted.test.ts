// Test exhausted condition (skill_practice_check with all 10 practices)
import { describe, it, expect } from "vitest";
import { aggregateCharacterSheet } from "../sheet";

describe("Exhausted condition (skill_practice_check all practices)", () => {
  it("with Plating floor 10 active: should clamp to 10 minimum", () => {
    const r = aggregateCharacterSheet({
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
          primitiveId: 999,
          source: "MANIFEST",
          acquiredAtLevel: 1,
          isMirrored: false,
          primitive: {
            id: 999,
            name: "Plating",
            category: "SHEET_AUGMENT",
            buCost: 0,
            isMirrorable: false,
            mirrorBuCredit: 0,
            hardModifiers: [{
              kind: "modify",
              target: "skill_practice_check",
              operation: "min",
              value: 10,
            }],
          },
        },
      ],
      capabilityLinks: [],
      itemLinks: [],
      runtimeConditions: [
        {
          title: "exhausted",
          active: true,
          modifiers: [{
            kind: "modify",
            target: "skill_practice_check",
            operation: "subtract",
            value: 2,
            metadata: {
              targetScope: {
                layer: "PRACTICE",
                values: ["PROWESS", "AWARENESS", "INFLUENCE", "INTUITION", "FINESSE", "REASON", "MYSTICISM", "FIELDCRAFT", "KNOWLEDGE", "COMMUNION"],
              },
            },
          }],
        },
      ],
    });
    console.log("Practices with Plating:", r.practices.map((p) => `${p.practice}=${p.total}`).join(", "));
    // Each practice should be at least 10 (Floor 10)
    // PHY: 4 + 6 - 2 = 8, clamped to 10
    // MENT: 4 - 2 = 2, clamped to 10
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    expect(fieldcraft?.total).toBe(10); // clamped
    const reason = r.practices.find((p) => p.practice === "reason");
    expect(reason?.total).toBe(10); // clamped
  });

  it("exhausted + Plating: should clamp to floor 10 minimum", () => {
    const r = aggregateCharacterSheet({
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
          primitiveId: 999,
          source: "MANIFEST",
          acquiredAtLevel: 1,
          isMirrored: false,
          primitive: {
            id: 999,
            name: "Plating",
            category: "SHEET_AUGMENT",
            buCost: 0,
            isMirrorable: false,
            mirrorBuCredit: 0,
            hardModifiers: [{
              kind: "modify",
              target: "skill_practice_check",
              operation: "min",
              value: 10,
            }],
          },
        },
      ],
      capabilityLinks: [],
      itemLinks: [],
      runtimeConditions: [
        {
          title: "exhausted",
          active: true,
          modifiers: [{
            kind: "modify",
            target: "skill_practice_check",
            operation: "subtract",
            value: 2,
            metadata: {
              targetScope: {
                layer: "PRACTICE",
                values: ["PROWESS", "AWARENESS", "INFLUENCE", "INTUITION", "FINESSE", "REASON", "MYSTICISM", "FIELDCRAFT", "KNOWLEDGE", "COMMUNION"],
              },
            },
          }],
        },
      ],
    });
    // All practices should be clamped to 10 (Floor 10 wins over -2)
    const allAt10 = r.practices.every((p) => p.total === 10);
    console.log("Practices:", r.practices.map((p) => `${p.practice}=${p.total}`).join(", "));
    expect(allAt10).toBe(true);
  });

  it("should subtract 2 from each practice", () => {
    const r = aggregateCharacterSheet({
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
      primitiveLinks: [],
      capabilityLinks: [],
      itemLinks: [],
      runtimeConditions: [
        {
          title: "exhausted",
          active: true,
          modifiers: [{
            kind: "modify",
            target: "skill_practice_check",
            operation: "subtract",
            value: 2,
            metadata: {
              targetScope: {
                layer: "PRACTICE",
                values: ["PROWESS", "AWARENESS", "INFLUENCE", "INTUITION", "FINESSE", "REASON", "MYSTICISM", "FIELDCRAFT", "KNOWLEDGE", "COMMUNION"],
              },
            },
          }],
        },
      ],
    });
    console.log("Practices:", r.practices.map((p) => `${p.practice}=${p.total}`).join(", "));
    // Each practice total should be -2 (since no primitives contributing)
    // slice = 4 for PHY, slice = 4 for MENT, slice = 2 for MAG
    // PHY practices: 4 - 2 = 2 (no PB since no prof PB token primitive)
    // Actually PHY is prof, so pb=6 (level) added. With -2: 4 + 6 - 2 = 8
    // MENT: 4 - 2 = 2 (no prof)
    // MAG: 2 - 2 = 0
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    expect(fieldcraft?.total).toBe(8); // PHY practice + prof PB - 2
    const reason = r.practices.find((p) => p.practice === "reason");
    expect(reason?.total).toBe(2); // MENT - 2
  });
});