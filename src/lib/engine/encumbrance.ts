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
 * Phase 8.I i3 (Mashu): base walking speed per character size.
 * Swim/climb default to half this value (rounded up).
 */
export const SIZE_BASE_SPEED: Record<CharacterSize, number> = {
  TINY: 15,
  SMALL: 25,
  MEDIUM: 30,
  LARGE: 40,
  HUGE: 60,
  GARGANTUAN: 90,
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
  // Two-handed equipment has a two-slot baseline. Higher authored slot
  // requirements describe agreed bulk or other restrictions explicitly.
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
 * Equipped items use one slot, or two when two-handed, unless their
 * authored slot requirement is higher. Item size affects Load, not an
 * automatic slot multiplier. Unusual gear can have a table-agreed slot cost.
 */
export function computeEquipSlotsUsed(items: ReadonlyArray<EncumbranceItem>): number {
  return items
    .filter((i) => i.equipped)
    .reduce((total, item) => {
      const baseline = item.isTwoHanded === true ? 2 : 1;
      return total + Math.max(baseline, item.slotCount) * item.quantity;
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
  bonusCapacity: number = 0,
): EncumbranceBreakdown {
  const capacity = Math.max(0, Math.ceil(computeCapacity(size, physicalModifier, items) + bonusCapacity));
  const load = computeLoad(items);
  const equipSlotsUsed = computeEquipSlotsUsed(items);
  const equipSlotsAvailable = Math.max(0, Math.ceil(BASE_EQUIP_SLOTS + bonusSlots));
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
