import { describe, expect, it } from "vitest";
import {
  calculateBuBudget,
  calculatePrimitiveBu,
  canAcceptMirror,
  evaluateBuLedger,
  getVolatilityCeiling,
  sumPrimitiveBu,
  validateBuValue,
} from "../bu";
import type { PrimitiveInput } from "../bu";

// Test fixtures
const strike: PrimitiveInput = {
  id: 1,
  name: "Strike",
  category: "VERB_TIER",
  buCost: 4,
  isMirrorable: false,
  mirrorBuCredit: 0,
  hardModifiers: [],
};

const fire: PrimitiveInput = {
  id: 2,
  name: "Fire",
  category: "DOMAIN",
  buCost: 4,
  isMirrorable: false,
  mirrorBuCredit: 0,
  hardModifiers: [],
};

const closeRange: PrimitiveInput = {
  id: 3,
  name: "Close Range Gate",
  category: "RANGE",
  buCost: 2,
  isMirrorable: false,
  mirrorBuCredit: 0,
  hardModifiers: [],
};

const minorDie: PrimitiveInput = {
  id: 4,
  name: "Minor Die Block",
  category: "OUTPUT",
  buCost: 1,
  isMirrorable: false,
  mirrorBuCredit: 0,
  hardModifiers: [],
};

const vulnerableToFire: PrimitiveInput = {
  id: 100,
  name: "Vulnerable to Fire",
  category: "DEFENSE",
  buCost: 0,
  isMirrorable: true,
  mirrorBuCredit: 4,
  hardModifiers: [],
};

describe("getVolatilityCeiling", () => {
  it("returns -4 BU at level 1 (special case per canon)", () => {
    expect(getVolatilityCeiling(1).maxNegativeBu).toBe(4);
  });

  it("returns -8 BU for levels 2-4", () => {
    expect(getVolatilityCeiling(2).maxNegativeBu).toBe(8);
    expect(getVolatilityCeiling(3).maxNegativeBu).toBe(8);
    expect(getVolatilityCeiling(4).maxNegativeBu).toBe(8);
  });

  it("returns -12 BU for levels 5-10", () => {
    expect(getVolatilityCeiling(5).maxNegativeBu).toBe(12);
    expect(getVolatilityCeiling(10).maxNegativeBu).toBe(12);
  });

  it("returns -16 BU for levels 11-15", () => {
    expect(getVolatilityCeiling(11).maxNegativeBu).toBe(16);
    expect(getVolatilityCeiling(15).maxNegativeBu).toBe(16);
  });

  it("returns -24 BU for levels 16+", () => {
    expect(getVolatilityCeiling(16).maxNegativeBu).toBe(24);
    expect(getVolatilityCeiling(20).maxNegativeBu).toBe(24);
    expect(getVolatilityCeiling(25).maxNegativeBu).toBe(24);
  });
});

describe("calculateBuBudget", () => {
  it("returns 25 BU at level 1", () => {
    expect(calculateBuBudget(1)).toBe(25);
  });

  it("returns the canon cumulative value at each level", () => {
    // Phase 8.1 batch 10: the cumulative table is the source of
    // truth (Leveling & Progression Canon v1). These values come
    // straight from the canon; the legacy formula
    // (25 + 10*(L-1) + spikes) doesn't match exactly because the
    // canon bakes progression spikes into specific levels in a way
    // that doesn't align with "applied at the level it's listed".
    expect(calculateBuBudget(2)).toBe(35);
    expect(calculateBuBudget(3)).toBe(45);
    expect(calculateBuBudget(4)).toBe(55);
    expect(calculateBuBudget(5)).toBe(69);
    expect(calculateBuBudget(8)).toBe(99);
    expect(calculateBuBudget(9)).toBe(117);
    expect(calculateBuBudget(12)).toBe(147);
    expect(calculateBuBudget(13)).toBe(169);
    expect(calculateBuBudget(17)).toBe(225);
    expect(calculateBuBudget(20)).toBe(255);
  });

  it("returns 25 for invalid levels (clamped to floor)", () => {
    // Phase 8.1 batch 10: invalid levels fall back to L1's value
    // (25 BU) instead of 0 — the table treats < 1 as "no level
    // chosen yet" rather than "broken".
    expect(calculateBuBudget(0)).toBe(25);
    expect(calculateBuBudget(-1)).toBe(25);
  });
});

describe("calculatePrimitiveBu", () => {
  it("returns positive buCost for non-mirrored primitives", () => {
    expect(calculatePrimitiveBu(strike, false)).toBe(4);
  });

  it("returns negative mirrorBuCredit for mirrored primitives", () => {
    expect(calculatePrimitiveBu(vulnerableToFire, true)).toBe(-4);
  });

  it("throws when trying to mirror a non-mirrorable primitive", () => {
    expect(() => calculatePrimitiveBu(strike, true)).toThrow(
      /not mirrorable/,
    );
  });
});

describe("sumPrimitiveBu", () => {
  it("sums only positive BU when no mirroring", () => {
    const result = sumPrimitiveBu([strike, fire, closeRange, minorDie]);
    expect(result.positiveSpent).toBe(11);
    expect(result.mirrorCredit).toBe(0);
    expect(result.netSpent).toBe(11);
  });

  it("sums mirror credits as negative numbers", () => {
    const result = sumPrimitiveBu(
      [strike, fire, vulnerableToFire],
      new Set([100]),
    );
    expect(result.positiveSpent).toBe(8);
    expect(result.mirrorCredit).toBe(-4);
    expect(result.netSpent).toBe(4);
  });

  it("returns zeros for empty list", () => {
    expect(sumPrimitiveBu([])).toEqual({
      positiveSpent: 0,
      mirrorCredit: 0,
      netSpent: 0,
    });
  });
});

describe("evaluateBuLedger", () => {
  it("computes a full ledger for an L1 character with no mirrors", () => {
    const ledger = evaluateBuLedger(1, [strike, fire, closeRange, minorDie]);
    expect(ledger.positiveSpent).toBe(11);
    expect(ledger.mirrorCredit).toBe(0);
    expect(ledger.netSpent).toBe(11);
    expect(ledger.volatilityRating).toBe(0);
    expect(ledger.volatilityCeiling).toBe(4); // L1 special case per canon
    expect(ledger.ceilingExceeded).toBe(false);
    expect(ledger.budget).toBe(25);
    expect(ledger.remaining).toBe(14);
    expect(ledger.overBudget).toBe(false);
  });

  it("computes volatility rating from mirrored primitives", () => {
    const ledger = evaluateBuLedger(
      3,
      [strike, fire, vulnerableToFire],
      new Set([100]),
    );
    expect(ledger.positiveSpent).toBe(8);
    expect(ledger.mirrorCredit).toBe(-4);
    expect(ledger.netSpent).toBe(4);
    expect(ledger.volatilityRating).toBe(4);
    expect(ledger.ceilingExceeded).toBe(false); // -4 < -8 ceiling (L2-4)
  });

  it("flags ceiling exceeded when volatility > max", () => {
    const vuln2: PrimitiveInput = {
      ...vulnerableToFire,
      id: 101,
      name: "Vulnerable to Ice",
      mirrorBuCredit: 5,
    };
    const vuln3: PrimitiveInput = {
      ...vulnerableToFire,
      id: 102,
      name: "Vulnerable to Lightning",
      mirrorBuCredit: 4,
    };
    // Total mirror = 4 + 5 + 4 = 13, exceeds L1 ceiling of 4 per canon.
    const ledger = evaluateBuLedger(
      1,
      [vulnerableToFire, vuln2, vuln3],
      new Set([100, 101, 102]),
    );
    expect(ledger.volatilityRating).toBe(13);
    expect(ledger.volatilityCeiling).toBe(4);
    expect(ledger.ceilingExceeded).toBe(true);
  });

  it("flags over budget when netSpent > budget", () => {
    // Lots of expensive primitives at L1 (budget 25)
    const expensive: PrimitiveInput = {
      ...strike,
      buCost: 20,
    };
    const ledger = evaluateBuLedger(1, [expensive, expensive, expensive]);
    expect(ledger.netSpent).toBe(60);
    expect(ledger.budget).toBe(25);
    expect(ledger.overBudget).toBe(true);
    expect(ledger.remaining).toBe(-35);
  });
});

describe("canAcceptMirror", () => {
  it("rejects mirroring non-mirrorable primitives", () => {
    const result = canAcceptMirror(1, [], strike);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not flagged as mirrorable/);
  });

  it("allows mirroring when within ceiling", () => {
    const result = canAcceptMirror(1, [], vulnerableToFire);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("rejects mirroring when would exceed ceiling", () => {
    // Already at -5, trying to add -4 → -9 > -8 ceiling
    const vuln1: PrimitiveInput = {
      ...vulnerableToFire,
      id: 101,
      mirrorBuCredit: 5,
    };
    const result = canAcceptMirror(1, [vuln1], vulnerableToFire);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/exceeding level 1 ceiling/);
  });
});

describe("validateBuValue", () => {
  it("accepts non-negative integers", () => {
    expect(() => validateBuValue(0, "buCost")).not.toThrow();
    expect(() => validateBuValue(4, "buCost")).not.toThrow();
    expect(() => validateBuValue(1000, "buCost")).not.toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => validateBuValue(-1, "buCost")).toThrow(/non-negative/);
  });

  it("rejects non-integers", () => {
    expect(() => validateBuValue(4.5, "buCost")).toThrow(/integer/);
    expect(() => validateBuValue(NaN, "buCost")).toThrow(/integer/);
  });
});