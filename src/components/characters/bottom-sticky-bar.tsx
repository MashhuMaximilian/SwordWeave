"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { VitalityTracker } from "@/components/characters/vitality-tracker";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";

export interface AttributeModifiersForSticky {
  /**
   * Final per-attribute modifier (raw `Math.floor((attr-10)/2)` +
   * primitive contributions, after mirror flips + stacking).
   * The canonical Phase 8.3f resolver in
   * `src/lib/engine/resolve-modifiers.ts` produces this directly
   * — the bar no longer recomputes the formula itself.
   */
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
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
   * contributions) produced by the canonical resolver. The
   * bar no longer recomputes anything — the resolver
   * already handles the math + mirror flips + stacking.
   */
  readonly attributeModifiers?: AttributeModifiersForSticky;
  /**
   * Phase 8.3f S5 (Mashu 2026-07-28): the resolver's full
   * output. The bar uses `totals` for save value + save DC
   * computation. Optional — if omitted, the bar shows mod
   * only (legacy fallback for tests).
   */
  readonly resolver?: ResolvedModifiers;
  /**
   * Phase 8.3g (Mashu 2026-07-28): practices list was removed.
   * The quick bar no longer shows individual practices — just
   * per-attribute modifier + save value. Use the in-page
   * Practices card on the Overview tab to see the full list.
   */
  readonly practices?: never;
  // Keep PracticeRowForSticky as an exported type so existing
  // import sites don't break (the type was exported but never
  // referenced outside the bar).
  readonly __practiceRowForStickyCompat?: never;
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
}: BottomStickyBarProps) {
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  // Phase 8.3g (Mashu 2026-07-28): the resolver returns the
  // FINAL per-attribute modifier (slice + primitive
  // contributions + mirror flips). We just use it directly.
  const physMod = attributeModifiers?.physical ?? physical;
  const mentMod = attributeModifiers?.mental ?? mental;
  const magiMod = attributeModifiers?.magical ?? magical;

  const phys = physMod >= 0 ? `+${physMod}` : `${physMod}`;
  const ment = mentMod >= 0 ? `+${mentMod}` : `${mentMod}`;
  const magi = magiMod >= 0 ? `+${magiMod}` : `${magiMod}`;
  const pbDisplay = pb >= 0 ? `+${pb}` : `${pb}`;

  // Phase 8.3g: per-attribute save values. PB only for proficient.
  // The save value uses the same formula as the in-page vitality
  // card: mod + PB (if proficient) + primitives@SAVE.
  function saveFor(attr: "physical" | "mental" | "magical", mod: number): number {
    const isProf = proficientAttribute?.toLowerCase() === attr;
    const base = mod + (isProf ? pb : 0);
    const prim =
      resolver?.totals[
        `character.defense.${attr}Dc`
      ] ?? 0;
    return base + prim;
  }
  const physSave = saveFor("physical", physMod);
  const mentSave = saveFor("mental", mentMod);
  const magiSave = saveFor("magical", magiMod);

  // Phase 8.3g: ONE save DC (from the proficient attribute).
  const primaryAttr: "physical" | "mental" | "magical" =
    (proficientAttribute?.toLowerCase() as
      | "physical" | "mental" | "magical" | undefined) ?? "physical";
  const primaryMod =
    primaryAttr === "physical" ? physMod : primaryAttr === "mental" ? mentMod : magiMod;
  const primarySaveDelta =
    resolver?.totals[`character.defense.${primaryAttr}Dc`] ?? 0;
  const primaryDc = 5 + pb + primaryMod + primarySaveDelta;
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <div
      // Phase 8.4 v4 (Mashu 2026-07-28): bar at bottom-12 (48px)
      // so it sits directly on top of the tabs. The bar is
      // ALWAYS visible (collapsed = just the bar, expanded = bar
      // + drawer above it). Mashu 2026-07-28: "Quick bar
      // should've been on top of drawer."
      className="fixed bottom-12 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      data-testid="bottom-sticky-bar"
      data-expanded={expanded}
    >
      {/* Collapsed row — stays visible whether expanded or not.
          Per Phase 8.3g: shows vitality + DC + attribute mod
          pills. Click to expand; click again to collapse. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 pr-16 pl-3 py-1 text-sm hover:bg-secondary/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse quick dock" : "Expand quick dock"}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-mono font-semibold text-foreground">
            <Heart className="size-3.5 text-rose-500" />
            {currentVitality ?? maxVitality}/{maxVitality}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">
            DC {primaryDc}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">
            P{phys} Me{ment} Ma{magi}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">PB {pbDisplay}</span>
        </div>
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded drawer — Phase 8.3g (Mashu 2026-07-28):
          - Sits ABOVE the bar (the bar is the toggle/header).
          - The 3 attribute chips each have 2 ROWS: mod on top,
            save value below. NO separate SV chips. NO practices
            list (dropped per Mashu 2026-07-28 X-through).
          - One DC inline with the bar (always visible). */}
      {expanded ? (
        <div
          // Sits above the bar (bottom-12 / 48px). The bar is
          // ~28px tall so the drawer bottom = 48 + 28 = 76px
          // from viewport bottom (bottom-[4.75rem]).
          className="fixed bottom-[4.75rem] left-0 right-0 z-50 border-t border-border bg-background/95 px-3 pb-2 pt-1 max-h-[60dvh] overflow-y-auto"
          data-testid="bottom-sticky-bar-drawer"
        >
          <div className="mb-3">
            <VitalityTracker
              characterId={characterId}
              max={maxVitality}
              current={currentVitality ?? maxVitality}
              compact
            />
          </div>

          {/* Phase 8.3g (Mashu 2026-07-28): each attribute is a
              SINGLE chip with 2 ROWS — mod on top, save value
              below. NO separate SV chips. The bar's collapsed
              row already shows the same numbers; the chips
              here are clickable for provenance (mod → mod
              modal, save → save modal). The proficient
              attribute is highlighted teal. */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Saves
            </p>
            <div className="grid grid-cols-3 gap-2">
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
                    className={`flex flex-col items-center justify-center rounded-md border px-2 py-1.5 ${
                      isProf
                        ? "border-teal-500/40 bg-teal-500/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                      {label}
                    </span>
                    <span className="font-mono text-base font-bold tabular-nums">
                      {fmt(m)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">mod</span>
                    <span className="mt-1 font-mono text-sm font-semibold tabular-nums">
                      {fmt(s)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">save</span>
                  </div>
                );
              })}
            </div>

            {/* DC card (single, big). Always shows primary DC
                (from the proficient attribute). */}
            <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5">
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Save DC
                </p>
                <p className="text-[10px] text-muted-foreground">
                  (from {primaryAttr === "physical" ? "Physical" : primaryAttr === "mental" ? "Mental" : "Magical"} — proficient)
                </p>
              </div>
              <span className="font-mono text-xl font-bold tabular-nums">
                {primaryDc}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

