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
import { resolveValue, isTypedToken, type ResolveContext } from "./runtime-resolver";
import { evaluateCondition, type ConditionContext } from "./condition-evaluator";
import type { HardModifier } from "@/types/swordweave";
import { sumPrimitiveContributions, walkPrimitiveContributionsForAxis } from "./primitive-walk";
import { computeAllSavingThrows, computeAllSaveDCs, proficiencyBonus } from "./practices";
import { resolveModifiers, type ResolvedPrimitiveSlot } from "./resolve-modifiers";
import { SIZE_CAPACITY } from "./encumbrance";
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

/**
 * Phase 8.I i3 fix (Mashu): global rounding — no .5 values
 * anywhere on the sheet. Round 0.5 → up for positive numbers,
 * down for negative (i.e. Math.ceil on the absolute value).
 * Applies to modifiers, vitality, carry capacity, speed.
 */
function roundUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0) return Math.ceil(value);
  return Math.floor(value);
}

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
  characterId?: string;
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
  /**
   * Phase 8.L round 55: runtime conditions from the Play Session
   * Scratchpad (localStorage). Each active condition contributes its
   * hardModifiers to the sheet math (attributes, practices, PB,
   * defense DC, attack bonus). The sheet walks them just like
   * primitiveLinks so the totals and breakdowns stay consistent.
   */
  runtimeConditions?: ReadonlyArray<{
    readonly title: string;
    readonly active: boolean;
    readonly modifiers: readonly HardModifier[];
  }>;
  /**
   * Phase 8.I i2.6 (Mashu 2026-08-06): optional runtime context
   * for evaluating per-modifier conditions. When omitted (the
   * default), every modifier fires regardless of its condition
   * — matching the pre-i2.6 behavior so existing tests pass.
   *
   * When provided, each primitive's hardModifier is filtered:
   * if its `condition` evaluates to `false` against this
   * context, the modifier is skipped. This enables e.g. Broad
   * Familiarity (half PB to non-proficient checks) to actually
   * filter its bonus at evaluation time.
   *
   * The context is built by callers from the character's
   * current sheet state (vitality, proficiencies, flags, etc.)
   * plus optional target/scene state for the relevant axis.
   */
  conditionContext?: ConditionContext;
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
  // Phase 8.I i2 finish: saving throws (player rolls) +
  // save DCs (enemies roll against). Separate axes per R3-Q1.
  readonly savingThrows: ReadonlyArray<{
    readonly attribute: Attribute;
    readonly bonus: number;
  }>;
  readonly saveDCs: ReadonlyArray<{
    readonly attribute: Attribute;
    readonly dc: number;
  }>;
  readonly encumbrance: EncumbranceBreakdown;
  readonly practiceCount: number;
  readonly capabilityCount: number;
  readonly equippedItemCount: number;
  readonly totalItemCount: number;
  // Phase 8.I i2 finish (Mashu 2026-08-06): character
  // attributes including primitive modifier contributions.
  readonly attributes: Attributes;
  // Phase 8.I i2 finish: speed per locomotion type
  // (WALKING/CLIMBING/SWIMMING/FLYING/BURROWING). Default
  // 30 walking, 0 for the others; modified by primitives
  // targeting speed.<locomotion>.
  readonly speedByType: Readonly<Record<string, number>>;
  // Phase 8.I i2 finish: carry capacity = size_capacity +
  // (physical modifier × 5) + primitive contributions.
  readonly carryCapacity: number;
  // Phase 8.I i2 finish: total load = item-derived load +
  // primitive load contributions (set/add ops).
  readonly load: number;
  // Phase 8.I i2 finish: equip slots used = item-derived
  // slots + primitive equip_slot contributions.
  readonly equipSlotsUsed: number;
  // Phase 8.I Wave 5 (Mashu 2026-08-06): size, source_type,
  // complexity, combat_action, upkeep_cost.
  readonly resolvedSize: string;
  readonly resolvedSourceType: string;
  readonly complexity: number;
  readonly inCombat: boolean;
  readonly upkeepCost: number;
  // Phase 8.I Wave 6 (Mashu 2026-08-06): custom behavior
  // variables (i4 finish). Each entry is a named bucket
  // the character has via primitives — e.g. legendary
  // resistance, action points, custom trackers. Authored
  // as `target=behavior:<key>, op=add, value=1`.
  readonly behaviorVariables: ReadonlyArray<{
    readonly key: string;
    readonly value: number;
    readonly contributions: ReadonlyArray<{
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }>;
  }>;
};

/**
 * Aggregate all sheet-readiness data for a character.
 */

const SIZE_TIERS = ["tiny", "small", "medium", "large", "huge", "gargantuan"];

/**
 * Phase 8.L: Walk primitives to extract size/source_type/inCombat.
 * Runs BEFORE computeEncumbrance so the size reaches the capacity formula.
 */
function resolveCharacterAxes(
  primitiveLinks: ReadonlyArray<unknown>,
  defaultSize: string | null | undefined,
  proficientAttribute: string,
): { resolvedSize: string; resolvedSourceType: string; inCombat: boolean } {
  let resolvedSize = (defaultSize as string | null | undefined) ?? "MEDIUM";
  let resolvedSourceType: string = proficientAttribute === "MAGICAL" ? "MAGICAL" : "PHYSICAL";
  let inCombat = false;
  for (const l of primitiveLinks as ReadonlyArray<{
    primitive?: {
      hardModifiers?: ReadonlyArray<{
        target?: unknown;
        operation?: unknown;
        value?: unknown;
      }>;
    };
  }>) {
    const mods = Array.isArray(l.primitive?.hardModifiers)
      ? (l.primitive.hardModifiers as Array<{
          target?: unknown;
          operation?: unknown;
          value?: unknown;
        }>)
      : [];
    for (const mod of mods) {
      const target = String(mod.target ?? "");
      const op = String(mod.operation ?? "");
      const value = Number(mod.value);
      const kwValue =
        mod.value &&
        typeof mod.value === "object" &&
        (mod.value as { kind?: string }).kind === "keyword"
          ? String((mod.value as { value?: unknown }).value ?? "").toLowerCase()
          : null;
      const dotIdx = target.indexOf(".");
      let axis: string;
      let sub: string;
      if (dotIdx > 0) {
        axis = target.slice(0, dotIdx);
        sub = target.slice(dotIdx + 1).toLowerCase();
      } else if (kwValue) {
        axis = target;
        sub = kwValue;
      } else {
        continue;
      }
      if (axis === "size" && SIZE_TIERS.includes(sub)) {
        if (op === "set" || op === "grant" || op === "add") {
          resolvedSize = sub.toUpperCase();
        }
      }
      if (axis === "source_type") {
        if (op === "set" || op === "grant") {
          resolvedSourceType = sub.toUpperCase();
        }
      }
      if (target === "combat_action" || (axis === "combat_action" && kwValue)) {
        if (op === "grant") inCombat = true;
        if (op === "set") inCombat = value !== 0;
      }
    }
  }
  return { resolvedSize, resolvedSourceType, inCombat };
}

export function aggregateCharacterSheet(
  input: CharacterSheetInput,
): CharacterSheet {
  // Phase 8.I i2 finish (Mashu 2026-08-06): walk primitive
  // modifiers for each attribute (P, ME, MA) and sum the
  // contributions. Previously attributes were read straight
  // from input.attrPhysical/Mental/Magical — primitive
  // modifiers targeting attribute.<attr> were ignored.
  const attributes: Attributes = {
    physical:
      input.attrPhysical +
      sumPrimitiveContributions(
        input.primitiveLinks,
        "attribute",
        "physical",
        input.conditionContext,
      ),
    mental:
      input.attrMental +
      sumPrimitiveContributions(
        input.primitiveLinks,
        "attribute",
        "mental",
        input.conditionContext,
      ),
    magical:
      input.attrMagical +
      sumPrimitiveContributions(
        input.primitiveLinks,
        "attribute",
        "magical",
        input.conditionContext,
      ),
  };
  const slices: PracticeSlices = input.practiceSlices ?? {};

  // Build primitive bonus map (used by practice roll-up)
  //
  // Phase 8.I i2 (Mashu 2026-08-04): REPLACE buCost-as-proxy with
  // real hardModifier walks. The previous loop added each primitive's
  // buCost as a contribution to all practices silently — this
  // produced the "+7 mystery number" on Tessy because there was no
  // real modifier that explained it.
  //
  // New behaviour: for each primitive with category
  // CHARACTER_SHEET_AUGMENT or PRACTICE_PROGRESSION_AUGMENT, walk
  // its hardModifiers and pick up `add`/`subtract` ops that target
  // `skill_practice_check`. Each modifier carries a sub-target
  // (the practice(s) it applies to) — we split the bonus per
  // practice so the correct practices get the correct delta.
  //
  // Returns: Map<PrimitiveId, Map<Practice, {name, bonus}>>
  // The inner map is keyed by Practice so a single primitive can
  // contribute different amounts to different practices (e.g. one
  // modifier targets "awareness" for +2, another targets "reason"
  // for +3). A primitive with NO skill_practice_check modifier
  // contributes nothing — the buCost-as-proxy path is gone.
  //
  // The modal's "Primitive contributions" section reads from the
  // same source, so the displayed total will match the formula.
  type PracticeBonusMap = Map<
    number,
    Map<Practice, { name: string; bonus: number }>
  >;
  const primitiveBonuses: PracticeBonusMap = new Map();

  // Practice names in metadata.targetScope.values are stored UPPER
  // ("AWARENESS", "REASON", etc.) but the Practice enum is
  // lowercase. We map both ways for backwards compat.
  const upperToPractice: Record<string, Practice> = {
    PROWESS: "prowess",
    FINESSE: "finesse",
    FIELDCRAFT: "fieldcraft",
    AWARENESS: "awareness",
    REASON: "reason",
    KNOWLEDGE: "knowledge",
    INFLUENCE: "influence",
    MYSTICISM: "mysticism",
    COMMUNION: "communion",
    INTUITION: "intuition",
  };

  // Phase 8.I i2.5d (Mashu 2026-08-05): accept BOTH the legacy
  // category name (SHEET_AUGMENT) and the canonical name
  // (CHARACTER_SHEET_AUGMENT). The form saves under the legacy
  // short name; the engine filter only matched the canonical name,
  // so primitives saved through the form were silently filtered
  // out of the practice math. The canonical type was renamed at
  // some point during Phase 7 (per the comment in
  // src/lib/packages/primitive-package.ts) but the engine code
  // wasn\'t updated to handle the legacy alias.
  // Phase 8.L round 55: also walk runtime conditions (Play Session
  // Scratchpad). Each active condition contributes its hardModifiers
  // to the practice math just like a slotted primitive. We use a
  // synthetic negative primitiveId so the Map<primitiveId, ...> key
  // doesn't collide with real primitives.
  const runtimeConditionLinks = (input.runtimeConditions ?? [])
    .filter((c) => c.active)
    .map((c, i): PrimitiveLinkSnapshot => ({
      primitiveId: -100000 - i,
      source: "RUNTIME",
      acquiredAtLevel: 0,
      isMirrored: false,
      primitive: {
        id: -100000 - i,
        name: c.title || "Untitled condition",
        category: "RUNTIME_CONDITION",
        buCost: 0,
        isMirrorable: false,
        mirrorBuCredit: 0,
        hardModifiers: c.modifiers,
      },
    }));
  const allLinks: ReadonlyArray<PrimitiveLinkSnapshot> = [
    ...input.primitiveLinks,
    ...runtimeConditionLinks,
  ];
  for (const link of allLinks) {
    const p = link.primitive;
    if (
      p.category !== "CHARACTER_SHEET_AUGMENT" &&
      p.category !== "SHEET_AUGMENT" &&
      p.category !== "PRACTICE_PROGRESSION_AUGMENT" &&
      p.category !== "RUNTIME_CONDITION"
    ) {
      continue;
    }
    if (primitiveBonuses.has(p.id)) continue;

    const practiceMap = new Map<Practice, { name: string; bonus: number }>();
    const mods = Array.isArray(p.hardModifiers) ? p.hardModifiers : [];
    for (const rawMod of mods) {
      const mod = rawMod as {
        target?: string;
        operation?: string;
        value?: unknown;
        /**
         * Phase 8.I i2.6 (Mashu 2026-08-06): per-modifier condition.
         * When input.conditionContext is provided, evaluate the
         * condition against it; if it fails, skip this modifier.
         * Defaults to null (no condition) so older rows without
         * a condition field always fire.
         */
        condition?: unknown;
        metadata?: {
          targetScope?: { layer?: unknown; values?: unknown };
        };
      };
      if (String(mod.target ?? "") !== "skill_practice_check") continue;

      // Phase 8.I i2.6: condition filter happens INSIDE the
      // per-practice walk below (so dynamic predicates like
      // `actor:not_proficient` can resolve against the practice
      // currently being rolled).

      const scope = mod.metadata?.targetScope;
      // Phase 8.L round 55: empty scope = "any" = apply to every
      // practice (L53 expansion parity with engine). Previously
      // we silently dropped these (notably Iron Defender
      // Plating's "Floor 10" primitive, which has NO metadata).
      const values = Array.isArray(scope?.values) && scope.values.length > 0
        ? scope.values.map((v) => String(v))
        : Object.keys(upperToPractice);

      // Phase 8.I i2.5c (Mashu 2026-08-05): typed tokens
      // (PB chip, /physical/, etc.) are stored as objects,
      // not plain numbers. We must resolve them through the
      // runtime resolver (resolveValue) instead of NaNing
      // them. For the practice math we only care about plain
      // numeric contributions — typed tokens contribute 0
      // unless the form's value resolves to a number, which
      // the resolver handles.
      const ctx: ResolveContext = {
        level: input.level,
        pb: 2 + Math.floor((input.level - 1) / 4),
        attributes: {
          physical: input.attrPhysical,
          mental: input.attrMental,
          magical: input.attrMagical,
        } as ResolveContext["attributes"],
        practices: {} as ResolveContext["practices"],
        behaviorVariables: {} as ResolveContext["behaviorVariables"],
      };
      let value: number;
      if (isTypedToken(mod.value)) {
        value = resolveValue(mod.value, ctx);
      } else if (Array.isArray(mod.value)) {
        // Phase 8.I i2.7d (Mashu 2026-08-06): equation mode
        // stores an Operand[] (the form's full expression).
        // resolveValue's array branch handles it; duplicate
        // the dispatch here so the practice walk doesn't drop
        // it on the floor.
        value = resolveValue(mod.value, ctx);
      } else if (typeof mod.value === "number") {
        value = mod.value;
      } else if (typeof mod.value === "string") {
        const parsed = Number(mod.value);
        if (!Number.isFinite(parsed)) continue;
        value = parsed;
      } else {
        continue;
      }
      if (!Number.isFinite(value)) continue;

      const op = String(mod.operation ?? "");
      let delta = 0;
      if (op === "add") delta = value;
      else if (op === "subtract") delta = -value;
      else continue; // multiply/divide/set/grant don't apply to practice math

      if (link.isMirrored === true) delta = -delta;

      // Phase 8.I i2.6 (Mashu 2026-08-06): per-practice variable
      // conditions. When a modifier has a condition that references
      // the practice being rolled (e.g. Broad Familiarity's
      // `actor:not_proficient`), the engine needs to evaluate
      // against the right practice for each application. We move
      // the condition check INSIDE the per-practice loop and
      // build a fresh ConditionContext with currentPractice set.
      for (const v of values) {
        const practiceName =
          upperToPractice[v.toUpperCase()] ?? (v.toLowerCase() as Practice);
        if (!practiceName) continue;

        // Per-practice condition filter. Re-evaluate the
        // condition with this practice set as currentPractice.
        // This makes `actor:not_proficient` resolve correctly
        // for each practice the modifier applies to.
        if (
          input.conditionContext !== undefined &&
          mod.condition !== undefined &&
          mod.condition !== null
        ) {
          const ctxForThisPractice: ConditionContext = {
            ...input.conditionContext,
            currentPractice: practiceName,
          };
          if (
            !evaluateCondition(
              mod.condition as Parameters<typeof evaluateCondition>[0],
              ctxForThisPractice,
            )
          ) {
            continue;
          }
        }

        const existing = practiceMap.get(practiceName);
        if (existing) {
          existing.bonus += delta;
        } else {
          practiceMap.set(practiceName, { name: p.name, bonus: delta });
        }
      }
    }
    primitiveBonuses.set(p.id, practiceMap);
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
  // Phase 8.L round 55: PB-modifying modifiers (primitive or
  // runtime) need to flow into practice totals. The sheet runs
  // its own resolver so we can pick up primitives that target
  // proficiency_bonus (the server doesn't have the runtime
  // conditions, but it does have slotted primitives).
  // Phase 8.L round 55: build synthetic slots from primitiveLinks +
  // runtimeConditions so the resolver can compute the final PB
  // (level + all PB-targeting modifiers).
  const resolverSlots: ResolvedPrimitiveSlot[] = [
    ...input.primitiveLinks.map<ResolvedPrimitiveSlot>((link) => ({
      primitiveId: link.primitiveId,
      name: link.primitive.name,
      category: link.primitive.category,
      hardModifiers: (link.primitive.hardModifiers ?? []) as readonly HardModifier[],
      isMirrored: link.isMirrored,
      isMirrorable: link.primitive.isMirrorable,
      mirrorVector: null,
      originHeritageId: null,
      originCapabilityId: null,
      originEffectId: null,
      isToggledOff: false,
    })),
    ...((input.runtimeConditions ?? []).filter((c) => c.active).map<ResolvedPrimitiveSlot>((c, i) => ({
      primitiveId: -100000 - i,
      name: c.title || "Untitled condition",
      category: "RUNTIME_CONDITION",
      hardModifiers: c.modifiers,
      isMirrored: false,
      isMirrorable: false,
      mirrorVector: null,
      originHeritageId: null,
      originCapabilityId: null,
      originEffectId: null,
      isToggledOff: false,
    }))),
  ];
  const sheetResolver = resolveModifiers({
    characterId: input.characterId ?? "",
    level: input.level,
    pb: proficiencyBonus(input.level),
    proficientAttribute:
      input.attrProficient === null
        ? null
        : (input.attrProficient.toLowerCase() as "physical" | "mental" | "magical"),
    attributes: {
      physical: input.attrPhysical,
      mental: input.attrMental,
      magical: input.attrMagical,
    },
    slots: resolverSlots,
  });
  const pbOverride = sheetResolver.totals["proficiency_bonus"];
  // Phase 8.L round 58 (Mashu): the practice walk earlier built
  // primitiveBonuses with ctx.pb = level-based PB. If a condition
  // or another primitive modified PB, the PB-token primitives
  // (Proficient Fieldcraft with /pb/, PB Half with /pb_half/, etc.)
  // have stale values. Rebuild them with the FINAL pb so the
  // practice math reflects reality.
  //
  // We do this BEFORE computeAllPracticeModifiers so the sheet's
  // displayed practice totals (which go to the server-rendered
  // character sheet) match what the client resolver computes.
  if (pbOverride !== undefined && pbOverride !== proficiencyBonus(input.level)) {
    const ctxFinalPb: ResolveContext = {
      level: input.level,
      pb: pbOverride,
      attributes: {
        physical: input.attrPhysical,
        mental: input.attrMental,
        magical: input.attrMagical,
      } as ResolveContext["attributes"],
      practices: {} as ResolveContext["practices"],
      behaviorVariables: {} as ResolveContext["behaviorVariables"],
    };
    // Walk input.primitiveLinks + runtimeConditions. For each PB-derived
    // value that target skill_practice_check, re-resolve with finalPb
    // and OVERWRITE the entry in primitiveBonuses.
    const allPracticeSlots = [
      ...input.primitiveLinks.map((link) => ({
        id: link.primitive.id,
        name: link.primitive.name,
        hardModifiers: link.primitive.hardModifiers,
        isMirrored: link.isMirrored,
      })),
      ...((input.runtimeConditions ?? []).filter((c) => c.active).map((c, i) => ({
        id: -100000 - i,
        name: c.title || "Untitled condition",
        hardModifiers: c.modifiers,
        isMirrored: false,
      }))),
    ];
    for (const sl of allPracticeSlots) {
      const practiceMap = primitiveBonuses.get(sl.id);
      if (!practiceMap) continue;
      const mods = sl.hardModifiers ?? [];
      for (const rawMod of mods) {
        const mod = rawMod as {
          target?: string;
          operation?: string;
          value?: unknown;
        };
        if (String(mod.target ?? "") !== "skill_practice_check") continue;
        // Re-resolve the value with finalPb ctx
        let resolvedValue: number = 0;
        if (isTypedToken(mod.value)) {
          resolvedValue = resolveValue(mod.value, ctxFinalPb);
        } else if (Array.isArray(mod.value)) {
          resolvedValue = resolveValue(mod.value, ctxFinalPb);
        } else if (typeof mod.value === "number") {
          resolvedValue = mod.value;
        } else if (typeof mod.value === "string") {
          const n = Number(mod.value);
          if (!Number.isFinite(n)) continue;
          resolvedValue = n;
        } else {
          continue;
        }
        if (!Number.isFinite(resolvedValue)) continue;
        const op = String(mod.operation ?? "");
        let delta = 0;
        if (op === "add") delta = resolvedValue;
        else if (op === "subtract") delta = -resolvedValue;
        else continue;
        if (sl.isMirrored === true) delta = -delta;
        // Overwrite ALL practices that this modifier targets.
        // We need the same practice list the original walk used.
        const scope = (rawMod as { metadata?: { targetScope?: { values?: unknown } } })
          .metadata?.targetScope;
        const valuesList = Array.isArray(scope?.values) && scope.values.length > 0
          ? scope.values.map((v) => String(v))
          : Object.keys(upperToPractice);
        const upperToPracticeLocal: Record<string, Practice> = upperToPractice;
        for (const upperPractice of valuesList) {
          const practiceName =
            upperToPracticeLocal[upperPractice] ?? (upperPractice.toLowerCase() as Practice);
          const entry = practiceMap.get(practiceName);
          if (entry) {
            // OVERWRITE — don't accumulate, since this is the
            // full re-resolution with the final pb.
            practiceMap.set(practiceName, { name: sl.name, bonus: delta });
          }
        }
      }
    }
  }
  const practices = computeAllPracticeModifiers(
    attributes,
    slices,
    input.attrProficient,
    input.level,
    primitiveBonuses,
    pbOverride,
  );

  // Vitality
  // Phase 8.I i2 (Mashu 2026-08-04): now reads hardModifiers from
  // each primitive instead of relying on a name-match + buCost
  // proxy. The vitality helper has its own doc explaining why.
  const vitalityModifiers = computeVitalityModifiersFromPrimitives(
    input.primitiveLinks.map((l) => ({
      name: l.primitive.name,
      category: l.primitive.category,
      buCost: l.primitive.buCost,
      isMirrored: l.isMirrored === true,
      hardModifiers: l.primitive.hardModifiers ?? [],
    })),
  );
  const maxVitality = computeMaxVitality(input.level, vitalityModifiers);
  const vitalityCurrent = input.currentVitality;
  const vitalityPercent =
    vitalityCurrent === null
      ? null
      : Math.max(0, Math.min(100, Math.round((vitalityCurrent / maxVitality) * 100)));

  // Defensive DCs
  // Phase 8.I i2 finish (Mashu 2026-08-06): walk primitive
  // modifiers targeting defense_dc.<physical|mental|magical>
  // and add to the base DC.
  const dcRecord = computeAllDefensiveDCs(
    attributes,
    input.attrProficient,
    input.level,
    input.primitiveLinks,
    input.conditionContext,
  );
  const defensiveDCs: Array<{ attribute: Attribute; dc: number }> = [
    { attribute: "PHYSICAL", dc: dcRecord.physical },
    { attribute: "MENTAL", dc: dcRecord.mental },
    { attribute: "MAGICAL", dc: dcRecord.magical },
  ];

  // Phase 8.I i2 finish: saving throws (player rolls) and
  // save DCs (enemies roll against) — separate axes per R3-Q1.
  // Phase 8.L round 55: pass the engine-resolved PB so PB-affecting
  // modifiers propagate to all 3 saving throws.
  const stRecord = computeAllSavingThrows(
    attributes,
    input.attrProficient,
    input.level,
    input.primitiveLinks,
    input.conditionContext,
    pbOverride,
  );
  const savingThrows: Array<{ attribute: Attribute; bonus: number }> = [
    { attribute: "PHYSICAL", bonus: stRecord.physical },
    { attribute: "MENTAL", bonus: stRecord.mental },
    { attribute: "MAGICAL", bonus: stRecord.magical },
  ];
  const saveDCRecord = computeAllSaveDCs(
    attributes,
    input.attrProficient,
    input.level,
    input.primitiveLinks,
    input.conditionContext,
  );
  const saveDCs: Array<{ attribute: Attribute; dc: number }> = [
    { attribute: "PHYSICAL", dc: saveDCRecord.physical },
    { attribute: "MENTAL", dc: saveDCRecord.mental },
    { attribute: "MAGICAL", dc: saveDCRecord.magical },
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
    // Phase 8.5 / Session H6 round 4 (Mashu 2026-08-03):
    // forward the 2H flag so the engine can apply the 2H
    // slot baseline (2 slots) before the size multiplier.
    // Without this, the Claymore (2H LARGE) computes to 1
    // slot — the user expects 4 (2H baseline * LARGE 2x).
    isTwoHanded: l.item.isTwoHanded,
    capacityBonus: 0,
    ignoreLoadBonus: 0,
    quantity: l.quantity ?? 1,
    // `equipped` drives slot accounting only — Load ignores
    // equipped state and counts every item.
    equipped: l.equipped,
  };
});
const equippedItems = input.itemLinks.filter((l) => l.equipped);
// Phase 8.L: resolve size/source_type from primitives BEFORE
// computeEncumbrance so the resolved size reaches the capacity formula.
const { resolvedSize, resolvedSourceType, inCombat } = resolveCharacterAxes(
  input.primitiveLinks,
  input.size,
  input.attrProficient ?? "PHYSICAL",
);

const encumbrance = computeEncumbrance(
  resolvedSize as CharacterSize,
  input.attrPhysical,
  encumbranceItems,
  // Phase 8.L: Extra Slot primitive adds +1 to available slots.
  // Previously this was hardcoded 6 (No bonus applied).
  sumPrimitiveContributions(input.primitiveLinks, "equip_slot", null, input.conditionContext),
);

// Phase 8.I i2 finish (Mashu 2026-08-06) — speed walks per locomotion.
// Phase 8.I i3 (Mashu): base speed per size — Tiny 15, Small 25,
// Medium 30, Large 40, Huge 60, Gargantuan 90.
// Swim + Climb default to half base speed (rounded up).
// Fly + Burrow default to 0 (must be granted by primitives).
const SIZE_BASE_SPEED: Record<string, number> = {
  TINY: 15,
  SMALL: 25,
  MEDIUM: 30,
  LARGE: 40,
  HUGE: 60,
  GARGANTUAN: 90,
};
const baseWalkSpeed = SIZE_BASE_SPEED[(resolvedSize as CharacterSize) ?? "MEDIUM"] ?? 30;
const baseSwimClimbSpeed = roundUp(baseWalkSpeed / 2);

const SPEED_DEFAULTS: Record<string, number> = {
  WALKING_SPEED: baseWalkSpeed,
  CLIMBING_SPEED: baseSwimClimbSpeed,
  SWIMMING_SPEED: baseSwimClimbSpeed,
  FLYING_SPEED: 0,
  BURROWING_SPEED: 0,
};
const speedByType: Record<string, number> = {};
for (const locomotion of Object.keys(SPEED_DEFAULTS)) {
  const lower = locomotion.toLowerCase().replace("_speed", "");
  const primitiveSum = sumPrimitiveContributions(
    input.primitiveLinks,
    "speed",
    lower,
    input.conditionContext,
  );
  speedByType[locomotion] = roundUp((SPEED_DEFAULTS[locomotion] ?? 0) + primitiveSum);
}

// Phase 8.I i2 finish - carry capacity = SIZE_CAPACITY[size]
// + (physical × 5) + primitive bonus.
// Phase 8.L: use resolvedSize so the Enlarge primitive reaches the
// capacity formula. (Without this, charSize was input.size which
// doesn't reflect primitive transformations.)
const charSize = resolvedSize as CharacterSize;
const baseCarry = SIZE_CAPACITY[charSize] + input.attrPhysical * 5;
const carryCapacityBonus = sumPrimitiveContributions(
  input.primitiveLinks,
  "carry_capacity",
  null,
  input.conditionContext,
);
const carryCapacity = roundUp(baseCarry + carryCapacityBonus);

// Load = item-derived + primitive load contributions.
const itemLoad = encumbrance.load;
const loadPrimitive = sumPrimitiveContributions(
  input.primitiveLinks,
  "load",
  null,
  input.conditionContext,
);
const loadTotal = itemLoad + loadPrimitive;

// Equip slots = item-derived + primitive equip_slot contributions.
const slotsUsed = encumbrance.equipSlotsUsed;
const slotPrimitiveBonus = sumPrimitiveContributions(
  input.primitiveLinks,
  "equip_slot",
  null,
  input.conditionContext,
);
const equipSlotsUsed = slotsUsed + slotPrimitiveBonus;

// Phase 8.I Wave 5 (Mashu 2026-08-06): size, source_type,
// complexity, combat_action. Tag-enum / boolean axes the
// drawer displays.

// Phase 8.L: size/source_type/inCombat extraction moved into
// resolveCharacterAxes() helper (declared above aggregateCharacterSheet)
// so it runs BEFORE computeEncumbrance receives the resolved size.

const complexity = sumPrimitiveContributions(
  input.primitiveLinks,
  "complexity",
  null,
  input.conditionContext,
);
const upkeepCost = sumPrimitiveContributions(
  input.primitiveLinks,
  "upkeep_cost",
  null,
  input.conditionContext,
);

// Phase 8.I Wave 6 (Mashu 2026-08-06) — custom behavior
// variables (i4 finish). Walk primitives targeting
// behavior:<key> and bucket the contributions per key.
// Used for legendary_resistance, action_point, etc.
const behaviorVariables: Array<{
  key: string;
  value: number;
  contributions: Array<{ primitiveId: number; primitiveName: string; delta: number }>;
}> = [];
const behaviorMap = new Map<string, { value: number; contributions: Array<{ primitiveId: number; primitiveName: string; delta: number }> }>();

// Phase 8.L round 58: include runtimeConditions as virtual slots so
// conditions targeting behavior.X (e.g. legendary_resistance) are
// reflected in the server-rendered behavior variables. The walk
// below handles both slotted primitives and active conditions.
const behaviorWalkSlots: Array<{
  primitive: { id: number; name: string; hardModifiers: unknown };
  isMirrored: boolean;
}> = [
  ...input.primitiveLinks.map((link) => ({
    primitive: { id: link.primitive.id, name: link.primitive.name, hardModifiers: link.primitive.hardModifiers },
    isMirrored: link.isMirrored,
  })),
  ...((input.runtimeConditions ?? []).filter((c) => c.active).map((c, i) => ({
    primitive: {
      id: -100000 - i,
      name: c.title || "Untitled condition",
      hardModifiers: c.modifiers ?? [],
    },
    isMirrored: false,
  }))),
];
for (const slot of behaviorWalkSlots) {
  const mods = Array.isArray(slot.primitive?.hardModifiers)
    ? (slot.primitive.hardModifiers as Array<{
        target?: unknown;
        operation?: unknown;
        value?: unknown;
      }>)
    : [];
  for (const mod of mods) {
    const target = String(mod.target ?? "");
    if (!target.startsWith("behavior.")) continue;
    const key = target.slice("behavior.".length);
    if (key.length === 0) continue;
    const op = String(mod.operation ?? "");
    const value = Number(mod.value);
    if (!Number.isFinite(value)) continue;
    let delta = 0;
    if (op === "add") delta = value;
    else if (op === "subtract") delta = -value;
    else if (op === "set") delta = value;
    else if (op === "grant") delta = value;
    else continue;
    if (slot.isMirrored === true) delta = -delta;
    const existing = behaviorMap.get(key);
    if (existing) {
      existing.value += delta;
      existing.contributions.push({
        primitiveId: Number(slot.primitive?.id ?? 0),
        primitiveName: String(slot.primitive?.name ?? "Unknown"),
        delta,
      });
    } else {
      behaviorMap.set(key, {
        value: delta,
        contributions: [
          {
            primitiveId: Number(slot.primitive?.id ?? 0),
            primitiveName: String(slot.primitive?.name ?? "Unknown"),
            delta,
          },
        ],
      });
    }
  }
}

for (const [key, val] of behaviorMap.entries()) {
  if (val.value !== 0) {
    behaviorVariables.push({ key, value: val.value, contributions: val.contributions });
  }
}
behaviorVariables.sort((a, b) => a.key.localeCompare(b.key));

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
      max: roundUp(maxVitality),
      current: vitalityCurrent,
      percent: vitalityPercent,
      modifiers: vitalityModifiers,
    },
    defensiveDCs,
    savingThrows,
    saveDCs,
    encumbrance,
    speedByType: Object.fromEntries(
      Object.entries(speedByType).map(([k, v]) => [k, roundUp(v)]),
    ),
    carryCapacity: roundUp(carryCapacity),
    load: loadTotal,
    equipSlotsUsed,
    resolvedSize,
    resolvedSourceType,
    complexity,
    inCombat,
    upkeepCost,
    behaviorVariables,
    practiceCount: practices.length,
    capabilityCount: input.capabilityLinks.length,
    equippedItemCount: equippedItems.length,
    totalItemCount: input.itemLinks.length,
    // Phase 8.I i2 finish: attributes including primitive
    // modifier contributions.
    attributes,
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
 *
 * Phase 8.5 H-rev3 (Mashu 2026-08-03): the `buCost` field on
 * items is now labeled "Extra BU cost" in the composer; today
 * it's still summed verbatim here as the "Item BU (separate)"
 * display number. The proper integration with the deduped
 * primitive total (so narrative-only items or items whose
 * extra cost should fold into the same direct-vs-inherited
 * split that primitives already use) is parked for
 * Session J / T16. DO NOT change the math here without
 * reading the "Open followup #2" block in
 * `~/.hermes/skills/swordweave/swordweave-character-items/SKILL.md`
 * (and `swordweave-transitive-bu-dedup-split.md` for the
 * primitive-side spec). Filed: T16 / Session J.
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
      p.category === "SHEET_AUGMENT" ||
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