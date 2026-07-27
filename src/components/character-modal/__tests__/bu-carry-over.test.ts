/**
 * Phase 8.2 batch 19: regression test for the BU carry-over math.
 *
 * Per Mashu 2026-07-27, the carry-over rule for BU budget / debt:
 *   - mirror primitives EARN debt (their sum is the available pool)
 *   - non-mirror primitives fill the budget; overflow absorbs into the
 *     available pool up to its size
 *   - the budget display subtracts the absorbed overflow so the
 *     visible budget number only reflects what's NOT been absorbed
 *   - any remainder overflow still shows as +N
 *
 * Display format: BU DEBT X/Y (max Z BU)
 *   X = overflow absorbed by debt (= min(overflow, mirrorTotal))
 *   Y = mirrorTotal (the earned/available debt pool)
 *   Z = maxBuDebtForLevel(level)
 *
 * Budget display: visible = nonMirror - absorbed; if visible > cap,
 * show as `visible/cap (+remainder)`.
 */
import { describe, expect, it } from "vitest";

const maxBuDebtForLevel = (level: number) =>
  !Number.isFinite(level) || level <= 0 ? 0 : Math.ceil(level / 4) * 4;

function computeDisplay({
  nonMirror,
  mirror,
  budgetCap,
  level,
}: {
  nonMirror: number;
  mirror: number;
  budgetCap: number;
  level: number;
}) {
  const budgetOverflow = Math.max(0, nonMirror - budgetCap);
  const debtX = Math.min(budgetOverflow, mirror);
  const debtY = mirror;
  const debtZ = maxBuDebtForLevel(level);
  const budgetVisible = Math.max(0, nonMirror - debtX);
  const budgetRemainder = Math.max(0, budgetVisible - budgetCap);
  const budgetDisplay =
    budgetRemainder > 0
      ? `${budgetVisible}/${budgetCap} (+${budgetRemainder})`
      : `${budgetVisible}/${budgetCap}`;
  const debtDisplay = `${debtX}/${debtY} (max ${debtZ} BU)`;
  return { budgetDisplay, debtDisplay };
}

describe("BU carry-over math — phase 8.2 batch 19", () => {
  it("lvl 10 stage 1 — mirror=8, non-mirror=127 (no overflow yet)", () => {
    // No overflow, debt not yet used.
    const { budgetDisplay, debtDisplay } = computeDisplay({
      nonMirror: 127,
      mirror: 8,
      budgetCap: 127,
      level: 10,
    });
    expect(budgetDisplay).toBe("127/127");
    expect(debtDisplay).toBe("0/8 (max 12 BU)");
  });

  it("lvl 10 stage 2 — mirror=8, non-mirror=135 (overflow fully absorbed)", () => {
    // Overflow = 8 (135 - 127). mirror = 8. All overflow absorbs into debt.
    const { budgetDisplay, debtDisplay } = computeDisplay({
      nonMirror: 135,
      mirror: 8,
      budgetCap: 127,
      level: 10,
    });
    expect(budgetDisplay).toBe("127/127");
    expect(debtDisplay).toBe("8/8 (max 12 BU)");
  });

  it("lvl 10 stage 3 — mirror=8, non-mirror=139 (debt full, +4 remains)", () => {
    // Overflow = 12. mirror = 8 absorbs 8. Remainder 4 stays as budget +4.
    const { budgetDisplay, debtDisplay } = computeDisplay({
      nonMirror: 139,
      mirror: 8,
      budgetCap: 127,
      level: 10,
    });
    expect(budgetDisplay).toBe("131/127 (+4)");
    expect(debtDisplay).toBe("8/8 (max 12 BU)");
  });

  it("lvl 18 — mirror=8, non-mirror=236 (image scenario, 1 BU overflow)", () => {
    // Tessy's level: budget=235, overflow=1, mirror=8, absorbs 1.
    const { budgetDisplay, debtDisplay } = computeDisplay({
      nonMirror: 236,
      mirror: 8,
      budgetCap: 235,
      level: 18,
    });
    expect(budgetDisplay).toBe("235/235");
    expect(debtDisplay).toBe("1/8 (max 20 BU)");
  });

  it("lvl 18 — no mirrors (Y=0), non-mirror overflow stays in budget", () => {
    const { budgetDisplay, debtDisplay } = computeDisplay({
      nonMirror: 240,
      mirror: 0,
      budgetCap: 235,
      level: 18,
    });
    expect(budgetDisplay).toBe("240/235 (+5)");
    expect(debtDisplay).toBe("0/0 (max 20 BU)");
  });
});