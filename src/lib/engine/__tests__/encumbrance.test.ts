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

  // Phase 8.5 / Session H6 (Mashu 2026-08-03): the
  // engine uses "pieces per Load" semantics. A LARGE
  // Claymore (loadValue=4) means 4 LARGE pieces fit in
  // 1 Load — so 4 pieces = 1 Load, 5 pieces = 2 Load.
  // Math: ceil(quantity / piecesPerLoad).
  it("sums ceil(quantity / piecesPerLoad)", () => {
    const items = [
      mkItem({ loadValue: 2, quantity: 3 }), // ceil(3/2) = 2
      mkItem({ loadValue: 1, quantity: 2 }), // ceil(2/1) = 2
    ];
    expect(computeLoad(items)).toBe(4);
  });

  it("single LARGE item = 1 Load", () => {
    // 1 LARGE piece = ceil(1/4) = 1 Load.
    const items = [mkItem({ loadValue: 4, quantity: 1 })];
    expect(computeLoad(items)).toBe(1);
  });

  it("4 LARGE items still = 1 Load", () => {
    // 4 LARGE pieces all fit in the same 1 Load slot.
    const items = [mkItem({ loadValue: 4, quantity: 4 })];
    expect(computeLoad(items)).toBe(1);
  });

  it("5 LARGE items = 2 Load (overflow)", () => {
    const items = [mkItem({ loadValue: 4, quantity: 5 })];
    expect(computeLoad(items)).toBe(2);
  });

  it("respects ignoreLoadBonus", () => {
    // piecesPerLoad = max(1, 5 - 3) = 2. ceil(1/2) = 1.
    const items = [
      mkItem({ loadValue: 5, ignoreLoadBonus: 3, quantity: 1 }),
    ];
    expect(computeLoad(items)).toBe(1);
  });

  it("clamps piecesPerLoad to >= 1 when bonus = load", () => {
    // piecesPerLoad = max(1, 2 - 5) = 1. ceil(1/1) = 1.
    const items = [
      mkItem({ loadValue: 2, ignoreLoadBonus: 5, quantity: 1 }),
    ];
    expect(computeLoad(items)).toBe(1);
  });

  it("TINY items (loadValue=0) contribute 0 to Load directly", () => {
    // TINY items use the pouch system; computeLoad skips
    // them so computeEncumbrance can sum the pouch count.
    const items = [mkItem({ loadValue: 0, quantity: 500 })];
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
    // Phase 8.5 H6: loadValue=5 means 5 pieces per Load.
    // ceil(10/5) = 2 Load.
    const items = [
      mkItem({ loadValue: 5, quantity: 10 }),
    ];
    const r = computeEncumbrance("MEDIUM", 0, items);
    expect(r.encumbered).toBe(false);
    expect(r.load).toBe(2);
    expect(r.capacity).toBe(40);
  });

  it("not encumbered under capacity", () => {
    // loadValue=5, qty=2 → ceil(2/5) = 1 Load.
    const items = [mkItem({ loadValue: 5, quantity: 2 })];
    const r = computeEncumbrance("MEDIUM", 0, items);
    expect(r.encumbered).toBe(false);
    expect(r.load).toBe(1);
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