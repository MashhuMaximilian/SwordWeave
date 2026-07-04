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
  it("identifies vitality primitives by name", () => {
    const prims = [
      { name: "Toughness", category: "character-sheet-augment", buCost: 4 },
      { name: "Fire Resistance", category: "defense", buCost: 3 },
      { name: "Vitality Boost", category: "character-sheet-augment", buCost: 5 },
    ];
    const mods = computeVitalityModifiersFromPrimitives(prims);
    expect(mods).toHaveLength(2);
    expect(mods.map((m) => m.source)).toEqual(["Toughness", "Vitality Boost"]);
  });

  it("identifies HP/Health/Tough in name", () => {
    const prims = [
      { name: "HP Bonus", category: "x", buCost: 2 },
      { name: "Health Aura", category: "x", buCost: 4 },
      { name: "Tough Skin", category: "x", buCost: 1 },
    ];
    expect(computeVitalityModifiersFromPrimitives(prims)).toHaveLength(3);
  });

  it("empty list = no modifiers", () => {
    expect(computeVitalityModifiersFromPrimitives([])).toEqual([]);
  });

  it("uses buCost as amount", () => {
    const prims = [
      { name: "Toughness", category: "x", buCost: 7 },
    ];
    const [mod] = computeVitalityModifiersFromPrimitives(prims);
    expect(mod?.amount).toBe(7);
  });
});