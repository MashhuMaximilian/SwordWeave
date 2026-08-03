"use client";

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

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import {
  FormulaModal,
  contributionsToSteps,
  type FormulaStep,
} from "@/components/characters/formula-modal";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";
import { SIZE_CAPACITY, SIZE_LOAD } from "@/lib/engine/encumbrance";

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
}

export interface BottomStickyBarProps {
  readonly characterId: string;
  readonly currentVitality: number | null;
  readonly maxVitality: number;
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
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
  | null;

export function BottomStickyBar({
  characterId,
  currentVitality,
  maxVitality,
  physical,
  mental,
  magical,
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
}: BottomStickyBarProps) {
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [combo, setCombo] = useState<ComboKind>(null);
  const [comboAttr, setComboAttr] = useState<"physical" | "mental" | "magical">("physical");
  const [comboPractice, setComboPractice] = useState<{
    name: string;
    attribute: "physical" | "mental" | "magical";
    total: number;
  } | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const physMod = attributeModifiers?.physical ?? physical;
  const mentMod = attributeModifiers?.mental ?? mental;
  const magiMod = attributeModifiers?.magical ?? magical;
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  function saveFor(attr: "physical" | "mental" | "magical", mod: number): number {
    const isProf = proficientAttribute?.toLowerCase() === attr;
    return mod + (isProf ? pb : 0);
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
  const primarySaveDelta = resolver?.totals[`defense_dc.${primaryAttr}`] ?? 0;
  const primaryDc = 5 + pb + primaryMod + primarySaveDelta;

  // Phase 8.5 / Session H6 (Mashu 2026-08-03): Attack Bonus card
  // mirrors the Save DC card. Default attribute is PHYSICAL (we
  // don't track weapon/spell selection yet — that's a future phase).
  // Formula: Attack Bonus = PB + Physical mod + primitive bonuses
  // keyed by attack_bonus.physical in the resolver.
  const physicalAttackBonus =
    pb +
    physMod +
    (resolver?.totals["attack_bonus.physical"] ?? 0);

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
  const saveTarget = comboAttr === "physical"
    ? "save_dc.physical"
    : comboAttr === "mental"
      ? "save_dc.mental"
      : "save_dc.magical";
  const dcTarget = `defense_dc.${primaryAttr}`;
  const practiceTarget = `practice.${comboAttr}`;
  const vitalityTarget = "max_vitality";

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
            <div className="flex flex-col items-center leading-none">
              <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                PB
              </span>
              <span className="font-bold tabular-nums">{fmt(pb)}</span>
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                DC
              </span>
              <span className="font-bold tabular-nums text-teal-700 dark:text-teal-200">
                {primaryDc}
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
              Mods + saves + PB
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { attr: "physical", label: "PHYS", mod: physMod, save: physSave },
                  { attr: "mental", label: "MENT", mod: mentMod, save: mentSave },
                  { attr: "magical", label: "MAGI", mod: magiMod, save: magiSave },
                ] as const
              ).map(({ attr, label, mod: m, save: s }) => {
                const isProf = proficientAttribute?.toLowerCase() === attr;
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
                    <span className="mt-1 font-mono text-base font-bold tabular-nums leading-none">
                      {fmt(m)}
                    </span>
                    <span className="mt-1.5 text-[9px] text-muted-foreground">
                      save: <span className="font-mono font-semibold">{fmt(s)}</span>
                    </span>
                  </button>
                );
              })}
              {/* PB card — Phase 8.4 v25. Clickable for provenance.
                  Visual style matches the attribute cards (border + bg).
                  Text teal so it still reads as the "special" cell. */}
              <button
                type="button"
                onClick={() => setCombo("pb")}
                className="flex flex-col items-center justify-center rounded border-2 border-border bg-card px-1 py-1.5 text-center transition-colors hover:bg-secondary/30"
                title="Show formula for Proficiency Bonus"
                aria-label="Show proficiency bonus formula"
              >
                <span className="text-[8px] font-semibold uppercase text-teal-700 dark:text-teal-300">
                  PB
                </span>
                <span className="mt-1 font-mono text-base font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
                  {fmt(pb)}
                </span>
                <span className="mt-1.5 text-[9px] text-muted-foreground">
                  starts +2
                </span>
              </button>
            </div>
          </div>

          {/* 3. Attack Bonus (left) + Save DC (right) — 2 cards side-by-side. */}
          {/* Phase 8.5 H6: split into a 2-col grid. ATK defaults to Physical. */}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openAtkModal}
              className="block w-full rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-secondary/30"
              title="Show formula for Attack Bonus"
              aria-label="Show attack bonus formula"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Attack Bonus
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    PHYSICAL
                  </p>
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
                  {fmt(physicalAttackBonus)}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={openDcModal}
              className="block w-full rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-secondary/30"
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
                  const rows = practices
                    .filter((p) => p.attribute === attr)
                    .sort((a, b) => b.total - a.total);
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
                          {rows.map((p) => (
                            <li key={p.id ?? p.name}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPracticeDetailModal(p);
                                }}
                                className="flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left hover:bg-secondary/30"
                                title={`Show provenance for ${p.name}`}
                              >
                                <span className="truncate text-xs capitalize">
                                  {p.name}
                                </span>
                                <span
                                  className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${
                                    isProf
                                      ? "text-teal-700 dark:text-teal-200"
                                      : "text-foreground"
                                  }`}
                                >
                                  {fmt(p.total)}
                                </span>
                              </button>
                            </li>
                          ))}
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
          <div className="mt-2 rounded-md border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              <LoadCell encumbrance={encumbrance} onClick={openEncumbranceModal} />
              <EquipSlotsPanel
                slotCount={6}
                usedSlots={0}
              />
            </div>
          </div>
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
            saveBase={comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod}
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
          />
        ) : combo === "dc" ? (
          <FormulaModal
            title={`Save DC (${primaryAttrLabel})`}
            subtitle="from your proficient attribute"
            total={primaryDc}
            formula="Save DC = 5 + PB + proficient Attribute Mod + primitive contributions"
            breakdown={[
              { label: "Base", value: 5 },
              { label: `PB`, value: pb },
              {
                label: `${primaryAttrLabel} modifier`,
                value: primaryMod,
              },
              ...contributionsToSteps(dcTarget, resolver_),
            ]}
            onClose={() => setCombo(null)}
          />
        ) : combo === "practice" ? (
          <FormulaModal
            title={`${comboAttr.toUpperCase()} practice`}
            total={
              (resolver_.totals[practiceTarget] ?? 0) +
              (comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod) +
              (proficientAttribute?.toLowerCase() === comboAttr ? pb : 0)
            }
            formula={`Practice = base ${comboAttr.toUpperCase()} + attribute delta + PB (if proficient)`}
            breakdown={[
              {
                label: `${comboAttr.toUpperCase()} attribute`,
                value:
                  comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod,
              },
              ...contributionsToSteps(practiceTarget, resolver_),
              ...(proficientAttribute?.toLowerCase() === comboAttr
                ? [{ label: "PB (proficient)", value: pb }]
                : []),
            ]}
            onClose={() => setCombo(null)}
          />
        ) : combo === "practice-detail" && comboPractice ? (
          // PracticeDetailModal keeps its own layout — per-row
          // provenance. It uses FormulaModal for the formula +
          // summary, then the contrib list.
          <PracticeDetailModal
            practice={comboPractice}
            byTarget={byTarget}
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
          />
        ) : combo === "atk" ? (
          // Phase 8.5 H6: Attack Bonus popup. Mirrors the PB popup
          // shape so future attribute/scope options can plug in
          // without rewiring.
          <FormulaModal
            title="Attack Bonus"
            subtitle="PHYSICAL — to-hit roll"
            total={physicalAttackBonus}
            formula="Attack Bonus = Proficiency Bonus + Physical modifier + attack_bonus.physical primitives"
            breakdown={[
              { label: "Proficiency Bonus", value: pb },
              { label: `Physical modifier`, value: physMod },
              {
                label: "Primitive bonuses (attack_bonus.physical)",
                value: resolver?.totals["attack_bonus.physical"] ?? 0,
              },
              { label: "= Attack Bonus", value: physicalAttackBonus },
            ]}
            info={{
              title: "Scope: PHYSICAL only (v1)",
              body: (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Today the attack bonus card defaults to the
                    PHYSICAL attribute. Future phases will surface
                    weapon/spell selection so the same card can drive
                    MENTAL (ranged/cantrip) and MAGICAL (spell) attacks.
                    The primitive total{" "}
                    <span className="font-mono text-foreground">
                      attack_bonus.physical
                    </span>{" "}
                    is read from the resolver when present.
                  </p>
                </div>
              ),
            }}
            onClose={() => setCombo(null)}
          />
        ) : combo === "encumbrance" ? (
          <EncumbranceFormulaModal
            encumbrance={encumbrance}
            characterSize={characterSize}
            physicalMod={physMod}
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
}: {
  slotCount: number;
  usedSlots: number;
}) {
  // 6 universal equip slots (2H items use 2 slots). For now
  // this is display-only — when items are equipped the slots
  // fill in. Session G only handles the visual; the equip
  // wiring itself is the sheet tab's responsibility.
  const slots = Array.from({ length: slotCount }, (_, i) => i < usedSlots);
  return (
    <div className="bg-card p-3">
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

  // Mod total = base + primitive contributions
  const attrContribs = resolver.byTarget[attrTarget] ?? [];
  const attrDelta = resolver.totals[attrTarget] ?? 0;
  const attrTotal = saveBase + attrDelta;

  // Save total = mod + PB (if proficient)
  const saveContribs = resolver.byTarget[saveTarget] ?? [];
  const saveDelta = resolver.totals[saveTarget] ?? 0;
  const saveTotal = attrTotal + saveDelta + (isProf ? pb : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for ${attr.toUpperCase()} mod + save`}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
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
            title={saveLabel}
            total={saveTotal}
            formula={`${saveLabel} = ${attrLabel} + primitive save contributions + PB (if proficient)`}
            breakdown={[
              { label: attrLabel, value: attrTotal },
              ...saveContribs.map((c) => {
                const via =
                  c.provenance?.kind === "direct"
                    ? undefined
                    : formatViaForSteps(c);
                return via
                  ? {
                      label: c.primitiveName,
                      value: c.value,
                      via,
                      contribution: c,
                    }
                  : {
                      label: c.primitiveName,
                      value: c.value,
                      contribution: c,
                    };
              }),
              ...(isProf ? [{ label: "PB (proficient)", value: pb }] : []),
            ]}
            fallbackMessage="No primitive contributes to saves. Save = mod + PB (if proficient)."
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
}: {
  title: string;
  total: number;
  formula: string;
  breakdown: ReadonlyArray<FormulaStep>;
  fallbackMessage: string;
}) {
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {title}
        </span>
        <span className="font-mono text-xl font-bold tabular-nums">
          {fmt(total)}
        </span>
      </div>
      <p className="mb-2 rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed text-foreground">
        {formula}
      </p>
      {breakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fallbackMessage}</p>
      ) : (
        <ul className="space-y-2">
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
    </section>
  );
}

function formatViaForSteps(c: import("@/lib/engine/resolve-modifiers").ModifierContribution): string {
  const { heritageName, capabilityName, effectName, kind } = c.provenance;
  if (kind === "direct") return "";
  const parts: string[] = [];
  if (heritageName) parts.push(heritageName);
  if (capabilityName) parts.push(capabilityName);
  if (effectName) parts.push(effectName);
  if (parts.length === 0) return `from ${kind}`;
  return parts.join(" → ");
}

function ContribListItem({ c }: {
  c: import("@/lib/engine/resolve-modifiers").ModifierContribution;
}) {
  const OP_LABEL: Record<string, string> = {
    add: "+",
    subtract: "−",
    set: "=",
    min: "min",
    max: "max",
    multiply: "×",
    divide: "÷",
    grant: "grant",
    revoke: "revoke",
  };
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  return (
    <li className="rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={c.primitiveName}>
            {c.primitiveName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">
            {OP_LABEL[c.op] ?? c.op}
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {fmt(c.value)}
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
  onClose,
}: {
  readonly practice: {
    name: string;
    attribute: "physical" | "mental" | "magical";
    total: number;
  };
  readonly byTarget: ResolvedModifiers["byTarget"];
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

  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  // The practice's "primitive contributions" are the
  // same as the attribute's primitive contributions —
  // practices inherit the attribute's resolver total.
  const attrTarget = `attribute.${practice.attribute}`;
  const contributions = byTarget[attrTarget] ?? [];
  const attrDelta = attrMod - attrBase;
  // Mirror-style trace: show the formula
  //   total = attrBase + (PB if prof) + attrDelta
  // It's the same as the Save DC formula except the
  // primitive contributions are real (the attribute's
  // primitives), not just PB.

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for ${practice.name}`}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
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
            className="rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(practice.total)}
              </span>
            </div>
            <p className="mb-2 rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed text-foreground">
              Practice = base {practice.attribute.toUpperCase()} attribute +
              primitive contributions + PB (if proficient)
            </p>
            <p className="rounded-md border border-dashed border-border bg-background/50 p-2 font-mono text-[11px] text-muted-foreground">
              {fmt(attrBase)} (attr){" "}
              <span className="text-muted-foreground/70">(base)</span>{" "}
              {attrDelta !== 0 && (
                <>
                  {fmt(attrDelta)} (primitives){" "}
                  <span className="text-muted-foreground/70">(delta)</span>{" "}
                </>
              )}
              {isProf ? fmt(pb) : "+0"} (PB) = {fmt(practice.total)}
            </p>
          </section>

          <section>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Primitive contributions
            </p>
            {contributions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No primitive contributes to this practice. Total = attribute + PB.
              </p>
            ) : (
              <ul className="space-y-2">
                {contributions.map((c, i) => (
                  <ContribListItem key={`${c.primitiveId}-${i}`} c={c} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
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
}: {
  readonly encumbrance: EncumbranceForSticky;
  readonly characterSize: "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "HUGE" | "GARGANTUAN";
  readonly physicalMod: number;
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

  const sizeCap = SIZE_CAPACITY[characterSize];
  const physBonus = physicalMod * 5;
  // Item bonuses default to 0 in v25 (not plumbed through
  // yet — session H will wire it).
  const itemBonus = 0;
  const capacity = sizeCap + physBonus + itemBonus;
  const load = encumbrance.load;

  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Formula for Encumbrance`}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
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
            <p className="rounded-md border border-dashed border-border bg-background/50 p-2 font-mono text-[11px] text-muted-foreground">
              {sizeCap} (size: {characterSize}) + {physBonus} (Physical {fmt(physicalMod)} × 5)
              {itemBonus !== 0 && ` + ${itemBonus} (items)`} = {fmt(capacity)}
            </p>
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

          {/* Info panel — size table + pouch rule */}
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
              <p className="mt-1 text-[11px] text-muted-foreground">
                6 universal equip slots. 2H items use 2 slots. Equipped items also
                contribute to Load.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
