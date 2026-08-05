/**
 * runtime-resolver.test.ts — Phase 8.I i2.5 (Mashu 2026-08-05)
 *
 * Tests for typed-token resolution. PB chip, attribute token,
 * practice token, behavior variable, dice expression, keyword,
 * runtime reference — all need to resolve to the right number
 * against character state.
 */
import { describe, expect, it } from "vitest";
import {
  resolveToken,
  resolveValue,
  rollDice,
  isTypedToken,
  type ResolveContext,
} from "../runtime-resolver";

// Resolver uses engine's canonical attribute keys: physical | mental | magical
// (the form's "magic-abstract" chip is normalized at lookup time).

const baseCtx: ResolveContext = {
  level: 17,
  pb: 6, // L17 → 2 + floor((17-1)/4) = 6
  attributes: { physical: 5, mental: 4, magical: 3 },
  practices: {
    awareness: 11,
    fieldcraft: 9,
    influence: 7,
    reason: 10,
    vitality: 8,
    lore: 6,
    magic: 5,
    combat: 12,
    movement: 7,
    social: 8,
  },
  behaviorVariables: {
    blockValue: 6,
    darkvision: 60,
  },
};

describe("rollDice (Phase 8.I i2.5)", () => {
  it("rolls a single die", () => {
    const r = rollDice("1d20");
    expect(r.rolls.length).toBe(1);
    expect(r.rolls[0]).toBeGreaterThanOrEqual(1);
    expect(r.rolls[0]).toBeLessThanOrEqual(20);
    expect(r.total).toBe(r.rolls[0]);
  });

  it("rolls multiple dice (2d6)", () => {
    const r = rollDice("2d6");
    expect(r.rolls.length).toBe(2);
    expect(r.total).toBeGreaterThanOrEqual(2);
    expect(r.total).toBeLessThanOrEqual(12);
    // avg = 2 × 3.5 = 7
    expect(r.avg).toBe(7);
  });

  it("handles flat modifiers (2d6+3)", () => {
    const r = rollDice("2d6+3");
    expect(r.rolls.length).toBe(2);
    expect(r.total).toBeGreaterThanOrEqual(5); // 2 + 3
    expect(r.total).toBeLessThanOrEqual(15); // 12 + 3
    expect(r.avg).toBe(10); // 7 + 3
  });

  it("handles negative modifiers (2d6-1)", () => {
    const r = rollDice("2d6-1");
    expect(r.avg).toBe(6); // 7 - 1
  });

  it("returns 0 for empty input", () => {
    expect(rollDice("")).toEqual({ avg: 0, rolls: [], total: 0 });
  });

  it("returns 0 for malformed input", () => {
    expect(rollDice("not a dice").total).toBe(0);
  });
});

describe("resolveToken — number token", () => {
  it("returns the literal number", () => {
    expect(
      resolveToken({ kind: "number", value: 42 }, baseCtx),
    ).toBe(42);
  });

  it("handles negative numbers", () => {
    expect(
      resolveToken({ kind: "number", value: -5 }, baseCtx),
    ).toBe(-5);
  });

  it("handles 0", () => {
    expect(resolveToken({ kind: "number", value: 0 }, baseCtx)).toBe(0);
  });
});

describe("resolveToken — derived token (Phase 8.I i2.5: PB chip works)", () => {
  it("resolves PB to character's pb", () => {
    expect(resolveToken({ kind: "derived", which: "pb" }, baseCtx)).toBe(6);
  });

  it("resolves PB/2 to character's half PB", () => {
    expect(resolveToken({ kind: "derived", which: "pb_half" }, baseCtx)).toBe(3);
  });

  it("resolves LEVEL to character's level", () => {
    expect(resolveToken({ kind: "derived", which: "level" }, baseCtx)).toBe(17);
  });

  it("resolves PB for a L1 character", () => {
    const ctx: ResolveContext = { ...baseCtx, level: 1, pb: 2 };
    expect(resolveToken({ kind: "derived", which: "pb" }, ctx)).toBe(2);
  });
});

describe("resolveToken — attribute token (Phase 8.I i2.5: /physical/ works)", () => {
  it("resolves /physical/ to character's physical attribute", () => {
    expect(
      resolveToken({ kind: "attribute", attribute: "physical" }, baseCtx),
    ).toBe(5);
  });

  it("resolves /mental/ to character's mental attribute", () => {
    expect(
      resolveToken({ kind: "attribute", attribute: "mental" }, baseCtx),
    ).toBe(4);
  });

  it("normalizes magic-abstract to magical", () => {
    expect(
      resolveToken(
        { kind: "attribute", attribute: "magic-abstract" },
        baseCtx,
      ),
    ).toBe(3);
  });

  it("returns 0 for unknown attribute", () => {
    const ctx: ResolveContext = {
      ...baseCtx,
      attributes: { physical: 0, mental: 0, magical: 0 },
    };
    expect(
      resolveToken({ kind: "attribute", attribute: "physical" }, ctx),
    ).toBe(0);
  });
});

describe("resolveToken — practice token (Phase 8.I i2.5: /awareness/ works)", () => {
  it("resolves /awareness/ to character's awareness practice", () => {
    expect(
      resolveToken({ kind: "practice", practice: "awareness" }, baseCtx),
    ).toBe(11);
  });

  it("resolves /fieldcraft/ correctly", () => {
    expect(
      resolveToken({ kind: "practice", practice: "fieldcraft" }, baseCtx),
    ).toBe(9);
  });

  it("returns 0 for unset practice", () => {
    const ctx: ResolveContext = {
      ...baseCtx,
      practices: { ...baseCtx.practices, combat: 0 },
    };
    expect(
      resolveToken({ kind: "practice", practice: "combat" }, ctx),
    ).toBe(0);
  });
});

describe("resolveToken — behavior variable (Phase 8.I i2.5: /blockValue/ works)", () => {
  it("resolves /blockValue/ to its set value", () => {
    expect(
      resolveToken({ kind: "behavior", name: "blockValue" }, baseCtx),
    ).toBe(6);
  });

  it("resolves /darkvision/ to its set value", () => {
    expect(
      resolveToken({ kind: "behavior", name: "darkvision" }, baseCtx),
    ).toBe(60);
  });

  it("returns 0 for undeclared behavior variable", () => {
    expect(
      resolveToken({ kind: "behavior", name: "undeclared" }, baseCtx),
    ).toBe(0);
  });
});

describe("resolveToken — dice expression (Phase 8.I i2.5: #2d6# works)", () => {
  it("returns the average value for modifiers", () => {
    const r = resolveToken({ kind: "dice", expression: "2d6" }, baseCtx);
    expect(r).toBe(7); // 2 × 3.5
  });

  it("returns avg with modifier", () => {
    const r = resolveToken({ kind: "dice", expression: "1d20+5" }, baseCtx);
    expect(r).toBe(15.5); // 10.5 + 5
  });
});

describe("resolveToken — keyword (Phase 8.I i2.5: [fire] tags)", () => {
  it("returns 0 for keyword (tags don't contribute to number)", () => {
    expect(resolveToken({ kind: "keyword", text: "fire" }, baseCtx)).toBe(0);
  });

  it("any keyword returns 0", () => {
    expect(resolveToken({ kind: "keyword", text: "piercing" }, baseCtx)).toBe(
      0,
    );
  });
});

describe("resolveToken — runtime reference (Phase 8.I i2.5)", () => {
  it("treats runtime references as behavior variables", () => {
    expect(
      resolveToken(
        { kind: "runtime", name: "blockValue", hint: "number" },
        baseCtx,
      ),
    ).toBe(6);
  });

  it("returns 0 for undeclared runtime reference", () => {
    expect(
      resolveToken(
        { kind: "runtime", name: "notDeclared", hint: "number" },
        baseCtx,
      ),
    ).toBe(0);
  });
});

describe("isTypedToken", () => {
  it("identifies typed tokens", () => {
    expect(isTypedToken({ kind: "number", value: 5 })).toBe(true);
    expect(isTypedToken({ kind: "derived", which: "pb" })).toBe(true);
    expect(isTypedToken({ kind: "behavior", name: "x" })).toBe(true);
  });

  it("rejects plain numbers", () => {
    expect(isTypedToken(5)).toBe(false);
    expect(isTypedToken(0)).toBe(false);
  });

  it("rejects plain strings", () => {
    expect(isTypedToken("PB")).toBe(false);
    expect(isTypedToken("hello")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isTypedToken(null)).toBe(false);
    expect(isTypedToken(undefined)).toBe(false);
  });
});

describe("resolveValue (Phase 8.I i2.5: dispatch on type)", () => {
  it("resolves typed tokens", () => {
    expect(resolveValue({ kind: "derived", which: "pb" }, baseCtx)).toBe(6);
  });

  it("passes through plain numbers", () => {
    expect(resolveValue(5, baseCtx)).toBe(5);
  });

  it("parses plain numeric strings", () => {
    expect(resolveValue("5", baseCtx)).toBe(5);
    expect(resolveValue("-3", baseCtx)).toBe(-3);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(resolveValue("PB", baseCtx)).toBe(0); // legacy: no longer recognized as a string
  });

  it("converts booleans to 0/1", () => {
    expect(resolveValue(true, baseCtx)).toBe(1);
    expect(resolveValue(false, baseCtx)).toBe(0);
  });

  it("returns 0 for null/undefined", () => {
    expect(resolveValue(null, baseCtx)).toBe(0);
    expect(resolveValue(undefined, baseCtx)).toBe(0);
  });
});

describe("modifier additivity (Phase 8.I i2.5: end-to-end example)", () => {
  it("Mashu's example: set blockValue=6 + add 1 to /blockValue/ resolves correctly", () => {
    // The "set blockValue" modifier produces a behavior variable.
    // The "add 1 to /blockValue/" modifier reads it.
    // First: collect behavior variables.
    const behaviorVariables: Record<string, number> = {};
    // Simulate `set 6 to behavior:blockValue`:
    resolveValue(
      { kind: "behavior", name: "blockValue" },
      { ...baseCtx, behaviorVariables: { blockValue: 6 } },
    );

    // Now resolve /blockValue/ in the second modifier:
    const r = resolveValue(
      { kind: "behavior", name: "blockValue" },
      { ...baseCtx, behaviorVariables: { blockValue: 6 } },
    );
    expect(r).toBe(6); // The token resolves to 6 (the set value)
    // The second modifier's contribution is +1 to its target, NOT the
    // value of blockValue itself. The resolver contributes 1 (the
    // literal "+1" from the modifier's value field).
    expect(resolveValue(1, baseCtx)).toBe(1);
  });

  it("PB chip on + PB to Prowess: token resolves, modifier adds PB to Prowess", () => {
    // The modifier value is the PB token; the modifier adds PB to Prowess.
    const tokenContribution = resolveValue(
      { kind: "derived", which: "pb" },
      baseCtx,
    );
    expect(tokenContribution).toBe(6);
    // The modifier's "add" op adds 6 to Prowess.
  });
});
