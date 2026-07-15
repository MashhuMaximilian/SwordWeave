import { describe, it, expect } from "vitest";
import {
  computeMirrorDebt,
  type SlotInput,
} from "../bu-debt";

/**
 * These scenarios mirror the user's canonical examples (BU Market page
 * §'Mirror-Vector Architecture' + the debt-model clarification).
 *
 * "I have starting budget 25 BU at lvl 1. I take a mirrored primitive
 *  that costs 4BU. I get the effects of that, and I now have 29 total
 *  BU to spend (25+4)."
 */
describe("canonical debt scenarios — user-supplied examples", () => {
  it("L1 baseline: 25 BU starting, no mirror", () => {
    const slots: SlotInput[] = [
      { is_mirrored: false, buCost: 12 },
      { is_mirrored: false, buCost: 8 },
    ];
    const breakdown = computeMirrorDebt({
      level: 1,
      startingBu: 25,
      slots,
    });
    expect(breakdown.basePool).toBe(25);
    expect(breakdown.totalAvailable).toBe(25);
    expect(breakdown.totalSpent).toBe(20);
    expect(breakdown.overBudget).toBe(false);
    expect(breakdown.mirrorDebtUsed).toBe(0);
  });

  it("L1 with 4-BU mirrored primitive: budget 25 → 29", () => {
    const slots: SlotInput[] = [
      { is_mirrored: true, buCost: 4, mirrorBuCredit: 4 },
      { is_mirrored: false, buCost: 12 },
      { is_mirrored: false, buCost: 8 },
    ];
    const breakdown = computeMirrorDebt({
      level: 1,
      startingBu: 25,
      slots,
    });
    expect(breakdown.basePool).toBe(25);
    expect(breakdown.mirrorDebtExpansion).toBe(4);
    expect(breakdown.totalAvailable).toBe(29);
    expect(breakdown.totalSpent).toBe(24);
    expect(breakdown.overBudget).toBe(false);
  });

  it("L1 with mirror and overspend triggers over-budget", () => {
    // Player takes 4 BU mirrored (so budget becomes 29) but then
    // buys 30 BU worth of standard slots. Should be over budget.
    const slots: SlotInput[] = [
      { is_mirrored: true, buCost: 4, mirrorBuCredit: 4 },
      { is_mirrored: false, buCost: 30 },
    ];
    const breakdown = computeMirrorDebt({
      level: 1,
      startingBu: 25,
      slots,
    });
    expect(breakdown.totalAvailable).toBe(29);
    expect(breakdown.totalSpent).toBe(34);
    expect(breakdown.overBudget).toBe(true);
  });

  it("L3 (bracket 2-4, ceiling 8) with mirror beyond ceiling", () => {
    // 6 + 6 mirrored = 12 debt used, ceiling is 8 at L3.
    const slots: SlotInput[] = [
      { is_mirrored: true, buCost: 6, mirrorBuCredit: 6 },
      { is_mirrored: true, buCost: 6, mirrorBuCredit: 6 },
    ];
    const breakdown = computeMirrorDebt({
      level: 3,
      startingBu: 25,
      slots,
    });
    expect(breakdown.mirrorDebtCeiling).toBe(8);
    expect(breakdown.mirrorDebtUsed).toBe(12);
    expect(breakdown.mirrorDebtExceeded).toBe(true);
    expect(breakdown.warning).toMatch(/exceeds level-3 bracket ceiling/);
  });

  it("L4 still shares 2-4 bracket ceiling (NOT cumulative per level)", () => {
    // L2-4 share the same -8 ceiling. L4 with 8 BU mirror debt is
    // at the limit, not exceeded.
    const slots: SlotInput[] = [
      { is_mirrored: true, buCost: 8, mirrorBuCredit: 8 },
    ];
    const breakdown = computeMirrorDebt({
      level: 4,
      startingBu: 25,
      slots,
    });
    expect(breakdown.mirrorDebtCeiling).toBe(8);
    expect(breakdown.mirrorDebtUsed).toBe(8);
    expect(breakdown.mirrorDebtExceeded).toBe(false);
  });
});
