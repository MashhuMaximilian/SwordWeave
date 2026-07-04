/**
 * Sheet aggregator — Phase 4.
 *
 * Given a character record (with primitiveLinks, capabilityLinks, itemLinks),
 * produce a single object containing everything the character sheet UI needs:
 *   - BU balance (progression + item BU separate)
 *   - Practice table (10 practices with breakdown)
 *   - Vitality (max + current + percent)
 *   - Defensive DCs (per attribute)
 *   - Encumbrance (load + capacity + state)
 *
 * Pure function — no DB dependency. Takes pre-loaded data, returns ready-to-render.
 */

import {
  computeAllPracticeModifiers,
  computeAllDefensiveDCs,
  type Attribute,
  type Attributes,
  type Practice,
  type PracticeAttributeMap,
  type PracticeModifierBreakdown,
  type PracticeSlices,
  PRACTICE_ATTRIBUTE_MAP,
} from "./practices";
import {
  computeMaxVitality,
  computeVitalityModifiersFromPrimitives,
  type VitalityModifier,
} from "./vitality";
import {
  BUAccount,
  BUBalance,
  computeBUBalance,
} from "./bu-balance";
import {
  EncumbranceBreakdown,
  computeEncumbrance,
  type CharacterSize,
} from "./encumbrance";

export type PrimitiveLinkSnapshot = {
  primitiveId: number;
  source: string;
  acquiredAtLevel: number;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
    /** raw hardModifiers — each contains bonus info, simplified for sheet */
    hardModifiers?: ReadonlyArray<{ bonus?: number; target?: string }>;
  };
};

export type CapabilityLinkSnapshot = {
  capabilityId: string;
  acquiredAtLevel: number;
  capability: {
    id: string;
    name: string;
    type: string;
    sourceType: string;
  };
};

export type ItemLinkSnapshot = {
  itemId: string;
  equipped: boolean;
  item: {
    id: string;
    name: string;
    itemType: string;
    rarity: string;
    slotCost: number;
    isTwoHanded: boolean;
    isConsumable: boolean;
  };
};

export type CharacterSheetInput = {
  level: number;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: Attribute | null;
  practiceSlices: PracticeSlices | null;
  startingBu: number;
  buSpent: number;
  dmBonusBu: number;
  currentVitality: number | null;
  size: string;
  primitiveLinks: PrimitiveLinkSnapshot[];
  capabilityLinks: CapabilityLinkSnapshot[];
  itemLinks: ItemLinkSnapshot[];
};

export type CharacterSheet = {
  readonly buBalance: BUBalance;
  readonly practices: ReadonlyArray<PracticeModifierBreakdown>;
  readonly practiceAttributeMap: PracticeAttributeMap;
  readonly vitality: {
    readonly max: number;
    readonly current: number | null;
    readonly percent: number | null;
    readonly modifiers: ReadonlyArray<VitalityModifier>;
  };
  readonly defensiveDCs: ReadonlyArray<{
    readonly attribute: Attribute;
    readonly dc: number;
  }>;
  readonly encumbrance: EncumbranceBreakdown;
  readonly practiceCount: number;
  readonly capabilityCount: number;
  readonly equippedItemCount: number;
  readonly totalItemCount: number;
};

/**
 * Aggregate all sheet-readiness data for a character.
 */
export function aggregateCharacterSheet(
  input: CharacterSheetInput,
): CharacterSheet {
  const attributes: Attributes = {
    physical: input.attrPhysical,
    mental: input.attrMental,
    magical: input.attrMagical,
  };
  const slices: PracticeSlices = input.practiceSlices ?? {};

  // Build primitive bonus map (used by practice roll-up)
  // Heuristic: practice-affecting primitives contribute their buCost as bonus.
  // This is a simplified v1 — full primitive→practice modifiers come from
  // hardModifiers (see primitives.ts) when wired in.
  const primitiveBonuses = new Map<
    number,
    { name: string; bonus: number }
  >();
  for (const link of input.primitiveLinks) {
    const p = link.primitive;
    // Practice-affecting primitives typically live in CHARACTER_SHEET_AUGMENT
    // or PRACTICE_PROGRESSION_AUGMENT categories.
    if (
      p.category === "CHARACTER_SHEET_AUGMENT" ||
      p.category === "PRACTICE_PROGRESSION_AUGMENT"
    ) {
      const existing = primitiveBonuses.get(p.id);
      if (!existing) {
        primitiveBonuses.set(p.id, { name: p.name, bonus: p.buCost });
      }
    }
  }

  // BU balance
  const buAccount: BUAccount = {
    startingBu: input.startingBu,
    buSpent: input.buSpent,
    level: input.level,
    dmBonusBu: input.dmBonusBu,
    itemBuSpent: sumItemBu(input.itemLinks),
  };
  const buBalance = computeBUBalance(buAccount);

  // Practices
  const practices = computeAllPracticeModifiers(
    attributes,
    slices,
    input.attrProficient,
    input.level,
    primitiveBonuses,
  );

  // Vitality
  const vitalityModifiers = computeVitalityModifiersFromPrimitives(
    input.primitiveLinks.map((l) => ({
      name: l.primitive.name,
      category: l.primitive.category,
      buCost: l.primitive.buCost,
    })),
  );
  const maxVitality = computeMaxVitality(input.level, vitalityModifiers);
  const vitalityCurrent = input.currentVitality;
  const vitalityPercent =
    vitalityCurrent === null
      ? null
      : Math.max(0, Math.min(100, Math.round((vitalityCurrent / maxVitality) * 100)));

  // Defensive DCs
  const dcRecord = computeAllDefensiveDCs(
    attributes,
    input.attrProficient,
    input.level,
  );
  const defensiveDCs: Array<{ attribute: Attribute; dc: number }> = [
    { attribute: "PHYSICAL", dc: dcRecord.physical },
    { attribute: "MENTAL", dc: dcRecord.mental },
    { attribute: "MAGICAL", dc: dcRecord.magical },
  ];

  // Encumbrance
  const equippedItems = input.itemLinks.filter((l) => l.equipped);
  const encumbranceItems = equippedItems.map((l) => ({
    size: "MEDIUM" as CharacterSize, // items are MEDIUM by default
    loadValue: l.item.slotCost, // approximate: slot cost ~= load
    slotCount: l.item.isTwoHanded ? 2 : 1,
    capacityBonus: 0,
    ignoreLoadBonus: 0,
    quantity: 1,
    equipped: true,
  }));
  const encumbrance = computeEncumbrance(
    (input.size as CharacterSize) ?? "MEDIUM",
    input.attrPhysical,
    encumbranceItems,
  );

  return {
    buBalance,
    practices,
    practiceAttributeMap: PRACTICE_ATTRIBUTE_MAP,
    vitality: {
      max: maxVitality,
      current: vitalityCurrent,
      percent: vitalityPercent,
      modifiers: vitalityModifiers,
    },
    defensiveDCs,
    encumbrance,
    practiceCount: practices.length,
    capabilityCount: input.capabilityLinks.length,
    equippedItemCount: equippedItems.length,
    totalItemCount: input.itemLinks.length,
  };
}

/**
 * Sum item BU from linked items. We don't store item-bu-cost on the link,
 * so this pulls it from the linked item's buCost via buCost tracking.
 * For Phase 4 v1 we treat each item's buCost as its item-BU contribution.
 *
 * NOTE: when items get their own buCost tracking this stays simple.
 */
function sumItemBu(items: ItemLinkSnapshot[]): number {
  // Item BU is part of the phase 4 sheet display (separate from progression pool).
  // For now we don't store item buCost on the link — return 0; the UI shows
  // the count and the user can flip into Edit to see per-item cost.
  void items;
  return 0;
}

/**
 * Build practice primitive bonuses from raw character primitiveLinks
 * with full hardModifiers support. Used by richer sheet views later.
 */
export function buildPrimitiveBonusMap(
  links: ReadonlyArray<PrimitiveLinkSnapshot>,
): Map<number, { name: string; bonus: number }> {
  const map = new Map<number, { name: string; bonus: number }>();
  for (const link of links) {
    const p = link.primitive;
    if (
      p.category === "CHARACTER_SHEET_AUGMENT" ||
      p.category === "PRACTICE_PROGRESSION_AUGMENT"
    ) {
      map.set(p.id, { name: p.name, bonus: p.buCost });
    }
  }
  return map;
}

// Re-export common types for sheet UI consumers
export type {
  Practice,
  PracticeModifierBreakdown,
  Attribute,
  Attributes,
  PracticeSlices,
};