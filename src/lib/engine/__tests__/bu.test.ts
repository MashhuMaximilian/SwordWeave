import { describe, expect, it } from "vitest";
import {
  calculateBuBudget,
  calculatePrimitiveBu,
  canAcceptMirror,
  evaluateBuLedger,
  getVolatilityCeiling,
  maxBuDebtForLevel,
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
  // Phase 8.1 batch 11 (Mashu 2026-07-22): brackets are 4-wide with
  // no L1 special case. ceiling(L) = ceil(L/4) * 4.
  it("L1-L4 → 4 BU", () => {
    expect(getVolatilityCeiling(1).maxNegativeBu).toBe(4);
    expect(getVolatilityCeiling(4).maxNegativeBu).toBe(4);
    expect(getVolatilityCeiling(1).levelBracket).toBe("L1-L4");
  });

  it("L5-L8 → 8 BU", () => {
    expect(getVolatilityCeiling(5).maxNegativeBu).toBe(8);
    expect(getVolatilityCeiling(8).maxNegativeBu).toBe(8);
    expect(getVolatilityCeiling(5).levelBracket).toBe("L5-L8");
  });

  it("L9-L12 → 12 BU", () => {
    expect(getVolatilityCeiling(9).maxNegativeBu).toBe(12);
    expect(getVolatilityCeiling(12).maxNegativeBu).toBe(12);
    expect(getVolatilityCeiling(12).levelBracket).toBe("L9-L12");
  });

  it("L13-L16 → 16 BU", () => {
    expect(getVolatilityCeiling(13).maxNegativeBu).toBe(16);
    expect(getVolatilityCeiling(16).maxNegativeBu).toBe(16);
    expect(getVolatilityCeiling(16).levelBracket).toBe("L13-L16");
  });

  it("L17-L20 → 20 BU", () => {
    expect(getVolatilityCeiling(17).maxNegativeBu).toBe(20);
    expect(getVolatilityCeiling(20).maxNegativeBu).toBe(20);
    expect(getVolatilityCeiling(20).levelBracket).toBe("L17-L20");
  });

  it("continues past L20: L24 → 24, L28 → 28", () => {
    expect(getVolatilityCeiling(24).maxNegativeBu).toBe(24);
    expect(getVolatilityCeiling(28).maxNegativeBu).toBe(28);
    expect(getVolatilityCeiling(28).levelBracket).toBe("L25-L28");
  });

  it("L29+ → 32+", () => {
    expect(getVolatilityCeiling(29).maxNegativeBu).toBe(32);
    expect(getVolatilityCeiling(100).maxNegativeBu).toBe(100);
    expect(getVolatilityCeiling(29).levelBracket).toBe("L29+");
  });
});

describe("calculateBuBudget", () => {
  it("returns 25 BU at level 1", () => {
    expect(calculateBuBudget(1)).toBe(25);
  });

  it("follows the +10 per level + every-4-level spike formula", () => {
    // Phase 8.1 batch 11: cumulative(L) = 25 + 10*(L-1) + spike(L)
    // where spike(L) = sum of (4, 8, 12, ..., 4*floor(L/4)).
    // Examples:
    //   L2 = 35 (25 + 10, no spike)
    //   L4 = 59 (25 + 30 + 4 spike)
    //   L8 = 107 (25 + 70 + 4 + 8 spikes)
    //   L12 = 159 (25 + 110 + 4 + 8 + 12 spikes)
    //   L20 = 275 (25 + 190 + 4 + 8 + 12 + 16 + 20 spikes)
    expect(calculateBuBudget(2)).toBe(35);
    expect(calculateBuBudget(3)).toBe(45);
    expect(calculateBuBudget(4)).toBe(59);
    expect(calculateBuBudget(5)).toBe(69);
    expect(calculateBuBudget(8)).toBe(107);
    expect(calculateBuBudget(9)).toBe(117);
    expect(calculateBuBudget(12)).toBe(159);
    expect(calculateBuBudget(13)).toBe(169);
    expect(calculateBuBudget(17)).toBe(225);
    expect(calculateBuBudget(20)).toBe(275);
  });

  it("continues past level 20 with no upper cap", () => {
    // Phase 8.1 batch 11: no MAX_CHARACTER_LEVEL. Spikes continue
    // every 4 levels indefinitely.
    expect(calculateBuBudget(21)).toBe(285);
    expect(calculateBuBudget(24)).toBe(339);
    expect(calculateBuBudget(40)).toBe(635);
    expect(calculateBuBudget(100)).toBe(2315);
  });

  it("returns 25 for invalid levels (clamped to floor)", () => {
    // Phase 8.1 batch 10: invalid levels fall back to L1's value
    // (25 BU) instead of 0 — the formula treats < 1 as "no level
    // chosen yet" rather than "broken".
    expect(calculateBuBudget(0)).toBe(25);
    expect(calculateBuBudget(-1)).toBe(25);
  });
});

describe("maxBuDebtForLevel", () => {
  // Phase 8.1 batch 11 (Mashu 2026-07-22): flat 4-wide debt brackets,
  // no L1 special case. ceiling(L) = ceil(L/4) * 4.
  //   L1-L4   → 4
  //   L5-L8   → 8
  //   L9-L12  → 12
  //   L13-L16 → 16
  //   L17-L20 → 20
  //   L21-L24 → 24
  //   L25-L28 → 28
  //   L29-L32 → 32
  it("L1-L4 → 4 BU debt ceiling", () => {
    expect(maxBuDebtForLevel(1)).toBe(4);
    expect(maxBuDebtForLevel(2)).toBe(4);
    expect(maxBuDebtForLevel(3)).toBe(4);
    expect(maxBuDebtForLevel(4)).toBe(4);
  });

  it("L5-L8 → 8 BU debt ceiling", () => {
    expect(maxBuDebtForLevel(5)).toBe(8);
    expect(maxBuDebtForLevel(8)).toBe(8);
  });

  it("L9-L12 → 12 BU debt ceiling", () => {
    expect(maxBuDebtForLevel(9)).toBe(12);
    expect(maxBuDebtForLevel(12)).toBe(12);
  });

  it("L13-L16 → 16 BU debt ceiling", () => {
    expect(maxBuDebtForLevel(13)).toBe(16);
    expect(maxBuDebtForLevel(16)).toBe(16);
  });

  it("L17-L20 → 20 BU debt ceiling", () => {
    expect(maxBuDebtForLevel(17)).toBe(20);
    expect(maxBuDebtForLevel(20)).toBe(20);
  });

  it("continues past L20 — L24 → 24, L28 → 28", () => {
    expect(maxBuDebtForLevel(24)).toBe(24);
    expect(maxBuDebtForLevel(28)).toBe(28);
    expect(maxBuDebtForLevel(100)).toBe(100);
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