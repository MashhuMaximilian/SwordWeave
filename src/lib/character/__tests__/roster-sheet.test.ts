import { describe, expect, it } from "vitest";
import { aggregateRosterSheet } from "../roster-sheet";
import type { CharacterSheetInput } from "@/lib/engine/sheet";

const input: CharacterSheetInput = {
  level: 6, attrPhysical: 5, attrMental: 3, attrMagical: 2, attrProficient: "PHYSICAL",
  practiceSlices: {}, startingBu: 25, buSpent: 0, dmBonusBu: 0,
  currentVitality: 39, size: "MEDIUM", capabilityLinks: [], itemLinks: [],
  primitiveLinks: [{
    primitiveId: 1, source: "PERSONAL", acquiredAtLevel: 1, isMirrored: false,
    primitive: {
      id: 1, name: "Desperate strength", category: "SHEET_AUGMENT", buCost: 12,
      isMirrorable: false, mirrorBuCredit: 0,
      hardModifiers: [{
        kind: "modify", target: "attribute", operation: "add", value: { kind: "number", value: 2 },
        metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
        condition: { kind: "compound", tokens: ["self:stat|vitality|<|30"] },
      }],
    },
  }],
};

describe("roster saved state", () => {
  it("does not grant low-vitality bonuses to a healthy character", () => {
    expect(aggregateRosterSheet(input).attributes.physical).toBe(5);
    expect(aggregateRosterSheet({ ...input, currentVitality: null }).attributes.physical).toBe(5);
  });

  it("includes the bonus when the saved vitality meets its condition", () => {
    expect(aggregateRosterSheet({ ...input, currentVitality: 20 }).attributes.physical).toBe(7);
  });
});
