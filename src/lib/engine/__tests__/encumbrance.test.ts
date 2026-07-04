import { describe, it, expect } from "vitest";
import {
  BASE_EQUIP_SLOTS,
  POUCH_LOAD_VALUE,
  SIZE_CAPACITY,
  SIZE_LOAD,
  TINY_ITEMS_PER_POUCH,
  computeCapacity,
  computeEncumbrance,
  computeEquipSlotsUsed,
  computeLoad,
  tinyItemsToPouches,
} from "../encumbrance";
import type { EncumbranceItem } from "../encumbrance";

const mkItem = (overrides: Partial<EncumbranceItem>): EncumbranceItem => ({
  size: "SMALL",
  loadValue: 1,
  slotCount: 1,
  capacityBonus: 0,
  ignoreLoadBonus: 0,
  quantity: 1,
  equipped: false,
  ...overrides,
});

describe("SIZE_CAPACITY", () => {
  it("canonical sizes", () => {
    expect(SIZE_CAPACITY.TINY).toBe(10);
    expect(SIZE_CAPACITY.SMALL).toBe(20);
    expect(SIZE_CAPACITY.MEDIUM).toBe(40);
    expect(SIZE_CAPACITY.LARGE).toBe(80);
    expect(SIZE_CAPACITY.HUGE).toBe(160);
    expect(SIZE_CAPACITY.GARGANTUAN).toBe(320);
  });
});

describe("SIZE_LOAD", () => {
  it("TINY = 0 (handled via pouches)", () => {
    expect(SIZE_LOAD.TINY).toBe(0);
  });
  it("MEDIUM = 2", () => {
    expect(SIZE_LOAD.MEDIUM).toBe(2);
  });
});

describe("BASE_EQUIP_SLOTS", () => {
  it("is 6", () => {
    expect(BASE_EQUIP_SLOTS).toBe(6);
  });
});

describe("computeCapacity", () => {
  it("Medium + Phys 0 = 40", () => {
    expect(computeCapacity("MEDIUM", 0, [])).toBe(40);
  });

  it("Medium + Phys +3 = 55 (40 + 15)", () => {
    expect(computeCapacity("MEDIUM", 3, [])).toBe(55);
  });

  it("includes item capacity bonuses", () => {
    const items = [
      mkItem({ capacityBonus: 20 }),
      mkItem({ capacityBonus: 5 }),
    ];
    expect(computeCapacity("MEDIUM", 3, items)).toBe(80);
  });

  it("negative phys mod is allowed", () => {
    expect(computeCapacity("MEDIUM", -1, [])).toBe(35);
  });
});

describe("computeLoad", () => {
  it("empty inventory = 0", () => {
    expect(computeLoad([])).toBe(0);
  });

  it("sums load * quantity", () => {
    const items = [
      mkItem({ loadValue: 2, quantity: 3 }), // 6
      mkItem({ loadValue: 1, quantity: 2 }), // 2
    ];
    expect(computeLoad(items)).toBe(8);
  });

  it("respects ignoreLoadBonus", () => {
    const items = [
      mkItem({ loadValue: 5, ignoreLoadBonus: 3 }), // effective 2
    ];
    expect(computeLoad(items)).toBe(2);
  });

  it("clamps to 0 when bonus > load", () => {
    const items = [
      mkItem({ loadValue: 2, ignoreLoadBonus: 5 }), // effective 0
    ];
    expect(computeLoad(items)).toBe(0);
  });
});

describe("computeEquipSlotsUsed", () => {
  it("2H item uses 2 slots", () => {
    const items = [mkItem({ slotCount: 2, equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(2);
  });

  it("only equipped items count", () => {
    const items = [
      mkItem({ equipped: true, slotCount: 1 }),
      mkItem({ equipped: false, slotCount: 1 }),
    ];
    expect(computeEquipSlotsUsed(items)).toBe(1);
  });

  it("quantity multiplies slot use", () => {
    const items = [mkItem({ slotCount: 1, quantity: 3, equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(3);
  });
});

describe("computeEncumbrance", () => {
  it("encumbered state is binary", () => {
    const items = [
      mkItem({ loadValue: 5, quantity: 10 }), // 50 load
    ];
    const r = computeEncumbrance("MEDIUM", 0, items);
    expect(r.encumbered).toBe(true);
    expect(r.load).toBe(50);
    expect(r.capacity).toBe(40);
  });

  it("not encumbered under capacity", () => {
    const items = [mkItem({ loadValue: 5, quantity: 2 })];
    const r = computeEncumbrance("MEDIUM", 0, items);
    expect(r.encumbered).toBe(false);
    expect(r.load).toBe(10);
  });

  it("tracks equip slots", () => {
    const items = [
      mkItem({ equipped: true, slotCount: 1 }),
      mkItem({ equipped: true, slotCount: 1 }),
      mkItem({ equipped: false, slotCount: 1 }),
    ];
    const r = computeEncumbrance("MEDIUM", 0, items);
    expect(r.equipSlotsUsed).toBe(2);
    expect(r.equipSlotsAvailable).toBe(6);
  });

  it("bonus slots add to available", () => {
    const r = computeEncumbrance("MEDIUM", 0, [], 2);
    expect(r.equipSlotsAvailable).toBe(8);
  });
});

describe("tinyItemsToPouches", () => {
  it("1000 tiny items = 1 pouch = 1 load", () => {
    const r = tinyItemsToPouches(1000);
    expect(r.pouches).toBe(1);
    expect(r.remainder).toBe(0);
    expect(r.load).toBe(POUCH_LOAD_VALUE);
  });

  it("2500 tiny items = 2 pouches + 500 remainder", () => {
    const r = tinyItemsToPouches(2500);
    expect(r.pouches).toBe(2);
    expect(r.remainder).toBe(500);
    expect(r.load).toBe(2);
  });

  it("TINY_ITEMS_PER_POUCH = 1000", () => {
    expect(TINY_ITEMS_PER_POUCH).toBe(1000);
  });

  it("less than 1000 = 0 pouches + all remainder", () => {
    const r = tinyItemsToPouches(500);
    expect(r.pouches).toBe(0);
    expect(r.remainder).toBe(500);
    expect(r.load).toBe(0);
  });
});