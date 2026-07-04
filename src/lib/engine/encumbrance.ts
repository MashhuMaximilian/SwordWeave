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
 * @param items Items with quantity, equipped state
 */
export function computeLoad(items: ReadonlyArray<EncumbranceItem>): number {
  return items.reduce((t, i) => {
    const ignoreBonus = i.ignoreLoadBonus;
    const effective = Math.max(0, i.loadValue - ignoreBonus);
    return t + effective * i.quantity;
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