"use client";

/**
 * bottom-sticky-bar.tsx — Phase 8.3g v4 (Mashu 2026-07-28)
 *
 * Mobile-only bottom dock. ONE docked card at the bottom of
 * the screen with:
 *
 *   - Header bar (always visible): collapsed info as stacked
 *     columns: `P Me Ma` on top, `+5 +5 +0` below. Plus
 *     vitality (♥), PB, and a chevron toggle.
 *   - Drawer (only when expanded): vitality bar + values + buttons,
 *     then ↓ mods + saves section, then DC card, then 3-column
 *     practices section.
 *
 * Phase 8.3g v4 changes (Mashu 2026-07-28):
 *   - Practices: bigger font, capitalized ("Physical" / "Mental"
 *     / "Magic"), regular card backgrounds (no teal BG).
 *   - Save chip: "save: {n}" with explicit space between mod + save.
 *   - DC card moved BELOW mods+saves, regular card (no teal BG),
 *     just the number teal.
 *   - Heal/Damage buttons less transparent (was masked by disabled
 *     state in last deploy).
 *   - Vitality bar + values restored above the buttons (the user
 *     never asked me to delete them — I removed them by mistake).
 *   - Collapsed bar attributes as stacked columns: P / ME / MA on
 *     top, +5 / +5 / +0 below.
 *   - Drawer is glance-only: no clickable provenance modals.
 *   - Practices math: each practice = attribute + PB (if proficient)
 *     + primitives. No slice split.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart, Coffee, Bed, Minus, Plus } from "lucide-react";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";

export interface PracticeRowForSticky {
  /** Optional — older call sites use PracticeRow which has
   * no `id`. Use a synthetic key in that case. */
  readonly id?: number;
  readonly name: string;
  readonly category: string;
  readonly buCost: number;
  readonly attribute: "PHYSICAL" | "MENTAL" | "MAGICAL";
  /**
   * Phase 8.3g v4: practice value = attribute + PB (if proficient)
   * + primitive contributions. Computed by the page-level
   * aggregator and passed in here.
   */
  readonly total: number;
  readonly isMirrored: boolean;
  readonly isMirrorable: boolean;
  readonly mirrorVector: string | null;
  readonly originHeritageId: string | null;
  readonly originCapabilityId: string | null;
  readonly originEffectId: string | null;
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
  /**
   * Final per-attribute modifier (raw slice + primitive
   * contributions) produced by the canonical resolver.
   */
  readonly attributeModifiers?: { physical: number; mental: number; magical: number };
  /** Resolver's full output (totals + byTarget). */
  readonly resolver?: ResolvedModifiers;
  /** Practice rows. */
  readonly practices: ReadonlyArray<PracticeRowForSticky>;
}

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
}: BottomStickyBarProps) {
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const physMod = attributeModifiers?.physical ?? physical;
  const mentMod = attributeModifiers?.mental ?? mental;
  const magiMod = attributeModifiers?.magical ?? magical;
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  // Phase 8.3g v4: the save VALUE is the d20 modifier the
  // character adds when making a save — just mod + PB (if
  // proficient). NO save-target primitives (those bump the
  // DC, not the save).
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

  // Phase 8.3g v4: capitalised practice column labels.
  const PRACTICE_ATTR_LABEL: Record<"PHYSICAL" | "MENTAL" | "MAGICAL", string> = {
    PHYSICAL: "Physical",
    MENTAL: "Mental",
    MAGICAL: "Magic",
  };

  // Phase 8.3g v4: vitality bar percentage (needed for the
  // restored bar above the buttons).
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

  return (
    <div
      // ONE docked card. Always at bottom-12 (above the tabs).
      // Header bar is always visible at the top. Drawer content
      // sits below when expanded.
      className="fixed bottom-12 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      data-testid="bottom-sticky-bar"
      data-expanded={expanded}
    >
      {/* Header bar — always visible. The TOGGLE. Phase 8.3g
          v4 (Mashu 2026-07-28): attributes stacked as
          `P / ME / MA` on top, `+5 / +5 / +0` below. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-1.5 text-sm hover:bg-secondary/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse quick dock" : "Expand quick dock"}
      >
        <div className="flex flex-1 items-center justify-between gap-3">
          {/* Vitality: ♥ 308/268 */}
          <span className="flex items-center gap-1 font-mono text-xs font-semibold text-foreground">
            <Heart className="size-3.5 text-rose-500" />
            {effectiveCurrent}/{maxVitality}
          </span>

          {/* Attributes: stacked columns P / ME / MA, +5 / +5 / +0 */}
          <div className="flex items-center gap-2 font-mono text-xs">
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

          {/* PB */}
          <div className="flex flex-col items-center font-mono text-xs leading-none">
            <span className="text-[9px] font-semibold uppercase text-muted-foreground">
              PB
            </span>
            <span className="font-bold tabular-nums">{fmt(pb)}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" />
        )}
      </button>

      {/* Drawer content — only when expanded. */}
      {expanded && (
        <div
          className="px-2 pb-24 pt-1.5 max-h-[65dvh] overflow-y-auto"
          data-testid="bottom-sticky-bar-drawer"
        >
          {/* 1. Vitality bar + values + action buttons.
              Phase 8.3g v4 (Mashu 2026-07-28): "We add back
              the vitality bar and values that you deleted
              and I never told you to delete them above the
              buttons where it was." */}
          <div className="mb-2 rounded-md border border-border bg-card px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Vitality
            </p>
            <p className="mt-0.5 font-mono text-2xl font-bold leading-none">
              {effectiveCurrent}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {maxVitality}
              </span>
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all ${vitalityColor}`}
                style={{ width: `${vitalityPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[9px] text-muted-foreground">{vitalityPercent}%</p>

            {/* Action buttons — Phase 8.3g v4 (Mashu): less
                transparent / properly solid. The disabled
                state was previously using opacity-50 which
                made them look "ghosted". Replaced with an
                explicit solid styling. */}
            <div className="mt-2 flex flex-nowrap gap-1.5">
              <VitalityTracker
                characterId={characterId}
                max={maxVitality}
                current={effectiveCurrent}
                compact
              />
            </div>
          </div>

          {/* 2. Mods + saves — 3 small chips. Per Mashu
              2026-07-28: "write 'save: {save number}'"
              and "a bit more space between the modifier
              and the save." Proficient chip is teal text
              but the BACKGROUND is regular (Phase 8.3g
              v4: "Keep the values teal but the backgrounds
              of the cards (for save DC and the proficient
              block of practices) regular.") */}
          <div className="mb-2">
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
                  <div
                    key={attr}
                    className={`flex flex-col items-center justify-center rounded border-2 bg-card px-1 py-1.5 text-center ${
                      isProf ? "border-teal-500" : "border-border"
                    }`}
                  >
                    <span
                      className={`text-[8px] font-semibold uppercase ${
                        isProf
                          ? "text-teal-700 dark:text-teal-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="mt-1 font-mono text-base font-bold tabular-nums leading-none">
                      {fmt(m)}
                    </span>
                    <span className="mt-1.5 text-[9px] text-muted-foreground">
                      save: <span className="font-mono font-semibold">{fmt(s)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Save DC card — under mods+saves. Per Mashu
              2026-07-28: "We move the save DC card in the
              Mods + saves section below the 3 cards and
              make it regular card and just the number
              teal." Regular card (no teal BG), just the
              number teal. */}
          <div className="mb-2 rounded-md border border-border bg-card px-3 py-2">
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
          </div>

          {/* 4. Practices — 3 columns, bigger font,
              capitalized. Per Mashu 2026-07-28: "In drawer
              practices need to be capitalized and a font
              size a bit bigger. We can write 'Physical'
              'mental' and 'Magic' in those cards bc it
              fits." Phase 8.3g v4 keeps values teal on
              the proficient column but the BACKGROUND is
              regular (not teal). */}
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
                  return (
                    <div
                      key={attr}
                      className={`rounded border-2 bg-card px-2 py-1.5 ${
                        isProf ? "border-teal-500" : "border-border"
                      }`}
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
                            <li
                              key={p.id ?? p.name}
                              className="flex items-center justify-between gap-1"
                            >
                              <span
                                className={`truncate text-xs ${
                                  isProf
                                    ? "text-foreground"
                                    : "text-foreground"
                                }`}
                              >
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
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
