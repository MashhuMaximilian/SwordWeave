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
 *   - Drawer grows UPWARD with max-h-[88dvh] when expanded.
 *   - Added provenance popups for DC, attrs, saves, vitality,
 *     and practices.
 *   - PROF tag next to the proficient attribute label.
 *   - Combined mod + save provenance in a single modal.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import { ProvenanceModal } from "@/components/characters/provenance-modal";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";

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
}

type ComboKind =
  | "mod+save"
  | "vitality"
  | "dc"
  | "practice"
  | "practice-detail"
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
  const openPracticeModal = useCallback(
    (attr: "physical" | "mental" | "magical") => {
      setComboAttr(attr);
      setCombo("practice");
    },
    [],
  );

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
        className="flex w-full items-center justify-between gap-2 border-b border-border pl-3 pr-12 py-1.5 text-sm hover:bg-secondary/30"
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
          with max-h-[88dvh] so the user can see most of the
          page's content even when expanded. On mobile this
          is essentially the entire visible viewport. */}
      {expanded && (
        <div
          className="px-2 pb-20 pt-1.5 max-h-[calc(100dvh-3rem)] overflow-y-auto"
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

          {/* 2. Mods + saves — 3 chips. Each is clickable for
              a combined mod + save provenance modal. The
              proficient chip gets a "PROF" tag. */}
          <div className="mt-2 mb-2">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mods + saves
            </p>
            <div className="grid grid-cols-3 gap-1.5">
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
                    title={`Show provenance for ${label} mod + save`}
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
            </div>
          </div>

          {/* 3. Save DC card — clickable for provenance. */}
          <button
            type="button"
            onClick={openDcModal}
            className="mb-2 block w-full rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-secondary/30"
            title="Show provenance for Save DC"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Save DC
                </p>
                <p className="text-[9px] text-muted-foreground">
                  from {primaryAttrLabel} (proficient)
                </p>
              </div>
              <span className="font-mono text-2xl font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
                {primaryDc}
              </span>
            </div>
          </button>

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
          <div className="mt-2 rounded-md border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-3">
              <LoadCell encumbrance={encumbrance} />
              <div className="hidden md:block">
                <div className="bg-card p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    PB
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                    {fmt(pb)}
                  </p>
                </div>
              </div>
              <div className="bg-card p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Equip
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-muted-foreground">
                  —
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  (coming soon)
                </p>
              </div>
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
          <ModSaveProvenanceModal
            attr={comboAttr}
            attrTarget={attrTarget}
            attrLabel={`${comboAttr.toUpperCase()} modifier`}
            saveTarget={saveTarget}
            saveLabel={`${comboAttr.toUpperCase()} save`}
            saveDelta={saveFor(comboAttr, comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod) - (comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod)}
            saveBase={comboAttr === "physical" ? physMod : comboAttr === "mental" ? mentMod : magiMod}
            pb={pb}
            isProf={proficientAttribute?.toLowerCase() === comboAttr}
            totals={totals}
            byTarget={byTarget}
            onClose={() => setCombo(null)}
          />
        ) : combo === "vitality" ? (
          <ProvenanceModal
            target={vitalityTarget}
            targetLabel="Max vitality"
            totals={totals}
            byTarget={byTarget}
            onClose={() => setCombo(null)}
          />
        ) : combo === "dc" ? (
          <ProvenanceModal
            target={dcTarget}
            targetLabel={`Save DC (${primaryAttrLabel})`}
            totals={totals}
            byTarget={byTarget}
            onClose={() => setCombo(null)}
          />
        ) : combo === "practice" ? (
          <ProvenanceModal
            target={practiceTarget}
            targetLabel={`${comboAttr.toUpperCase()} practice`}
            totals={totals}
            byTarget={byTarget}
            onClose={() => setCombo(null)}
          />
        ) : combo === "practice-detail" && comboPractice ? (
          <PracticeDetailModal
            practice={comboPractice}
            totals={totals}
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
        ) : null
      )}
    </div>
  );
}

// =============================================================================
// IdentityCell — compact cell for the identity strip
// =============================================================================
function IdentityCell({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string | null;
  tone?: "default" | "ok" | "bad";
}) {
  return (
    <div className="bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 truncate font-medium ${
          tone === "ok"
            ? "text-green-600 dark:text-green-400"
            : tone === "bad"
              ? "text-destructive"
              : ""
        }`}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// LoadCell — load + capacity bar
// =============================================================================
function LoadCell({ encumbrance }: { encumbrance: EncumbranceForSticky }) {
  const tone = encumbrance.overburdened
    ? "destructive"
    : encumbrance.encumbered || encumbrance.heavilyEncumbered
      ? "warning"
      : "ok";
  return (
    <div className="bg-card p-3">
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
    </div>
  );
}

// =============================================================================
// ModSaveProvenanceModal — combined modal showing BOTH
// the attribute modifier AND the save value. The user
// gets one window with two sections so they can audit
// both contributions at once.
// =============================================================================
function ModSaveProvenanceModal({
  attr,
  attrTarget,
  attrLabel,
  saveTarget,
  saveLabel,
  saveDelta,
  saveBase,
  pb,
  isProf,
  totals,
  byTarget,
  onClose,
}: {
  attr: "physical" | "mental" | "magical";
  attrTarget: string;
  attrLabel: string;
  saveTarget: string;
  saveLabel: string;
  saveDelta: number;
  saveBase: number;
  pb: number;
  isProf: boolean;
  totals: ResolvedModifiers["totals"];
  byTarget: ResolvedModifiers["byTarget"];
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

  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  // The save value = mod + pb (if proficient). The
  // "savings" target is the proto-target that the save
  // would be decorated by, but per the resolver's design
  // saves don't have primitive contributions — they only
  // depend on the attribute mod + PB. So we render the
  // save's TOTAL manually with a note explaining the
  // formula.
  const saveTotal = saveBase + (isProf ? pb : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Provenance for ${attr.toUpperCase()} mod + save`}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Provenance
            </h2>
            <p className="mt-0.5 text-base font-semibold">
              {attr.toUpperCase()} mod + save
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
          {/* Section 1: attribute modifier */}
          <section>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {attrLabel}
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(totals[attrTarget] ?? 0)}
              </span>
            </div>
            <ul className="space-y-2">
              {(byTarget[attrTarget] ?? []).map((c, i) => (
                <ContribListItem key={`${c.primitiveId}-${i}`} c={c} />
              ))}
              {(byTarget[attrTarget] ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No primitive contributes. Base = attribute raw value.
                </li>
              )}
            </ul>
          </section>

          {/* Section 2: save value */}
          <section>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {saveLabel}
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(saveTotal)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              save = attribute mod + PB (if proficient). Formula: {fmt(saveBase)} +{" "}
              {isProf ? fmt(pb) : "0"} = {fmt(saveTotal)}.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Saves don't have primitive contributions in v1. If a future primitive
              adds to a save directly, we'll surface it here.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
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
// contributions that produced it.
// =============================================================================
function PracticeDetailModal({
  practice,
  totals,
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
  readonly totals: ResolvedModifiers["totals"];
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
  const attrDelta = totals[attrTarget] ?? 0;
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
      aria-label={`Provenance for ${practice.name}`}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Provenance
            </h2>
            <p className="mt-0.5 text-base font-semibold">
              {practice.name}
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
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Total
              </span>
              <span className="font-mono text-xl font-bold tabular-nums">
                {fmt(practice.total)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              formula: {fmt(attrBase)} (attr) + {fmt(attrDelta)} (primitives) + {isProf ? fmt(pb) : "0"} (PB) = {fmt(practice.total)}
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
