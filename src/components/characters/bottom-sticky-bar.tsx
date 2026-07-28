"use client";

/**
 * bottom-sticky-bar.tsx — Phase 8.3g v5 (Mashu 2026-07-28)
 *
 * Mobile-only bottom dock. ONE docked card at the bottom of
 * the screen with:
 *
 *   - Header bar (always visible): ♥ 308/268 | P/Me/Ma stacked
 *     | PB | DC | chevron. DC restored next to PB (Phase
 *     8.3g v5, Mashu: "In quick bar (collapsed) you took
 *     out the DC, why?"). PB moved away from the right edge
 *     so the FAB doesn't cover it (Mashu: "the PB is waaaay
 *     too much to the right and it gets covered by fab").
 *   - Drawer (only when expanded):
 *     1. Vitality header + bar + buttons (compact, single row)
 *     2. Mods + saves (3 chips)
 *     3. Save DC card
 *     4. Practices (3 columns, capitalized)
 *
 * Phase 8.3g v5 changes (Mashu 2026-07-28):
 *   - DC restored to collapsed bar (next to PB).
 *   - PB moved away from right edge (FAB don't cover).
 *   - Drawer buttons smaller (single row, no wrap).
 *   - Buttons moved UP closer to the health bar.
 *   - Header right padding reduced.
 *   - Drawer is glance-only: no clickable provenance modals.
 *   - Practices math: each practice = attribute + PB (if proficient)
 *     + primitives. No slice split.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
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

  return (
    <div
      className="fixed bottom-12 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      data-testid="bottom-sticky-bar"
      data-expanded={expanded}
    >
      {/* Header bar — always visible. The TOGGLE.
          Phase 8.3g v5 (Mashu 2026-07-28):
          - DC restored next to PB (same format like PB).
          - PB moved away from the right edge (FAB
            covers it; the previous right padding was
            there to compensate but the layout still
            butted PB against the FAB).
          - pr-2 (reduced) so the right edge has 8px
            to the chevron, not 64px like before. PB
            sits at the right of the inner content area
            with `gap-2` separating it from DC. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-sm hover:bg-secondary/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse quick dock" : "Expand quick dock"}
      >
        <div className="flex flex-1 items-center justify-between gap-2">
          {/* Vitality: ♥ 308/268 */}
          <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-semibold text-foreground">
            <Heart className="size-3.5 text-rose-500" />
            {effectiveCurrent}/{maxVitality}
          </span>

          {/* Attributes: stacked columns P / ME / MA, +5 / +5 / +0 */}
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

          {/* PB + DC (Phase 8.3g v5: DC restored, same
              format as PB; both are stacked P/B columns
              with the value below). The two are placed
              INSIDE the row (not at the right edge)
              so the FAB doesn't cover them. */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
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

      {/* Drawer content — only when expanded. */}
      {expanded && (
        <div
          className="px-2 pb-20 pt-1.5 max-h-[65dvh] overflow-y-auto"
          data-testid="bottom-sticky-bar-drawer"
        >
          {/* 1. Vitality header (label + number + bar) +
              compact action buttons in a SINGLE ROW
              (Phase 8.3g v5: "we can make them smaller
              (like long rest and short rest on a single
              row not wrapping). And move them up
              closer to the health bar."). */}
          <div className="rounded-md border border-border bg-card px-2 py-1.5">
            <div className="flex items-baseline justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Vitality
              </p>
              <p className="text-[9px] text-muted-foreground tabular-nums">
                {vitalityPercent}%
              </p>
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

            {/* Action buttons — Phase 8.3g v5: SINGLE
                ROW, smaller. flex-nowrap + even more
                compact padding than the previous
                compact. Less padding all around so
                "Long rest" fits without wrapping. */}
            <div className="mt-1.5 flex flex-nowrap gap-1">
              <VitalityTracker
                characterId={characterId}
                max={maxVitality}
                current={effectiveCurrent}
                compact
              />
            </div>
          </div>

          {/* 2. Mods + saves — 3 small chips. */}
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

          {/* 3. Save DC card — under mods+saves. */}
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

          {/* 4. Practices — 3 columns, capitalized. */}
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
                              <span className="truncate text-xs">
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
