import { describe, expect, it } from "vitest";
import { parsePrimitiveRecord } from "../primitive-package";

const base = {
  name: "Test primitive",
  category: "STRUCTURAL",
  costTier: "Tier 1",
  buCost: 4,
  isPublic: false,
  isMirrorable: false,
  mirrorVector: "STANDARD_ONLY",
  mirrorBuCredit: 0,
  mirrorEligibilityNotes: "",
};

describe("primitive package mechanics", () => {
  it("derives display output from a typed composition rule", () => {
    const record = parsePrimitiveRecord({
      ...base,
      mechanicalOutputText: "ignored display text",
      mechanicalRule: { family: "STRUCTURE", bindings: { structure: "single-point structure" } },
      narrativeRule: "One subject or point.",
      hardModifiers: [],
    });

    expect(record.mechanicalOutputText).toBe("Apply through a [single-point structure].");
    expect(record.narrativeRule).toBe("One subject or point.");
  });

  it("moves legacy free-text output into the verbose description", () => {
    const record = parsePrimitiveRecord({
      ...base,
      mechanicalOutputText: "Can bite through plate armor.",
      narrativeRule: "Metal-alloy teeth.",
      hardModifiers: [],
    });

    expect(record.mechanicalRule).toEqual({ family: "DESCRIPTIVE" });
    expect(record.mechanicalOutputText).toBe("");
    expect(record.narrativeRule).toBe("Can bite through plate armor.\n\nMetal-alloy teeth.");
  });
});
