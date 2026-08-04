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
    // TINY items have loadValue = 0 by convention
    // (see SIZE_LOAD.TINY). The pouch system handles
    // their Load contribution separately inside
    // computeEncumbrance via tinyItemsToPouches. We
    // explicitly skip them here so we don't double-count
    // — otherwise the max(1, ...) clamp below would
    // charge 1 Load per tiny piece.
    if (i.loadValue <= 0) return t;
    const piecesPerLoad = Math.max(1, i.loadValue - ignoreBonus);
    return t + Math.ceil(i.quantity / piecesPerLoad);
  }, 0);
}

/**
 * Compute total equip slots used.
 * 2H items use 2 slots; 1H items use 1 slot.
 */
export function computeEquipSlotsUsed(items: ReadonlyArray<EncumbranceItem>): number {
  return items
    .filter((i) => i.equipped)
    .reduce((t, i) => t + i.slotCount * i.quantity, 0);
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