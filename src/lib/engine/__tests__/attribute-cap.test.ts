// Test that attribute.X max/min IS clamped (actual cap, not roll)
import { describe, it, expect } from "vitest";
import { aggregateCharacterSheet } from "../sheet";

describe("Attribute max/min is an actual cap (not roll constraint)", () => {
  it("Ceiling 18 on attribute.physical should clamp attribute to 18", () => {
    const r = aggregateCharacterSheet({
      characterId: "t",
      level: 18,
      attrPhysical: 50,  // Way over 18
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
          primitiveId: 15220,
          source: "MANIFEST",
          acquiredAtLevel: 1,
          isMirrored: false,
          primitive: {
            id: 15220,
            name: "Ceiling 18",
            category: "CHARACTER_SHEET_AUGMENT",
            buCost: 0,
            isMirrorable: false,
            mirrorBuCredit: 0,
            hardModifiers: [{
              kind: "modify",
              target: "attribute.physical",
              operation: "max",
              value: 18,
            }],
          },
        },
      ],
      capabilityLinks: [],
      itemLinks: [],
      runtimeConditions: [],
    });
    // The clamped attribute flows through sheetResolver.totals
    // and is read by computeAllPracticeModifiers as the base
    // for PHY practices.
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    console.log("Fieldcraft total (with attribute ceiling):", fieldcraft?.total);
    // PHY clamped to 18 (not 50). Fieldcraft = 18 (slice) + 6 (PB if prof) = 24
    expect(fieldcraft?.total).toBe(24);  // 18 + 6
  });
});