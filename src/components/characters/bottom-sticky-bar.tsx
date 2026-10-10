"use client";
import { DrawerAttributeDeck, DrawerVitalityDeck } from "./drawer-stat-deck";
import { useToggleState } from "@/lib/hooks/use-toggle-state";
import { useCharacterReadOnly } from "./character-read-only";
import { usePhoneCharacterSurface } from "@/components/characters/compact-hierarchy";
import { grantedKeyword } from "@/lib/engine/practice-grants";

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

import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { humanReadableCondition, humanReadableToken } from "@/lib/engine/condition-dictionary";
import { cn } from "@/lib/utils";
import { formatEquationValue } from "@/lib/engine/equation-formatter";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import { reconcileVitality } from "@/components/characters/optimistic-vitality";
import {
  FormulaModal,
  SummaryLine,
  contributionsToSteps,
  type FormulaStep,
} from "@/components/characters/formula-modal";
import {
  humanizeMechanicalTarget,
  operationValue,
  operationVerb,
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
    c.op === "grant" && c.tags.includes(tag) && !c.inhibited && c.conditionActive !== false,
  ).length;
  const advKey = `behavior.${tag}.${target}`;
  const perAxis = (byTarget[advKey] ?? []).reduce(
    (sum, c) => sum + (!c.inhibited && c.conditionActive !== false && (c.op === "add" || c.op === "subtract") ? c.value : 0),
    0,
  );
  return Math.max(0, local + perAxis);
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
            className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs italic text-amber-700 dark:text-amber-300"
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
      title={[markers.join(" "), netAdv === 0 ? "" : `Roll ${Math.abs(netAdv) + 1} dice; keep the ${netAdv > 0 ? "highest" : "lowest"}.`].filter(Boolean).join(" · ")}
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
  readonly onOpenConsequences?: () => void;
  readonly characterId: string;
  readonly level: number;
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
  readonly resolveForAttribute?: (attribute: "physical" | "mental" | "magical") => ResolvedModifiers;
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
  readonly accessRules?: ReadonlyArray<{
    readonly primitiveId: number;
    readonly name: string;
    readonly kind: "domain" | "verb" | "range" | "die" | "structure" | "behavior";
    readonly detail: string;
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
  | "scaling"
  | "behavior"
  | "damage"
  | "damage-type"
  | null;

export function BottomStickyBar({
  onOpenConsequences,
  characterId,
  level,
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
  resolveForAttribute,
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
  accessRules = [],
}: BottomStickyBarProps) {
  const readOnly = useCharacterReadOnly();
  const ruleKindLabel: Record<NonNullable<BottomStickyBarProps["accessRules"]>[number]["kind"], string> = {
    domain: "Domain",
    verb: "Verb",
    range: "Range",
    die: "Die",
    structure: "Structure",
    behavior: "Behavior",
  };
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const phone = usePhoneCharacterSurface();
  const [phonePanel, setPhonePanel] = useState<"rolls" | "resources" | "rules">("rolls");
  const [combo, setCombo] = useState<ComboKind>(null);
  const [comboAttr, setComboAttr] = useState<"physical" | "mental" | "magical">("physical");
  const [comboBehaviorKey, setComboBehaviorKey] = useState<string>("");
  const [comboPractice, setComboPractice] = useState<{
    name: string;
    attribute: "physical" | "mental" | "magical";
    total: number;
  } | null>(null);
  const [comboDamageType, setComboDamageType] = useState<string | null>(null);
  const canonicalCurrent = Math.max(0, Math.min(maxVitality, currentVitality ?? maxVitality));
  const [visibleCurrent, setVisibleCurrent] = useState(canonicalCurrent);
  // While a vitality mutation is being persisted, route refreshes can briefly
  // deliver the previous canonical value. Keep the optimistic value visible
  // until the server catches up to it. This avoids the visible
  // heal -> old value -> heal sequence on rests.
  const optimisticVitalityRef = useRef<number | null>(null);
  const setOptimisticVitality = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(maxVitality, next));
    optimisticVitalityRef.current =
      clamped === canonicalCurrent ? null : clamped;
    setVisibleCurrent(clamped);
  }, [canonicalCurrent, maxVitality]);
  const openDamageTypeModal = useCallback((type: string) => {
    setComboDamageType(type);
    setCombo("damage-type");
  }, []);



  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    const next = reconcileVitality(
      canonicalCurrent,
      optimisticVitalityRef.current,
    );
    optimisticVitalityRef.current = next.optimistic;
    setVisibleCurrent(next.visible);
  }, [canonicalCurrent]);

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
  // attack; 5 + PB + attr mod for DC). So the card reads
  // totals[...] DIRECTLY, without adding the base again. This
  // also means operations like divide/multiply work correctly
  // because the engine operates on the seeded base.
  // Attack Bonus = PB + PrimaryAttribute mod + primitive bonuses
  // The single attack_bonus target already includes the primitive
  // contributions for the chosen attribute AND is seeded with
  // the base (PB + chosen attr mod).
  const atkFloor = findFloor(resolver?.byTarget ?? {}, "attack_bonus");
  const atkCeiling = findCeiling(resolver?.byTarget ?? {}, "attack_bonus");

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
  //
  // Phase 8.L round 137 (Mashu): MULTI-ATTRIBUTE proficiency
  // — user can be proficient in multiple attrs (e.g.
  // physical AND mental via custom conditions granting PB).
  // The selector includes every attribute the user is prof
  // in (primary prof attr + attrs with PB-grant in their
  // save target).
  const profAttr = proficientAttribute?.toLowerCase() ?? null;
  const attrsWithProfGrant = (() => {
    const out: Array<"physical" | "mental" | "magical"> = [];
    if (profAttr === "physical" || profAttr === "mental" || profAttr === "magical") {
      out.push(profAttr);
    }
    for (const attr of ["physical", "mental", "magical"] as const) {
      if (out.includes(attr)) continue;
      const hasGrant = (resolver?.byTarget?.[`${attr}_saving_throw`] ?? [])
        .some((c) => !c.inhibited && c.conditionActive !== false &&
          ["proficiency", "pb", "proficiency_bonus"].includes(grantedKeyword(c.rawValue) ?? "") &&
          !(c.tags ?? []).includes("expertise"));
      if (hasGrant) out.push(attr);
    }
    return out;
  })();
  const atkAttrsWithPrimitives = attrsWithProfGrant.slice();
  const showAttackSelector = atkAttrsWithPrimitives.length > 1;

  // Phase 8.L round 129 (Mashu Q1): the save DC selector
  // shows only attributes the user is proficient in.
  // Phase 8.L round 137 (Mashu): same multi-attr expansion.
  const saveAttrsWithPrimitives = attrsWithProfGrant.slice();
  const showSaveSelector = saveAttrsWithPrimitives.length > 1;
  const effectiveAttackAttr = atkAttrsWithPrimitives.includes(chosenAttackAttr)
    ? chosenAttackAttr : primaryAttr;
  const effectiveDcAttr = saveAttrsWithPrimitives.includes(chosenSaveAttr)
    ? chosenSaveAttr : primaryAttr;
  const attackResolver = effectiveAttackAttr === primaryAttr || !resolveForAttribute
    ? resolver : resolveForAttribute(effectiveAttackAttr);
  const dcResolver = effectiveDcAttr === primaryAttr || !resolveForAttribute
    ? resolver : resolveForAttribute(effectiveDcAttr);
  const primaryAttackBonus = attackResolver?.totals["attack_bonus"] ?? pb + primaryMod;
  const primaryDc = dcResolver?.totals["save_dc"] ?? 5 + pb + primaryMod;

  const PRACTICE_ATTR_LABEL: Record<"PHYSICAL" | "MENTAL" | "MAGICAL", string> = {
    PHYSICAL: "Physical",
    MENTAL: "Mental",
    MAGICAL: "Magic",
  };

  const effectiveCurrent = visibleCurrent;
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
  const openScalingModal = useCallback(() => setCombo("scaling"), []);
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
  const scalingRules = accessRules.filter((rule) =>
    rule.kind === "range" || rule.kind === "die" || rule.kind === "structure",
  );
  const grantedAccessRules = accessRules.filter((rule) =>
    rule.kind === "domain" || rule.kind === "verb" || rule.kind === "behavior",
  );
  const behaviorVariableNames = new Set(
    behaviorVariables.map((variable) => variable.key.replaceAll("_", "").toLowerCase()),
  );
  const visibleAccessRules = grantedAccessRules.filter((rule) =>
    rule.kind !== "behavior" || !behaviorVariableNames.has(rule.name.replace(/[^a-z0-9]/gi, "").toLowerCase()),
  );
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
  const vitalityTarget = "max_vitality";

  // Phase 8.I i3: * marker for conditional modifiers — see
  // hasConditionalMarker() module-level helper.

  return (
    <div
      className="v12-bottom-drawer v12-instrument fixed bottom-12 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md"
      data-testid="bottom-sticky-bar"
      data-character-surface
      data-expanded={expanded}
    >
      {/* Header bar — always visible. The TOGGLE.
          Phase 8.4 v10 (Mashu 2026-07-28): right padding
          doubled (`pr-12`) again because the FAB was still
          covering PB/DC. PB/DC inner gap also doubled
          (`gap-6`) for more breathing room. */}
      {phone ? <div className="v12-phone-dock-launcher">
        <button type="button" className="v12-phone-dock-vitality" onClick={() => { setPhonePanel("resources"); setExpanded(value => phonePanel === "resources" ? !value : true); }} aria-expanded={expanded && phonePanel === "resources"} aria-label={`Vitality ${effectiveCurrent} of ${maxVitality}; open resources`}>
          <Heart aria-hidden="true" />
          <strong>{effectiveCurrent}<span>/{maxVitality}</span></strong>
        </button>
        <button type="button" className="v12-phone-dock-numbers" onClick={() => { setPhonePanel("rolls"); setExpanded(value => phonePanel === "rolls" ? !value : true); }} aria-expanded={expanded && phonePanel === "rolls"} aria-label={expanded && phonePanel === "rolls" ? "Collapse character numbers" : "Expand character numbers and practices"}>
          {([
            { label: "PHY", name: "Physical", mod: physMod, save: physSave },
            { label: "MEN", name: "Mental", mod: mentMod, save: mentSave },
            { label: "MAG", name: "Magical", mod: magiMod, save: magiSave },
          ] as const).map(({ label, name, mod, save }) => <span className="v12-phone-dock-stat" key={label} aria-label={`${name} modifier ${fmt(mod)}, save ${fmt(save)}`}>
            <small>{label}</small><strong>{fmt(mod)}</strong><span className="v12-phone-dock-save">S {fmt(save)}</span>
          </span>)}
          {([
            { label: "PB", name: "Proficiency bonus", value: fmt(pb) },
            { label: "DC", name: "Save DC", value: primaryDc },
            { label: "ATK", name: "Attack bonus", value: fmt(primaryAttackBonus) },
          ] as const).map(({ label, name, value }) => <span className="v12-phone-dock-stat v12-phone-dock-derived" key={label} aria-label={`${name} ${value}`}><small>{label}</small><strong>{value}</strong></span>)}
          {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
      </div> : <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="v12-bottom-drawer-toggle flex w-full items-center justify-between gap-2 border-b border-border pl-3 pr-16 py-1.5 text-sm hover:bg-secondary/30"
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
      </button>}

      {/* Drawer content — only when expanded. Grows upward
          with max-h-[70dvh] so the user can see most of the
          page's content even when expanded. On mobile this
          is essentially the entire visible viewport. */}
      {expanded && (
        <div
          className="v12-bottom-drawer-body px-2 pb-3 pt-1.5 max-h-[70dvh] overflow-y-auto"
          data-testid="bottom-sticky-bar-drawer"
          data-phone-panel={phone ? phonePanel : undefined}
        >
          {phone && <nav className="v12-phone-instrument-tabs" aria-label="Character instruments">{(["rolls", "resources", "rules"] as const).map(panel => <button type="button" key={panel} aria-pressed={phonePanel === panel} onClick={() => setPhonePanel(panel)}>{panel}</button>)}<button type="button" aria-label="Close character instruments" onClick={() => setExpanded(false)}>×</button></nav>}
          {phone && onOpenConsequences && <button type="button" className="v12-phone-consequences-button" onClick={onOpenConsequences}>Consequences <span>Conditions, costs &amp; ongoing effects</span></button>}
          {/* 1. Vitality header + bar + buttons.
              The header + numbers + bar are all clickable
              to open the max-vitality provenance modal.
              The Damage/Heal/Long-rest/Short-rest buttons
              live in their own row to avoid click conflicts. */}
          <DrawerVitalityDeck current={effectiveCurrent} max={maxVitality} onOpen={openVitalityModal}><div className="mt-1.5 flex flex-nowrap gap-1"><VitalityTracker characterId={characterId} max={maxVitality} current={effectiveCurrent} onCurrentChange={setOptimisticVitality} compact/></div></DrawerVitalityDeck>

          {/* 2. Mods + saves + PB — 4 chips. Each is clickable for
              a formula popup. The proficient chip gets a "PROF" tag.
              PB is the 4th card (Phase 8.4 v25 — moved here from
              the bottom grid so the user sees it next to the mods). */}
          <DrawerAttributeDeck onOpen={openModSaveModal} attributes={([{attr:"physical",label:"PHYS",mod:physMod,save:physSave},{attr:"mental",label:"MENT",mod:mentMod,save:mentSave},{attr:"magical",label:"MAGI",mod:magiMod,save:magiSave}] as const).map(({attr,label,mod,save})=>{const contributions=resolver?.byTarget?.[`${attr}_saving_throw`]??[];return {key:attr,label,modifier:mod,save,proficient:proficientAttribute?.toLowerCase()===attr||contributions.some(c=>c.op==="add"&&c.value===pb&&!(c.tags??[]).includes("expertise")),expert:contributions.some(c=>(c.tags??[]).includes("expertise")),marker:<AxisMarkers byTarget={byTarget} target={`attribute.${attr}`}/>};})}/>

          {/* 3. PB (left) + Attack Bonus (mid) + DC (right)
              — three teal-accented "meta-stat" cards on a
              single row at all widths. Phase 8.5 H7 (Mashu
              2026-08-03): PB joined ATK + Save DC here; it was
              previously in the attribute row above. */}
          <div className="v12-drawer-section v12-drawer-derived mb-2 grid grid-cols-3 gap-2">
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
              title="Show provenance for DC"
              aria-label="Show DC formula"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    DC
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
          <div className="v12-drawer-section v12-drawer-practices">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Practices
            </p>
            {practices.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
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
                    <div
                      key={attr}
                      role="button"
                      tabIndex={0}
                      onClick={() => openPracticeModal(attrLower)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openPracticeModal(attrLower);
                        }
                      }}
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
                        <p className="text-xs text-muted-foreground italic">
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
                              (c) => c.conditionActive && !c.inhibited && c.value !== 0 &&
                                (c.tags.includes("expertise") || c.primitiveName.toLowerCase().includes("expertise")),
                            );
                            const hasProf = practiceContribs.some(
                              (c) => c.conditionActive && !c.inhibited &&
                                (c.tags.includes("proficiency") || c.primitiveName.toLowerCase().includes("proficient")),
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
                                onKeyDown={(e) => e.stopPropagation()}
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
                    </div>
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
          <div className="v12-drawer-loadout mt-2 rounded-md border border-border bg-card overflow-hidden">
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
          <div className="v12-drawer-action-profile mt-2">
            <div className="v12-drawer-speed rounded-md border border-border bg-card overflow-hidden">
              <SpeedCard speedByType={speedByType} onClick={openSpeedModal} />
            </div>
            <button type="button" className="v12-scaling-console" onClick={openScalingModal}>
              <span className="v12-scaling-console-kicker">At the table</span>
              <strong>Action scale &amp; upkeep</strong>
              <p>Read scope, force, timing, and what must be sustained.</p>
              <span className="v12-scaling-console-rules">
                {scalingRules.length > 0 ? scalingRules.map((rule) => (
                  <span key={`${rule.kind}-${rule.primitiveId}`}>
                    <b>{rule.kind}</b>{rule.name}
                  </span>
                )) : <em>No action-scale primitives attached</em>}
              </span>
            </button>
          </div>

          {/* Phase 8.I i2 finish: damage modifier cards
              (resistance / vulnerability / immunity). */}
          {(damageModifiers.resistance.length > 0 ||
            damageModifiers.vulnerability.length > 0 ||
            damageModifiers.immunity.length > 0) && (
            <div className="v12-drawer-damage mt-2 rounded-md border border-border bg-card px-2 py-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

          {(visibleAccessRules.length > 0 || behaviorVariables.length > 0) && (
            <section className="v12-drawer-access mt-2" aria-label="Access and rules granted by primitives">
              <header>
                <span>Granted access &amp; behaviors</span>
                <b>{visibleAccessRules.length + behaviorVariables.length}</b>
              </header>
              <div>
                {visibleAccessRules.map((rule) => (
                  <article key={`${rule.kind}-${rule.primitiveId}`} data-rule-kind={rule.kind}>
                    <span>{ruleKindLabel[rule.kind]}</span>
                    <strong>{rule.name}</strong>
                    <p>{rule.detail}</p>
                  </article>
                ))}
                {behaviorVariables.map((variable) => {
                  const label = variable.key.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
                  return (
                    <button key={variable.key} type="button" className="v12-access-counter" onClick={() => openBehaviorModal(variable.key)}>
                      <span>Counter</span><strong>{label}</strong><b>{variable.value}</b>
                      <p>{variable.contributions.length} contributing primitive{variable.contributions.length === 1 ? "" : "s"}. Open the card for its source ledger.</p>
                    </button>
                  );
                })}
              </div>
            </section>
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
            isExpert={(resolver_?.byTarget?.[`${comboAttr}_saving_throw`] ?? []).some((c) => (c.tags ?? []).includes("expertise"))}
            resolver={resolver_}
            onClose={() => setCombo(null)}
          />
        ) : combo === "vitality" ? (
          <FormulaModal
            title="Max Vitality"
            total={maxVitality}
            formula="Max Vitality = (10 + Proficiency Bonus) × level, then apply Vitality primitives. PB and Vitality primitives may raise or lower the result."
            breakdown={contributionsToSteps(vitalityTarget, resolver_)}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
        ) : combo === "dc" ? (
          // Phase 8.M: when defense_dc primitives target multiple
          // attributes, the Save DC modal reads from the chosen
          // attribute (selected via the dropdown below).
          (() => {
            const dcAttr = effectiveDcAttr;
            const dcAttrLabel =
              dcAttr === "physical" ? "PHYSICAL" :
              dcAttr === "mental" ? "MENTAL" : "MAGICAL";
            // Phase 8.L round 82: dcTotal now reads directly from
            // resolver.totals["save_dc"], which the engine seeds
            // with 5+PB+current attribute and includes direct
            // contributions. The previous `5 + pb + dcMod +
            // dcPrimitiveBonus` formula was double-counting the
            // base. Note: dcMod was the FULL attribute value (not
            // the modifier) — another bug masked by the base=5.
            // The chosen attribute includes its active primitives.
            const dcAttribute =
              dcAttr === "physical"
                ? physMod
                : dcAttr === "mental"
                  ? mentMod
                  : magiMod;
            const dcTotal = dcResolver?.totals["save_dc"] ?? 5 + pb + dcAttribute;
            return (
          <FormulaModal
            title={`DC (${dcAttrLabel})`}
            subtitle="from the chosen attribute"
            total={dcTotal}
            formula={`Start at 5, add proficiency bonus and the ${dcAttrLabel.toLowerCase()} attribute, then apply DC primitives.`}
            breakdown={[
              { label: "Base", value: 5 },
              { label: "PB", value: pb },
              { label: `${dcAttrLabel} attribute`, value: dcAttribute },
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
              ...contributionsToSteps(`defense_dc.${dcAttr}`, dcResolver ?? resolver_),
              ...contributionsToSteps(`save_dc.${dcAttr}`, dcResolver ?? resolver_),
              ...contributionsToSteps(`save_dc`, dcResolver ?? resolver_),
            ]}
            selector={
              showSaveSelector && !readOnly
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
          <PracticeGroupModal
            attribute={comboAttr}
            practices={practices
              .filter((practice) => practice.attribute.toLowerCase() === comboAttr)
              .map((practice) => ({
                name: practice.name,
                attribute: practice.attribute,
                total:
                  (comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod) +
                  (proficientAttribute === practice.attribute ? pb : 0) +
                  (resolver_.totals[`skill_practice_check.${practice.name.toLowerCase()}`] ?? 0),
              }))}
            onSelect={openPracticeDetailModal}
            onClose={() => setCombo(null)}
          />
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
          // PB starts at +2, advances every four levels, and can
          // change through primitives.
          <FormulaModal
            title="Proficiency Bonus"
            total={pb}
            formula="PB = 2 + floor((level − 1) / 4), then apply PB primitives. The progression has no level cap."
            breakdown={[
              { label: "Base PB", value: 2 },
              { label: `Level bonus (L${level})`, value: Math.floor((level - 1) / 4) },
              { label: "PB primitive changes", value: pb - 2 - Math.floor((level - 1) / 4) },
            ]}
            onClose={() => setCombo(null)}

            characterId={characterId}          />
        ) : combo === "atk" ? (
          // Phase 8.M: when primitives target attack_bonus for
          // multiple attributes, the modal reads from the chosen
          // attribute (selected via the dropdown below).
          (() => {
            const atkAttr = effectiveAttackAttr;
            const atkAttrLabel =
              atkAttr === "physical" ? "PHYSICAL" :
              atkAttr === "mental" ? "MENTAL" : "MAGICAL";
            // Phase 8.L round 83: atkTotal reads directly from
            // resolver.totals['attack_bonus']. atkMod is the FULL
            // attribute value (e.g. 14 for phys_attr=14). The
            // "modifier" computed in the breakdown is (atkMod-10)/2.
            const atkMod = atkAttr === "physical" ? physMod :
              atkAttr === "mental" ? mentMod : magiMod;
            const atkTotal = attackResolver?.totals["attack_bonus"] ?? pb;
            const atkSelectorFloor = findFloor(
              attackResolver?.byTarget ?? {}, `attack_bonus.${atkAttr}`,
            );
            const atkSelectorCeiling = findCeiling(
              attackResolver?.byTarget ?? {}, `attack_bonus.${atkAttr}`,
            );
            return (
          // Phase 8.5 H6: Attack Bonus popup. Mirrors the PB popup
          // shape so future attribute/scope options can plug in
          // without rewiring.
          <FormulaModal
            title="Attack Bonus"
            subtitle={`${atkAttrLabel} — to-hit roll`}
            total={atkTotal}
            formula={`Combine proficiency bonus, the ${atkAttrLabel.toLowerCase()} attribute, and attack-specific primitives.`}
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
              ...contributionsToSteps(`attack_bonus.${atkAttr}`, attackResolver ?? resolver_),
              ...(atkSelectorFloor !== null && atkTotal < atkSelectorFloor
                ? [{ label: `Minimum to-hit (floor ${atkSelectorFloor})`, value: atkSelectorFloor }]
                : []),
              { label: "= Attack Bonus", value: atkTotal },
            ]}
            selector={
              showAttackSelector && !readOnly
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
        ) : combo === "scaling" ? (
          <ScalingFieldGuide
            rules={scalingRules}
            ruleKindLabel={ruleKindLabel}
            onClose={() => setCombo(null)}
          />
        ) : combo === "speed" ? (
          <FormulaModal
            title="Walking Speed"
            subtitle={`base speed (${SIZE_BASE_SPEED[characterSize]} ft for ${characterSize}) + primitive contributions`}
            total={speedByType["WALKING_SPEED"] ?? 0}
            formula={`Start from the ${characterSize.toLowerCase()} size baseline of ${SIZE_BASE_SPEED[characterSize]} feet, then apply movement primitives.`}
            info={{
              title: "Speed by size",
              body: (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Speed by size</p>
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
                formula="This counter is the combined value granted by its contributing behavior primitives."
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
            formula="Resistance halves matching damage. Vulnerability doubles it. Immunity reduces it to zero."
            resultLabel={`${damageModifiers.resistance.length + damageModifiers.vulnerability.length + damageModifiers.immunity.length} active`}
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
                resultLabel={`×${mult}`}
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
      className="v12-equip-deck block w-full bg-card p-3 text-left transition-colors hover:bg-secondary/30"
      title="Show equip slots formula"
      aria-label="Show equip slots formula"
    >
      <div className="pointer-events-none">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Equip
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {usedSlots}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          / {slotCount}
        </span>
      </p>
      <div className="v12-equip-slots mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, slotCount)}, minmax(0, 1fr))` }}>
        {slots.map((filled, i) => (
          <div
            key={i}
            className={`v12-equip-slot ${filled ? "is-filled" : "is-empty"}`}
            title={filled ? `Slot ${i + 1} (filled)` : `Slot ${i + 1} (empty)`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        2H items use 2 slots
      </p>
      </div>
    </button>
  );
}

// =============================================================================
type ScalingRule = NonNullable<BottomStickyBarProps["accessRules"]>[number];

function ScalingFieldGuide({
  rules,
  ruleKindLabel,
  onClose,
}: {
  readonly rules: ReadonlyArray<ScalingRule>;
  readonly ruleKindLabel: Record<ScalingRule["kind"], string>;
  readonly onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="v12-formula-backdrop fixed inset-0 z-[120] flex items-center justify-center overflow-hidden p-3 sm:p-5" onClick={onClose} role="dialog" aria-modal="true" aria-label="Action scale and upkeep">
      <div className="v12-field-guide v12-instrument-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="v12-field-guide-head">
          <div>
            <span className="v12-modal-kicker">Table instrument · field guide</span>
            <h2>Action scale &amp; upkeep</h2>
            <p>Read the declared intent, place it in the combat rhythm, then state its price before the roll.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="v12-field-guide-body">
          <section className="v12-field-guide-built">
            <header><h3>Built into this character</h3><b>{rules.length} attached</b></header>
            {rules.length ? (
              <div>
                {rules.map((rule) => (
                  <article key={`${rule.kind}-${rule.primitiveId}`} data-rule-kind={rule.kind}>
                    <span>{ruleKindLabel[rule.kind]}</span>
                    <strong>{rule.name}</strong>
                    <p>{rule.detail}</p>
                  </article>
                ))}
              </div>
            ) : <p className="v12-field-guide-empty">No Range, output die, or Structure primitive is currently attached.</p>}
            <aside>Range and output dice are purchased primitives. Structure records how the capability is delivered. The scales below describe the declared use at the table; they are guidance, not extra owned primitives.</aside>
          </section>

          <section className="v12-field-guide-declarations">
            <header><div><b>Declare the action</b><small>These are table-facing descriptors. They do not add purchases by themselves.</small></div></header>
            <div>
              <article><b>Targets</b><p>Single · Multiple · Area</p></article>
              <article><b>Shape</b><p>Direct · Cone · Line · Sphere · Zone · Beam</p></article>
              <article><b>Size</b><p>One target · 5 ft · 10 ft · 20 ft · Custom</p></article>
              <article><b>Placement</b><p>Self · Target · Point · Directional</p></article>
              <article><b>Effect duration</b><p>Instant · Short · Medium · Long · Scene · Persistent · Permanent</p></article>
              <article><b>Casting time</b><p>Action · Instant · Short · Medium · Long · Scene</p></article>
              <article><b>Range <span className="v12-needs-primitive">Needs primitive</span></b><p>Touch · Close · Near · Far · Very Far · Extreme</p></article>
              <article><b>Output die <span className="v12-needs-primitive">Needs primitive</span></b><p>None · d4 · d6 · d8 · d10 · d12 · d20</p></article>
            </div>
          </section>

          <section className="v12-field-guide-intent">
            <header><span>1</span><div><b>Read the intent</b><small>Three questions set the pressure.</small></div></header>
            <div className="v12-field-guide-dials">
              <article><b>Scale</b><p>Self or touch → single target → area → scene-wide</p></article>
              <article><b>Impact</b><p>Minor → combat → fight swing → encounter break → reality pressure</p></article>
              <article><b>Complexity</b><p>Simple → standard → advanced → exotic → reality-tier</p></article>
            </div>
          </section>

          <section className="v12-field-guide-rhythm">
            <header><span>2</span><div><b>Track</b><small>Track determines when the capability resolves in Combat Rhythm.</small></div></header>
            <div>
              <article><strong>Fast</strong><b>0–1</b><p>Immediate, direct, or simple.</p></article>
              <article><strong>Measured</strong><b>2–3</b><p>Standard capability or multi-step action.</p></article>
              <article><strong>Heavy</strong><b>4+</b><p>Scene-altering or extended; resolves last if still possible.</p></article>
            </div>
          </section>

          <section className="v12-field-guide-duration">
            <header><span>3</span><div><b>Duration</b><small>Duration determines how long the result exists after it resolves.</small></div></header>
            <ol>
              <li><b>Instant</b><span>Resolves and ends immediately.</span></li>
              <li><b>Defined</b><span>Persists for a stated round, scene, or other time window without active maintenance.</span></li>
              <li><b>Permanent</b><span>Remains until its fiction or rules end it; permanence does not automatically mean upkeep.</span></li>
            </ol>
          </section>

          <section className="v12-field-guide-upkeep">
            <header><span>4</span><div><b>Contextual upkeep</b><small>Active maintenance is separate from Track and Duration.</small></div></header>
            <p>Upkeep is paid at the start of each turn while the user actively maintains the effect. The capability establishes that upkeep exists; the DM sets the amount at the table from the current pressure, scrutiny, interference, and circumstances.</p>
            <p>Remaining invisible among commoners may cost little. Sustaining the same invisibility in a king’s court or among trained mages may cost more. The amount is contextual, not a fixed universal price printed permanently on the capability.</p>
            <aside><b>Cost tradeoff.</b> Pay more upfront for an effect that sustains itself for its defined Duration, or pay less initially and accept smaller ongoing payments while maintaining it. If upkeep cannot be paid, the maintained effect ends.</aside>
          </section>

          <section className="v12-field-guide-cost">
            <header><span>5</span><div><b>State the cost</b><small>The player hears the stakes before committing.</small></div></header>
            <p>Greater scale, impact, complexity, or time compression raises Strain. Cost can be Vitality, a resource, an environmental hazard, a narrative twist, lost access, or a negotiated condition. The player may accept it, reduce the intent, propose a different cost, or abort before rolling.</p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

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
      className="v12-load-deck block w-full bg-card p-3 text-left transition-colors hover:bg-secondary/30"
      title="Show walking speed formula"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
      <span className={`text-xs font-semibold uppercase ${colorClass}`}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={onClick ? (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); e.stopPropagation(); onClick(t); } : undefined}
            className={`cursor-pointer rounded-full border border-current/30 bg-current/10 px-1.5 py-0.5 text-xs font-medium ${colorClass} hover:bg-current/20`}
            title={`Click to see ${t} damage modifier provenance`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
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
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Load
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {encumbrance.load}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          / {encumbrance.capacity}
        </span>
      </p>
      <div className="v12-load-track mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`v12-load-fill h-full rounded-full transition-all ${
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
  isExpert,
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
  isExpert: boolean;
  resolver: ResolvedModifiers;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
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

  return createPortal(
    <div
      className="v12-formula-backdrop fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/50 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for ${attr.toUpperCase()} mod + save`}
    >
      <div
        className="v12-formula-modal v12-calculation-instrument v12-mod-save-modal v12-instrument-dialog flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl sm:max-h-[calc(100dvh-2.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v12-formula-head flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <span className="v12-modal-kicker">Character instrument</span>
            <h2>
              {attr.toUpperCase()} mod + save
            </h2>
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

        <div className="v12-formula-body v12-calculation-body v12-mod-save-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
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
            // Phase 8.L round 135 (Mashu): formula reflects
            // engine's actual contribution. PROF adds PB,
            // EXPERT adds PB again (stacks = 2*PB).
            formula={`${saveLabel} = ${attrLabel}${(isProf ? " + PB (proficient)" : "")}${(isExpert ? " + PB (expertise)" : "")} + primitive save contributions + action_roll sub-target ops`}
            breakdown={[
              { label: attrLabel, value: attrTotal },
              ...(isProf
                ? [{ label: "PB (proficient)", value: pb }]
                : []),
              ...(isExpert
                ? [{ label: "PB (expertise)", value: pb }]
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
    </div>,
    document.body,
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
      <div className="v12-calculation-intro" title={formula}>
        <span>Calculation</span>
        <p>{title} combines the active entries below in order. Limits apply to the result after additions and subtractions.</p>
      </div>
      {breakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fallbackMessage}</p>
      ) : (
        // Phase 8.L round 100 (Mashu): limit breakdown height so
        // long breakdowns don't push other sections off-screen.
        // Each <li> is ~50px so 8 items fit comfortably. Modal
        // body still scrolls for cases where >8 items need to
        // be visible at once.
        <ul className="max-h-[40dvh] space-y-2 overflow-y-auto pr-1">
          {breakdown.map((step, i) => {
            const contribution = step.contribution;
            if (contribution) {
              const conditionText = contribution.condition
                ? humanReadableCondition(contribution.condition as Parameters<typeof humanReadableCondition>[0]).trim()
                : "";
              return (
                <li key={`${step.label}-${i}`} className={cn("v12-contribution-row", contribution.inhibited && "is-inactive")}>
                  <div className="v12-contribution-main">
                    <div className="v12-contribution-copy">
                      <p className="v12-contribution-name" title={step.label}>{step.label}</p>
                      {step.via ? <p className="v12-contribution-via" title={step.via}><span>via</span> {step.via}</p> : null}
                    </div>
                    <div className={cn("v12-contribution-statement", `is-${contribution.op}`)}>
                      <span>{operationVerb(contribution.op)}</span>
                      <strong>{operationValue(contribution.op, contribution.value, grantedKeyword(contribution.rawValue))}</strong>
                      <small>{contribution.op === "grant" || contribution.op === "revoke" ? "for" : "to"} {humanizeMechanicalTarget(contribution.target)}</small>
                      {conditionText ? <em>when {conditionText}</em> : null}
                    </div>
                  </div>
                  <div className="v12-contribution-flags">
                    {contribution.preMirrorValue !== null ? <span className="v12-contribution-flag is-mirrored">mirrored {fmt(contribution.preMirrorValue)} → {fmt(contribution.value)}</span> : null}
                    {contribution.inhibited || contribution.conditionActive === false ? <span className="v12-contribution-flag is-inhibited">inhibited</span> : contribution.hasCondition ? <span className="v12-contribution-flag is-engaged">condition engaged</span> : null}
                  </div>
                </li>
              );
            }
            return (
              <li key={`${step.label}-${i}`} className="v12-formula-ledger-row">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{step.label}</p>
                    {step.via ? <p className="mt-0.5 text-[11px] text-muted-foreground">via {step.via}</p> : null}
                  </div>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{fmt(step.value)}</span>
                </div>
              </li>
            );
          })}
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

function contributionKey(
  c: import("@/lib/engine/resolve-modifiers").ModifierContribution,
): string {
  return [
    c.primitiveId,
    c.target,
    c.op,
    c.value,
    c.originCapabilityId ?? "",
    c.provenance.effectName ?? "",
    c.provenance.accordion ?? "",
    c.provenance.heritageName ?? "",
  ].join("|");
}

function uniqueContributions(
  contributions: readonly import("@/lib/engine/resolve-modifiers").ModifierContribution[],
) {
  const seen = new Set<string>();
  return contributions.filter((contribution) => {
    const key = contributionKey(contribution);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function PracticeGroupModal({ attribute, practices, onSelect, onClose }: {
  attribute: "physical" | "mental" | "magical";
  practices: ReadonlyArray<{ name: string; attribute: "PHYSICAL" | "MENTAL" | "MAGICAL"; total: number }>;
  onSelect: (practice: { name: string; attribute: "PHYSICAL" | "MENTAL" | "MAGICAL"; total: number }) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="v12-formula-backdrop fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/60 p-3 backdrop-blur-sm sm:p-5" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${attribute} practices`}>
      <div className="v12-formula-modal v12-calculation-instrument v12-instrument-dialog flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="v12-formula-head flex items-center justify-between border-b border-border px-4 py-3">
          <div><span className="v12-modal-kicker">Character instrument</span><h2>{attribute.toUpperCase()} practices</h2></div>
          <button type="button" onClick={onClose} className="rounded-md p-1 transition-colors hover:bg-muted" aria-label="Close">×</button>
        </div>
        <div className="v12-formula-body min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <p className="text-sm text-muted-foreground">Each Practice has its own total and rule contributions. Select one to see its calculation.</p>
          {practices.map((practice) => (
            <button key={practice.name} type="button" onClick={() => onSelect(practice)} className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left hover:bg-secondary/30">
              <span className="capitalize">{practice.name}</span><strong className="font-mono tabular-nums">{practice.total >= 0 ? `+${practice.total}` : practice.total}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ContribListItem({ c, setRawTokensOpen, isOff, offReason }: {
  c: import("@/lib/engine/resolve-modifiers").ModifierContribution;
  setRawTokensOpen: (cond: unknown) => void;
  isOff: boolean;
  offReason?: "capability" | "condition" | null;
}) {
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? `+${n}` : `${n}`);
  const prov = c.provenance;
  const breadcrumb = [
    prov.accordion ?? null,
    prov.heritageName,
    prov.capabilityName,
    prov.effectName,
  ].filter(Boolean).join(" › ") || "Direct";
  const condText = c.condition
    ? humanReadableCondition(c.condition as Parameters<typeof humanReadableCondition>[0])
    : null;
  const keyword = c.op === "grant" ? grantedKeyword(c.rawValue) : null;
  const value = operationValue(c.op, c.value, keyword);
  const target = humanizeMechanicalTarget(c.target);
  return (
    <li className={cn("v12-contribution-row", isOff && "is-inactive")}>
      <div className="v12-contribution-main">
        <div className="v12-contribution-copy">
          <p className={cn("v12-contribution-name", isOff && "text-muted-foreground line-through")} title={c.primitiveName}>
            {c.primitiveName}
            {isOff ? <span className="v12-contribution-status">{offReason === "condition" ? "condition not met" : "capability inactive"}</span> : null}
          </p>
          <p className="v12-contribution-via" title={breadcrumb}><span>From</span> {breadcrumb}</p>
        </div>
        <div className={cn("v12-contribution-statement", `is-${c.op}`)}>
          <span>{operationVerb(c.op)}</span>
          <strong>{value}</strong>
          <small>{c.op === "grant" || c.op === "revoke" ? "for" : "to"} {target}</small>
          {condText ? (
            <button type="button" onClick={() => setRawTokensOpen(c.condition)} className="v12-contribution-condition">
              when {condText}
            </button>
          ) : null}
        </div>
      </div>
      <div className="v12-contribution-flags">
        {c.preMirrorValue !== null ? <span className="v12-contribution-flag is-mirrored">Mirrored {fmt(c.preMirrorValue)} → {fmt(c.value)}</span> : null}
        {isOff ? <span className="v12-contribution-flag is-inhibited">Inactive</span> : c.hasCondition ? <span className="v12-contribution-flag is-engaged">Condition active</span> : null}
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

  // Use the same play state as the resolver, including read-only public snapshots.
  const { offCapabilityIds } = useToggleState(characterId);
  const [rawTokensOpen, setRawTokensOpen] = useState<unknown | null>(null);

  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n >= 0 ? `+${n}` : `${n}`);

  // The practice's "primitive contributions" are the
  // same as the attribute's primitive contributions —
  // practices inherit the attribute's resolver total.
  const attrTarget = `attribute.${practice.attribute}`;
  const contributions = uniqueContributions(byTarget[attrTarget] ?? []);
  const attrDelta = attrMod - attrBase;
  // Practice-specific primitive contributions (e.g. Proficient Fieldcraft,
  // Iron Will) target `skill_practice_check.<practice>`. These are
  // SEPARATE from the attribute primitives — both feed into the
  // practice total.
  const practiceTarget = `skill_practice_check.${practice.name.toLowerCase()}`;
  const practiceContributions = uniqueContributions(byTarget[practiceTarget] ?? []);
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
  const practiceMaxDisplay = practiceMax == null || practiceMax === Infinity ? null : practiceMax;
  // Mirror-style trace: show the formula
  //   total = attrBase + (PB if prof) + attrDelta
  // It's the same as the Save DC formula except the
  // primitive contributions are real (the attribute's
  // primitives), not just PB.

  return (
    <Fragment>
    {createPortal(
    <div
      className="v12-formula-backdrop fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/50 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for ${practice.name}`}
    >
      <div
        className="v12-formula-modal v12-calculation-instrument v12-instrument-dialog v12-practice-modal flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl sm:max-h-[calc(100dvh-2.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v12-formula-head flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 shrink-0">
          <div className="min-w-0">
            <span className="v12-modal-kicker">Character instrument</span>
            <h2>{practice.name}</h2>
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

        <div className="v12-formula-body v12-calculation-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
          {/* Phase 8.L round 16: practice description lives
              INSIDE the scroll area (was in the sticky header
              and forced the modal to overflow on mobile).
              Per Mashu: "the header is not part of scroll...
              Only the name has to be sticky not the
              description or the accordions." */}
          <PhonePracticeAbout>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
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
                      <summary className="cursor-pointer list-none font-semibold uppercase tracking-wide text-xs text-muted-foreground">
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
                      <summary className="cursor-pointer list-none font-semibold uppercase tracking-wide text-xs text-muted-foreground">
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
                    <details className="v12-practice-boundary">
                      <summary>Practice boundary</summary>
                      <p>{desc.versus}</p>
                    </details>
                  ) : null}
                </div>
              );
            })()}
          </PhonePracticeAbout>
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(practice.total)}
              </span>
            </div>
            <div className="v12-equation-board" aria-label="Practice total calculation">
              <div><span>Attribute modifier</span><strong>{fmt(attrMod)}</strong></div>
              <i>+</i>
              <div><span>Proficiency</span><strong>{isProf ? fmt(pb) : "—"}</strong></div>
              <i>+</i>
              <div><span>Practice effects</span><strong>{fmt(practicePrimitiveTotal)}</strong></div>
              <i>=</i>
              <div className="is-result"><span>Practice total</span><strong>{fmt(practice.total)}</strong></div>
            </div>
            {(practiceMin > 0 || practiceMaxDisplay !== null) ? (
              <div className="v12-roll-limits">
                <span>Roll limits</span>
                {practiceMin > 0 ? <strong>Results cannot fall below {practiceMin}</strong> : null}
                {practiceMaxDisplay !== null ? <strong>Results cannot exceed {practiceMaxDisplay}</strong> : null}
              </div>
            ) : null}
          </section>

          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Consequences
            </p>
            {(() => {
              const allContribs = [
                ...(byTarget[attrTarget] ?? []),
                ...(byTarget[practiceTarget] ?? []),
              ].filter((c) => c.hasCondition);
              if (allContribs.length === 0)
                return <p className="text-xs text-muted-foreground">No active consequences.</p>;
              return (
                <ul className="space-y-1">
                  {allContribs.map((c, i) => {
                    const conditionText = c.condition
                      ? humanReadableCondition(c.condition as Parameters<typeof humanReadableCondition>[0]).trim()
                      : "";
                    return <li key={`cond-${i}`} className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-xs">
                      <div className="v12-condition-contribution">
                        <span className="v12-condition-contribution-name">
                          <strong>{c.primitiveName}</strong>
                        </span>
                        <span className={cn("v12-contribution-statement", `is-${c.op}`)}>
                          <span>{operationVerb(c.op)}</span>
                          <strong>{operationValue(c.op, c.value, grantedKeyword(c.rawValue))}</strong>
                          <small>{c.op === "grant" || c.op === "revoke" ? "for" : "to"} {humanizeMechanicalTarget(c.target)}</small>
                          {conditionText ? <em>when {conditionText}</em> : null}
                        </span>
                        <span className={cn("font-mono text-xs", c.conditionActive === false ? "text-red-500" : "text-teal-600 dark:text-teal-400")}>
                          {c.conditionActive === false ? "⛔ Inhibited" : c.conditionActive === true ? "✓ Engaged" : "— inactive"}
                        </span>
                      </div>
                    </li>;
                  })}
                </ul>
              );
            })()}
          </section>

          <section data-phone-empty={contributions.length === 0 || undefined}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

          <section data-phone-empty={practiceContributions.length === 0 || undefined}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Practice primitives
            </p>
            {practiceContributions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No practice-specific primitive contributes here.
              </p>
            ) : (
              <ul className="space-y-2">
                {practiceContributions.map((c, i) => (
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
      document.body,
    )}
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

  return createPortal(
    <div
      className="v12-formula-backdrop fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/50 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for Encumbrance`}
    >
      <div
        className="v12-formula-modal v12-calculation-instrument v12-instrument-dialog flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl sm:max-h-[calc(100dvh-2.5rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v12-formula-head flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <span className="v12-modal-kicker">Character instrument</span>
            <h2>Encumbrance</h2>
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

        <div className="v12-formula-body v12-calculation-body v12-encumbrance-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
          {/* Static formula */}
          <section className="v12-formula-rule-panel">
            <div className="v12-rule-overview">
              <div><span>Carrying status</span><strong>{encumbrance.encumbered ? "Encumbered" : `${capacity - load} free`}</strong></div>
              <p>Capacity starts with the character’s size allowance, adds five times their Physical modifier, then applies carrying primitives. Load is the combined size load of every carried item, including equipped items.</p>
            </div>
          </section>

          {/* Capacity breakdown */}
          <section className="v12-encumbrance-capacity">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Capacity
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(capacity)}
              </span>
            </div>
            <div className="v12-equation-board" aria-label="Capacity calculation">
              <div><span>{characterSize.toLowerCase()} size</span><strong>{sizeCap}</strong></div><i>+</i>
              <div><span>Physical × 5</span><strong>{fmt(physBonus)}</strong></div><i>+</i>
              <div><span>Carrying effects</span><strong>{fmt(primitiveBonus)}</strong></div><i>=</i>
              <div className="is-result"><span>Capacity</span><strong>{capacity}</strong></div>
            </div>
            {primitiveContributions && primitiveContributions.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {primitiveContributions.map((p) => (
                  <li key={`${p.id}-${p.target}`} className="v12-contribution-row">
                    <div className="v12-contribution-main">
                      <span className="v12-contribution-name">{p.name}</span>
                      <span className={cn("v12-contribution-statement", `is-${p.op}`)}>
                        <span>{operationVerb(p.op)}</span><strong>{operationValue(p.op, p.value)}</strong><small>to carrying capacity</small>
                      </span>
                    </div>
                    {(p.provenance.heritageName || p.provenance.capabilityName || p.provenance.effectName) ? (
                      <span className="pl-1 text-xs italic text-muted-foreground">
                        via{" "}
                        {[p.provenance.accordion ?? null, p.provenance.heritageName, p.provenance.capabilityName, p.provenance.effectName]
                          .filter(Boolean)
                          .join(" › ")}
                      </span>
                    ) : (
                      <span className="pl-1 text-xs italic text-muted-foreground">via Direct</span>
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Equip-slot primitives
              </p>
              <ul className="space-y-1">
                {equipSlotContributions.map((p) => (
                  <li key={`${p.id}-${p.target}`} className="v12-contribution-row">
                    <div className="v12-contribution-main">
                      <span className="v12-contribution-name">{p.name}</span>
                      <span className={cn("v12-contribution-statement", `is-${p.op}`)}>
                        <span>{operationVerb(p.op)}</span><strong>{operationValue(p.op, p.value)}</strong><small>to equip slots</small>
                      </span>
                    </div>
                    {(p.provenance.heritageName || p.provenance.capabilityName || p.provenance.effectName) ? (
                      <span className="pl-1 text-xs italic text-muted-foreground">
                        via{" "}
                        {[p.provenance.accordion ?? null, p.provenance.heritageName, p.provenance.capabilityName, p.provenance.effectName]
                          .filter(Boolean)
                          .join(" › ")}
                      </span>
                    ) : (
                      <span className="pl-1 text-xs italic text-muted-foreground">via Direct</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Reference — Equip slots summary */}
          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reference — Equip slots
            </p>
            <div className="v12-equip-reference">
              <div><span>Available</span><strong>{encumbrance.equipSlotsAvailable}</strong></div>
              <div><span>Used</span><strong>{encumbrance.equipSlotsUsed}</strong></div>
              <div><span>From primitives</span><strong>{fmt(encumbrance.equipSlotsAvailable - 6)}</strong></div>
              <p>Ordinary equipped items use one slot; two-handed items use two. The table can agree a higher authored requirement for unusual gear. Item size does not automatically multiply it. Primitives can extend available slots. Equipped items also contribute to Load.</p>
            </div>
          </section>

          {/* Size table + pouch rule */}
          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reference — Size table
            </p>
            <div className="v12-size-reference">
              {(["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const).map((sz) => (
                <article key={sz} className={sz === characterSize ? "is-current" : ""}>
                  <strong>{sz.toLowerCase()}</strong>
                  <span><small>Capacity</small>{SIZE_CAPACITY[sz]}</span>
                  <span><small>Load / item</small>{sz === "TINY" ? "0*" : SIZE_LOAD[sz]}</span>
                </article>
              ))}
              <p>
                * Tiny items are tracked via pouches: 1 Pouch = up to 1000 Tiny Items
                = 1 Load. Includes coins, gems, scrolls, nails, etc.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PhonePracticeAbout({children}: {children: ReactNode}) {
  const phone = usePhoneCharacterSurface();
  return phone ? <details className="v12-practice-about v12-phone-practice-reference"><summary>About this practice</summary><div>{children}</div></details> : <section className="v12-practice-about">{children}</section>;
}
