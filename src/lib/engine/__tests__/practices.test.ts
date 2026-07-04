import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_SUM,
  MAX_ATTRIBUTE,
  MIN_ATTRIBUTE,
  PRACTICE_ATTRIBUTE_MAP,
  computeAllDefensiveDCs,
  computeAllPracticeModifiers,
  computeDefensiveDC,
  computePracticeModifierAtLevel,
  distributeAttributeSlices,
  getPracticeAttribute,
  getPracticeSlice,
  MAX_PB,
  proficiencyBonus,
  STARTING_PB,
  validateAttributes,
  validatePracticeSlicesForAttribute,
} from "../practices";

describe("validateAttributes", () => {
  it("accepts canonical 3-4-3 distribution", () => {
    const r = validateAttributes({ physical: 3, mental: 4, magical: 3 });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("accepts a -1 attribute summing to 10", () => {
    const r = validateAttributes({ physical: 0, mental: 5, magical: 5 });
    expect(r.valid).toBe(true);
  });

  it("rejects attributes that don't sum to 10", () => {
    const r = validateAttributes({ physical: 3, mental: 3, magical: 3 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("sum to 10"))).toBe(true);
  });

  it("rejects attribute above max", () => {
    const r = validateAttributes({ physical: 6, mental: 2, magical: 2 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("outside range"))).toBe(true);
  });

  it("rejects attribute below min", () => {
    const r = validateAttributes({ physical: -2, mental: 7, magical: 5 });
    expect(r.valid).toBe(false);
  });
});

describe("validatePracticeSlicesForAttribute", () => {
  it("accepts slices summing to attribute", () => {
    const r = validatePracticeSlicesForAttribute("PHYSICAL", 5, {
      prowess: 2,
      finesse: 3,
      fieldcraft: 0,
    });
    expect(r.valid).toBe(true);
  });

  it("rejects slices that don't sum", () => {
    const r = validatePracticeSlicesForAttribute("PHYSICAL", 5, {
      prowess: 2,
      finesse: 2,
      fieldcraft: 0,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("sum to 4"))).toBe(true);
  });

  it("rejects slice below -1", () => {
    const r = validatePracticeSlicesForAttribute("PHYSICAL", -1, {
      prowess: -5,
      finesse: 2,
      fieldcraft: 2,
    });
    expect(r.valid).toBe(false);
  });

  it("handles 4 mental practices", () => {
    const r = validatePracticeSlicesForAttribute("MENTAL", 4, {
      awareness: 1,
      reason: 2,
      knowledge: 1,
      influence: 0,
    });
    expect(r.valid).toBe(true);
  });
});

describe("distributeAttributeSlices", () => {
  it("distributes +5 physical evenly with remainder", () => {
    const r = distributeAttributeSlices("PHYSICAL", 5);
    expect(r.prowess + r.finesse + r.fieldcraft).toBe(5);
  });

  it("distributes +6 mental evenly across 4 practices", () => {
    const r = distributeAttributeSlices("MENTAL", 6);
    expect(r.awareness + r.reason + r.knowledge + r.influence).toBe(6);
  });

  it("zero distributes to all zeros", () => {
    const r = distributeAttributeSlices("MAGICAL", 0);
    expect(r.mysticism).toBe(0);
    expect(r.communion).toBe(0);
    expect(r.intuition).toBe(0);
  });

  it("negative puts all into first practice", () => {
    const r = distributeAttributeSlices("PHYSICAL", -1);
    expect(r.prowess).toBe(-1);
    expect(r.finesse).toBe(0);
    expect(r.fieldcraft).toBe(0);
  });
});

describe("getPracticeAttribute", () => {
  it("returns PHYSICAL for physical practices", () => {
    expect(getPracticeAttribute("prowess")).toBe("PHYSICAL");
    expect(getPracticeAttribute("finesse")).toBe("PHYSICAL");
    expect(getPracticeAttribute("fieldcraft")).toBe("PHYSICAL");
  });

  it("returns MENTAL for mental practices", () => {
    expect(getPracticeAttribute("awareness")).toBe("MENTAL");
    expect(getPracticeAttribute("reason")).toBe("MENTAL");
    expect(getPracticeAttribute("knowledge")).toBe("MENTAL");
    expect(getPracticeAttribute("influence")).toBe("MENTAL");
  });

  it("returns MAGICAL for magical practices", () => {
    expect(getPracticeAttribute("mysticism")).toBe("MAGICAL");
    expect(getPracticeAttribute("communion")).toBe("MAGICAL");
    expect(getPracticeAttribute("intuition")).toBe("MAGICAL");
  });
});

describe("getPracticeSlice", () => {
  it("returns explicit slice if set", () => {
    const r = getPracticeSlice(
      "prowess",
      { physical: 5, mental: 3, magical: 2 },
      { prowess: 4 },
    );
    expect(r).toBe(4);
  });

  it("falls back to auto-distribution if not set", () => {
    const r = getPracticeSlice(
      "prowess",
      { physical: 5, mental: 3, magical: 2 },
      {},
    );
    expect(r).toBe(2);
  });
});

describe("proficiencyBonus", () => {
  it("returns 2 at L1", () => {
    expect(proficiencyBonus(1)).toBe(2);
  });

  it("returns 3 at L5", () => {
    expect(proficiencyBonus(5)).toBe(3);
  });

  it("returns 4 at L9", () => {
    expect(proficiencyBonus(9)).toBe(4);
  });

  it("returns 5 at L13", () => {
    expect(proficiencyBonus(13)).toBe(5);
  });

  it("returns 6 at L17", () => {
    expect(proficiencyBonus(17)).toBe(6);
  });

  it("caps at MAX_PB", () => {
    expect(proficiencyBonus(100)).toBe(MAX_PB);
  });

  it("returns 0 for level 0 or negative", () => {
    expect(proficiencyBonus(0)).toBe(0);
    expect(proficiencyBonus(-5)).toBe(0);
  });
});

describe("computePracticeModifierAtLevel", () => {
  it("returns slice + PB when proficient", () => {
    const r = computePracticeModifierAtLevel(
      "prowess",
      { physical: 5, mental: 3, magical: 2 },
      { prowess: 2 },
      "PHYSICAL",
      1,
      new Map(),
    );
    expect(r.slice).toBe(2);
    expect(r.pbContribution).toBe(STARTING_PB);
    expect(r.total).toBe(2 + STARTING_PB);
  });

  it("returns only slice when not proficient", () => {
    const r = computePracticeModifierAtLevel(
      "prowess",
      { physical: 5, mental: 3, magical: 2 },
      { prowess: 2 },
      "MENTAL",
      1,
      new Map(),
    );
    expect(r.pbContribution).toBe(0);
    expect(r.total).toBe(2);
  });

  it("PB applies to ALL practices under proficient attribute", () => {
    const slices = { prowess: 2, finesse: 2, fieldcraft: 1 };
    for (const practice of ["prowess", "finesse", "fieldcraft"] as const) {
      const r = computePracticeModifierAtLevel(
        practice,
        { physical: 5, mental: 3, magical: 2 },
        slices,
        "PHYSICAL",
        1,
        new Map(),
      );
      expect(r.pbContribution).toBe(STARTING_PB);
    }
  });

  it("includes primitive bonuses with names", () => {
    const primMap = new Map([
      [10, { name: "Keen Nose", bonus: 1 }],
      [11, { name: "Iron Grip", bonus: 1 }],
    ]);
    const r = computePracticeModifierAtLevel(
      "prowess",
      { physical: 5, mental: 3, magical: 2 },
      { prowess: 2 },
      "PHYSICAL",
      1,
      primMap,
    );
    expect(r.primitiveContributions).toHaveLength(2);
    expect(r.total).toBe(2 + STARTING_PB + 1 + 1);
  });
});

describe("computeAllPracticeModifiers", () => {
  it("returns 10 entries (3 phys + 4 mental + 3 magic)", () => {
    const r = computeAllPracticeModifiers(
      { physical: 3, mental: 4, magical: 3 },
      {},
      "PHYSICAL",
      1,
    );
    expect(r).toHaveLength(10);
  });
});

describe("computeDefensiveDC", () => {
  it("DC = 5 + attr + PB (proficient)", () => {
    const r = computeDefensiveDC(
      "PHYSICAL",
      { physical: 5, mental: 3, magical: 2 },
      "PHYSICAL",
      1,
    );
    expect(r).toBe(12);
  });

  it("DC = 5 + attr (no proficiency)", () => {
    const r = computeDefensiveDC(
      "MAGICAL",
      { physical: 5, mental: 3, magical: 2 },
      "PHYSICAL",
      1,
    );
    expect(r).toBe(7);
  });

  it("scales with level via PB", () => {
    const r1 = computeDefensiveDC(
      "PHYSICAL",
      { physical: 5, mental: 3, magical: 2 },
      "PHYSICAL",
      1,
    );
    const r5 = computeDefensiveDC(
      "PHYSICAL",
      { physical: 5, mental: 3, magical: 2 },
      "PHYSICAL",
      5,
    );
    expect(r5).toBeGreaterThan(r1);
  });
});

describe("computeAllDefensiveDCs", () => {
  it("returns all three DCs", () => {
    const r = computeAllDefensiveDCs(
      { physical: 5, mental: 3, magical: 2 },
      "PHYSICAL",
      1,
    );
    expect(r.physical).toBe(12);
    expect(r.mental).toBe(8);
    expect(r.magical).toBe(7);
  });
});

describe("PRACTICE_ATTRIBUTE_MAP", () => {
  it("has 3+4+3 = 10 practices", () => {
    const total =
      PRACTICE_ATTRIBUTE_MAP.PHYSICAL.length +
      PRACTICE_ATTRIBUTE_MAP.MENTAL.length +
      PRACTICE_ATTRIBUTE_MAP.MAGICAL.length;
    expect(total).toBe(10);
  });
});

describe("constants", () => {
  it("MIN_ATTRIBUTE is -1", () => {
    expect(MIN_ATTRIBUTE).toBe(-1);
  });
  it("MAX_ATTRIBUTE is 5", () => {
    expect(MAX_ATTRIBUTE).toBe(5);
  });
  it("ATTRIBUTE_SUM is 10", () => {
    expect(ATTRIBUTE_SUM).toBe(10);
  });
});