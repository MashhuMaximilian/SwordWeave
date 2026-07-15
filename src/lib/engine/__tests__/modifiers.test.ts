/**
 * modifiers.test.ts — Hard Modifier evaluation, stacking, damage resolution
 */
import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  applyOperation,
  applyStacking,
  evaluateModifiers,
  evaluateTarget,
  resolveDamageApplication,
  type EvaluationContext,
} from "../modifiers";
import type {
  HardModifier,
  ModifierCondition,
  ModifierStackingMode,
} from "@/types/swordweave";

const baseContext: EvaluationContext = {
  character: {
    id: "char-1",
    level: 1,
    attributes: { physical: 3, mental: 4, magical: 3 },
  },
};

// =============================================================================
// applyOperation
// =============================================================================

describe("applyOperation", () => {
  it("adds to base", () => {
    expect(applyOperation(5, "add", 3)).toBe(8);
  });

  it("subtracts from base", () => {
    expect(applyOperation(10, "subtract", 3)).toBe(7);
  });

  it("multiplies base", () => {
    expect(applyOperation(4, "multiply", 2)).toBe(8);
  });

  it("divides base", () => {
    expect(applyOperation(10, "divide", 2)).toBe(5);
  });

  it("returns base when dividing by zero", () => {
    expect(applyOperation(10, "divide", 0)).toBe(10);
  });

  it("takes min", () => {
    expect(applyOperation(5, "min", 3)).toBe(3);
  });

  it("takes max", () => {
    expect(applyOperation(5, "max", 10)).toBe(10);
  });

  it("sets to value", () => {
    expect(applyOperation(5, "set", 42)).toBe(42);
  });

  it("grant sets if base is zero", () => {
    expect(applyOperation(0, "grant", 50)).toBe(50);
  });

  it("grant keeps existing value", () => {
    expect(applyOperation(30, "grant", 50)).toBe(30);
  });

  it("revoke zeroes numbers", () => {
    expect(applyOperation(30, "revoke", 0)).toBe(0);
  });

  it("toggle flips boolean", () => {
    expect(applyOperation(true, "toggle", false)).toBe(false);
  });

  it("returns base unchanged for non-numeric add", () => {
    expect(applyOperation("hello", "add", 1)).toBe("hello");
  });

  it("coerces numeric strings", () => {
    expect(applyOperation(5, "add", "3")).toBe(8);
  });
});

// =============================================================================
// applyStacking
// =============================================================================

describe("applyStacking", () => {
  it("stack sums numeric values", () => {
    expect(applyStacking([2, 3, 4], "stack")).toBe(9);
  });

  it("highest-only picks max", () => {
    expect(applyStacking([2, 5, 3], "highest-only")).toBe(5);
  });

  it("lowest-only picks min", () => {
    expect(applyStacking([2, 5, 3], "lowest-only")).toBe(2);
  });

  it("empty array returns 0", () => {
    expect(applyStacking([], "stack")).toBe(0);
  });

  it("non-numeric with stack returns last", () => {
    expect(applyStacking(["a", "b", "c"], "stack")).toBe("c");
  });

  it("non-numeric with highest-only returns first", () => {
    expect(applyStacking(["a", "b", "c"], "highest-only")).toBe("a");
  });
});

// =============================================================================
// evaluateCondition
// =============================================================================

describe("evaluateCondition", () => {
  it("returns true when no condition", () => {
    expect(evaluateCondition(undefined, baseContext)).toBe(true);
  });

  it("equals matches exact value", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "equals",
      value: 1,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("equals rejects different value", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "equals",
      value: 5,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(false);
  });

  it("not-equals returns true when values differ", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "not-equals",
      value: 5,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("greater-than works numerically", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "greater-than",
      value: 0,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("less-than works numerically", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "less-than",
      value: 10,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("less-than false when equal", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "less-than",
      value: 1,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(false);
  });

  it("less-than-or-equal true when equal", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "less-than-or-equal",
      value: 1,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("greater-than-or-equal true when equal", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "greater-than-or-equal",
      value: 1,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("includes checks string substrings", () => {
    const ctx: EvaluationContext = {
      ...baseContext,
      effect: { id: "fx-1", name: "fire_damage" },
    };
    const cond: ModifierCondition = {
      key: "effect.name",
      operator: "includes",
      value: "fire",
    };
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });

  it("exists true when key present", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "exists",
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("exists false when key absent", () => {
    const cond: ModifierCondition = {
      key: "nonexistent.key",
      operator: "exists",
    };
    expect(evaluateCondition(cond, baseContext)).toBe(false);
  });

  it("works with custom environment keys", () => {
    const ctx: EvaluationContext = {
      ...baseContext,
      environment: { "weather": "rainy" },
    };
    const cond: ModifierCondition = {
      key: "weather",
      operator: "equals",
      value: "rainy",
    };
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });

  // =================================================================
  // Phase-7-Q-B: v1 condition shapes — engine returns true for all
  // v1 conditions in v1 (DM adjudicates at the table).
  // =================================================================
  it("v1 preset condition always evaluates to true (DM adjudicates)", () => {
    const cond = {
      kind: "preset",
      presetKey: "target-prone",
      customTags: [],
    } as const;
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("v1 narrative condition always evaluates to true", () => {
    const cond = { kind: "narrative", text: "during a full moon" } as const;
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("v1 tags condition always evaluates to true", () => {
    const cond = { kind: "tags", customTags: ["smell", "fog"] } as const;
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("v1 preset with custom tags still evaluates to true", () => {
    const cond = {
      kind: "preset",
      presetKey: "actor-below-half-hp",
      customTags: ["tracking"],
    } as const;
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });

  it("legacy condition with explicit legacy triple still works", () => {
    const cond: ModifierCondition = {
      key: "character.level",
      operator: "equals",
      value: 1,
    };
    expect(evaluateCondition(cond, baseContext)).toBe(true);
  });
});

// =============================================================================
// evaluateModifiers
// =============================================================================

describe("evaluateModifiers", () => {
  it("returns empty record when no modifiers", () => {
    expect(evaluateModifiers([], baseContext)).toEqual({});
  });

  it("groups modifiers by target", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 1,
      },
      {
        kind: "modify",
        target: "character.attribute.mental",
        operation: "add",
        value: 2,
      },
    ];
    const result = evaluateModifiers(mods, baseContext);
    expect(result["character.attribute.physical"]).toBe(1);
    expect(result["character.attribute.mental"]).toBe(2);
  });

  it("stacks multiple modifiers on same target", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 2,
      },
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 1,
      },
    ];
    const result = evaluateModifiers(mods, baseContext);
    expect(result["character.defense.physicalDc"]).toBe(3);
  });

  it("filters by condition", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 5,
        condition: {
          key: "character.level",
          operator: "equals",
          value: 5, // doesn't match L1
        },
      },
    ];
    const result = evaluateModifiers(mods, baseContext);
    expect(result["character.attribute.physical"]).toBeUndefined();
  });

  it("applies modifiers when condition matches", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 5,
        condition: {
          key: "character.level",
          operator: "equals",
          value: 1, // matches L1
        },
      },
    ];
    const result = evaluateModifiers(mods, baseContext);
    expect(result["character.attribute.physical"]).toBe(5);
  });

  it("respects highest-only stacking", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 1,
        stacking: "highest-only",
      },
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 3,
        stacking: "highest-only",
      },
      {
        kind: "modify",
        target: "character.defense.physicalDc",
        operation: "add",
        value: 2,
        stacking: "highest-only",
      },
    ];
    const result = evaluateModifiers(mods, baseContext);
    expect(result["character.defense.physicalDc"]).toBe(3);
  });
});

// =============================================================================
// evaluateTarget
// =============================================================================

describe("evaluateTarget", () => {
  it("returns null when no modifiers match", () => {
    expect(evaluateTarget([], "character.attribute.physical", baseContext)).toBeNull();
  });

  it("returns single modifier's contribution", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 5,
      },
    ];
    expect(evaluateTarget(mods, "character.attribute.physical", baseContext)).toBe(5);
  });

  it("returns highest-only when stacking specified", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 5,
        stacking: "highest-only",
      },
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 2,
        stacking: "highest-only",
      },
    ];
    expect(evaluateTarget(mods, "character.attribute.physical", baseContext)).toBe(5);
  });

  it("returns null when condition blocks all modifiers", () => {
    const mods: HardModifier[] = [
      {
        kind: "modify",
        target: "character.attribute.physical",
        operation: "add",
        value: 5,
        condition: { key: "character.level", operator: "equals", value: 99 },
      },
    ];
    expect(evaluateTarget(mods, "character.attribute.physical", baseContext)).toBeNull();
  });
});

// =============================================================================
// resolveDamageApplication (canonical: largest applies, does NOT stack)
// =============================================================================

describe("resolveDamageApplication", () => {
  it("applies single resistance subtract modifier", () => {
    const resistMod: HardModifier = {
      kind: "modify",
      target: "damage.resistance",
      operation: "subtract",
      value: 3,
      metadata: { damageType: "fire" },
    };
    const result = resolveDamageApplication({
      baseDamage: 20,
      damageType: "fire",
      resistanceModifiers: [resistMod],
      vulnerabilityModifiers: [],
      context: baseContext,
    });
    expect(result.finalDamage).toBe(17);
    expect(result.resisted).toBe(true);
    expect(result.vulnerable).toBe(false);
  });

  it("applies single vulnerability multiplier", () => {
    const vulnMod: HardModifier = {
      kind: "modify",
      target: "damage.vulnerability",
      operation: "multiply",
      value: 2,
      metadata: { damageType: "fire" },
    };
    const result = resolveDamageApplication({
      baseDamage: 10,
      damageType: "fire",
      resistanceModifiers: [],
      vulnerabilityModifiers: [vulnMod],
      context: baseContext,
    });
    expect(result.finalDamage).toBe(20);
    expect(result.vulnerable).toBe(true);
  });

  it("largest resistance applies (does NOT stack)", () => {
    const smallResist: HardModifier = {
      kind: "modify",
      target: "damage.resistance",
      operation: "subtract",
      value: 2,
      metadata: { damageType: "fire" },
    };
    const largeResist: HardModifier = {
      kind: "modify",
      target: "damage.resistance",
      operation: "subtract",
      value: 5,
      metadata: { damageType: "fire" },
    };
    const result = resolveDamageApplication({
      baseDamage: 20,
      damageType: "fire",
      resistanceModifiers: [smallResist, largeResist],
      vulnerabilityModifiers: [],
      context: baseContext,
    });
    // Largest reduction wins: -5 (NOT -2 + -5 = -7)
    expect(result.finalDamage).toBe(15);
  });

  it("filters modifiers by damage type", () => {
    const fireResist: HardModifier = {
      kind: "modify",
      target: "damage.resistance",
      operation: "subtract",
      value: 10,
      metadata: { damageType: "fire" },
    };
    const result = resolveDamageApplication({
      baseDamage: 20,
      damageType: "cold", // not fire
      resistanceModifiers: [fireResist],
      vulnerabilityModifiers: [],
      context: baseContext,
    });
    expect(result.finalDamage).toBe(20); // fire resistance doesn't apply to cold
    expect(result.resisted).toBe(false);
  });

  it("'all' damage type applies to any", () => {
    const omniResist: HardModifier = {
      kind: "modify",
      target: "damage.resistance",
      operation: "subtract",
      value: 5,
      metadata: { damageType: "all" },
    };
    const result = resolveDamageApplication({
      baseDamage: 20,
      damageType: "psychic",
      resistanceModifiers: [omniResist],
      vulnerabilityModifiers: [],
      context: baseContext,
    });
    expect(result.finalDamage).toBe(15);
  });

  it("damage cannot go below 0", () => {
    const hugeResist: HardModifier = {
      kind: "modify",
      target: "damage.resistance",
      operation: "subtract",
      value: 999,
      metadata: { damageType: "all" },
    };
    const result = resolveDamageApplication({
      baseDamage: 10,
      damageType: "fire",
      resistanceModifiers: [hugeResist],
      vulnerabilityModifiers: [],
      context: baseContext,
    });
    expect(result.finalDamage).toBe(0);
  });

  it("resistance and vulnerability both apply", () => {
    const resist: HardModifier = {
      kind: "modify",
      target: "damage.resistance",
      operation: "subtract",
      value: 3,
      metadata: { damageType: "fire" },
    };
    const vuln: HardModifier = {
      kind: "modify",
      target: "damage.vulnerability",
      operation: "add",
      value: 5,
      metadata: { damageType: "fire" },
    };
    const result = resolveDamageApplication({
      baseDamage: 20,
      damageType: "fire",
      resistanceModifiers: [resist],
      vulnerabilityModifiers: [vuln],
      context: baseContext,
    });
    // 20 - 3 + 5 = 22
    expect(result.finalDamage).toBe(22);
    expect(result.resisted).toBe(true);
    expect(result.vulnerable).toBe(true);
  });
});