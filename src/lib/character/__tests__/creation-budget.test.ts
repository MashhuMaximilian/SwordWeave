import { describe, expect, it } from "vitest";
import { creationBudget } from "../creation-budget";

describe("creation budget allocation", () => {
  it("fills base budget before using debt credit and then overflow", () => {
    expect(creationBudget({ level: 9, budget: 60, positiveSpent: 76, mirrorCredit: 10 })).toMatchObject({
      baseUsed: 60, debtUsed: 10, debtAvailable: 0, overflow: 6,
      netSpent: 66, remaining: 0, needsDmApproval: true, canCreate: true,
    });
  });
  it("keeps unused drawback credit separate while base budget is available", () => {
    expect(creationBudget({ level: 1, budget: 25, positiveSpent: 20, mirrorCredit: 4 })).toMatchObject({
      baseUsed: 20, debtUsed: 0, debtAvailable: 4, overflow: 0, remaining: 9,
    });
  });
  it("allows DM-approved overflow through the next-level threshold inclusive", () => {
    expect(creationBudget({ level: 10, budget: 125, positiveSpent: 127, mirrorCredit: 0 })).toMatchObject({
      overflow: 2, needsDmApproval: true, canCreate: true, nextLevelBudget: 137,
    });
    expect(creationBudget({ level: 1, budget: 25, positiveSpent: 39, mirrorCredit: 4 }).canCreate).toBe(true);
    expect(creationBudget({ level: 1, budget: 25, positiveSpent: 40, mirrorCredit: 4 })).toMatchObject({
      aboveNextLevel: true, canCreate: false,
    });
  });
  it("recalculates both hard ceilings when changing level", () => {
    const input = { budget: 25, positiveSpent: 40, mirrorCredit: 8 };
    expect(creationBudget({ ...input, level: 10 }).canCreate).toBe(true);
    expect(creationBudget({ ...input, level: 1 })).toMatchObject({ debtExceeded: true, canCreate: false });
  });
  it("counts an explicit DM bonus toward the next-level ceiling", () => {
    expect(creationBudget({ level: 1, budget: 30, dmBonusBu: 5, positiveSpent: 40, mirrorCredit: 0 })).toMatchObject({
      nextLevelBudget: 40, canCreate: true,
    });
  });
});
