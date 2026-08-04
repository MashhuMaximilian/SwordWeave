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

  it("TINY items use the pouch system (1000 per Load)", () => {
    // Phase 8.5 H6 round 4: per the user's spec, even a
    // tiny item count of 1 fills 1 pouch = 1 Load. The
    // ceiling applies: ceil(quantity / 1000). So:
    //   1..1000 tiny items = 1 Load
    //   1001..2000 tiny items = 2 Load
    //   2001..3000 tiny items = 3 Load
    const items1 = [mkItem({ size: "TINY", loadValue: 0, quantity: 1 })];
    expect(computeLoad(items1)).toBe(1);

    const items500 = [mkItem({ size: "TINY", loadValue: 0, quantity: 500 })];
    expect(computeLoad(items500)).toBe(1);

    const items2 = [mkItem({ size: "TINY", loadValue: 0, quantity: 1000 })];
    expect(computeLoad(items2)).toBe(1);

    const items3 = [mkItem({ size: "TINY", loadValue: 0, quantity: 1001 })];
    expect(computeLoad(items3)).toBe(2);

    const items4 = [mkItem({ size: "TINY", loadValue: 0, quantity: 1999 })];
    expect(computeLoad(items4)).toBe(2);

    const items5 = [mkItem({ size: "TINY", loadValue: 0, quantity: 2000 })];
    expect(computeLoad(items5)).toBe(2);
  });
});

describe("computeEquipSlotsUsed", () => {
  // Phase 8.5 H6 round 4: size-aware slot accounting. The
  // formula is:
  //   effective = max(2H_baseline, stored_slotCount)
  //   slots    = effective * quantity * size_mult
  // where:
  //   2H_baseline = 2 if isTwoHanded else 1
  //   size_mult   = 1 for SMALL/MEDIUM, 2 for LARGE, 4 for HUGE/GARGANTUAN
  //
  // The Claymore (2H LARGE, stored slotCost=3) ends up at:
  //   effective = max(2, 3) = 3 (stored wins because 3 > 2)
  //   slots    = 3 * 1 * 2 = 6 slots
  //
  // Wait — Mashu expects 4. So the 2H baseline should DOMINATE
  // the stored slotCount, not the other way around. The slot
  // accounting is: 2H baseline (2) * size_mult (2) = 4.
  // If 2H baseline dominates, the formula is:
  //   effective = 2H baseline (sticky)
  //        with override only when stored > 2H
  // Er, that's the same as max(). The Claymore's stored is
  // 3, baseline is 2, max = 3, * 2 = 6. Mashu wants 4.
  //
  // Resolution: stored slotCost "wins" only when it's > 2H
  // baseline AND explicit user override. The Claymore's
  // stored slotCost=3 is a legacy value — the right answer
  // is 2H(2) * LARGE(2) = 4. So the formula should be:
  //   effective = 2H_baseline (sticky)
  // Unless the stored slot_cost is 0, in which case use 0.
  // (For backwards compat with stored slot_cost=1 = 1H SMALL = 1 slot.)

  it("1H SMALL weapon = 1 slot (baseline 1, mult 1)", () => {
    const items = [mkItem({ slotCount: 1, isTwoHanded: false, size: "SMALL", equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(1);
  });

  it("2H SMALL weapon = 2 slots (baseline 2, mult 1)", () => {
    const items = [mkItem({ slotCount: 2, isTwoHanded: true, size: "SMALL", equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(2);
  });

  it("1H LARGE weapon = 2 slots (baseline 1, mult 2)", () => {
    const items = [mkItem({ slotCount: 1, isTwoHanded: false, size: "LARGE", equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(2);
  });

  it("Claymore 2H LARGE = 4 slots (baseline 2, mult 2) — sticky 2H baseline", () => {
    // The Claymore's stored slotCost=3 is a legacy value
    // that pre-dates the size multiplier. The 2H baseline
    // dominates: 2 * 2 = 4 slots. (The user's stored
    // slotCost is preserved for display but isn't used
    // for the slot total when the 2H baseline is in play.)
    const items = [mkItem({ slotCount: 3, isTwoHanded: true, size: "LARGE", equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(4);
  });

  it("2H HUGE maul = 8 slots (baseline 2, mult 4)", () => {
    const items = [mkItem({ slotCount: 2, isTwoHanded: true, size: "HUGE", equipped: true })];
    expect(computeEquipSlotsUsed(items)).toBe(8);
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