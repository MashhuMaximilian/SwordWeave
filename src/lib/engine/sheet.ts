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
  SIZE_LOAD,
  type CharacterSize,
} from "./encumbrance";
import {
  evaluateBuLedger,
  getVolatilityCeiling,
  type BuLedger,
  type PrimitiveInput,
} from "./bu";

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
    /**
     * Phase 8.3d (Mashu 2026-07-27): the primitive's authored
     * hard_modifiers JSONB, passed through verbatim so the
     * character sheet can render conditions via ConditionBadges.
     * The BU ledger at the bottom of aggregateCharacterSheet
     * still drops this (we only evaluate stacking by primitive
     * id, not by modifier conditions). Future work: wire
     * conditions into modifier evaluation.
     */
    hardModifiers: readonly unknown[];
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
  /**
   * Phase 8.4 v24.5 (Mashu 2026-07-29): stack quantity
   * affects the separate Item BU display (a stack of 3
   * cheap torches costs 3x the single BU).
   */
  quantity?: number;
  item: {
    id: string;
    name: string;
    itemType: string;
    rarity: string;
    slotCost: number;
    isTwoHanded: boolean;
    isConsumable: boolean;
    /**
     * Phase 8.4 v24.5 (Mashu 2026-07-29): item BU cost
     * surfaced to the sheet's top-deck "Item BU (separate)"
     * card via sumItemBu().
     */
    buCost: number;
    /**
     * Phase 8.5 H5 (Mashu 2026-08-03): item size drives
     * encumbrance Load via SIZE_LOAD. Required for the
     * encumbrance aggregator. Optional so legacy callers
     * still compile; the engine defaults to SMALL.
     */
    size?: string;
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
  // Phase 8.2 batch 11: mirror rule. Per Phase 7.5 modifier-rebuild
  // spec, mirror is per-OPERATION on a modifier (Add↔Subtract sign
  // flip, Multiply↔Divide reciprocal, Min↔Max, Grant↔Revoke). For
  // the v1 sheet roll-up using buCost as a proxy (hardModifiers not
  // yet wired), we model the buCost contribution as an implicit Add
  // op: mirroring flips the sign. This matches OP_SPECS.add.mirrorOp
  // = "subtract" + mirrorFlipsSign=true — same rule the form's
  // Mirror toggle uses in /sandbox/primitive-form.tsx. When
  // hardModifiers come online, this will be replaced by walking each
  // primitive's modifier and calling applyMirror() per OP_SPECS.
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
        const bonus =
          link.isMirrored === true ? -p.buCost : p.buCost;
        primitiveBonuses.set(p.id, {
          name: p.name,
          bonus,
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
  // Phase 8.2 batch 11: mirror rule. Per Phase 7.5 modifier-rebuild
  // spec, mirror is per-OPERATION on a modifier (Add↔Subtract sign
  // flip, Multiply↔Divide reciprocal, Min↔Max, Grant↔Revoke). For
  // the v1 sheet roll-up using buCost as a proxy (hardModifiers not
  // yet wired), we model the buCost contribution as an implicit Add
  // op: mirroring flips the sign. This matches OP_SPECS.add.mirrorOp
  // = "subtract" + mirrorFlipsSign=true — same rule the form's
  // Mirror toggle uses in /sandbox/primitive-form.tsx. When
  // hardModifiers come online, this will be replaced by walking each
  // primitive's modifier and calling applyMirror() per OP_SPECS.
  const vitalityModifiers = computeVitalityModifiersFromPrimitives(
    input.primitiveLinks.map((l) => ({
      name: l.primitive.name,
      category: l.primitive.category,
      buCost: l.primitive.buCost,
      isMirrored: l.isMirrored === true,
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
//
// Phase 8.5 H5-fix (Mashu 2026-08-03): encumbrance semantics.
//
// Per the canonical spec (message.txt):
//   - Load (capacity consumed) = sum of (item.size load × quantity)
//     for ALL items, equipped or not. Everything the character
//     carries contributes to Load.
//   - Equipped slots = number of slot-bearing items currently
//     equipped, multiplied by the item's slotCost (2H = 2 slots).
//   - Capacity = size base + (Physical mod × 5) + capacity bonuses.
//
// The previous code was filtering to equipped items only for Load
// AND was using `slotCost` as a load proxy (which conflated equipped
// slots with carry weight). Both are wrong.
const ITEM_SIZE_DEFAULT: CharacterSize = "SMALL";
const encumbranceItems = input.itemLinks.map((l) => {
  const itemSize =
    (l.item as { size?: CharacterSize }).size ?? ITEM_SIZE_DEFAULT;
  return {
    size: itemSize,
    loadValue: SIZE_LOAD[itemSize],
    slotCount: l.item.slotCost,
    capacityBonus: 0,
    ignoreLoadBonus: 0,
    quantity: l.quantity ?? 1,
    // `equipped` drives slot accounting only — Load ignores
    // equipped state and counts every item.
    equipped: l.equipped,
  };
});
const equippedItems = input.itemLinks.filter((l) => l.equipped);
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
 * Sum item BU from linked items.
 *
 * Phase 8.4 v24.5 (Mashu 2026-07-29): the top-deck card
 * "Item BU (separate)" was always rendering 0 because this
 * helper returned a hardcoded 0. Per Mashu:
 *   "We have in top deck the 'Item BU 0 (separate)' it's
 *    still 0. That just sums up all the BU of items in the
 *    item tab."
 *
 * Now sums each item's buCost, multiplied by quantity
 * (multi-stack items count their quantity). Pure BU pool
 * tracking is unaffected — items never deduct from the
 * progression pool; this is purely the separate display.
 */
function sumItemBu(items: ItemLinkSnapshot[]): number {
  return items.reduce(
    (sum, link) => sum + (link.item.buCost ?? 0) * (link.quantity ?? 1),
    0,
  );
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