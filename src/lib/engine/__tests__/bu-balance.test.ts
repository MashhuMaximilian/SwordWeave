import { describe, it, expect } from "vitest";
import {
  BU_PER_LEVEL,
  RECOMMENDED_BACKGROUND_BU_CAP,
  RECOMMENDED_RACE_BU_CAP,
  checkTemplateBUWarnings,
  computeBUBalance,
  computeProgressionPool,
  formatBUBalanceLine,
  validateHardCaps,
  type BUAccount,
} from "../bu-balance";
import { computeMaxVitality, computeVitalityModifiersFromPrimitives } from "../vitality";

describe("computeProgressionPool", () => {
  it("L1 starting = 25", () => {
    expect(computeProgressionPool(25, 1, 0)).toBe(25);
  });

  it("L5 with no bonus = 25 + 4*5 = 45", () => {
    expect(computeProgressionPool(25, 5, 0)).toBe(45);
  });

  it("L5 with +10 DM bonus = 55", () => {
    expect(computeProgressionPool(25, 5, 10)).toBe(55);
  });

  it("L20 caps progression", () => {
    expect(computeProgressionPool(25, 20, 0)).toBe(25 + 19 * 5);
  });
});

describe("computeBUBalance", () => {
  it("computes percentage", () => {
    const account: BUAccount = {
      startingBu: 25,
      buSpent: 12,
      level: 5,
      dmBonusBu: 0,
      itemBuSpent: 0,
    };
    const r = computeBUBalance(account);
    expect(r.progressionPool).toBe(45);
    expect(r.progressionRemaining).toBe(33);
    expect(r.progressionPercent).toBe(27); // 12/45 ≈ 27%
  });

  it("flags over-budget", () => {
    const account: BUAccount = {
      startingBu: 25,
      buSpent: 50,
      level: 5,
      dmBonusBu: 0,
      itemBuSpent: 0,
    };
    const r = computeBUBalance(account);
    expect(r.overBudget).toBe(true);
    expect(r.warning).toContain("exceeds");
  });

  it("tracks item BU separately", () => {
    const account: BUAccount = {
      startingBu: 25,
      buSpent: 10,
      level: 5,
      dmBonusBu: 0,
      itemBuSpent: 8,
    };
    const r = computeBUBalance(account);
    expect(r.itemBuSpent).toBe(8);
    expect(r.progressionSpent).toBe(10);
    expect(r.progressionRemaining).toBe(35);
  });
});

describe("checkTemplateBUWarnings", () => {
  it("no warnings for typical race/bg", () => {
    const w = checkTemplateBUWarnings(8, 5);
    expect(w).toEqual([]);
  });

  it("warns for oversized race", () => {
    const w = checkTemplateBUWarnings(15, 5);
    expect(w.some((x) => x.includes("Race"))).toBe(true);
  });

  it("warns for oversized background", () => {
    const w = checkTemplateBUWarnings(8, 10);
    expect(w.some((x) => x.includes("Background"))).toBe(true);
  });
});

describe("validateHardCaps", () => {
  it("passes when under cap", () => {
    const r = validateHardCaps(
      { startingBu: 25, buSpent: 10, level: 1, dmBonusBu: 0, itemBuSpent: 0 },
      8,
      5,
      false,
    );
    expect(r.valid).toBe(true);
  });

  it("rejects over progression cap", () => {
    const r = validateHardCaps(
      { startingBu: 25, buSpent: 30, level: 1, dmBonusBu: 0, itemBuSpent: 0 },
      8,
      5,
      false,
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("progression cap"))).toBe(true);
  });

  it("hard cap on race/bg when toggle enabled", () => {
    const r = validateHardCaps(
      { startingBu: 25, buSpent: 10, level: 1, dmBonusBu: 0, itemBuSpent: 0 },
      15, // over race cap
      5,
      true,
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("Race"))).toBe(true);
  });

  it("soft cap on race/bg when toggle disabled", () => {
    const r = validateHardCaps(
      { startingBu: 25, buSpent: 10, level: 1, dmBonusBu: 0, itemBuSpent: 0 },
      15,
      5,
      false,
    );
    expect(r.valid).toBe(true); // soft only
  });
});

describe("formatBUBalanceLine", () => {
  it("formats summary line", () => {
    const account: BUAccount = {
      startingBu: 25,
      buSpent: 12,
      level: 5,
      dmBonusBu: 5,
      itemBuSpent: 0,
    };
    const r = formatBUBalanceLine(computeBUBalance(account));
    expect(r).toContain("12/");
    expect(r).toContain("L5");
    expect(r).toContain("DM bonus");
  });
});

describe("constants", () => {
  it("BU_PER_LEVEL is 5", () => {
    expect(BU_PER_LEVEL).toBe(5);
  });
  it("RECOMMENDED_RACE_BU_CAP is 12", () => {
    expect(RECOMMENDED_RACE_BU_CAP).toBe(12);
  });
  it("RECOMMENDED_BACKGROUND_BU_CAP is 8", () => {
    expect(RECOMMENDED_BACKGROUND_BU_CAP).toBe(8);
  });
});

describe("computeMaxVitality", () => {
  it("L1 base = (10+2)*1 = 12", () => {
    expect(computeMaxVitality(1)).toBe(12);
  });

  it("L5 base = (10+3)*5 = 65", () => {
    expect(computeMaxVitality(5)).toBe(65);
  });

  it("includes modifiers", () => {
    expect(
      computeMaxVitality(1, [
        { source: "Tough", amount: 5 },
        { source: "Iron Skin", amount: 3 },
      ]),
    ).toBe(20);
  });
});

describe("computeVitalityModifiersFromPrimitives", () => {
  it("finds vitality-related primitives by name", () => {
    const r = computeVitalityModifiersFromPrimitives([
      { name: "Toughness", category: "character-sheet-augment", buCost: 4 },
      { name: "Fire Damage", category: "verb-tier", buCost: 4 },
      { name: "Vitality Boost", category: "character-sheet-augment", buCost: 3 },
    ]);
    expect(r.length).toBe(2);
  });

  it("returns empty for unrelated primitives", () => {
    const r = computeVitalityModifiersFromPrimitives([
      { name: "Fire Damage", category: "verb-tier", buCost: 4 },
      { name: "Light", category: "domain-license", buCost: 2 },
    ]);
    expect(r).toEqual([]);
  });
});