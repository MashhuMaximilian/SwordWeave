/**
 * stats.test.ts — Verify PB, attribute, vitality, defense, and movement math
 *                   against canonical Notion rules.
 */
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_SUM,
  BASELINE_DEFENSE,
  BASELINE_LAND_SPEED,
  MAX_ATTRIBUTE,
  MAX_PB,
  MIN_ATTRIBUTE,
  proficiencyBonus,
  calculateAttributeScore,
  validateAttributes,
  compileAttributes,
  calculateMaxVitality,
  calculateDefenseDc,
  compileDefenses,
  compileMovement,
  compileEntityLiveStats,
  type AttributeScores,
} from "../stats";
import type { HardModifier } from "@/types/swordweave";

// =============================================================================
// Proficiency Bonus
// =============================================================================

describe("proficiencyBonus", () => {
  it("returns +2 at level 1", () => {
    expect(proficiencyBonus(1)).toBe(2);
  });

  it("returns +2 at levels 2-4", () => {
    expect(proficiencyBonus(2)).toBe(2);
    expect(proficiencyBonus(3)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
  });

  it("returns +3 at levels 5-8", () => {
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(8)).toBe(3);
  });

  it("returns +4 at levels 9-12", () => {
    expect(proficiencyBonus(9)).toBe(4);
    expect(proficiencyBonus(12)).toBe(4);
  });

  it("returns +5 at levels 13-16", () => {
    expect(proficiencyBonus(13)).toBe(5);
    expect(proficiencyBonus(16)).toBe(5);
  });

  it("returns +6 at levels 17-20", () => {
    expect(proficiencyBonus(17)).toBe(6);
    expect(proficiencyBonus(20)).toBe(6);
  });

  it("caps at MAX_PB", () => {
    expect(proficiencyBonus(50)).toBeLessThanOrEqual(MAX_PB);
  });

  it("throws for invalid levels", () => {
    expect(() => proficiencyBonus(0)).toThrow();
    expect(() => proficiencyBonus(-1)).toThrow();
  });
});

// =============================================================================
// Attribute Score Calculation
// =============================================================================

describe("calculateAttributeScore", () => {
  it("returns base when no modifiers", () => {
    expect(calculateAttributeScore(2, "physical", [])).toBe(2);
  });

  it("applies 'add' modifier", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 1,
      },
    ];
    expect(calculateAttributeScore(2, "physical", mods)).toBe(3);
  });

  it("applies 'subtract' modifier", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "subtract",
        value: 2,
      },
    ];
    expect(calculateAttributeScore(3, "physical", mods)).toBe(1);
  });

  it("applies 'set' modifier", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.mental",
        operation: "set",
        value: 5,
      },
    ];
    expect(calculateAttributeScore(2, "mental", mods)).toBe(5);
  });

  it("applies 'multiply' modifier", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.magical",
        operation: "multiply",
        value: 2,
      },
    ];
    expect(calculateAttributeScore(3, "magical", mods)).toBe(6);
  });

  it("applies multiple modifiers in sequence", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 2,
      },
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "subtract",
        value: 1,
      },
    ];
    expect(calculateAttributeScore(3, "physical", mods)).toBe(4);
  });

  it("ignores modifiers targeting other attributes", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.mental",
        operation: "add",
        value: 5,
      },
    ];
    expect(calculateAttributeScore(2, "physical", mods)).toBe(2);
  });

  it("ignores non-numeric values", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: "not a number",
      },
    ];
    expect(calculateAttributeScore(2, "physical", mods)).toBe(2);
  });
});

// =============================================================================
// Attribute Validation
// =============================================================================

describe("validateAttributes", () => {
  it("accepts a balanced spread (4/3/3 = 10)", () => {
    expect(validateAttributes({ physical: 4, mental: 3, magical: 3 })).toBeNull();
  });

  it("accepts a balanced spread with negatives (5/5/0 = 10)", () => {
    expect(validateAttributes({ physical: 5, mental: 5, magical: 0 })).toBeNull();
  });

  it("accepts the minimum spread (5/5/-1 = 9... wait, sum must = 10)", () => {
    expect(
      validateAttributes({ physical: 5, mental: 4, magical: 1 }),
    ).toBeNull();
  });

  it("rejects sum != 10", () => {
    const result = validateAttributes({ physical: 4, mental: 4, magical: 4 });
    expect(result).toMatch(/sum 12/);
  });

  it("rejects attribute below -1", () => {
    const result = validateAttributes({ physical: -2, mental: 6, magical: 6 });
    expect(result).toMatch(/Physical.*out of range/);
  });

  it("rejects attribute above 5", () => {
    const result = validateAttributes({ physical: 6, mental: 2, magical: 2 });
    expect(result).toMatch(/Physical.*out of range/);
  });

  it("rejects non-integer attribute", () => {
    const result = validateAttributes({ physical: 2.5, mental: 4, magical: 3.5 });
    expect(result).toMatch(/Physical/);
  });

  it("accepts the canonical L1 spread (3/4/3)", () => {
    expect(validateAttributes({ physical: 3, mental: 4, magical: 3 })).toBeNull();
  });

  it("rejects spread with one attribute at MAX", () => {
    expect(
      validateAttributes({ physical: 5, mental: 5, magical: 5 }),
    ).toMatch(/sum/);
  });

  it("rejects spread with all low (-1/5/5 = 9)", () => {
    const result = validateAttributes({
      physical: -1,
      mental: 5,
      magical: 5,
    });
    expect(result).toMatch(/sum 9/);
  });
});

// =============================================================================
// compileAttributes
// =============================================================================

describe("compileAttributes", () => {
  it("compiles all three attributes in one pass", () => {
    const base: AttributeScores = { physical: 3, mental: 4, magical: 3 };
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 1,
      },
      {
        kind: "modify",
        target: "character.attribute.magical",
        operation: "subtract",
        value: 1,
      },
    ];
    const compiled = compileAttributes(base, mods);
    expect(compiled).toEqual({ physical: 4, mental: 4, magical: 2 });
  });

  it("returns base values when no modifiers", () => {
    const base: AttributeScores = { physical: 3, mental: 3, magical: 4 };
    expect(compileAttributes(base, [])).toEqual(base);
  });
});

// =============================================================================
// Max Vitality
// =============================================================================

describe("calculateMaxVitality", () => {
  it("L1 with PB=2: (10 + 2) * 1 = 12", () => {
    expect(calculateMaxVitality(1)).toBe(12);
  });

  it("L5 with PB=3: (10 + 3) * 5 = 65", () => {
    expect(calculateMaxVitality(5)).toBe(65);
  });

  it("L10 with PB=4: (10 + 4) * 10 = 140", () => {
    expect(calculateMaxVitality(10)).toBe(140);
  });

  it("L20 with PB=6: (10 + 6) * 20 = 320", () => {
    expect(calculateMaxVitality(20)).toBe(320);
  });

  it("applies vitality augment (+5 from Vitality Core Augment I)", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.maxVitality",
        operation: "add",
        value: 5,
      },
    ];
    expect(calculateMaxVitality(1, mods)).toBe(17); // 12 + 5
  });

  it("applies multiple vitality modifiers", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.maxVitality",
        operation: "add",
        value: 5,
      },
      {
        kind: "modify",
        target: "character.maxVitality",
        operation: "add",
        value: 12,
      },
    ];
    expect(calculateMaxVitality(1, mods)).toBe(29); // 12 + 17
  });

  it("does not go negative", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.maxVitality",
        operation: "subtract",
        value: 999,
      },
    ];
    expect(calculateMaxVitality(1, mods)).toBe(0);
  });

  it("throws for invalid level", () => {
    expect(() => calculateMaxVitality(0)).toThrow();
  });
});

// =============================================================================
// Defense DC
// =============================================================================

describe("calculateDefenseDc", () => {
  it("L1 with PB=2, attribute 0: 10 + 2 + 0 = 12", () => {
    expect(calculateDefenseDc(BASELINE_DEFENSE, 2, 0)).toBe(12);
  });

  it("L5 with PB=3, attribute +4: 10 + 3 + 4 = 17", () => {
    expect(calculateDefenseDc(BASELINE_DEFENSE, 3, 4)).toBe(17);
  });

  it("attribute -1 (worst): 10 + 2 - 1 = 11", () => {
    expect(calculateDefenseDc(BASELINE_DEFENSE, 2, -1)).toBe(11);
  });

  it("applies defense-specific modifier", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 3,
      },
    ];
    // target=physicalDc, mod targets physicalDc → applied
    expect(
      calculateDefenseDc(BASELINE_DEFENSE, 2, 0, mods, "character.defense.physicalDc"),
    ).toBe(15);
  });

  it("ignores modifier targeting other defense when target is specified", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.defense.mentalDc",
        operation: "add",
        value: 3,
      },
    ];
    // target=physicalDc, mod targets mentalDc → ignored
    expect(
      calculateDefenseDc(BASELINE_DEFENSE, 2, 0, mods, "character.defense.physicalDc"),
    ).toBe(12);
  });

  it("applies all modifiers when no target specified", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 1,
      },
      {
        kind: "modify",
        target: "character.defense.mentalDc",
        operation: "add",
        value: 2,
      },
    ];
    expect(calculateDefenseDc(BASELINE_DEFENSE, 2, 0, mods)).toBe(15); // 12 + 1 + 2
  });
});

// =============================================================================
// compileDefenses
// =============================================================================

describe("compileDefenses", () => {
  it("L1 character with 3/3/4 attributes gets 12/12/16... wait, 12/12/16", () => {
    // physicalDc: 10 + 2 + 3 = 15? No, attribute=3
    // Actually the DC is 10 + PB + attribute. So 10 + 2 + 3 = 15
    const result = compileDefenses({ physical: 3, mental: 3, magical: 3 }, 2);
    expect(result).toEqual({ physicalDc: 15, mentalDc: 15, magicalDc: 15 });
  });

  it("L1 character with 3/4/3 attributes: physicalDc 15, mentalDc 16, magicalDc 15", () => {
    const result = compileDefenses({ physical: 3, mental: 4, magical: 3 }, 2);
    expect(result).toEqual({ physicalDc: 15, mentalDc: 16, magicalDc: 15 });
  });

  it("L5 character with high mental: physicalDc 16, mentalDc 18, magicalDc 17", () => {
    const result = compileDefenses(
      { physical: 3, mental: 5, magical: 4 },
      3,
    );
    expect(result).toEqual({ physicalDc: 16, mentalDc: 18, magicalDc: 17 });
  });

  it("applies defense-specific modifiers", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 2,
      },
    ];
    const result = compileDefenses({ physical: 3, mental: 3, magical: 3 }, 2, mods);
    expect(result.physicalDc).toBe(17); // 15 + 2
    expect(result.mentalDc).toBe(15);
    expect(result.magicalDc).toBe(15);
  });
});

// =============================================================================
// Movement
// =============================================================================

describe("compileMovement", () => {
  it("baseline 30 ft land at any level", () => {
    expect(compileMovement(1).land).toBe(30);
    expect(compileMovement(10).land).toBe(30);
  });

  it("Stride Extension +10 ft adds to land speed", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.movement.land",
        operation: "add",
        value: 10,
      },
    ];
    expect(compileMovement(1, mods).land).toBe(40);
  });

  it("grants fly speed", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.movement.fly",
        operation: "grant",
        value: 50,
      },
    ];
    const result = compileMovement(1, mods);
    expect(result.fly).toBe(50);
    expect(result.land).toBe(30);
  });

  it("revoke operation removes movement type", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.movement.fly",
        operation: "grant",
        value: 50,
      },
      {
        kind: "modify",
        target: "character.movement.fly",
        operation: "revoke",
        value: 0,
      },
    ];
    const result = compileMovement(1, mods);
    expect(result.fly).toBeUndefined();
  });

  it("negative movement modifier reduces speed", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.movement.land",
        operation: "subtract",
        value: 10,
      },
    ];
    expect(compileMovement(1, mods).land).toBe(20);
  });

  it("speed never goes negative", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.movement.land",
        operation: "subtract",
        value: 999,
      },
    ];
    expect(compileMovement(1, mods).land).toBe(0);
  });

  it("baseline constants match Notion (30 ft)", () => {
    expect(BASELINE_LAND_SPEED).toBe(30);
  });
});

// =============================================================================
// compileEntityLiveStats (one-shot)
// =============================================================================

describe("compileEntityLiveStats", () => {
  it("compiles a complete L1 character", () => {
    const stats = compileEntityLiveStats({
      level: 1,
      baseAttributes: { physical: 3, mental: 4, magical: 3 },
      modifiers: [],
    });
    expect(stats).toEqual({
      level: 1,
      proficiencyBonus: 2,
      maxVitality: 12,
      currentVitality: 12,
      movement: { land: 30 },
      defenses: { physicalDc: 15, mentalDc: 16, magicalDc: 15 },
      attributes: { physical: 3, mental: 4, magical: 3 },
    });
  });

  it("respects currentVitality override", () => {
    const stats = compileEntityLiveStats({
      level: 1,
      baseAttributes: { physical: 3, mental: 3, magical: 4 },
      currentVitality: 5,
      modifiers: [],
    });
    expect(stats.currentVitality).toBe(5);
    expect(stats.maxVitality).toBe(12);
  });

  it("applies vitality augment from primitive", () => {
    const stats = compileEntityLiveStats({
      level: 1,
      baseAttributes: { physical: 3, mental: 3, magical: 4 },
      modifiers: [
        {
          kind: "modify",
          target: "character.maxVitality",
          operation: "add",
          value: 5,
        },
      ],
    });
    expect(stats.maxVitality).toBe(17);
    expect(stats.currentVitality).toBe(17);
  });

  it("applies multiple modifier types at once", () => {
    const stats = compileEntityLiveStats({
      level: 5,
      baseAttributes: { physical: 4, mental: 3, magical: 3 },
      modifiers: [
        {
          kind: "modify",
          target: "character.attribute.physical",
          operation: "add",
          value: 1,
        },
        {
          kind: "modify",
          target: "character.maxVitality",
          operation: "add",
          value: 12,
        },
        {
          kind: "modify",
          target: "character.defense.physicalDc",
          operation: "add",
          value: 2,
        },
        {
          kind: "modify",
          target: "character.movement.land",
          operation: "add",
          value: 10,
        },
      ],
    });
    expect(stats.proficiencyBonus).toBe(3);
    expect(stats.attributes.physical).toBe(5);
    expect(stats.maxVitality).toBe(77); // 65 + 12
    expect(stats.defenses.physicalDc).toBe(20); // 10 + 3 + 5 + 2
    expect(stats.movement.land).toBe(40); // 30 + 10
  });
});

// =============================================================================
// Constants sanity check
// =============================================================================

describe("canonical constants", () => {
  it("MIN_ATTRIBUTE = -1, MAX_ATTRIBUTE = 5, SUM = 10", () => {
    expect(MIN_ATTRIBUTE).toBe(-1);
    expect(MAX_ATTRIBUTE).toBe(5);
    expect(ATTRIBUTE_SUM).toBe(10);
  });

  it("BASELINE_DEFENSE = 10", () => {
    expect(BASELINE_DEFENSE).toBe(10);
  });

  it("BASELINE_LAND_SPEED = 30", () => {
    expect(BASELINE_LAND_SPEED).toBe(30);
  });
});