import { describe, it, expect } from "vitest";
import {
  computeMaxVitality,
  computeVitalityModifiersFromPrimitives,
} from "../vitality";
import { proficiencyBonus } from "../practices";

describe("computeMaxVitality", () => {
  it("L1 base = (10 + PB) * 1 = (10 + 2) * 1 = 12", () => {
    expect(computeMaxVitality(1)).toBe((10 + proficiencyBonus(1)) * 1);
  });

  it("L5 base = (10 + PB) * 5", () => {
    expect(computeMaxVitality(5)).toBe((10 + proficiencyBonus(5)) * 5);
  });

  it("L20 base = (10 + PB) * 20", () => {
    expect(computeMaxVitality(20)).toBe((10 + proficiencyBonus(20)) * 20);
  });

  it("applies modifiers additively", () => {
    const base = computeMaxVitality(5);
    const withMods = computeMaxVitality(5, [
      { source: "Toughness", amount: 3 },
      { source: "Vitality Boost", amount: 5 },
    ]);
    expect(withMods).toBe(base + 8);
  });

  it("negative modifier reduces vitality", () => {
    const base = computeMaxVitality(5);
    const reduced = computeMaxVitality(5, [
      { source: "Withered", amount: -4 },
    ]);
    expect(reduced).toBe(base - 4);
  });

  it("empty modifiers = base", () => {
    expect(computeMaxVitality(5, [])).toBe(computeMaxVitality(5));
  });
});

describe("computeVitalityModifiersFromPrimitives", () => {
  // Phase 8.I i2 (Mashu 2026-08-04): the old name-match + buCost
  // proxy is gone. Vitality contributions now come from
  // hardModifiers targeting `max_vitality` with add/subtract ops.

  it("identifies vitality primitives via hardModifier target=max_vitality", () => {
    const prims = [
      {
        name: "Toughness",
        category: "character-sheet-augment",
        buCost: 4,
        hardModifiers: [
          { target: "max_vitality", operation: "add", value: 4 },
        ],
      },
      {
        name: "Fire Resistance",
        category: "defense",
        buCost: 3,
        hardModifiers: [
          { target: "resistance", operation: "grant", value: "fire" },
        ],
      },
      {
        name: "Vitality Boost",
        category: "character-sheet-augment",
        buCost: 5,
        hardModifiers: [
          { target: "max_vitality", operation: "add", value: 5 },
        ],
      },
    ];
    const mods = computeVitalityModifiersFromPrimitives(prims);
    expect(mods).toHaveLength(2);
    expect(mods.map((m) => m.source)).toEqual(["Toughness", "Vitality Boost"]);
  });

  it("a primitive WITHOUT a max_vitality modifier contributes nothing", () => {
    // Phase 8.I i2: the old "name includes 'hp'/'vitality'/'health'/'tough'"
    // heuristic is gone. A primitive named "HP Bonus" with no
    // hardModifier contributes 0 — the author must author the
    // modifier explicitly.
    const prims = [
      { name: "HP Bonus", category: "x", buCost: 2, hardModifiers: [] },
      { name: "Health Aura", category: "x", buCost: 4, hardModifiers: [] },
      { name: "Tough Skin", category: "x", buCost: 1, hardModifiers: [] },
    ];
    expect(computeVitalityModifiersFromPrimitives(prims)).toHaveLength(0);
  });

  it("empty list = no modifiers", () => {
    expect(computeVitalityModifiersFromPrimitives([])).toEqual([]);
  });

  it("reads value from hardModifier, not from buCost", () => {
    const prims = [
      {
        name: "Toughness",
        category: "x",
        buCost: 7,
        hardModifiers: [
          { target: "max_vitality", operation: "add", value: 7 },
        ],
      },
    ];
    const [mod] = computeVitalityModifiersFromPrimitives(prims);
    expect(mod?.amount).toBe(7);
  });

  it("mirrored primitive flips the sign", () => {
    const prims = [
      {
        name: "Vigorous",
        category: "character-sheet-augment",
        buCost: 5,
        isMirrored: true,
        hardModifiers: [
          { target: "max_vitality", operation: "add", value: 5 },
        ],
      },
    ];
    const [mod] = computeVitalityModifiersFromPrimitives(prims);
    expect(mod?.amount).toBe(-5);
  });

  it("subtract op contributes negatively", () => {
    const prims = [
      {
        name: "Withered",
        category: "x",
        buCost: 1,
        hardModifiers: [
          { target: "max_vitality", operation: "subtract", value: 4 },
        ],
      },
    ];
    const [mod] = computeVitalityModifiersFromPrimitives(prims);
    expect(mod?.amount).toBe(-4);
  });
});