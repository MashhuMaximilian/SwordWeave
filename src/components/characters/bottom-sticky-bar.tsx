"use client";

// Phase 8.L round 26 (Mashu 2026-08-13): Build marker — force Turbopack
// to hash the chunks differently so the CDN serves the new code.

/**
 * bottom-sticky-bar.tsx — Phase 8.4 (Mashu 2026-07-28)
 *
 * The character sheet's single source of truth for play-time
 * data. Visible on BOTH mobile and desktop (no longer
 * `md:hidden`). The CabinetDrawer pattern: a sticky bar at the
 * bottom of the viewport with a collapsed header (instantly
 * readable) and an expandable drawer that grows UPWARD to fill
 * most of the viewport.
 *
 * Header (always visible):
 *   ♥ current/max | P/ME/MA | PB | DC [PROF] | chevron
 *
 * Drawer (when expanded, top → bottom):
 *   1. Vitality header + bar + buttons (compact, single row)
 *   2. Mods + saves (3 chips, "PROF" tag on the proficient one)
 *   3. Save DC card
 *   4. Practices (3 columns, capitalized)
 *   5. Load + Equip slots (Load only on mobile; PB on desktop) at the bottom
 *
 * Every number is clickable → opens a ProvenanceModal showing
 * the resolver contributions. The combined "mod + save" modal
 * shows both sections in one window.
 *
 * Phase 8.4 changes (Mashu 2026-07-28):
 *   - Removed the Overview tab: the identity strip + load/equip
 *     slots now live HERE. Single source of truth means no
 *     duplicate data.
 *   - Drawer is visible on all screen sizes (no md:hidden).
 *   - Drawer grows UPWARD with max-h-[70dvh] when expanded.
 *   - Added provenance popups for DC, attrs, saves, vitality,
 *     and practices.
 *   - PROF tag next to the proficient attribute label.
 *   - Combined mod + save provenance in a single modal.
 */

import { Fragment, type ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { humanReadableCondition, humanReadableToken } from "@/lib/engine/condition-dictionary";
import { cn } from "@/lib/utils";
import { formatEquationValue } from "@/lib/engine/equation-formatter";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import {
  FormulaModal,
  SummaryLine,
  contributionsToSteps,
  type FormulaStep,
} from "@/components/characters/formula-modal";
import {
  OP_LABEL,
  OP_COLOR,
  formatOperandValue,
} from "@/components/characters/operator-symbol";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";
console.log("PHASE8_L20_BUILD_MARKER:", "-5090448014643774033");

import { PRACTICE_DESCRIPTIONS, type Practice } from "@/lib/primitives/target-scope";
// Phase 8.L: open the SAME preview modal the /atelier list uses.
// See preview-modal.tsx — useEntityPreview wraps sandbox library-preview-pane.
import { SIZE_CAPACITY, SIZE_LOAD, SIZE_BASE_SPEED } from "@/lib/engine/encumbrance";

/** Round 0.5 up (ceiling for positive, floor for negative). */
function roundUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0) return Math.ceil(value);
  return Math.floor(value);
}

/** Phase 8.I i3: check whether any contribution to a target carries
 * a condition that is either active OR non-computable. The * marker
 * surfaces when:
 * - hasCondition=true AND conditionActive=true (condition met, bonus applied)
 * - hasCondition=true AND conditionComputable=false (can't evaluate at
 *   sheet time → bonus included with * for table-side resolution)
 * Computable-false conditions do NOT trigger * (bonus is suppressed). */
function hasConditionalMarker(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
): boolean {
  return (byTarget[target] ?? []).some(
    (c) => c.hasCondition === true && (c.conditionActive === true || c.conditionComputable === false),
  );
}

/** Phase 8.I i3: count advantage/disadvantage stacks from
 * contributions that used `op: grant` with matching tags. */
function countStacks(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
  tag: string,
): number {
  // Phase 8.K K8: count from BOTH the local byTarget (legacy op=grant + tag)
  // AND the per-axis counter at behavior.advantage.<target> /
  // behavior.disadvantage.<target>.
  const local = (byTarget[target] ?? []).filter((c) =>
    c.op === "grant" && c.tags.includes(tag),
  ).length;
  const advKey = `behavior.${tag}.${target}`;
  const perAxis = (byTarget[advKey] ?? []).reduce(
    (sum, c) => sum + (c.op === "add" || c.op === "subtract" ? c.value : 0),
    0,
  );
  return local + perAxis;
}

/** Phase 8.I i3: find min/max floor/ceiling values from contributions
 * that used `op: set` with min/max operations. */
/**
 * Phase 8.L L21: filter + sum primitive contributions to capacity.
 * Targets include "capacity" (direct adds) and "load" (negative).
 */
/**
 * Split the resolver's capacity-side primitives into:
 *   - loadPrimitives: target in {carry_capacity, capacity} (capacity adds)
 *   - equipSlotPrimitives: target in {equip_slot}
 *   - sizePrimitives: target = size (informational — surfaced separately)
 *
 * Per Mashu L10: equip-slot primitives render below load primitives
 * so the layout reads top-to-bottom: capacity → load primitives →
 * load total → equip slots.
 */
function splitCapacityPrimitives(
  byTarget: ResolvedModifiers["byTarget"] | undefined,
): {
  loadPrimitives: ReadonlyArray<{
    id: number;
    name: string;
    op: string;
    value: number;
    target: string;
    provenance: { capabilityName: string | null; effectName: string | null; heritageName: string | null; accordion: string | null };
  }>;
  equipSlotPrimitives: ReadonlyArray<{
    id: number;
    name: string;
    op: string;
    value: number;
    target: string;
    provenance: { capabilityName: string | null; effectName: string | null; heritageName: string | null; accordion: string | null };
  }>;
} {
  if (!byTarget) return { loadPrimitives: [], equipSlotPrimitives: [] };
  const load: Array<{
    id: number;
    name: string;
    op: string;
    value: number;
    target: string;
    provenance: { capabilityName: string | null; effectName: string | null; heritageName: string | null; accordion: string | null };
  }> = [];
  const equip: Array<{
    id: number;
    name: string;
    op: string;
    value: number;
    target: string;
    provenance: { capabilityName: string | null; effectName: string | null; heritageName: string | null; accordion: string | null };
  }> = [];
  const capTargets = new Set(["carry_capacity", "capacity", "load"]);
  for (const target of ["carry_capacity", "capacity", "load", "equip_slot", "size"] as const) {
    const contribs = byTarget[target] ?? [];
    for (const c of contribs) {
      if (c.op !== "add" && c.op !== "subtract") continue;
      const entry = {
        id: c.primitiveId,
        name: c.primitiveName,
        op: c.op,
        value: c.value,
        target: c.target,
        provenance: {
          capabilityName: c.provenance.capabilityName ?? null,
          effectName: c.provenance.effectName ?? null,
          heritageName: c.provenance.heritageName ?? null,
          accordion: c.provenance.accordion ?? null,
        },
      };
      if (target === "equip_slot") {
        equip.push(entry);
      } else if (capTargets.has(target)) {
        load.push(entry);
      }
      // size target: ignore (handled by the size card separately)
    }
  }
  return { loadPrimitives: load, equipSlotPrimitives: equip };
}

function formatViaFromProvenance(p: { heritageName: string | null; capabilityName: string | null; effectName: string | null; accordion: string | null }): string {
  const parts: string[] = [];
  if (p.accordion) parts.push(p.accordion);
  if (p.heritageName) parts.push(p.heritageName);
  if (p.capabilityName) parts.push(p.capabilityName);
  if (p.effectName) parts.push(p.effectName);
  return parts.join(" → ");
}

function findFloor(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
): number | null {
  // Phase 8.L round 45: skip inhibited contributions.
  const vals = (byTarget[target] ?? []).filter(
    (c) =>
      !c.inhibited &&
      (c.op === "min" || (c.op === "set" && c.tags.includes("min"))),
  );
  if (vals.length === 0) return null;
  return Math.min(...vals.map((c) => c.value));
}

function findCeiling(
  byTarget: ResolvedModifiers["byTarget"],
  target: string,
): number | null {
  // Phase 8.L round 45: skip inhibited contributions.
  const vals = (byTarget[target] ?? []).filter(
    (c) =>
      !c.inhibited &&
      (c.op === "max" || (c.op === "set" && c.tags.includes("max"))),
  );
  if (vals.length === 0) return null;
  return Math.max(...vals.map((c) => c.value));
}

/** Phase 8.I i3: render all axis markers (*, adv/disadv, min/max)
 * as a compact badge group next to the numeric value. */
// Phase 8.J: helper functions for color rules and condition text.
function isPbHalfValue(value: unknown): boolean {
  if (
    value &&
    typeof value === "object" &&
    "kind" in value &&
    (value as { kind: string }).kind === "derived" &&
    "which" in value &&
    ((value as { which: string }).which === "pb" || (value as { which: string }).which === "pb_half")
  ) {
    return true;
  }
  return false;
}

function isExpertiseName(name: string): boolean {
  return /^expertise\b/i.test(name);
}

function isProficiencyName(name: string): boolean {
  return /^proficient\b/i.test(name);
}

/**
 * Phase 8.K K17: render condition tokens as styled chips with
 * AND/OR as distinct visual elements. AND = cyan chip, OR = amber chip.
 */
function renderConditionChips(condition: unknown): ReactNode {
  const c = condition as { kind?: string; tokens?: string[] };
  if (!c || !Array.isArray(c.tokens)) return null;
  return (
    <>
      {c.tokens.map((tok, i) => {
        if (tok === "AND" || tok === "OR") {
          const isAnd = tok === "AND";
          return (
            <span
              key={i}
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                isAnd
                  ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              }`}
            >
              {tok}
            </span>
          );
        }
        return (
          <span
            key={i}
            className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] italic text-amber-700 dark:text-amber-300"
          >
            {humanReadableToken(tok)}
          </span>
        );
      })}
    </>
  );
}

function AxisMarkers({
  byTarget,
  target,
}: {
  byTarget: ResolvedModifiers["byTarget"];
  target: string;
}) {
  const hasCond = hasConditionalMarker(byTarget, target);
  const adv = countStacks(byTarget, target, "advantage");
  const disadv = countStacks(byTarget, target, "disadvantage");
  const floor = findFloor(byTarget, target);
  const ceiling = findCeiling(byTarget, target);
  // Phase 8.L L19: net adv/disadv. 1 adv + 1 disadv cancel.
  // The larger wins; the count shown is the net count.
  const netAdv = adv - disadv;
  const markers: string[] = [];
  if (netAdv === 1) markers.push("⇈");
  else if (netAdv >= 2) markers.push(`⇈(${netAdv})`);
  else if (netAdv === -1) markers.push("⇊");
  else if (netAdv <= -2) markers.push(`⇊(${Math.abs(netAdv)})`);
  if (floor !== null) markers.push(`↥ ${floor}`);
  if (ceiling !== null) markers.push(`↧ ${ceiling}`);
  if (hasCond) markers.push("*");
  if (markers.length === 0) return null;
  return (
    <span
      className="ml-1 flex items-center gap-0.5 text-xs"
      title={markers.join(" ")}
    >
      {markers.map((m, i) => {
        // Color rules (Phase 8.I POST A9):
        // - ⇈(N) advantage stacks → emerald (green)
        // - ⇊(N) disadvantage stacks → red
        // - ↥/↧ floor/ceiling → amber
        // - * conditional → amber
        const isAdv = m.startsWith("⇈");
        const isDisadv = m.startsWith("⇊");
        const isFloor = m.startsWith("↥");
        const isCeil = m.startsWith("↧");
        const isCond = m === "*";
        const cls = isAdv
          ? "text-emerald-600 dark:text-emerald-400"
          : isDisadv
            ? "text-red-600 dark:text-red-400"
            : (isFloor || isCeil || isCond)
              ? "text-amber-600 dark:text-amber-400"
              : "";
        return (
          <span key={i} className={cls}>
            {m}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Reverse PB → level. PB starts at 2 and adds 1 every 4 levels.
 * Returns the lowest level consistent with this PB. Used for
 * displaying "Level bonus (floor(L / 4))" in the PB popup.
 */
function computeLevelFromPb(pb: number): number {
  if (pb <= 2) return 1;
  return (pb - 2) * 4 + 1;
}

export interface PracticeRowForSticky {
  readonly id?: number;
  readonly name: string;
  readonly category: string;
  readonly buCost: number;
  readonly attribute: "PHYSICAL" | "MENTAL" | "MAGICAL";
  readonly total: number;
  readonly isMirrored: boolean;
  readonly isMirrorable: boolean;
  readonly mirrorVector: string | null;
  readonly originHeritageId: string | null;
  readonly originCapabilityId: string | null;
  readonly originEffectId: string | null;
}

export interface EncumbranceForSticky {
  readonly load: number;
  readonly capacity: number;
  readonly percentOfCapacity: number;
  readonly encumbered: boolean;
  readonly heavilyEncumbered: boolean;
  readonly overburdened: boolean;
  // Phase 8.5 H-fix4 (Mashu 2026-08-03): equip-slot fields
  // were previously omitted from this type, which forced
  // <EquipSlotsPanel> to fall back to hardcoded `slotCount={6}`
  // / `usedSlots={0}` in the bottom drawer. Now that the type
  // carries them, the panel reads them off `encumbrance` and
  // updates whenever the encumbrance prop re-renders (e.g.
  // after an item equip toggle on the Items tab).
  readonly equipSlotsUsed: number;
  readonly equipSlotsAvailable: number;
}

export interface BottomStickyBarProps {
  readonly characterId: string;
  readonly currentVitality: number | null;
  readonly maxVitality: number;
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
  /** Raw attribute values BEFORE primitive modifiers. Used by
   * the provenance modal so the base value matches what the user
   * set in the character editor, not the computed final mod.
   * Falls back to `physical`/`mental`/`magical` if not provided. */
  readonly baseAttributes?: { physical: number; mental: number; magical: number };
  readonly pb: number;
  readonly proficientAttribute: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
  readonly attributeModifiers?: { physical: number; mental: number; magical: number };
  readonly resolver?: ResolvedModifiers;
  readonly practices: ReadonlyArray<PracticeRowForSticky>;

  // Phase 8.4: identity strip data (moved from Overview tab)
  readonly lineageName: string | null;
  readonly lineageDescription: string | null;
  readonly upbringingName: string | null;
  readonly upbringingDescription: string | null;
  readonly manifestName: string | null;
  readonly attrSum: number;
  readonly attrSumValid: boolean;

  // Phase 8.4: load/equip slots (moved from Overview tab)
  readonly encumbrance: EncumbranceForSticky;
  // Phase 8.4 v25: character size (e.g. "MEDIUM") for the
  // encumbrance formula popup. Drives SIZE_CAPACITY lookup.
  readonly characterSize: "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE" | "GARGANTUAN";

  // Phase 8.I i2 finish (Mashu 2026-08-06) - speed +
  // carry capacity + damage modifier cards from primitive walks.
  readonly speedByType: Readonly<Record<string, number>>;
  readonly carryCapacity: number;
  readonly damageModifiers: {
    readonly resistance: readonly string[];
    readonly vulnerability: readonly string[];
    readonly immunity: readonly string[];
  };
  // Phase 8.I Wave 6 (Mashu 2026-08-06): custom behavior
  // variables (legendary_resistance, action_points, etc.)
  readonly behaviorVariables: ReadonlyArray<{
    readonly key: string;
    readonly value: number;
    readonly contributions: ReadonlyArray<{
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }>;
  }>;
}

type ComboKind =
  | "mod+save"
  | "vitality"
  | "dc"
  | "atk"
  | "practice"
  | "practice-detail"
  | "pb"
  | "encumbrance"
  | "speed"
  | "behavior"
  | "damage"
  | "damage-type"
  | null;

export function BottomStickyBar({
  characterId,
  currentVitality,
  maxVitality,
  physical,
  mental,
  magical,
  baseAttributes,
  pb,
  proficientAttribute,
  attributeModifiers,
  resolver,
  practices,
  lineageName,
  lineageDescription,
  upbringingName,
  upbringingDescription,
  manifestName,
  attrSum,
  attrSumValid,
  encumbrance,
  characterSize,
  speedByType,
  carryCapacity,
  damageModifiers,
  behaviorVariables,
}: BottomStickyBarProps) {
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [combo, setCombo] = useState<ComboKind>(null);
  const [comboAttr, setComboAttr] = useState<"physical" | "mental" | "magical">("physical");
  const [comboBehaviorKey, setComboBehaviorKey] = useState<string>("");
  const [comboPractice, setComboPractice] = useState<{
    name: string;
    attribute: "physical" | "mental" | "magical";
    total: number;
  } | null>(null);
  const [comboDamageType, setComboDamageType] = useState<string | null>(null);
  const openDamageTypeModal = useCallback((type: string) => {
    setComboDamageType(type);
    setCombo("damage-type");
  }, []);



  useEffect(() => {
    setHydrated(true);
  }, []);

  const physMod = attributeModifiers?.physical ?? physical;
  const mentMod = attributeModifiers?.mental ?? mental;
  const magiMod = attributeModifiers?.magical ?? magical;
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? `+${n}` : `${n}`);

  function saveFor(attr: "physical" | "mental" | "magical", mod: number): number {
    // Phase 8.L round 113 (Mashu 2026-08-26): use the engine's
    // saveTotal directly. Engine seeds `<attr>_saving_throw` =
    // PB + mod + primitives + sub-target ops (e.g. magi x2 ×2).
    // Modal also reads saveTotal via L111. Chip = modal = engine.
    //
    // Note: engine always includes PB. UI formula text says
    // "PB if prof" — that's a separate inconsistency (engine
    // design choice, not addressed here).
    void mod;
    return resolver?.totals[`${attr}_saving_throw`] ?? pb;
  }
  const physSave = saveFor("physical", physMod);
  const mentSave = saveFor("mental", mentMod);
  const magiSave = saveFor("magical", magiMod);

  const primaryAttr: "physical" | "mental" | "magical" =
    (proficientAttribute?.toLowerCase() as
      | "physical" | "mental" | "magical" | undefined) ?? "physical";
  const primaryAttrLabel =
    primaryAttr === "physical" ? "PHYSICAL" : primaryAttr === "mental" ? "MENTAL" : "MAGICAL";
  const primaryMod =
    primaryAttr === "physical" ? physMod : primaryAttr === "mental" ? mentMod : magiMod;
  // Phase 8.M (Mashu 2026-08-12): engine now exposes SINGLE
  // attack_bonus / save_dc targets derived from the chosen
  // attribute (defaults to proficientAttribute). When the
  // character has multi-attribute proficiency, the modal
  // renders a selector to change `chosenAttribute`.
  //
  // Phase 8.L round 79: engine SEEDS totals[attack_bonus] and
  // totals[save_dc] with their base values (PB + attr mod for
  // attack; 8 + PB + attr mod for save DC). So the card reads
  // totals[...] DIRECTLY, without adding the base again. This
  // also means operations like divide/multiply work correctly
  // because the engine operates on the seeded base.
  const primaryDc = resolver?.totals["save_dc"] ?? 8 + pb + primaryMod;

  // Attack Bonus = PB + PrimaryAttribute mod + primitive bonuses
  // The single attack_bonus target already includes the primitive
  // contributions for the chosen attribute AND is seeded with
  // the base (PB + chosen attr mod).
  const atkFloor = findFloor(resolver?.byTarget ?? {}, "attack_bonus");
  const atkCeiling = findCeiling(resolver?.byTarget ?? {}, "attack_bonus");
  const primaryAttackBonus = resolver?.totals["attack_bonus"] ?? pb + primaryMod;

  // Phase 8.M: selector state for multi-attribute attack_bonus / save_dc.
  // Default to the proficient attribute (or physical fallback). User
  // can change in the modal when multi-attr primitives exist.
  const [chosenAttackAttr, setChosenAttackAttr] = useState<
    "physical" | "mental" | "magical"
  >(
    (proficientAttribute?.toLowerCase() as
      | "physical" | "mental" | "magical"
      | undefined) ?? "physical",
  );
  const [chosenSaveAttr, setChosenSaveAttr] = useState<
    "physical" | "mental" | "magical"
  >(
    (proficientAttribute?.toLowerCase() as
      | "physical" | "mental" | "magical"
      | undefined) ?? "physical",
  );

  // Phase 8.M: detect multi-attribute attack_bonus / save_dc
  // primitives so the modal can show a selector.
  // Phase 8.L round 129 (Mashu Q1): the attack bonus
  // selector shows only attributes the user is proficient
  // in. Previously it showed any attribute that had
  // attack_bonus primitives, but the user can only "scale
  // with" an attribute they're proficient in.
  const profAttr = proficientAttribute?.toLowerCase() ?? null;
  const atkAttrsWithPrimitives: Array<"physical" | "mental" | "magical"> = [];
  if (profAttr === "physical" || profAttr === "mental" || profAttr === "magical") {
    atkAttrsWithPrimitives.push(profAttr);
  }
  const showAttackSelector = atkAttrsWithPrimitives.length > 1;

  // Phase 8.L round 129 (Mashu Q1): the save DC selector
  // shows only attributes the user is proficient in.
  // Previously it showed any attribute with DC primitives,
  // but the user can only "scale with" an attribute they're
  // proficient in (DC primitives targeting other attributes
  // are silently ignored).
  const saveAttrsWithPrimitives: Array<"physical" | "mental" | "magical"> = [];
  if (profAttr === "physical" || profAttr === "mental" || profAttr === "magical") {
    saveAttrsWithPrimitives.push(profAttr);
  }
  const showSaveSelector = saveAttrsWithPrimitives.length > 1;

  const PRACTICE_ATTR_LABEL: Record<"PHYSICAL" | "MENTAL" | "MAGICAL", string> = {
    PHYSICAL: "Physical",
    MENTAL: "Mental",
    MAGICAL: "Magic",
  };

  const effectiveCurrent = currentVitality ?? maxVitality;
  const vitalityPercent =
    maxVitality > 0
      ? Math.max(0, Math.min(100, Math.round((effectiveCurrent / maxVitality) * 100)))
      : 0;
  const vitalityColor =
    vitalityPercent < 25
      ? "bg-destructive"
      : vitalityPercent < 50
        ? "bg-amber-500"
        : "bg-green-500";

  // Open the combined mod + save provenance modal for an attribute.
  const openModSaveModal = useCallback(
    (attr: "physical" | "mental" | "magical") => {
      setComboAttr(attr);
      setCombo("mod+save");
    },
    [],
  );
  const openVitalityModal = useCallback(() => setCombo("vitality"), []);
  const openDcModal = useCallback(() => setCombo("dc"), []);
  // Phase 8.5 H6: Attack Bonus modal
  const openAtkModal = useCallback(() => setCombo("atk"), []);
  const openPracticeModal = useCallback(
    (attr: "physical" | "mental" | "magical") => {
      setComboAttr(attr);
      setCombo("practice");
    },
    [],
  );
  const openEncumbranceModal = useCallback(() => setCombo("encumbrance"), []);
  const openSpeedModal = useCallback(() => setCombo("speed"), []);
  const openBehaviorModal = useCallback((key: string) => {
    setComboBehaviorKey(key);
    setCombo("behavior");
  }, []);

  // Phase 8.4 v8 (Mashu 2026-07-28): per-practice modal —
  // each individual practice row opens a modal showing
  // its total + the resolver contributions that produced
  // that total. The column-level modal (openPracticeModal)
  // remains for the column "hey what makes physical
  // practices tick" case.
  const openPracticeDetailModal = useCallback(
    (
      p: {
        name: string;
        attribute: "PHYSICAL" | "MENTAL" | "MAGICAL";
        total: number;
      },
    ) => {
      setComboPractice({
        name: p.name,
        attribute: p.attribute.toLowerCase() as "physical" | "mental" | "magical",
        total: p.total,
      });
      setCombo("practice-detail");
    },
    [],
  );

  if (!hydrated) return null;

  const resolver_ = resolver as ResolvedModifiers | undefined;
  const totals = resolver_?.totals ?? {};
  const byTarget = resolver_?.byTarget ?? {};
  const attrTarget = `attribute.${comboAttr}`;
  // Phase 8.L round 102 (Mashu): saveTarget must be the
  // PHYSICAL_SAVING_THROW target, not save_dc.<attr>!
  // The previous code was using save_dc.physical which made
  // the PHYSICAL "save" total = attrTotal + save_dc_total + PB,
  // double-counting save DC into the save display. Now uses
  // the dedicated saving_throw target.
  const saveTarget = comboAttr === "physical"
    ? "physical_saving_throw"
    : comboAttr === "mental"
      ? "mental_saving_throw"
      : "magical_saving_throw";
  // Phase 8.M: SINGLE save_dc target (no attr suffix). Engine
  // routes primitives for the chosen attribute to this target.
  const dcTarget = "save_dc";
  const practiceTarget = `skill_practice_check`;
  const vitalityTarget = "max_vitality";

  // Phase 8.I i3: * marker for conditional modifiers — see
  // hasConditionalMarker() module-level helper.

  return (
    <div
      className="fixed bottom-12 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md"
      data-testid="bottom-sticky-bar"
      data-expanded={expanded}
    >
      {/* Header bar — always visible. The TOGGLE.
          Phase 8.4 v10 (Mashu 2026-07-28): right padding
          doubled (`pr-12`) again because the FAB was still
          covering PB/DC. PB/DC inner gap also doubled
          (`gap-6`) for more breathing room. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-b border-border pl-3 pr-16 py-1.5 text-sm hover:bg-secondary/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse quick dock" : "Expand quick dock"}
      >
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-semibold text-foreground">
            <Heart className="size-3.5 text-rose-500" />
            {effectiveCurrent}/{maxVitality}
          </span>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            {(
              [
                { label: "P", mod: physMod },
                { label: "ME", mod: mentMod },
                { label: "MA", mod: magiMod },
              ] as const
            ).map(({ label, mod }) => (
              <div key={label} className="flex flex-col items-center leading-none">
                <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                  {label}
                </span>
                <span className="font-bold tabular-nums">{fmt(mod)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6 font-mono text-xs">
            {/* Phase 8.5 H7 round 5 (Mashu 2026-08-03):
                PB / DC / ATK in the small header are NOT
                clickable — they're at-a-glance readouts.
                The provenance modal opens from the body
                cards (the meta-stat row when the drawer
                is expanded). Including buttons here made
                the header feel like a button farm and the
                user explicitly asked for the modal click
                to live on the cards only. */}
            <div className="flex flex-col items-center leading-none">
              <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                PB
              </span>
              <span className="font-bold tabular-nums text-teal-700 dark:text-teal-200">
                {fmt(pb)}
              </span>
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                DC
              </span>
              <span className="font-bold tabular-nums text-teal-700 dark:text-teal-200">
                {primaryDc}
              </span>
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                ATK
              </span>
              <span className="font-bold tabular-nums text-teal-700 dark:text-teal-200">
                {fmt(primaryAttackBonus)}
              </span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Drawer content — only when expanded. Grows upward
          with max-h-[70dvh] so the user can see most of the
          page's content even when expanded. On mobile this
          is essentially the entire visible viewport. */}
      {expanded && (
        <div
          className="px-2 pb-3 pt-1.5 max-h-[70dvh] overflow-y-auto"
          data-testid="bottom-sticky-bar-drawer"
        >
          {/* 1. Vitality header + bar + buttons.
              The header + numbers + bar are all clickable
              to open the max-vitality provenance modal.
              The Damage/Heal/Long-rest/Short-rest buttons
              live in their own row to avoid click conflicts. */}
          <div className="mt-2 rounded-md border border-border bg-card px-2 py-1.5">
            <button
              type="button"
              onClick={openVitalityModal}
              className="block w-full text-left"
              title="Show provenance for max vitality"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Vitality
                </p>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {vitalityPercent}%
                </span>
              </div>
              <p className="mt-0.5 font-mono text-xl font-bold leading-none">
                {effectiveCurrent}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {maxVitality}
                </span>
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${vitalityColor}`}
                  style={{ width: `${vitalityPercent}%` }}
                />
              </div>
            </button>

            <div className="mt-1.5 flex flex-nowrap gap-1">
              <VitalityTracker
                characterId={characterId}
                max={maxVitality}
                current={effectiveCurrent}
                compact
              />
            </div>
          </div>

          {/* 2. Mods + saves + PB — 4 chips. Each is clickable for
              a formula popup. The proficient chip gets a "PROF" tag.
              PB is the 4th card (Phase 8.4 v25 — moved here from
              the bottom grid so the user sees it next to the mods). */}
          <div className="mt-2 mb-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mods + saves
            </p>
            {/* Phase 8.5 H7 (Mashu 2026-08-03): PB removed from
                  this row and moved into the meta-stat row
                  below alongside ATK and Save DC. Grid is now
                  grid-cols-3 for the three attributes. */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { attr: "physical", label: "PHYS", mod: physMod, save: physSave },
                  { attr: "mental", label: "MENT", mod: mentMod, save: mentSave },
                  { attr: "magical", label: "MAGI", mod: magiMod, save: magiSave },
                ] as const
              ).map(({ attr, label, mod: m, save: s }) => {
                // Phase 8.L round 134 (Mashu): PROF tag also
                // appears when proficiency is granted via
                // conditions (grant keyword [proficiency] /
                // [proficiency_bonus] / [expertise] / derived
                // (pb | expertise) on target=attribute.<attr>).
                // Detected by checking the
                // <attr>_saving_throw contributions — the
                // engine materializes each grant as a PB-sized
                // addition to that target.
                const saveContribs = resolver?.byTarget?.[`${attr}_saving_throw`] ?? [];
                const grantedProf = saveContribs.some(
                  (c) => c.op === "add" && c.value === pb,
                );
                const isProf = proficientAttribute?.toLowerCase() === attr || grantedProf;
                return (
                  <button
                    key={attr}
                    type="button"
                    onClick={() => openModSaveModal(attr)}
                    className={`flex flex-col items-center justify-center rounded border-2 bg-card px-1 py-1.5 text-center transition-colors hover:bg-secondary/30 ${
                      isProf ? "border-teal-500" : "border-border"
                    }`}
                    title={`Show formula for ${label} mod + save`}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={`text-[8px] font-semibold uppercase ${
                          isProf
                            ? "text-teal-700 dark:text-teal-300"
                            : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </span>
                      {isProf && (
                        <span className="rounded bg-teal-500/15 px-1 py-0.5 text-[7px] font-bold uppercase text-teal-700 dark:text-teal-300">
                          PROF
                        </span>
                      )}
                    </span>
                    <span className="mt-1 flex items-center justify-center gap-0.5 font-mono text-base font-bold tabular-nums leading-none">
                      {fmt(m)}
                      <AxisMarkers byTarget={byTarget} target={`attribute.${attr}`} />
                    </span>
                    <span className="mt-1.5 text-[9px] text-muted-foreground">
                      save: <span className={cn("font-mono font-semibold", (byTarget[`save_dc.${attr}`] ?? []).length > 0 && "text-teal-700 dark:text-teal-300")}>{fmt(s)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. PB (left) + Attack Bonus (mid) + Save DC (right)
              — three teal-accented "meta-stat" cards on a
              single row at all widths. Phase 8.5 H7 (Mashu
              2026-08-03): PB joined ATK + Save DC here; it was
              previously in the attribute row above. */}
          <div className="mb-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCombo("pb")}
              className="block w-full rounded-md border-2 border-teal-500/60 bg-teal-500/5 px-2 py-2 text-left transition-colors hover:bg-teal-500/10"
              title="Show formula for Proficiency Bonus"
              aria-label="Show proficiency bonus formula"
            >
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                    PB
                  </p>
                  <p className="text-[9px] text-teal-700/70 dark:text-teal-300/70">
                    starts +2
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
                  {fmt(pb)}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={openAtkModal}
              className="block w-full rounded-md border border-border bg-card px-2 py-2 text-left transition-colors hover:bg-secondary/30"
              title="Show formula for Attack Bonus"
              aria-label="Show attack bonus formula"
            >
              <div className="flex items-center justify-between gap-1">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Attack Bonus
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {primaryAttrLabel}
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
                  {fmt(primaryAttackBonus)}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={openDcModal}
              className="block w-full rounded-md border border-border bg-card px-2 py-2 text-left transition-colors hover:bg-secondary/30"
              title="Show provenance for Save DC"
              aria-label="Show save DC formula"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Save DC
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    from {primaryAttrLabel}
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
                  {primaryDc}
                  <AxisMarkers byTarget={byTarget} target={dcTarget} />
                </span>
              </div>
            </button>
          </div>

          {/* 4. Practices — 3 columns, capitalized. Each
              column is clickable for practice provenance. */}
          <div>
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Practices
            </p>
            {practices.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                No practices slotted.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {(["PHYSICAL", "MENTAL", "MAGICAL"] as const).map((attr) => {
                  // Phase 8.L round 68 (Mashu 2026-08-20): keep
                  // practices in server's canonical order
                  // (prowess, finesse, fieldcraft, etc.). DON'T
                  // sort by total — that reorders whenever a
                  // condition toggles, making it hard to find
                  // the same practice across sessions.
                  const rows = practices.filter(
                    (p) => p.attribute === attr,
                  );
                  const isProf = proficientAttribute === attr;
                  const attrLower = attr.toLowerCase() as "physical" | "mental" | "magical";
                  return (
                    <button
                      key={attr}
                      type="button"
                      onClick={() => openPracticeModal(attrLower)}
                      className={`rounded border-2 bg-card px-2 py-1.5 text-left transition-colors hover:bg-secondary/30 ${
                        isProf ? "border-teal-500" : "border-border"
                      }`}
                      title={`Show ${PRACTICE_ATTR_LABEL[attr]} practice provenance`}
                    >
                      <p
                        className={`mb-1.5 text-xs font-semibold capitalize ${
                          isProf
                            ? "text-teal-700 dark:text-teal-300"
                            : "text-foreground"
                        }`}
                      >
                        {PRACTICE_ATTR_LABEL[attr]}
                      </p>
                      {rows.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">
                          —
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {rows.map((p) => {
                            // Phase 8.L round 45 (Mashu 2026-08-13):
                            // compute the practice total from the
                            // CLIENT resolver (not the server prop).
                            // The resolver respects the toggle state
                            // (cap OFF / effect OFF), so primitive
                            // contributions under an inactive cap
                            // are excluded from the totals — and now
                            // from the bottom-drawer cell.
                            //
                            // Formula: total = base attr modifier
                            // + PB (if proficient)
                            // + resolver.totals["skill_practice_check.<name>"]
                            //
                            // The resolver's totals already include
                            // the floor/ceiling clamping + condition
                            // gating, so we just add the static
                            // parts on top.
                            const practiceAttrMod =
                              p.attribute === 'PHYSICAL' ? physMod :
                              p.attribute === 'MENTAL' ? mentMod :
                              magiMod;
                            const practiceIsProf =
                              proficientAttribute === p.attribute;
                            const practiceTotal =
                              practiceAttrMod +
                              (practiceIsProf ? pb : 0) +
                              (resolver?.totals[`skill_practice_check.${p.name.toLowerCase()}`] ?? 0);
                            const total = practiceTotal;
                            // L25: detect helper primitive kinds in this
                            // practice's modifiers. PB/2 detection via
                            // formula-modal helpers is inlined here.
                            const practiceContribs = byTarget[`skill_practice_check.${p.name.toLowerCase()}`] ?? [];
                            const hasExp = practiceContribs.some(
                              (c) => c.primitiveName.toLowerCase().startsWith("expertise") || c.primitiveName.toLowerCase().includes("expertise"),
                            );
                            const hasProf = practiceContribs.some(
                              (c) => c.primitiveName.toLowerCase().startsWith("proficient") || c.primitiveName.toLowerCase().includes("proficient"),
                            );
                            const hasPbHalf = practiceContribs.some(
                              (c) =>
                                c.value === 0 &&
                                !!c.rawValue &&
                                typeof c.rawValue === "object" &&
                                (c.rawValue as { kind?: string }).kind === "derived" &&
                                ((c.rawValue as { which?: string }).which === "pb_half"),
                            );
                            const nameCol = hasExp
                              ? "font-bold text-teal-700 dark:text-teal-200"
                              : hasProf
                                ? "text-teal-700 dark:text-teal-200"
                                : "text-foreground";
                            const valCol = hasExp
                              ? "font-bold text-teal-700 dark:text-teal-200"
                              : hasProf
                                ? "font-semibold text-teal-700 dark:text-teal-200"
                                : hasPbHalf
                                  ? "font-semibold text-teal-700 dark:text-teal-200"
                                  : "text-foreground";
                            return (
                            <li key={p.id ?? p.name}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPracticeDetailModal({ ...p, total });
                                }}
                                className="flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left hover:bg-secondary/30"
                                title={`Show provenance for ${p.name}`}
                              >
                                <span className={`truncate text-xs capitalize ${nameCol}`}>
                                  {p.name}
                                </span>
                                <span className={`flex items-center gap-0.5 shrink-0 font-mono text-xs tabular-nums ${valCol}`}>
                                  {fmt(total)}
                                  <AxisMarkers byTarget={byTarget} target={`skill_practice_check.${p.name.toLowerCase()}`} />
                                </span>
                              </button>
                            </li>
                            );
                          })}
                        </ul>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Load + Equip slots (BOTTOM of drawer). */}
          {/* Phase 8.4 v25: 2-column layout — Load (left) and
              Equip slots (right). PB moved to the mod+saves row. */}
          {/* Phase 8.5 H-fix4 (Mashu 2026-08-03): EquipSlotsPanel
              was receiving hardcoded `slotCount={6} usedSlots={0}`,
              which is why the drawer showed zero equipped slots
              regardless of how many items the character had
              equipped. Now reads from encumbrance.equipSlotsUsed /
              encumbrance.equipSlotsAvailable, which the engine
              already returns on sheet.encumbrance (the ItemsTab
              worked because it pulls the same fields directly). */}
          <div className="mt-2 rounded-md border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              <LoadCell encumbrance={encumbrance} onClick={openEncumbranceModal} />
              <EquipSlotsPanel
                slotCount={encumbrance.equipSlotsAvailable}
                usedSlots={encumbrance.equipSlotsUsed}
                onClick={openEncumbranceModal}
              />
            </div>
          </div>

          {/* Phase 8.I i2 finish (Mashu 2026-08-06): speed +
              carry capacity cards from primitive walks. */}
          {/* Speed card only — carry/load handled by LoadCell above. */}
          <div className="mt-2 rounded-md border border-border bg-card overflow-hidden">
            <SpeedCard speedByType={speedByType} onClick={openSpeedModal} />
          </div>

          {/* Phase 8.I i2 finish: damage modifier cards
              (resistance / vulnerability / immunity). */}
          {(damageModifiers.resistance.length > 0 ||
            damageModifiers.vulnerability.length > 0 ||
            damageModifiers.immunity.length > 0) && (
            <div className="mt-2 rounded-md border border-border bg-card px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Damage Modifiers
              </p>
              <div className="mt-1 space-y-1">
                {damageModifiers.resistance.length > 0 && (
                  <DamageModifierRow
                    label="Resistance"
                    types={damageModifiers.resistance}
                    colorClass="text-sky-700 dark:text-sky-300"
                    onClick={(type) => openDamageTypeModal(type)}
                  />
                )}
                {damageModifiers.vulnerability.length > 0 && (
                  <DamageModifierRow
                    label="Vulnerability"
                    types={damageModifiers.vulnerability}
                    colorClass="text-orange-700 dark:text-orange-300"
                    onClick={(type) => openDamageTypeModal(type)}
                  />
                )}
                {damageModifiers.immunity.length > 0 && (
                  <DamageModifierRow
                    label="Immunity"
                    types={damageModifiers.immunity}
                    colorClass="text-purple-700 dark:text-purple-300"
                    onClick={(type) => openDamageTypeModal(type)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Phase 8.I Wave 6 (Mashu 2026-08-06): custom behavior
              variables (legendary_resistance, action_points, etc.).
              Each variable shows its current value + the
              contributing primitives. */}
          {behaviorVariables.length > 0 && (
            <div className="mt-2 rounded-md border border-border bg-card px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Behavior Variables
              </p>
              <div className="mt-1 space-y-1">
                {behaviorVariables.map((bv) => (
                  <BehaviorVariableRow key={bv.key} bv={bv} onClick={() => openBehaviorModal(bv.key)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provenance modal. The combo state decides which
          target + label to show. For "mod+save" we render
          a custom two-section modal instead of the standard
          single-target modal. */}
      {combo && resolver_ && (
        combo === "mod+save" ? (
          // ModSaveProvenanceModal keeps its own two-section layout
          // (mod + save). It still uses FormulaModal internally
          // for each section so the structure is consistent.
          <ModSaveProvenanceModal
            attr={comboAttr}
            attrTarget={attrTarget}
            attrLabel={`${comboAttr.toUpperCase()} modifier`}
            saveTarget={saveTarget}
            saveLabel={`${comboAttr.toUpperCase()} save`}
            saveBase={
              comboAttr === "physical"
                ? (baseAttributes?.physical ?? physical)
                : comboAttr === "mental"
                  ? (baseAttributes?.mental ?? mental)
                  : (baseAttributes?.magical ?? magical)
            }
            pb={pb}
            isProf={proficientAttribute?.toLowerCase() === comboAttr}
            resolver={resolver_}
            onClose={() => setCombo(null)}
          />
        ) : combo === "vitality" ? (
          <FormulaModal
            title="Max Vitality"
            total={maxVitality}
            formula="Max Vitality = (10 + PB) × level + vitality primitive contributions"
            breakdown={contributionsToSteps(vitalityTarget, resolver_)}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
        ) : combo === "dc" ? (
          // Phase 8.M: when defense_dc primitives target multiple
          // attributes, the Save DC modal reads from the chosen
          // attribute (selected via the dropdown below).
          (() => {
            const dcAttr = (saveAttrsWithPrimitives.includes(chosenSaveAttr)
              ? chosenSaveAttr
              : primaryAttr) as "physical" | "mental" | "magical";
            const dcAttrLabel =
              dcAttr === "physical" ? "PHYSICAL" :
              dcAttr === "mental" ? "MENTAL" : "MAGICAL";
            // Phase 8.L round 82: dcTotal now reads directly from
            // resolver.totals["save_dc"], which the engine seeds
            // with 8+PB+attr_mod and includes per-attr + direct
            // contributions. The previous `5 + pb + dcMod +
            // dcPrimitiveBonus` formula was double-counting the
            // base. Note: dcMod was the FULL attribute value (not
            // the modifier) — another bug masked by the base=5.
            // Phase 8.L round 109 (Mashu): the engine seeds
            // save_dc with the RAW attribute (not computed),
            // so the breakdown needs to include that raw value.
            const dcAttrBase =
              dcAttr === "physical"
                ? baseAttributes?.physical ?? physical
                : dcAttr === "mental"
                  ? baseAttributes?.mental ?? mental
                  : baseAttributes?.magical ?? magical;
            const dcTotal = resolver?.totals["save_dc"] ?? 8 + pb + dcAttrBase;
            return (
          <FormulaModal
            title={`Save DC (${dcAttrLabel})`}
            subtitle="from the chosen attribute"
            total={dcTotal}
            formula={`Save DC = ${dcTotal} (= 8 + PB + ${dcAttrLabel} attribute + save_dc.${dcAttr} primitives)`}
            breakdown={[
              { label: "Base", value: 8 },
              { label: "PB", value: pb },
              // Phase 8.L round 109 (Mashu): include the raw
              // attribute value as a step. The engine uses RAW
              // attr (not computed) for save_dc, so this is the
              // value the engine adds. Without this step, the
              // breakdown sum doesn't match the displayed total
              // when there are save_dc primitives.
              { label: `${dcAttrLabel} attribute`, value: dcAttrBase },
              // Phase 8.L round 88: dcTotal already includes the
              // base (8+PB+chosen_attr) from the engine seed. So
              // we only show primitive contributions here, not the
              // base + PB + modifier (those are baked in).
              //
              // Phase 8.L round 93: ALSO pull from save_dc (parent)
              // so conditions targeting save_dc (e.g. dc_min
              // divide 3) appear in the breakdown. Without this,
              // the user's divide-by-3 condition would be invisible
              // and the breakdown sum would not match the displayed
              // total (which is divided).
              ...contributionsToSteps(`defense_dc.${dcAttr}`, resolver_),
              ...contributionsToSteps(`save_dc.${dcAttr}`, resolver_),
              ...contributionsToSteps(`save_dc`, resolver_),
            ]}
            selector={
              showSaveSelector
                ? {
                    label: "Scales with attribute",
                    value: dcAttr,
                    options: saveAttrsWithPrimitives.map((a) => ({
                      value: a,
                      label:
                        a === "physical" ? "PHYSICAL" :
                        a === "mental" ? "MENTAL" : "MAGICAL",
                    })),
                    onChange: (v) => setChosenSaveAttr(v as "physical" | "mental" | "magical"),
                  }
                : null
            }
            onClose={() => setCombo(null)}

            characterId={characterId}          />
            );
          })()
        ) : combo === "practice" ? (
          <FormulaModal
            title={`${comboAttr.toUpperCase()} practice`}
            total={
              (resolver_.totals[practiceTarget] ?? 0) +
              (comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod) +
              (proficientAttribute?.toLowerCase() === comboAttr ? pb : 0)
            }
            formula={`Practice = ${comboAttr.toUpperCase()} attribute (mod) + PB (if proficient) + practice primitive contributions`}
            breakdown={[
              {
                label: `${comboAttr.toUpperCase()} attribute (mod)`,
                value:
                  comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod,
              },
              ...contributionsToSteps(practiceTarget, resolver_),
              ...(proficientAttribute?.toLowerCase() === comboAttr
                ? [{ label: "PB (proficient)", value: pb }]
                : []),
            ]}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
        ) : combo === "practice-detail" && comboPractice ? (
          // PracticeDetailModal keeps its own layout — per-row
          // provenance. It uses FormulaModal for the formula +
          // summary, then the contrib list.
          <PracticeDetailModal
            practice={comboPractice}
            byTarget={byTarget}
            characterId={characterId}
            pb={pb}
            attrBase={
              comboPractice.attribute === "physical" ? physical :
              comboPractice.attribute === "mental" ? mental : magical
            }
            attrMod={
              comboPractice.attribute === "physical" ? physMod :
              comboPractice.attribute === "mental" ? mentMod : magiMod
            }
            isProf={proficientAttribute?.toLowerCase() === comboPractice.attribute}
            onClose={() => {
              setCombo(null);
              setComboPractice(null);
            }}
          />
        ) : combo === "pb" ? (
          // Proficiency Bonus popup. PB is purely a function of
          // level (starts at +2, +1 every 4 levels). There are no
          // primitive contributions in the current system — the
          // formula is fully static.
          <FormulaModal
            title="Proficiency Bonus"
            total={pb}
            formula={`PB = 2 + floor(level / 4) — starts at +2, +1 every 4 levels`}
            breakdown={[
              { label: "Base PB", value: 2 },
              { label: `Level bonus (floor(${computeLevelFromPb(pb)} / 4))`, value: pb - 2 },
            ]}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
        ) : combo === "atk" ? (
          // Phase 8.M: when primitives target attack_bonus for
          // multiple attributes, the modal reads from the chosen
          // attribute (selected via the dropdown below).
          (() => {
            const atkAttr = (atkAttrsWithPrimitives.includes(chosenAttackAttr)
              ? chosenAttackAttr
              : primaryAttr) as "physical" | "mental" | "magical";
            const atkAttrLabel =
              atkAttr === "physical" ? "PHYSICAL" :
              atkAttr === "mental" ? "MENTAL" : "MAGICAL";
            // Phase 8.L round 83: atkTotal reads directly from
            // resolver.totals['attack_bonus']. atkMod is the FULL
            // attribute value (e.g. 14 for phys_attr=14). The
            // "modifier" computed in the breakdown is (atkMod-10)/2.
            const atkMod = atkAttr === "physical" ? physMod :
              atkAttr === "mental" ? mentMod : magiMod;
            const atkTotal = resolver?.totals["attack_bonus"] ?? pb;
            const atkSelectorFloor = findFloor(
              resolver?.byTarget ?? {}, `attack_bonus.${atkAttr}`,
            );
            const atkSelectorCeiling = findCeiling(
              resolver?.byTarget ?? {}, `attack_bonus.${atkAttr}`,
            );
            return (
          // Phase 8.5 H6: Attack Bonus popup. Mirrors the PB popup
          // shape so future attribute/scope options can plug in
          // without rewiring.
          <FormulaModal
            title="Attack Bonus"
            subtitle={`${atkAttrLabel} — to-hit roll`}
            total={atkTotal}
            formula={`Attack Bonus = ${atkTotal} (= PB + ${atkAttrLabel} modifier + attack_bonus.${atkAttr} primitives)`}
            breakdown={[
              // Phase 8.L round 83: the breakdown shows PB and the
              // chosen-attribute modifier as separate steps, then
              // any primitive contributions. The user wants to SEE
              // the components that make up the total.
              //
              // Note: atkMod here is the FULL attribute value
              // (e.g. 14 for phys_attr=14). The "modifier" is
              // (attr-10)/2 — that's the D&D formula. So we
              // compute the modifier inline rather than passing
              // atkMod (which would be the full attribute).
              // Phase 8.L round 88: in this system, "modifier" means
              // the FULL attribute value (e.g. 4 for phys_attr=4),
              // NOT the D&D (attr-10)/2 modifier. The formula text
              // says "modifier = base attribute value + primitive
              // contributions" — explicit.
              { label: "Proficiency Bonus", value: pb },
              { label: `${atkAttrLabel} attribute`, value: atkMod },
              // Phase 8.L round 104 (Mashu): Mark of the Hunt was
              // appearing twice in the breakdown — once from
              // attack_bonus.physical (per-attr) and once from
              // attack_bonus (parent). The L81 reapply merges
              // per-attr entries into the parent, causing the
              // duplicate. Removed the duplicate.
              ...contributionsToSteps(`attack_bonus.${atkAttr}`, resolver_),
              ...(atkSelectorFloor !== null && atkTotal < atkSelectorFloor
                ? [{ label: `Minimum to-hit (floor ${atkSelectorFloor})`, value: atkSelectorFloor }]
                : []),
              { label: "= Attack Bonus", value: atkTotal },
            ]}
            selector={
              showAttackSelector
                ? {
                    label: "Scales with attribute",
                    value: atkAttr,
                    options: atkAttrsWithPrimitives.map((a) => ({
                      value: a,
                      label:
                        a === "physical" ? "PHYSICAL" :
                        a === "mental" ? "MENTAL" : "MAGICAL",
                    })),
                    onChange: (v) => setChosenAttackAttr(v as "physical" | "mental" | "magical"),
                  }
                : null
            }
            info={{
              title: "Attribute-Driven Attack Bonus",
              body: (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Attack Bonus scales with your PROFICIENT attribute
                    ({primaryAttrLabel}). Future phases will surface
                    weapon/spell selection so the same card can drive a
                    different attribute for specific attacks. The
                    primitive total{" "}
                    <span className="font-mono text-foreground">
                      `attack_bonus`
                    </span>{" "}
                    is read from the resolver when present.
                  </p>
                </div>
              ),
            }}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
            );
          })()
        ) : combo === "speed" ? (
          <FormulaModal
            title="Walking Speed"
            subtitle={`base speed (${SIZE_BASE_SPEED[characterSize]} ft for ${characterSize}) + primitive contributions`}
            total={speedByType["WALKING_SPEED"] ?? 0}
            formula={`Speed = Size base (${SIZE_BASE_SPEED[characterSize]} ft for ${characterSize}) + primitive contributions (speed.walking)`}
            info={{
              title: "Speed by size",
              body: (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Speed by size</p>
                  <table className="mt-1 w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-1 text-left uppercase">Size</th>
                        <th className="py-1 text-right uppercase">Walk</th>
                        <th className="py-1 text-right uppercase">Swim</th>
                        <th className="py-1 text-right uppercase">Climb</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {(["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const).map((sz) => (
                        <tr key={sz} className={sz === characterSize ? "bg-teal-500/10" : ""}>
                          <td className="py-0.5">{sz.toLowerCase()}</td>
                          <td className="py-0.5 text-right tabular-nums">{SIZE_BASE_SPEED[sz]}</td>
                          <td className="py-0.5 text-right tabular-nums">{roundUp(SIZE_BASE_SPEED[sz] / 2)}</td>
                          <td className="py-0.5 text-right tabular-nums">{roundUp(SIZE_BASE_SPEED[sz] / 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Swim and climb speeds default to half the base walking speed (rounded up).
                    Burrow and flight start at 0 — must be granted by primitives.
                  </p>
                </div>
              ),
            }}
            breakdown={[
              { label: `Size base (${characterSize})`, value: SIZE_BASE_SPEED[characterSize] ?? 30 },
              ...contributionsToSteps("speed.walking", resolver_, [
                { label: `WALKING_SPEED primitive total`, value: (resolver_?.totals["speed.walking"] ?? 0) },
              ]),
            ]}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
        ) : combo === "behavior" ? (
          // Phase 8.L round 33 (Mashu 2026-08-13): the behavior
          // variable's `contributions` prop only carries
          // primitiveName + delta. Look up the full contribution
          // (with provenance) from the resolver's byTarget so
          // the inheritance breadcrumb renders.
          (() => {
            const bv = behaviorVariables.find((b) => b.key === comboBehaviorKey);
            const target = bv ? `behavior.${bv.key}` : "";
            const resolverContribs = target
              ? (resolver?.byTarget[target] ?? [])
              : [];
            // Build a name → contribution lookup so we can attach
            // the provenance to each bv.contributions entry.
            const provByName = new Map<string, typeof resolverContribs[number]>();
            for (const c of resolverContribs) {
              provByName.set(c.primitiveName, c);
            }
            return (
              <FormulaModal
                title="Behavior Variable"
                subtitle={`primitive contributions to ${bv?.key ?? comboBehaviorKey}`}
                total={bv?.value ?? 0}
                formula="Behavior value = primitive `set` ops targeting behavior"
                breakdown={bv?.contributions.flatMap((c) => {
                  const full = provByName.get(c.primitiveName);
                  if (!full) return [];
                  const via = formatViaFromProvenance(full.provenance);
                  return via
                    ? [{ label: c.primitiveName, value: c.delta, via, contribution: full }]
                    : [{ label: c.primitiveName, value: c.delta, contribution: full }];
                }) ?? []}
                onClose={() => setCombo(null)}
                characterId={characterId}
              />
            );
          })()
        ) : combo === "damage" ? (
          <FormulaModal
            title="Damage Modifiers"
            subtitle="resistance, vulnerability, immunity multipliers"
            total={damageModifiers.resistance.length + damageModifiers.vulnerability.length + damageModifiers.immunity.length}
            formula="Resistance = ×0.5 | Vulnerability = ×2 | Immunity = ×0"
            breakdown={resolver_
              ? Object.entries(resolver_.totals)
                  .filter(([k]) => k.startsWith("damage_modifier."))
                  .map(([k, v]) => ({
                    label: k.replace("damage_modifier.", ""),
                    value: v,
                  }))
              : []}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
        ) : combo === "damage-type" && comboDamageType ? (
          (() => {
            const dmTarget = `damage_modifier.${comboDamageType}`;
            const dmContribs = resolver_.byTarget[dmTarget] ?? [];
            const dmTotal = resolver_.totals[dmTarget] ?? 0;
            const isResist = damageModifiers.resistance.includes(comboDamageType);
            const isVuln = damageModifiers.vulnerability.includes(comboDamageType);
            const isImmune = damageModifiers.immunity.includes(comboDamageType);
            const label = isImmune ? "Immunity" : isVuln ? "Vulnerability" : isResist ? "Resistance" : "Modifier";
            const mult = isImmune ? 0 : isVuln ? 2 : isResist ? 0.5 : 1;
            return (
              <FormulaModal
                title={`${comboDamageType.charAt(0).toUpperCase() + comboDamageType.slice(1)} ${label}`}
                subtitle={`multiplier: ×${mult}`}
                total={dmTotal}
                formula={`Damage × ${mult} — ${isResist ? "halved" : isVuln ? "doubled" : isImmune ? "ignored" : "normal"} damage from this type`}
                breakdown={contributionsToSteps(dmTarget, resolver_)}
                onClose={() => setCombo(null)}

            characterId={characterId}              />
            );
          })()
        ) : combo === "encumbrance" ? (
          <EncumbranceFormulaModal
            encumbrance={encumbrance}
            characterSize={characterSize}
            physicalMod={physMod}
            primitiveContributions={splitCapacityPrimitives(resolver?.byTarget).loadPrimitives}
            equipSlotContributions={splitCapacityPrimitives(resolver?.byTarget).equipSlotPrimitives}
            onClose={() => setCombo(null)}
          />
        ) : null
      )}
    </div>
  );
}



// =============================================================================
// LoadCell — load + capacity bar
// =============================================================================
function EquipSlotsPanel({
  slotCount,
  usedSlots,
  onClick,
}: {
  slotCount: number;
  usedSlots: number;
  onClick?: () => void;
}) {
  // 6 universal equip slots (2H items use 2 slots). For now
  // this is display-only — when items are equipped the slots
  // fill in. Session G only handles the visual; the equip
  // wiring itself is the sheet tab's responsibility.
  //
  // Phase 8.5 H-fix4 (Mashu 2026-08-03): caller was passing
  // hardcoded `slotCount={6} usedSlots={0}` — now reads the
  // real values off `encumbrance.equipSlotsUsed` /
  // `encumbrance.equipSlotsAvailable` (see call site). The
  // grid below clamps to 6 columns for visual density; extra
  // slots beyond 6 still count in the `usedSlots / slotCount`
  // number above the grid.
  const slots = Array.from({ length: slotCount }, (_, i) => i < usedSlots);
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full bg-card p-3 text-left transition-colors hover:bg-secondary/30"
      title="Show equip slots formula"
      aria-label="Show equip slots formula"
    >
      <div className="pointer-events-none">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Equip
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {usedSlots}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          / {slotCount}
        </span>
      </p>
      <div className="mt-2 grid grid-cols-6 gap-1">
        {slots.map((filled, i) => (
          <div
            key={i}
            className={`h-2 rounded-full ${
              filled ? "bg-teal-500" : "bg-secondary"
            }`}
            title={filled ? `Slot ${i + 1} (filled)` : `Slot ${i + 1} (empty)`}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        2H items use 2 slots
      </p>
      </div>
    </button>
  );
}

// =============================================================================
// Phase 8.I i2 finish (Mashu 2026-08-06) — SpeedCard, DamageModifierRow,
// DamageModifierRow. Small cards showing the i2.7 + i2 finish
// primitives contributions to the character sheet.
// =============================================================================

function SpeedCard({
  speedByType,
  onClick,
}: {
  speedByType: Readonly<Record<string, number>>;
  onClick: () => void;
}) {
  const walking = speedByType["WALKING_SPEED"] ?? 0;
  const otherLocomotions: Array<{ key: string; value: number }> = [];
  for (const [key, value] of Object.entries(speedByType)) {
    if (key === "WALKING_SPEED") continue;
    if (value > 0) otherLocomotions.push({ key, value });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full bg-card p-3 text-left transition-colors hover:bg-secondary/30"
      title="Show walking speed formula"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Speed
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {walking}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          ft walking
        </span>
      </p>
      {otherLocomotions.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {otherLocomotions.map(({ key, value }) => (
            <p
              key={key}
              className="text-[11px] text-muted-foreground font-mono"
            >
              <span className="font-semibold">{value}</span> ft {key
                .replace("_SPEED", "")
                .toLowerCase()}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}

function DamageModifierRow({
  label,
  types,
  colorClass,
  onClick,
}: {
  readonly label: string;
  readonly types: readonly string[];
  readonly colorClass: string;
  readonly onClick?: (type: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-semibold uppercase ${colorClass}`}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={onClick ? (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); e.stopPropagation(); onClick(t); } : undefined}
            className={`cursor-pointer rounded-full border border-current/30 bg-current/10 px-1.5 py-0.5 text-[10px] font-medium ${colorClass} hover:bg-current/20`}
            title={`Click to see ${t} damage modifier provenance`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function BehaviorVariableRow({
  bv,
  onClick,
}: {
  readonly bv: {
    readonly key: string;
    readonly value: number;
    readonly contributions: ReadonlyArray<{
      readonly primitiveId: number;
      readonly primitiveName: string;
      readonly delta: number;
    }>;
  };
  onClick: () => void;
}) {
  // Format the key for display: snake_case -> Title Case
  const displayKey = bv.key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const valueColor =
    bv.value === 0
      ? "text-muted-foreground"
      : bv.value > 0
        ? "text-teal-700 dark:text-teal-300"
        : "text-destructive";
  // Phase 8.J D-2: order adv/disadv first then *
  // For behavior variables, the value IS the stack count.
  // Show ⇈(N) for advantage, ⇊(N) for disadvantage, both regardless of count.
  const isAdv = bv.key === "advantage";
  const isDisadv = bv.key === "disadvantage";
  const advIcon = isAdv ? `⇈(${bv.value})` : null;
  const disadvIcon = isDisadv ? `⇊(${bv.value})` : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-baseline justify-between gap-2 text-left transition-colors hover:bg-secondary/30"
      title={`Show ${displayKey} provenance`}
    >
      <span className="text-[11px] font-medium text-foreground">
        {displayKey}
      </span>
      <span
        className={`font-mono text-xs font-semibold tabular-nums ${valueColor}`}
        title={bv.contributions
          .map((c) => `${c.primitiveName} ${c.delta >= 0 ? "+" : ""}${c.delta}`)
          .join("\n")}
      >
        {advIcon ? (
          <span className="text-emerald-600 dark:text-emerald-400">{advIcon}</span>
        ) : disadvIcon ? (
          <span className="text-red-600 dark:text-red-400">{disadvIcon}</span>
        ) : bv.value > 0 ? `+${bv.value}` : bv.value}
      </span>
    </button>
  );
}

function LoadCell({
  encumbrance,
  onClick,
}: {
  encumbrance: EncumbranceForSticky;
  onClick: () => void;
}) {
  const tone = encumbrance.overburdened
    ? "destructive"
    : encumbrance.encumbered || encumbrance.heavilyEncumbered
      ? "warning"
      : "ok";
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full bg-card p-3 text-left transition-colors hover:bg-secondary/30"
      title="Show encumbrance formula"
      aria-label="Show encumbrance formula"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Load
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {encumbrance.load}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          / {encumbrance.capacity}
        </span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${
            tone === "destructive"
              ? "bg-destructive"
              : tone === "warning"
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{ width: `${Math.min(100, encumbrance.percentOfCapacity)}%` }}
        />
      </div>
      {encumbrance.overburdened && (
        <p className="mt-1 text-[11px] font-semibold text-destructive">
          Overburdened
        </p>
      )}
      {!encumbrance.overburdened && encumbrance.encumbered && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          Encumbered
        </p>
      )}
    </button>
  );
}

// =============================================================================
// ModSaveProvenanceModal — combined modal showing BOTH
// the attribute modifier AND the save value. The user
// gets one window with two sections so they can audit
// both contributions at once.
//
// Phase 8.4 v25: each section is now a FormulaModal section
// (static formula + provenance chain), keeping the visual
// structure consistent with all the other chips. The shell
// just renders the title and closes the loop.
// =============================================================================
function ModSaveProvenanceModal({
  attr,
  attrTarget,
  attrLabel,
  saveTarget,
  saveLabel,
  saveBase,
  pb,
  isProf,
  resolver,
  onClose,
}: {
  attr: "physical" | "mental" | "magical";
  attrTarget: string;
  attrLabel: string;
  saveTarget: string;
  saveLabel: string;
  /** The attr mod number — what we'd display if there were no
   * primitive contributions. Used to derive the static-formula
   * baseline. */
  saveBase: number;
  pb: number;
  isProf: boolean;
  resolver: ResolvedModifiers;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Mod total = engine's computed attribute
  // Phase 8.L round 106 (Mashu 2026-08-26): the engine already
  // seeds attribute.X with the raw base AND any primitive
  // contributions. attrTotal = attrDelta directly (NOT saveBase + attrDelta,
  // which double-counts the base).
  const attrContribs = resolver.byTarget[attrTarget] ?? [];
  const attrDelta = resolver.totals[attrTarget] ?? 0;
  const attrTotal = attrDelta;

  // Save total = mod + primitive save contributions + PB (if proficient)
  // Phase 8.L round 107 (Mashu): engine seeds
  // X_saving_throw = PB + X_attr + primitive_save_delta.
  // With L106 attrTotal = attrDelta (= X_attr post-PASS-2),
  // the displayed total should be:
  //   attrTotal + primitive_save_delta + (pb if prof)
  // Since engine's saveDelta = PB + attr + primitive_save_delta,
  //   primitive_save_delta = saveDelta - PB - attr
  //   saveTotal = attrTotal + (saveDelta - PB - attr) + (pb if prof)
  // When prof: saveTotal = attrTotal + saveDelta - PB - attr + PB
  //          = attrTotal + saveDelta - attr
  //          = attrTotal + (attr + primitive_save_delta + PB) - attr
  //          = attrTotal + primitive_save_delta + PB  ✓
  // When NOT prof: saveTotal = attrTotal + (saveDelta - PB - attr)
  //             = attrTotal + primitive_save_delta  ✓
  // For proficiency handling, we keep attrTotal + (saveDelta - PB - attr)
  // when not prof, and attrTotal + (saveDelta - attr) when prof (PB already
  // shown as a separate step).
  // Simpler approach: attrTotal + (saveDelta - PB - attr) + (isProf ? PB : 0)
  // = attrTotal + saveDelta - PB - attr + (isProf ? PB : 0)
  // = attrTotal + saveDelta - attr + (isProf ? 0 : -PB)
  // But we WANT a clean formula match. So:
  const saveContribs = resolver.byTarget[saveTarget] ?? [];
  // Phase 8.L round 111 (Mashu 2026-08-26): just use saveDelta
  // directly. The previous \`primitiveSaveDelta = saveDelta - PB - attr\`
  // formula assumed primitives are additive, but with
  // multiply/divide ops (e.g. magi x2 ×2), the math doesn't
  // work out (16 - 6 - 4 = 6, but actual delta is multiplicative).
  // Engine already gives the final saveTotal in
  // resolver.totals[saveTarget]. Trust it.
  const saveDelta = resolver.totals[saveTarget] ?? (pb + attrDelta);
  const saveTotal = saveDelta;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 pb-24 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for ${attr.toUpperCase()} mod + save`}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Formula
            </h2>
            <p className="mt-0.5 text-base font-semibold">
              {attr.toUpperCase()} mod + save
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isProf ? "proficient attribute" : "non-proficient attribute"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <FormulaModalSection
            target={attrTarget}
            resolver={resolver}
            title={attrLabel}
            total={attrTotal}
            formula={`${attrLabel} = base attribute value + primitive contributions`}
            breakdown={[
              { label: "Base attribute", value: saveBase },
              ...contributionsToSteps(attrTarget, resolver),
            ]}
            fallbackMessage="No primitive contributes. Base = attribute raw value."
          />

          <FormulaModalSection
            target={saveTarget}
            resolver={resolver}
            title={saveLabel}
            total={saveTotal}
            // Phase 8.L round 129 (Mashu): PB only in seed if
            // proficient in this attribute. The breakdown
            // mirrors the engine: show PB only when prof.
            formula={`${saveLabel} = ${attrLabel} + (PB if proficient) + primitive save contributions + action_roll sub-target ops`}
            breakdown={[
              { label: attrLabel, value: attrTotal },
              ...(isProf
                ? [{ label: "PB (proficient)", value: pb }]
                : []),
              // Phase 8.L round 110 (Mashu): use contributionsToSteps
              // so direct primitives with an accordion (e.g.
              // Resilient Phys via LINEAGE) get the via label.
              ...contributionsToSteps(saveTarget, resolver),
            ]}
            fallbackMessage="No primitive contributes to saves. Save = mod + (PB if proficient)."
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Internal helper that renders a single FormulaModal section.
 * Used by ModSaveProvenanceModal so the inner layout matches
 * what the standalone FormulaModal renders.
 */
function FormulaModalSection({
  title,
  total,
  formula,
  breakdown,
  fallbackMessage,
  target,
  resolver,
}: {
  title: string;
  total: number;
  formula: string;
  breakdown: ReadonlyArray<FormulaStep>;
  fallbackMessage: string;
  target?: string;
  resolver: ResolvedModifiers;
}) {
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? `+${n}` : `${n}`);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {title}
        </span>
        <span className="font-mono text-xl font-bold tabular-nums">
          {fmt(total)}
          {target && <AxisMarkers byTarget={resolver.byTarget} target={target} />}
        </span>
      </div>
      <p className="mb-2 rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed text-foreground">
        {formula}
      </p>
      {breakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fallbackMessage}</p>
      ) : (
        // Phase 8.L round 100 (Mashu): limit breakdown height so
        // long breakdowns don't push other sections off-screen.
        // Each <li> is ~50px so 8 items fit comfortably. Modal
        // body still scrolls for cases where >8 items need to
        // be visible at once.
        <ul className="max-h-[40dvh] space-y-2 overflow-y-auto pr-1">
          {breakdown.map((step, i) => (
            <li
              key={`${step.label}-${i}`}
              className="rounded-md border border-border bg-background p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{step.label}</p>
                  {step.via && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      via {step.via}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-mono font-semibold tabular-nums">
                  {fmt(step.value)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* Phase 8.L round 114 (Mashu 2026-08-26): show equation-style
          summary line so the user can SEE how the breakdown sums to
          the total. The standalone FormulaModal already has this; the
          attribute mod+save modal (which uses FormulaModalSection)
          was missing it. */}
      <SummaryLine steps={breakdown} total={total} />
    </section>
  );
}

// 2026-08-12 round 19 marker -8679296480564731946 - accordion deployment fix

function formatViaForSteps(c: import("@/lib/engine/resolve-modifiers").ModifierContribution): string {
  const { heritageName, capabilityName, effectName, accordion, kind } = c.provenance;
  if (kind === "direct") return "";
  const parts: string[] = [];
  if (accordion) parts.push(accordion);
  if (heritageName) parts.push(heritageName);
  if (capabilityName) parts.push(capabilityName);
  if (effectName) parts.push(effectName);
  if (parts.length === 0) return "";
  return parts.join(" → ");
}

function ContribListItem({ c, setRawTokensOpen, isOff, offReason }: {
  c: import("@/lib/engine/resolve-modifiers").ModifierContribution;
  setRawTokensOpen: (cond: unknown) => void;
  isOff: boolean;
  /**
   * Phase 8.L round 26 (Mashu): WHY isOff is true. Drives the
   * label so we don't say "(capability OFF)" when the actual
   * reason is "condition not met" (which affects DIRECT
   * primitives too, not just capability-owned ones).
   */
  offReason?: "capability" | "condition" | null;
}) {
  const OP_LABEL: Record<string, string> = {
    add: "+",
    subtract: "−",
    set: "=",
    min: "↑",
    max: "↓",
    multiply: "×",
    divide: "÷",
    grant: "grant",
    revoke: "revoke",
  };
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? `+${n}` : `${n}`);
  // Phase 8.J M1+M7: min/max rows omit prefix and OP_LABEL
  const isLimit = c.op === "min" || c.op === "max";
  // Phase 8.J M3 + Phase 8.L round 13: provenance breadcrumb
  // (full chain incl. accordion as OUTERMOST element).
  // Per Mashu: "accordeon name if not direct primitive > heritage
  // name if nested in heritage > Capability > Effect"
  const prov = c.provenance;
  const breadcrumb = [
    prov.accordion ?? null,
    prov.heritageName,
    prov.capabilityName,
    prov.effectName,
  ].filter(Boolean).join(" › ") || "Direct";

  // Phase 8.J D-5: human-readable condition text
  const condText = c.condition
    ? humanReadableCondition(c.condition as Parameters<typeof humanReadableCondition>[0])
    : null;
  return (
    <li className="rounded-md border border-border bg-background p-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-xs font-medium",
              isExpertiseName(c.primitiveName) && "font-bold text-teal-700 dark:text-teal-300",
              isProficiencyName(c.primitiveName) && "text-teal-700 dark:text-teal-300",
              isOff && "text-muted-foreground line-through"
            )}
            title={c.primitiveName}
          >
            {c.primitiveName}
            {isOff && offReason === "capability" ? (
              <span className="ml-2 text-[9px] uppercase tracking-wide">(capability OFF)</span>
            ) : null}
            {isOff && offReason === "condition" ? (
              <span className="ml-2 text-[9px] uppercase tracking-wide">(condition not met)</span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70" title={breadcrumb}>
            via {breadcrumb}
          </p>
          {condText ? (
            <button
              type="button"
              onClick={() => setRawTokensOpen(c.condition)}
              className="mt-0.5 cursor-pointer text-[10px] italic text-amber-700 dark:text-amber-400 underline-offset-2 hover:underline"
            >
              when {condText}
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs">
          {!isLimit ? (
            // Phase 8.L round 125 (Mashu 2026-08-26): operator
            // rendered LARGE color-coded (matches the rest of
            // the modals); value rendered SMALLER + gray.
            // Previously the operator was small/gray and the
            // value was bold — inverted from the desired
            // treatment.
            <span className={cn(
              "font-mono text-base font-bold leading-none",
              OP_COLOR[c.op] ?? "text-foreground",
            )}>
              {OP_LABEL[c.op] ?? c.op}
            </span>
          ) : (
            // Phase 8.L: Floor/Ceiling as orange ↥/↧ per the
            // color rules — limits are informational indicators,
            // not modifiers.
            <span className={cn(
              "font-mono text-base font-bold leading-none",
              OP_COLOR[c.op] ?? "text-foreground",
            )}>
              {OP_LABEL[c.op] ?? c.op}
            </span>
          )}
          <span className={cn(
            "font-mono text-[11px] tabular-nums text-muted-foreground",
            isExpertiseName(c.primitiveName) && "font-bold text-teal-700 dark:text-teal-300",
            isProficiencyName(c.primitiveName) && "text-teal-700 dark:text-teal-300",
            isLimit && "text-orange-700 dark:text-orange-400",
            isOff && "text-muted-foreground line-through"
          )}>
            {c.op === "grant" && c.rawValue && typeof c.rawValue === "object" && (c.rawValue as { kind?: string }).kind === "keyword" ? (
              // Phase 8.L: keyword grants (advantage/disadvantage/etc.)
              // show the keyword as a colored chip, not the literal
              // `grant 0` text.
              (() => {
                const kw = String((c.rawValue as { value?: unknown }).value ?? "").toLowerCase();
                const isAdv = kw === "advantage";
                const isDisadv = kw === "disadvantage";
                const cls = isAdv
                  ? "rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300"
                  : isDisadv
                    ? "rounded bg-red-500/20 px-1.5 py-0.5 text-red-700 dark:text-red-300"
                    : "rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-700 dark:text-purple-300";
                return <span className={cls}>{kw}</span>;
              })()
            ) : (
              formatOperandValue(c.value)
            )}
          </span>
        </div>
      </div>
    </li>
  );
}

// =============================================================================
// PracticeDetailModal — per-practice provenance modal.
// Shows the practice's total + the formula + the resolver
// contributions that produced it. Phase 8.4 v25: now uses
// the shared FormulaModal component for the structural
// parts (header, formula section, summary), then layers
// the per-primitive contributions below.
// =============================================================================
function PracticeDetailModal({
  practice,
  byTarget,
  pb,
  attrBase,
  attrMod,
  isProf,
  characterId,
  onClose,
}: {
  readonly practice: {
    name: string;
    attribute: "physical" | "mental" | "magical";
    total: number;
  };
  readonly byTarget: ResolvedModifiers["byTarget"];
  readonly characterId: string;
  readonly pb: number;
  readonly attrBase: number;
  readonly attrMod: number;
  readonly isProf: boolean;
  readonly onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Phase 8.J D-5 + C2: read OFF caps from localStorage for greyed-out.
  const [offCapabilityIds, setOffCapabilityIds] = useState<Set<string>>(new Set());
  const [rawTokensOpen, setRawTokensOpen] = useState<unknown | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const off = new Set<string>();
      // Phase 8.L round 26 (Mashu): prefix MUST include characterId
    // so we only read OFF caps for THIS character (capability-card
    // writes sw:cap:<characterId>:<capabilityId> = "1" when OFF).
    // The old prefix "sw:cap:" was reading OFF caps from every
    // character on the device, breaking the per-character toggle.
    const prefix = `sw:cap:${characterId}:`;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix) && window.localStorage.getItem(key) === "1") {
          off.add(key.slice(prefix.length));
        }
      }
      setOffCapabilityIds(off);
    } catch {}
  }, []);

  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? `+${n}` : `${n}`);

  // The practice's "primitive contributions" are the
  // same as the attribute's primitive contributions —
  // practices inherit the attribute's resolver total.
  const attrTarget = `attribute.${practice.attribute}`;
  const contributions = byTarget[attrTarget] ?? [];
  const attrDelta = attrMod - attrBase;
  // Practice-specific primitive contributions (e.g. Proficient Fieldcraft,
  // Iron Will) target `skill_practice_check.<practice>`. These are
  // SEPARATE from the attribute primitives — both feed into the
  // practice total.
  const practiceTarget = `skill_practice_check.${practice.name.toLowerCase()}`;
  const practicePrimitiveTotal = byTarget[practiceTarget]
    ?.reduce((sum, c) => {
      // Phase 8.L: floor/ceiling (op=min/max) are informational,
      // NOT part of the modifier sum per the practice system
      // overview. Skip them when summing the practice total.
      // Phase 8.L round 45: also skip INHIBITED contributions
      // (cap/effect toggled OFF). The resolver already excludes
      // them from totals, but this sum walks byTarget which
      // includes them for display purposes.
      if (c.op === "min" || c.op === "max") return sum;
      if (c.inhibited) return sum;
      return sum + c.value;
    }, 0) ?? 0;
  // Also collect min/max separately so the formula line can
  // show the floor/ceiling indicators after the total.
  const practiceMin = byTarget[practiceTarget]
    ?.reduce((min, c) => {
      if (c.inhibited) return min;
      return c.op === "min" && c.value > min ? c.value : min;
    }, 0) ?? 0;
  const practiceMax = byTarget[practiceTarget]
    ?.reduce((max, c) => {
      if (c.inhibited) return max;
      return c.op === "max" && c.value < max ? c.value : max;
    }, Infinity);
  const practiceMaxDisplay = practiceMax === Infinity ? null : practiceMax;
  // Mirror-style trace: show the formula
  //   total = attrBase + (PB if prof) + attrDelta
  // It's the same as the Save DC formula except the
  // primitive contributions are real (the attribute's
  // primitives), not just PB.

  return (
    <Fragment>
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 pb-24 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for ${practice.name}`}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Formula
            </h2>
            <p className="mt-0.5 text-base font-semibold">{practice.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {practice.attribute.toUpperCase()} practice
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-muted shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Phase 8.L round 16: practice description lives
              INSIDE the scroll area (was in the sticky header
              and forced the modal to overflow on mobile).
              Per Mashu: "the header is not part of scroll...
              Only the name has to be sticky not the
              description or the accordions." */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              About this practice
            </p>
            {(() => {
              const key = practice.name.toUpperCase() as Practice;
              const desc = PRACTICE_DESCRIPTIONS[key];
              if (!desc) return null;
              return (
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <p>
                    <span className="not-italic font-semibold">{desc.coreQuestion}</span>{" "}
                    <span className="italic">{desc.description}</span>
                  </p>
                  {desc.mayInclude && desc.mayInclude.length > 0 ? (
                    <details className="rounded border border-border bg-background/40 px-1.5 py-1">
                      <summary className="cursor-pointer list-none font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                        May include ({desc.mayInclude.length})
                      </summary>
                      <ul className="mt-0.5 list-disc pl-4 text-[11px] text-muted-foreground/85">
                        {desc.mayInclude.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {desc.examples && desc.examples.length > 0 ? (
                    <details className="rounded border border-border bg-background/40 px-1.5 py-1">
                      <summary className="cursor-pointer list-none font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                        Examples ({desc.examples.length})
                      </summary>
                      <ul className="mt-0.5 list-disc pl-4 text-[11px] italic text-muted-foreground/85">
                        {desc.examples.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {desc.versus ? (
                    <p className="rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-1 text-[11px] italic text-amber-700 dark:text-amber-300">
                      <span className="not-italic font-semibold">Boundary:</span>{" "}
                      {desc.versus}
                    </p>
                  ) : null}
                </div>
              );
            })()}
          </section>
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(practice.total)}
                <AxisMarkers byTarget={byTarget} target={practiceTarget} />
              </span>
            </div>
            <p className="mb-2 rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed text-foreground">
              Practice = {practice.attribute.toUpperCase()} attribute (mod) +
              practice primitive contributions + PB (if proficient)
            </p>
            <p className="rounded-md border border-dashed border-border bg-background/50 p-2 font-mono text-[11px]">
              {/* Phase 8.L round 122 (Mashu 2026-08-26): the
                  practice trace now uses the same color-coded
                  operator + small-value format as the other
                  modals. Previously it was a single line of
                  +6 +6 +8 = +20 with no color, hard to scan. */}
              <span className="text-muted-foreground">{formatOperandValue(attrMod)}</span>{" "}
              <span className="text-muted-foreground/70">(attr mod)</span>{" "}
              {isProf && (
                <>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+</span>
                  <span className="text-muted-foreground">{formatOperandValue(pb)}</span>{" "}
                  <span className="text-muted-foreground/70">(PB)</span>{" "}
                </>
              )}
              {practicePrimitiveTotal !== 0 && (
                <>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+</span>
                  <span className="text-muted-foreground">{formatOperandValue(practicePrimitiveTotal)}</span>{" "}
                  <span className="text-muted-foreground/70">(practice primitives)</span>{" "}
                </>
              )}
              <span className="font-semibold text-foreground">= {fmt(practice.total)}</span>
              <AxisMarkers byTarget={byTarget} target={practiceTarget} />
            </p>
            {(practiceMin > 0 || practiceMaxDisplay !== null) ? (
              <p className="mt-1 font-mono text-[10px] text-orange-700 dark:text-orange-400">
                Floor / Ceiling (informational, not summed):
                {practiceMin > 0 ? <span className="ml-1">↥<strong className="ml-0.5">{practiceMin}</strong></span> : null}
                {practiceMaxDisplay !== null ? <span className="ml-2">↧<strong className="ml-0.5">{practiceMaxDisplay}</strong></span> : null}
              </p>
            ) : null}
          </section>

          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Conditions
            </p>
            {(() => {
              const allContribs = [
                ...(byTarget[attrTarget] ?? []),
                ...(byTarget[practiceTarget] ?? []),
              ].filter((c) => c.hasCondition);
              if (allContribs.length === 0)
                return <p className="text-xs text-muted-foreground">No active conditions.</p>;
              return (
                <ul className="space-y-1">
                  {allContribs.map((c, i) => (
                    <li key={`cond-${i}`} className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex flex-wrap items-center gap-1">
                          <strong>{c.primitiveName}</strong>
                          {/* Phase 8.L round 122: operator is
                              color-coded + large, value is small
                              + gray — same as the breakdown rows. */}
                          <span className={cn(
                            "font-mono text-base font-bold leading-none",
                            OP_COLOR[c.op] ?? "text-foreground",
                          )}>
                            {OP_LABEL[c.op] ?? c.op}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {formatOperandValue(c.value)}
                          </span>
                        </span>
                        <span className={cn("font-mono text-[10px]", c.conditionActive === false ? "text-red-500" : "text-teal-600 dark:text-teal-400")}>
                          {c.conditionActive === false ? "⛔ Inhibited" : c.conditionActive === true ? "✓ Engaged" : "— inactive"}
                        </span>
                      </div>
                      <span className="flex flex-wrap items-center gap-1 text-[11px] italic text-muted-foreground">
                        <span className="font-semibold">when</span>
                        {c.condition ? renderConditionChips(c.condition) : "no condition"}
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>

          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Attribute primitives (affect practice base)
            </p>
            {contributions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No attribute primitive contributes to this practice.
              </p>
            ) : (
              <ul className="space-y-2">
                {contributions.map((c, i) => (
                  <ContribListItem
                      key={`attr-${c.primitiveId}-${i}`}
                      c={c}
                      setRawTokensOpen={setRawTokensOpen}
                      isOff={offCapabilityIds.has(c.originCapabilityId ?? "") || c.conditionActive === false}
                      offReason={
                        offCapabilityIds.has(c.originCapabilityId ?? "")
                          ? "capability"
                          : c.conditionActive === false
                            ? "condition"
                            : null
                      }
                    />
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Practice primitives
            </p>
            {byTarget[practiceTarget]?.length === 0 ||
            !byTarget[practiceTarget] ? (
              <p className="text-sm text-muted-foreground">
                No practice-specific primitive contributes here.
              </p>
            ) : (
              <ul className="space-y-2">
                {byTarget[practiceTarget]!.map((c, i) => (
                  <ContribListItem
                      key={`prac-${c.primitiveId}-${i}`}
                      c={c}
                      setRawTokensOpen={setRawTokensOpen}
                      isOff={offCapabilityIds.has(c.originCapabilityId ?? "") || c.conditionActive === false}
                      offReason={
                        offCapabilityIds.has(c.originCapabilityId ?? "")
                          ? "capability"
                          : c.conditionActive === false
                            ? "condition"
                            : null
                      }
                    />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>,
      {rawTokensOpen !== null
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setRawTokensOpen(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Raw condition tokens"
            >
              <div
                className="flex max-h-[95dvh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Raw condition tokens
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRawTokensOpen(null)}
                    className="rounded-md p-1 transition-colors hover:bg-muted"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <pre className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(rawTokensOpen, null, 2)}
                </pre>
              </div>
            </div>,
            document.body,
          )
        : null}
    </Fragment>
  );
}

// =============================================================================
// EncumbranceFormulaModal — Phase 8.4 v25.
//
// Per Notion (380ed847...):
//   Capacity = size base + (Physical Mod × 5) + primitive bonuses
//   Load     = Σ (item.size load value × quantity)
//
// Plus the info panel: size table (Tiny = 0, Small = 1, etc.)
// and the pouch rule (1 Pouch = up to 1000 Tiny Items = 1 Load).
//
// We don't have an item-level breakdown plumbed through from
// the parent yet (that's session H), so the live trace uses
// the final load/capacity numbers from the engine and shows
// the formula composition explicitly.
// =============================================================================
function EncumbranceFormulaModal({
  encumbrance,
  characterSize,
  physicalMod,
  onClose,
  primitiveContributions,
  equipSlotContributions,
}: {
  readonly encumbrance: EncumbranceForSticky;
  readonly characterSize: "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE" | "GARGANTUAN";
  readonly physicalMod: number;
  readonly onClose: () => void;
  /** Phase 8.L L21: list of primitive contributions to capacity. */
  readonly primitiveContributions?: ReadonlyArray<{
    id: number;
    name: string;
    op: string;
    value: number;
    target: string;
    provenance: { capabilityName: string | null; effectName: string | null; heritageName: string | null; accordion: string | null };
  }>;
  /** Phase 8.L L21: list of primitive contributions to equip slots. */
  readonly equipSlotContributions?: ReadonlyArray<{
    id: number;
    name: string;
    op: string;
    value: number;
    target: string;
    provenance: { capabilityName: string | null; effectName: string | null; heritageName: string | null; accordion: string | null };
  }>;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const sizeCap = SIZE_CAPACITY[characterSize];
  const physBonus = physicalMod * 5;
  // Use the engine-computed capacity (encumbrance.capacity)
  // which includes ALL primitive bonuses (Backpack, etc.).
  // The breakdown below is a formula reference — the total
  // at the top always matches what the card shows.
  const capacity = encumbrance.capacity;
  const primitiveBonus = capacity - sizeCap - physBonus;
  const load = encumbrance.load;

  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? `+${n}` : `${n}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 pb-24 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for Encumbrance`}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Formula
            </h2>
            <p className="mt-0.5 text-base font-semibold">Encumbrance</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Load vs Capacity for a {characterSize.toLowerCase()} character
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Static formula */}
          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Formula
            </p>
            <p className="rounded-md border border-border bg-background p-2.5 font-mono text-sm leading-relaxed">
              Capacity = Size base + (Physical Mod × 5) + item bonuses
              <br />
              Load = Σ (item.size load value × quantity)
            </p>
          </section>

          {/* Capacity breakdown */}
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Capacity
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(capacity)}
              </span>
            </div>
            <p className="rounded-md border border-dashed border-border bg-background/50 p-2 font-mono text-[11px]">
              {/* Phase 8.L round 122 (Mashu 2026-08-26): color-coded
                  operator + small-value format. × is shown in
                  violet (multiply color), + is emerald. */}
              <span className="text-muted-foreground">{formatOperandValue(sizeCap)}</span>{" "}
              <span className="text-muted-foreground/70">(size: {characterSize})</span>{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+</span>
              <span className="text-muted-foreground">{formatOperandValue(physBonus)}</span>{" "}
              <span className="text-muted-foreground/70">(Physical value × 5)</span>
              {primitiveBonus !== 0 && (
                <>
                  {" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+</span>
                  <span className="text-muted-foreground">{formatOperandValue(primitiveBonus)}</span>{" "}
                  <span className="text-muted-foreground/70">(primitives)</span>
                </>
              )}{" "}
              <span className="font-semibold text-foreground">= {fmt(capacity)}</span>
            </p>
            {primitiveContributions && primitiveContributions.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {primitiveContributions.map((p) => (
                  <li key={`${p.id}-${p.target}`} className="rounded-md border border-border bg-background px-2 py-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-medium">{p.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className={cn(
                          "font-mono text-base font-bold leading-none",
                          OP_COLOR[p.op] ?? "text-foreground",
                        )}>
                          {OP_LABEL[p.op] ?? p.op}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatOperandValue(p.value)}
                        </span>
                      </div>
                    </div>
                    {(p.provenance.heritageName || p.provenance.capabilityName || p.provenance.effectName) ? (
                      <span className="pl-1 text-[10px] italic text-muted-foreground">
                        via{" "}
                        {[p.provenance.accordion ?? null, p.provenance.heritageName, p.provenance.capabilityName, p.provenance.effectName]
                          .filter(Boolean)
                          .join(" › ")}
                      </span>
                    ) : (
                      <span className="pl-1 text-[10px] italic text-muted-foreground">via Direct</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* Load breakdown */}
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Load
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {load}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {load === 0
                ? "Nothing carried. You're not encumbered."
                : `Carrying ${load} Load of items. Equipped items count toward Load too.`}
            </p>
            {encumbrance.encumbered && (
              <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                Encumbered — Load ({load}) exceeds Capacity ({capacity}).
              </p>
            )}
          </section>

          {/* Equip-slot primitives — separate section below load primitives,
              per Mashu L10: equip-slot primitives render their own section. */}
          {equipSlotContributions && equipSlotContributions.length > 0 ? (
            <section>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Equip-slot primitives
              </p>
              <ul className="space-y-1">
                {equipSlotContributions.map((p) => (
                  <li key={`${p.id}-${p.target}`} className="rounded-md border border-border bg-background px-2 py-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 font-mono text-teal-700 dark:text-teal-300">
                        {p.value >= 0 ? `+${p.value}` : p.value}
                      </span>
                    </div>
                    {(p.provenance.heritageName || p.provenance.capabilityName || p.provenance.effectName) ? (
                      <span className="pl-1 text-[10px] italic text-muted-foreground">
                        via{" "}
                        {[p.provenance.accordion ?? null, p.provenance.heritageName, p.provenance.capabilityName, p.provenance.effectName]
                          .filter(Boolean)
                          .join(" › ")}
                      </span>
                    ) : (
                      <span className="pl-1 text-[10px] italic text-muted-foreground">via Direct</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Reference — Equip slots summary */}
          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reference — Equip slots
            </p>
            <div className="rounded-md border border-border bg-background p-2.5 text-sm">
              <p className="font-mono text-xs">
                {encumbrance.equipSlotsAvailable} universal equip slots available
                ({encumbrance.equipSlotsUsed} used)
                {encumbrance.equipSlotsAvailable - encumbrance.equipSlotsUsed >
                encumbrance.equipSlotsUsed + 0 ? "" : ""}.
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                6 base + {encumbrance.equipSlotsAvailable - 6} from primitives
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                2H items use at least 2 slots depending on bulk.
                Equipped items also contribute to Load.
              </p>
            </div>
          </section>

          {/* Size table + pouch rule */}
          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reference — Size table
            </p>
            <div className="rounded-md border border-border bg-background p-2.5 text-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 text-left font-semibold uppercase">Size</th>
                    <th className="py-1 text-right font-semibold uppercase">Capacity</th>
                    <th className="py-1 text-right font-semibold uppercase">Load / item</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {(["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const).map((sz) => (
                    <tr key={sz} className={sz === characterSize ? "bg-teal-500/10" : ""}>
                      <td className="py-0.5">{sz.toLowerCase()}</td>
                      <td className="py-0.5 text-right tabular-nums">
                        {SIZE_CAPACITY[sz]}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">
                        {sz === "TINY" ? "0*" : SIZE_LOAD[sz]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">
                * Tiny items are tracked via pouches: 1 Pouch = up to 1000 Tiny Items
                = 1 Load. Includes coins, gems, scrolls, nails, etc.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
