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
  it("sums loadValue * quantity", () => {
    const items = [
      mkItem({ loadValue: 2, quantity: 3 }), // 6
      mkItem({ loadValue: 1, quantity: 2 }), // 2
    ];
    expect(computeLoad(items)).toBe(8);
  });

  it("single LARGE item = 4 Load (size_load[size])", () => {
    // Phase 8.5 H6 round 5: revert. LARGE = 4 Load per
    // piece. Same as the table shows: large 80 4.
    const items = [mkItem({ size: "LARGE", loadValue: 4, quantity: 1 })];
    expect(computeLoad(items)).toBe(4);
  });

  it("2 LARGE items = 8 Load (stacking multiplies)", () => {
    const items = [mkItem({ size: "LARGE", loadValue: 4, quantity: 2 })];
    expect(computeLoad(items)).toBe(8);
  });

  it("MEDIUM item (2 Load per piece) × 3 quantity = 6 Load", () => {
    const items = [mkItem({ size: "MEDIUM", loadValue: 2, quantity: 3 })];
    expect(computeLoad(items)).toBe(6);
  });

  it("TINY items use the pouch system (1000 per Load)", () => {
    // Per the user's spec: 1..1000 tiny items = 1 Load,
    // 1001..2000 = 2 Load, 2001..3000 = 3 Load. Math:
    // ceil(quantity / 1000).
    const items1 = [mkItem({ size: "TINY", loadValue: 0, quantity: 1 })];
    expect(computeLoad(items1)).toBe(1);
    const items500 = [mkItem({ size: "TINY", loadValue: 0, quantity: 500 })];
    expect(computeLoad(items500)).toBe(1);
    const items1000 = [mkItem({ size: "TINY", loadValue: 0, quantity: 1000 })];
    expect(computeLoad(items1000)).toBe(1);
    const items1001 = [mkItem({ size: "TINY", loadValue: 0, quantity: 1001 })];
    expect(computeLoad(items1001)).toBe(2);
    const items2000 = [mkItem({ size: "TINY", loadValue: 0, quantity: 2000 })];
    expect(computeLoad(items2000)).toBe(2);
  });

describe("computeEquipSlotsUsed", () => {
  it("ordinary items use one slot regardless of size", () => {
    for (const size of ["SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const) {
      expect(computeEquipSlotsUsed([mkItem({ slotCount: 1, isTwoHanded: false, size, equipped: true })])).toBe(1);
    }
  });

  it("two-handed items use two slots regardless of size", () => {
    for (const size of ["SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const) {
      expect(computeEquipSlotsUsed([mkItem({ slotCount: 2, isTwoHanded: true, size, equipped: true })])).toBe(2);
    }
  });

  it("enforces the two-handed baseline for legacy one-slot items", () => {
    expect(computeEquipSlotsUsed([mkItem({ slotCount: 1, isTwoHanded: true, size: "LARGE", equipped: true })])).toBe(2);
  });

  it("respects a higher authored requirement without multiplying it by size", () => {
    expect(computeEquipSlotsUsed([mkItem({ slotCount: 3, isTwoHanded: true, size: "LARGE", equipped: true })])).toBe(3);
    expect(computeEquipSlotsUsed([mkItem({ slotCount: 4, isTwoHanded: false, size: "HUGE", equipped: true })])).toBe(4);
  });

  it("only equipped items count", () => {
    const items = [
      mkItem({ slotCount: 1, isTwoHanded: false, size: "SMALL", equipped: true }),
      mkItem({ slotCount: 1, isTwoHanded: false, size: "SMALL", equipped: false }),
    ];
    expect(computeEquipSlotsUsed(items)).toBe(1);
  });

  it("quantity multiplies slot use", () => {
    const items = [mkItem({ slotCount: 1, quantity: 3, isTwoHanded: false, size: "SMALL", equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(3);
  });
});

describe("computeEncumbrance", () => {
  it("encumbered state is binary", () => {
    // loadValue=5, qty=10 → 5*10 = 50 Load. > 40 capacity → encumbered.
    const items = [
      mkItem({ loadValue: 5, quantity: 10 }),
    ];
    const r = computeEncumbrance("MEDIUM", 0, items);
    expect(r.encumbered).toBe(true);
    expect(r.load).toBe(50);
    expect(r.capacity).toBe(40);
  });

  it("not encumbered under capacity", () => {
    // loadValue=5, qty=2 → 10 Load. ≤ 40 capacity → not encumbered.
    const items = [mkItem({ loadValue: 5, quantity: 2 })];
    const r = computeEncumbrance("MEDIUM", 0, items);
    expect(r.encumbered).toBe(false);
    expect(r.load).toBe(10);
    expect(r.load).toBeLessThanOrEqual(r.capacity);
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
})
