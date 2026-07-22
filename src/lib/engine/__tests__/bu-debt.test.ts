import { describe, it, expect } from "vitest";
import {
  computeMirrorDebt,
  computeMirrorDebtExpansion,
  getMirrorDebtCeiling,
  describeMirrorDebtBracket,
  MAX_MIRROR_DEBT_BY_LEVEL,
  type SlotInput,
} from "../bu-debt";

describe("getMirrorDebtCeiling — bracket-based (not cumulative)", () => {
  it("L1 has 0 debt ceiling (no debt at character creation)", () => {
    expect(getMirrorDebtCeiling(1)).toBe(0);
  });

  it("L2-4 share the same -8 BU ceiling (bracket, not cumulative)", () => {
    expect(getMirrorDebtCeiling(2)).toBe(8);
    expect(getMirrorDebtCeiling(3)).toBe(8);
    expect(getMirrorDebtCeiling(4)).toBe(8);
  });

  it("L5-8 share -16 BU ceiling", () => {
    expect(getMirrorDebtCeiling(5)).toBe(16);
    expect(getMirrorDebtCeiling(7)).toBe(16);
    expect(getMirrorDebtCeiling(8)).toBe(16);
  });

  it("L9-12 share -24 BU ceiling", () => {
    expect(getMirrorDebtCeiling(9)).toBe(24);
    expect(getMirrorDebtCeiling(11)).toBe(24);
    expect(getMirrorDebtCeiling(12)).toBe(24);
  });

  it("clamps above L20 to the highest bracket", () => {
    expect(getMirrorDebtCeiling(21)).toBe(40);
    expect(getMirrorDebtCeiling(50)).toBe(40);
  });

  it("L17-20 share -40 BU ceiling", () => {
    expect(getMirrorDebtCeiling(17)).toBe(40);
    expect(getMirrorDebtCeiling(20)).toBe(40);
  });
});

describe("computeMirrorDebtExpansion", () => {
  it("returns 0 when no slots are mirrored", () => {
    const slots: SlotInput[] = [
      { is_mirrored: false, buCost: 4 },
      { is_mirrored: false, buCost: 8 },
    ];
    expect(computeMirrorDebtExpansion(slots)).toBe(0);
  });

  it("returns the sum of mirror_bu_credit for mirrored slots", () => {
    const slots: SlotInput[] = [
      { is_mirrored: true, buCost: 4, mirrorBuCredit: 4 },
      { is_mirrored: false, buCost: 8 },
      { is_mirrored: true, buCost: 12, mirrorBuCredit: 12 },
    ];
    expect(computeMirrorDebtExpansion(slots)).toBe(16);
  });

  it("defaults mirrorBuCredit to buCost when not specified", () => {
    const slots: SlotInput[] = [
      { is_mirrored: true, buCost: 4 },
    ];
    expect(computeMirrorDebtExpansion(slots)).toBe(4);
  });

  it("treats undefined is_mirrored as not mirrored", () => {
    const slots: SlotInput[] = [{ buCost: 4 }];
    expect(computeMirrorDebtExpansion(slots)).toBe(0);
  });
});

describe("computeMirrorDebt — full breakdown", () => {
  it("L1 character with no mirrors: basePool=25, expansion=0, total=25", () => {
    const breakdown = computeMirrorDebt({
      level: 1,
      startingBu: 25,
      slots: [
        { is_mirrored: false, buCost: 12 },
        { is_mirrored: false, buCost: 8 },
      ],
    });
    expect(breakdown.basePool).toBe(25);
    expect(breakdown.mirrorDebtExpansion).toBe(0);
    expect(breakdown.totalAvailable).toBe(25);
    expect(breakdown.totalSpent).toBe(20);
    expect(breakdown.overBudget).toBe(false);
  });

  it("L1 character takes 4 BU mirrored primitive: budget 25 -> 29", () => {
    const breakdown = computeMirrorDebt({
      level: 1,
      startingBu: 25,
      slots: [
        { is_mirrored: true, buCost: 4, mirrorBuCredit: 4 },
        { is_mirrored: false, buCost: 12 },
        { is_mirrored: false, buCost: 8 },
      ],
    });
    expect(breakdown.basePool).toBe(25);
    expect(breakdown.mirrorDebtExpansion).toBe(4);
    expect(breakdown.totalAvailable).toBe(29);
    expect(breakdown.totalSpent).toBe(24);
    expect(breakdown.overBudget).toBe(false);
  });

  it("over budget fires when spend exceeds available", () => {
    const breakdown = computeMirrorDebt({
      level: 1,
      startingBu: 25,
      slots: [
        { is_mirrored: false, buCost: 30 },
      ],
    });
    expect(breakdown.totalAvailable).toBe(25);
    expect(breakdown.totalSpent).toBe(30);
    expect(breakdown.overBudget).toBe(true);
  });

  it("L3 bracket ceiling of 8 BU exceeded by mirrored slots", () => {
    const breakdown = computeMirrorDebt({
      level: 3,
      startingBu: 25,
      slots: [
        { is_mirrored: true, buCost: 6, mirrorBuCredit: 6 },
        { is_mirrored: true, buCost: 6, mirrorBuCredit: 6 },
      ],
    });
    expect(breakdown.mirrorDebtCeiling).toBe(8);
    expect(breakdown.mirrorDebtUsed).toBe(12);
    expect(breakdown.mirrorDebtExceeded).toBe(true);
    expect(breakdown.warning).toMatch(/exceeds level-3 bracket ceiling/);
  });

  it("under-bracket mirror usage does not trigger warning", () => {
    const breakdown = computeMirrorDebt({
      level: 3,
      startingBu: 25,
      slots: [
        { is_mirrored: true, buCost: 4, mirrorBuCredit: 4 },
      ],
    });
    expect(breakdown.mirrorDebtCeiling).toBe(8);
    expect(breakdown.mirrorDebtUsed).toBe(4);
    expect(breakdown.mirrorDebtExceeded).toBe(false);
    expect(breakdown.warning).toBeUndefined();
  });

  it("DM bonus flows through to basePool", () => {
    const breakdown = computeMirrorDebt({
      level: 5,
      startingBu: 25,
      dmBonusBu: 8,
      slots: [],
    });
    // Phase 8.1 batch 10g: pool = max(25, cumulative(5)=69) + 8 = 77
    expect(breakdown.basePool).toBe(77);
  });
});

describe("describeMirrorDebtBracket", () => {
  it("formats a single-level bracket label", () => {
    const info = describeMirrorDebtBracket(1, 0);
    expect(info.bracketLabel).toBe("L1");
    expect(info.ceiling).toBe(0);
    expect(info.remaining).toBe(0);
  });

  it("formats a multi-level bracket label", () => {
    const info = describeMirrorDebtBracket(3, 4);
    expect(info.bracketLabel).toBe("L2-4");
    expect(info.ceiling).toBe(8);
    expect(info.used).toBe(4);
    expect(info.remaining).toBe(4);
  });

  it("clamps remaining to 0 when used exceeds ceiling", () => {
    const info = describeMirrorDebtBracket(3, 12);
    expect(info.remaining).toBe(0);
  });
});

describe("MAX_MIRROR_DEBT_BY_LEVEL — bracket integrity", () => {
  it("has no overlapping brackets", () => {
    const sorted = [...MAX_MIRROR_DEBT_BY_LEVEL].sort(
      (a, b) => a.minLevel - b.minLevel,
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      expect(curr.minLevel).toBe(prev.maxLevel + 1);
    }
  });

  it("ceiling grows monotonically", () => {
    const sorted = [...MAX_MIRROR_DEBT_BY_LEVEL].sort(
      (a, b) => a.minLevel - b.minLevel,
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      expect(curr.maxMirrorDebtBu).toBeGreaterThan(prev.maxMirrorDebtBu);
    }
  });
});
