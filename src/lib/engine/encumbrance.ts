/**
 * Encumbrance engine — Phase 4.
 *
 * Per Notion:
 * - Size-based capacity: Tiny 10, Small 20, Medium 40, Large 80, Huge 160, Gargantuan 320
 * - Final capacity = sizeCapacity + (Physical mod × 5) + capability/item bonuses
 * - Tiny items in pouches (1000 = 1 Load)
 * - 6 universal equip slots (2H item = 2 slots)
 * - Binary encumbered state (Load > Capacity)
 */

export type CharacterSize =
  | "TINY"
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "HUGE"
  | "GARGANTUAN";

export const SIZE_CAPACITY: Record<CharacterSize, number> = {
  TINY: 10,
  SMALL: 20,
  MEDIUM: 40,
  LARGE: 80,
  HUGE: 160,
  GARGANTUAN: 320,
};

/**
 * SIZE_LOAD — Phase 8.5 / Session H6 (Mashu 2026-08-03)
 *
 * The number of pieces of a given size that fit in ONE
 * Load of encumbrance. Per Mashu's clarification: "1 Load
 * fits X quantity of this size" — not "this size costs X
 * Load per piece". So a LARGE Claymore costs 1 Load for
 * the first piece, but you can stack up to 4 LARGE
 * pieces in the same 1 Load before it ticks over to 2.
 *
 *   SMALL = 1 piece per Load
 *   MEDIUM = 2 pieces per Load
 *   LARGE = 4 pieces per Load
 *   HUGE = 8 pieces per Load
 *   GARGANTUAN = 16 pieces per Load
 *
 * TINY items use the pouch system (see TINY_ITEMS_PER_POUCH
 * below) rather than this table directly — 1000 tiny items
 * pack into a 1-Load pouch, anything leftover is loose.
 */
export const SIZE_LOAD: Record<CharacterSize, number> = {
  TINY: 0,
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 4,
  HUGE: 8,
  GARGANTUAN: 16,
};

export const BASE_EQUIP_SLOTS = 6;

export interface EncumbranceItem {
  readonly size: CharacterSize;
  readonly loadValue: number;
  readonly slotCount: number;
  // Phase 8.5 / Session H6 round 4 (Mashu 2026-08-03):
  // isTwoHanded is the inline source of the 2H slot
  // baseline (2 slots). Without it the engine can't
  // distinguish a 1H LARGE weapon (slot baseline 1, *2 size
  // = 2 slots) from a 2H LARGE weapon (slot baseline 2,
  // *2 size = 4 slots). Optional so legacy callers without
  // the field still compile; defaults to false.
  readonly isTwoHanded?: boolean;
  readonly capacityBonus: number;
  readonly ignoreLoadBonus: number;
  readonly quantity: number;
  readonly equipped: boolean;
}

export interface EncumbranceBreakdown {
  readonly capacity: number;
  readonly load: number;
  readonly equipSlotsUsed: number;
  readonly equipSlotsAvailable: number;
  readonly encumbered: boolean;
  readonly percentOfCapacity: number;
}

/**
 * Compute total carry capacity for a character.
 *
 * @param size Character size
 * @param physicalModifier Slice value from physical attribute (e.g. +3)
 * @param items Items providing capacity bonuses
 */
export function computeCapacity(
  size: CharacterSize,
  physicalModifier: number,
  items: ReadonlyArray<EncumbranceItem> = [],
): number {
  const sizeCap = SIZE_CAPACITY[size];
  const physBonus = physicalModifier * 5;
  const itemBonus = items.reduce((t, i) => t + i.capacityBonus, 0);
  return sizeCap + physBonus + itemBonus;
}

/**
 * Compute total load from carried items.
 * Equipped items ALSO contribute to load (per Notion).
 *
 * Phase 8.5 / Session H6 (Mashu 2026-08-03): Load math
 * inverted from "Load-per-piece" to "pieces-per-Load".
 * Previously the engine summed `loadValue * quantity`
 * (treating SIZE_LOAD[size] as the Load cost per piece),
 * which made a single LARGE Claymore cost 4 Load. The
 * correct rule per the user's spec is "1 Load fits N
 * pieces" — so a LARGE Claymore costs 1 Load for the
 * first piece, and stacking 4 LARGE pieces still costs
 * only 1 Load (all four fit in the same Load slot). The
 * 5th LARGE piece overflows to 2 Load, etc. Math:
 *
 *   load_per_item_type = ceil(quantity / SIZE_LOAD[size])
 *
 * TINY items use the pouch system instead — handled by
 * `tinyItemsToPouches` in computeEncumbrance, not here.
 */
export function computeLoad(items: ReadonlyArray<EncumbranceItem>): number {
  return items.reduce((t, i) => {
    const ignoreBonus = i.ignoreLoadBonus;
    // Phase 8.5 / Session H6 round 5 (Mashu 2026-08-03):
    // Load math REVERTED to the original spec. The user's
    // canonical table (the encumbrance popup's SIZE / CAPACITY
    // / LOAD-ITEM rows) shows:
    //   tiny = 0* (pouch system)
    //   small = 1 Load per item
    //   medium = 2 Load per item
    //   large = 4 Load per item
    //   huge = 8 Load per item
    //   gargantuan = 16 Load per item
    // Total Load = SIZE_LOAD[size] * quantity.
    //
    // Round 4 inverted this thinking Mashu meant "pieces
    // per Load" — but the table on the encumbrance popup
    // is unambiguous: LOAD-ITEM = Load cost per piece.
    // A single LARGE Claymore = 4 Load. 1000 gold coins
    // (TINY) = 1 Load via the pouch rule, 2000 = 2 Load.
    if (i.size === "TINY") {
      const effectiveQty = Math.max(0, i.quantity - ignoreBonus);
      return t + Math.ceil(effectiveQty / TINY_ITEMS_PER_POUCH);
    }
    const loadPerItem = Math.max(0, i.loadValue - ignoreBonus);
    return t + loadPerItem * i.quantity;
  }, 0);
}

/**
 * Compute total equip slots used.
 *
 * Phase 8.5 / Session H6 round 4 (Mashu 2026-08-03):
 * size-aware slot accounting. The slot count for an
 * equipped item is the max of its stored slotCount
 * (user-editable on the item) and the size-derived
 * baseline:
 *
 *   2H items: baseline 2 slots (regardless of size)
 *   1H items: baseline 1 slot
 *
 * Then multiplied by a size multiplier:
 *   TINY=1, SMALL=1, MEDIUM=1, LARGE=2, HUGE=4, GARGANTUAN=4
 *
 * So a 2H LARGE weapon = max(2, slotCost) * 2 = 4 slots.
 * A 1H SMALL dagger = max(1, slotCost) * 1 = 1 slot.
 * A 2H HUGE maul = max(2, slotCost) * 4 = 8 slots.
 *
 * The user's expectation (the Claymore is 2H LARGE so it
 * should take 4 slots; the previous round was 1 slot):
 * the size multiplier was missing. Now applied.
 *
 * @param items Items with equipped state, slotCount,
 *              size, and quantity
 */
export function computeEquipSlotsUsed(items: ReadonlyArray<EncumbranceItem>): number {
  return items
    .filter((i) => i.equipped)
    .reduce((t, i) => {
      // Size multiplier — the LARGE / HUGE / GARGANTUAN
      // categories occupy more than 1 base slot.
      const SIZE_SLOT_MULT: Record<CharacterSize, number> = {
        TINY: 1,
        SMALL: 1,
        MEDIUM: 1,
        LARGE: 2,
        HUGE: 4,
        GARGANTUAN: 4,
      };
      const mult = SIZE_SLOT_MULT[i.size] ?? 1;
      // Phase 8.5 H6 round 5 (Mashu 2026-08-03):
      // size-aware slot accounting with the user's
      // stored slotCost as the authoritative number when
      // it's >= the 2H baseline.
      //
      // Per the user's spec (round 5 message.txt):
      // - 2H items use AT LEAST 2 slots (the baseline).
      // - The user can set slotCost in the builder form;
      //   when slotCost > 2H baseline, the stored value
      //   wins (e.g. Claymore 2H with stored slotCost=3
      //   = 3 equipped slots).
      // - The size of the item is a multiplier on top of the
      //   baseline (LARGE = 2x, HUGE = 4x, GARGANTUAN = 4x).
      //
      // Final: slots = max(stored_slotCost, 2H_baseline)
      //              * size_mult * quantity
      //
      // Example: Claymore 2H LARGE, stored=3:
      //   max(3, 2) = 3, * 2 (LARGE) * 1 = 6 slots.
      // But the user said the Claymore should be 3, not 6.
      // So the size multiplier is ONLY for size >= MEDIUM
      // when the stored slotCost is the 2H baseline (2).
      // If stored > 2H baseline, the stored value IS the
      // slot count and the size multiplier does NOT apply.
      //
      // Simpler: slots = max(stored_slotCost, 2H_baseline)
      // * quantity. The size multiplier is ignored when
      // stored > 2H baseline.
      //
      // Round 5's reconciliation: the user explicitly set
      // slotCost=3 on the Claymore. They want 3 slots, not 6.
      // The size multiplier cancels out when the stored
      // value is the authoritative one. Translation: the
      // 2H baseline is 2; the user's stored value (3)
      // wins over the size multiplier. Final = 3 slots.
      const baseline = i.isTwoHanded === true ? 2 : 1;
      const effective = Math.max(baseline, i.slotCount);
      // If stored > 2H baseline, the stored value is
      // authoritative (no size multiplier — the user
      // already paid the size into the stored value).
      // If stored == 2H baseline, size multiplier applies.
      const finalMult = i.slotCount > baseline ? 1 : mult;
      return t + effective * i.quantity * finalMult;
    }, 0);
}

/**
 * Full encumbrance breakdown.
 */
export function computeEncumbrance(
  size: CharacterSize,
  physicalModifier: number,
  items: ReadonlyArray<EncumbranceItem>,
  bonusSlots: number = 0,
): EncumbranceBreakdown {
  const capacity = computeCapacity(size, physicalModifier, items);
  const load = computeLoad(items);
  const equipSlotsUsed = computeEquipSlotsUsed(items);
  const equipSlotsAvailable = BASE_EQUIP_SLOTS + bonusSlots;
  const encumbered = load > capacity;
  const percentOfCapacity =
    capacity > 0 ? Math.round((load / capacity) * 100) : 0;

  return {
    capacity,
    load,
    equipSlotsUsed,
    equipSlotsAvailable,
    encumbered,
    percentOfCapacity,
  };
}

/**
 * Capacity for tiny item pouches: 1 pouch = up to 1000 tiny items = 1 Load.
 */
export const TINY_ITEMS_PER_POUCH = 1000;
export const POUCH_LOAD_VALUE = 1;

/**
 * Convert a quantity of tiny items into pouches.
 */
export function tinyItemsToPouches(tinyItemCount: number): {
  readonly pouches: number;
  readonly remainder: number;
  readonly load: number;
} {
  const pouches = Math.floor(tinyItemCount / TINY_ITEMS_PER_POUCH);
  const remainder = tinyItemCount % TINY_ITEMS_PER_POUCH;
  const load = pouches * POUCH_LOAD_VALUE;
  return { pouches, remainder, load };
}