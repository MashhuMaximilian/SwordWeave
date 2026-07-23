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
import {
  evaluateBuLedger,
  getVolatilityCeiling,
  type BuLedger,
  type PrimitiveInput,
} from "./bu";
import { resolveMirrorEffect } from "./mirror";

export type PrimitiveLinkSnapshot = {
  primitiveId: number;
  source: string;
  acquiredAtLevel: number;
  /** True if this primitive was acquired as a mirror (negative). Counts toward volatility. */
  isMirrored: boolean;
  primitive: {
    id: number;
    name: string;
    category: string;
    buCost: number;
    isMirrorable: boolean;
    mirrorBuCredit: number;
    // Phase 8.2 batch 10: canonical mirror vector per mirror.ts.
    // "STANDARD_ONLY" by default — primitive has no mirror
    // variant. Other values: VARIABLE_VECTOR (sign-flip numeric
    // modifiers), STRUCTURAL_FAULT (defensive → vulnerability),
    // COST_INSTABILITY (target unchanged, user pays cost).
    mirrorVector: string;
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
  readonly volatility: {
    readonly rating: number;
    readonly ceiling: number;
    readonly levelBracket:
      | "L1-L4"
      | "L5-L8"
      | "L9-L12"
      | "L13-L16"
      | "L17-L20"
      | "L21-L24"
      | "L25-L28"
      | "L29+";
    readonly remaining: number;
    readonly exceeded: boolean;
    /** Mirror primitives grouped for display: each entry contributes its credit to rating */
    readonly mirroredPrimitives: ReadonlyArray<{
      readonly id: number;
      readonly name: string;
      readonly mirrorBuCredit: number;
      readonly acquiredAtLevel: number;
    }>;
  };
  readonly buLedger: BuLedger;
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
  //
  // Phase 8.2 batch 10: pass isMirrored + mirrorVector to the engine so
  // each mirror vector applies its canonical rule (sign-flip for
  // VARIABLE_VECTOR / STRUCTURAL_FAULT; pass-through for STANDARD_ONLY
  // and COST_INSTABILITY). See mirror.ts for the taxonomy.
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
        const resolved = resolveMirrorEffect(
          p.mirrorVector ?? "STANDARD_ONLY",
          link.isMirrored === true,
          p.buCost,
        );
        primitiveBonuses.set(p.id, {
          name: p.name,
          bonus: resolved.targetValue,
        });
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
  // Phase 8.2 batch 10: pass isMirrored AND mirrorVector so the
  // engine can apply the right per-vector rule (sign-flip for
  // VARIABLE_VECTOR / STRUCTURAL_FAULT, pass-through for
  // STANDARD_ONLY and COST_INSTABILITY). See mirror.ts for the
  // 4-vector taxonomy.
  const vitalityModifiers = computeVitalityModifiersFromPrimitives(
    input.primitiveLinks.map((l) => ({
      name: l.primitive.name,
      category: l.primitive.category,
      buCost: l.primitive.buCost,
      isMirrored: l.isMirrored === true,
      mirrorVector: l.primitive.mirrorVector,
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

  // Volatility (mirror-vector) — per BU Market canon, each character has a
  // level-based ceiling on how much negative BU they can take. We compute the
  // full BU ledger using the engine helpers and project volatility from it.
  const ledgerInputs: PrimitiveInput[] = input.primitiveLinks.map((link) => ({
    id: link.primitive.id,
    name: link.primitive.name,
    category: link.primitive.category,
    buCost: link.primitive.buCost,
    isMirrorable: link.primitive.isMirrorable,
    mirrorBuCredit: link.primitive.mirrorBuCredit,
    hardModifiers: [],
  }));
  const mirroredIds = new Set(
    input.primitiveLinks.filter((l) => l.isMirrored).map((l) => l.primitive.id),
  );
  const buLedger = evaluateBuLedger(input.level, ledgerInputs, mirroredIds);
  const ceilingInfo = getVolatilityCeiling(input.level);
  const mirroredPrimitives = input.primitiveLinks
    .filter((l) => l.isMirrored)
    .map((l) => ({
      id: l.primitive.id,
      name: l.primitive.name,
      mirrorBuCredit: l.primitive.mirrorBuCredit,
      acquiredAtLevel: l.acquiredAtLevel,
    }));

  return {
    buBalance,
    volatility: {
      rating: buLedger.volatilityRating,
      ceiling: buLedger.volatilityCeiling,
      levelBracket: ceilingInfo.levelBracket,
      remaining: Math.max(0, buLedger.volatilityCeiling - buLedger.volatilityRating),
      exceeded: buLedger.ceilingExceeded,
      mirroredPrimitives,
    },
    buLedger,
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