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
  it("returns -8 BU for levels 1-4", () => {
    expect(getVolatilityCeiling(1).maxNegativeBu).toBe(8);
    expect(getVolatilityCeiling(2).maxNegativeBu).toBe(8);
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

  it("adds 10 BU per level after L1", () => {
    expect(calculateBuBudget(2)).toBe(35);
    expect(calculateBuBudget(3)).toBe(45);
  });

  it("adds progression spikes at L4, L8, L12, L16, L20", () => {
    // L3: 25 + 20 = 45
    expect(calculateBuBudget(3)).toBe(45);
    // L4: 25 + 30 + 4 = 59
    expect(calculateBuBudget(4)).toBe(59);
    // L7: 25 + 60 + 4 = 89
    expect(calculateBuBudget(7)).toBe(89);
    // L8: 25 + 70 + 4 + 8 = 107
    expect(calculateBuBudget(8)).toBe(107);
    // L20: 25 + 190 + 4 + 8 + 12 + 16 + 20 = 275
    expect(calculateBuBudget(20)).toBe(275);
  });

  it("returns 0 for invalid levels", () => {
    expect(calculateBuBudget(0)).toBe(0);
    expect(calculateBuBudget(-1)).toBe(0);
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
    expect(ledger.volatilityCeiling).toBe(8);
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
    expect(ledger.ceilingExceeded).toBe(false); // -4 < -8 ceiling
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
    // Total mirror = 4 + 5 + 4 = 13, exceeds L1-4 ceiling of 8
    const ledger = evaluateBuLedger(
      1,
      [vulnerableToFire, vuln2, vuln3],
      new Set([100, 101, 102]),
    );
    expect(ledger.volatilityRating).toBe(13);
    expect(ledger.volatilityCeiling).toBe(8);
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