"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { VitalityTracker } from "@/components/characters/vitality-tracker";

export interface PrimitiveModifierDeltaForSticky {
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
}

export interface PracticeRowForSticky {
  readonly practice: string;
  readonly attribute: "PHYSICAL" | "MENTAL" | "MAGICAL";
  readonly total: number;
  readonly pbContribution: number;
  readonly proficient: boolean;
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
   * Phase 8.4 (Mashu 2026-07-28): per-attribute delta from slotted
   * primitives (regular + mirrored). Used to compute the effective
   * modifier so the collapsed bar shows the same value the
   * CoreStatsCard shows on the page.
   */
  readonly primitiveModifierDelta?: PrimitiveModifierDeltaForSticky;
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
  primitiveModifierDelta,
  practices,
}: BottomStickyBarProps) {
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const physDelta = primitiveModifierDelta?.physical ?? 0;
  const mentDelta = primitiveModifierDelta?.mental ?? 0;
  const magiDelta = primitiveModifierDelta?.magical ?? 0;
  const physMod = Math.floor((physical - 10) / 2) + physDelta;
  const mentMod = Math.floor((mental - 10) / 2) + mentDelta;
  const magiMod = Math.floor((magical - 10) / 2) + magiDelta;

  const phys = physMod >= 0 ? `+${physMod}` : `${physMod}`;
  const ment = mentMod >= 0 ? `+${mentMod}` : `${mentMod}`;
  const magi = magiMod >= 0 ? `+${magiMod}` : `${magiMod}`;
  const pbDisplay = pb >= 0 ? `+${pb}` : `${pb}`;

  return (
    <div
      // Phase 8.4 v4 (Mashu 2026-07-28): bar at bottom-12 (48px)
      // so it sits directly on top of the tabs (which are at
      // bottom-0, ~48px tall). Mashu 2026-07-28: "Bar maybe at
      // bottom 12 or 10? It should sit directly on the tabs."
      // z-index: z-30 (BELOW FAB's z-40) so the FAB stays on top
      // when the bar is collapsed. The expanded drawer has its
      // own z-50 wrapper below so when expanded, the drawer
      // overlays the FAB. Mashu 2026-07-28: "Quick bar collaosed
      // should be beneath fab in z index, but expanded above it
      // in z index (so we can make quick bar header the collapsed
      // one have different z index than the expanded part below
      // header)."
      className="fixed bottom-12 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      data-testid="bottom-sticky-bar"
      data-expanded={expanded}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 pr-16 pl-3 py-2 text-sm hover:bg-secondary/30"
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

      {/* Expanded drawer — Phase 8.4 v5 (Mashu 2026-07-28):
          - Removed the duplicate "VITALITY: 78/73" header (the
            collapsed bar already shows it).
          - Full viewport width (no pr-16 padding) so the 4 vitality
            buttons and the 3-column practice grid use the full
            horizontal space.
          - 3-column practice grid (Physical + Mental + Magical
            side-by-side) instead of the previous 2-column +
            Magical-below layout. Mashu 2026-07-28: "Let's make 3
            columns for the quick practices here and see if it
            works."
          - Wrapped in a z-50 fixed-positioned overlay so the
            expanded drawer sits ABOVE the FAB (z-40). The bar
            header itself stays at z-30 (below FAB). Mashu
            2026-07-28: "Quick bar collaosed should be beneath fab
            in z index, but expanded above it in z index."
          - Positioned at bottom-24 (96px) so the drawer's
            bottom edge sits at the TOP of the bar (which is
            at bottom-12 / 48px + ~48px tall = 96px). The
            drawer no longer overlays the bar visually —
            they're stacked with the drawer above the bar.
            Mashu 2026-07-28: "When I expand quick bar it has
            open space and we need to lower it to start on
            top of the quick bar."
          - Added pb-20 (80px) bottom padding so the last
            practice row clears the FAB (at bottomOffset={56})
            when the user scrolls within the drawer. Mashu
            2026-07-28: "However we can use like some bottom
            padding to not have the Fab overlap with the
            modifiers." */}
      {expanded ? (
        <div
          className="fixed bottom-[5.25rem] left-0 right-0 z-50 border-t border-border bg-background/95 px-3 pb-12 pt-2 max-h-[60dvh] overflow-y-auto"
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

          {/* Phase 8.4 v5 (Mashu 2026-07-28): the Quick
              Practices header now surfaces the attribute
              modifier (raw + primitive delta) inline with the
              title. Mashu 2026-07-28: "I want in line with
              quick practices title the modifiers for
              attributes and well as the proficiency bonus."
              The previous version showed best practice totals,
              which the user explicitly rejected. */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Quick Practices
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold tabular-nums">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-foreground">
                  PHYS {phys}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-foreground">
                  MENT {ment}
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-foreground">
                  MAGI {magi}
                </span>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                  PROF {pbDisplay} PB
                </span>
              </div>
            </div>
            {/* Phase 8.4 v5 (Mashu 2026-07-28): wider gutter
                between the middle column and the ones on left
                and right. Mashu 2026-07-28: "we need a bit more
                gutter/padding between the middle column and
                the one on left and right." The previous
                `gap-2` (8px) is replaced with `gap-x-3` (12px)
                and `gap-y-0` so rows stack tight vertically.
                Also `px-1.5` adds 6px horizontal padding
                inside each column cell so names don't bump
                against the cell border. */}
            {/* Phase 8.4 v5 (Mashu 2026-07-28): gap-x-4
                (16px) between columns so the middle column
                has clear breathing room from left/right.
                Mashu 2026-07-28: "we need a bit more
                gutter/padding between the middle column and
                the one on left and right." */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-0">
              <PracticeColumn
                attr="PHYSICAL"
                label="Physical"
                practices={practices}
                proficientAttribute={proficientAttribute}
              />
              <PracticeColumn
                attr="MENTAL"
                label="Mental"
                practices={practices}
                proficientAttribute={proficientAttribute}
              />
              <PracticeColumn
                attr="MAGICAL"
                label="Magical"
                practices={practices}
                proficientAttribute={proficientAttribute}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PracticeColumn({
  attr,
  label,
  practices,
  proficientAttribute,
}: {
  attr: "PHYSICAL" | "MENTAL" | "MAGICAL";
  label: string;
  practices: ReadonlyArray<PracticeRowForSticky>;
  proficientAttribute: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
}) {
  const group = practices.filter((p) => p.attribute === attr);
  if (group.length === 0) return null;
  const isProficient = proficientAttribute === attr;
  return (
    <div className="space-y-0.5">
      {/* Phase 8.4 v5 (Mashu 2026-07-28): column header now
          shows ONLY the attribute name. The modifier is
          surfaced in the Quick Practices title row above
          (PHYS -3 | MENT -3 | MAGI -5 | PROF +6 PB) — no
          need to repeat it per column. Mashu 2026-07-28:
          "we have the tags with modifiers, but on columns
          under each title we don't need them (crossed
          red)." */}
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
        <span
          className={cn(
            isProficient ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
      </div>
      <ul className="space-y-0.5">
        {group
          .sort((a, b) => b.total - a.total)
          .map((p) => {
            const total = p.total >= 0 ? `+${p.total}` : `${p.total}`;
            // Mashu 2026-07-27: capitalize the first letter of the
            // practice name. Source data is lowercase; we transform
            // here. CSS `capitalize` is unreliable across environments
            // so we do it in JS.
            const displayName = p.practice.length > 0
              ? p.practice.charAt(0).toUpperCase() + p.practice.slice(1)
              : p.practice;
            return (
              <li
                key={p.practice}
                // Phase 8.4 (Mashu 2026-07-28): the practice name
                // and the modifier need a small fixed gap so the
                // eye can connect them. We use `gap-2` (8px) on the
                // flex container which is wider than the natural
                // 4px gap. The modifier is still right-aligned but
                // no longer hugs the right edge — Mashu 2026-07-28:
                // "modifiers should be closer to names not at the
                // right edge of column, we need a padding of sorts".
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span
                  className={cn(
                    "truncate",
                    isProficient
                      ? "text-teal-600 dark:text-teal-400"
                      : "text-foreground",
                  )}
                >
                  {displayName}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono font-semibold",
                    isProficient
                      ? "text-teal-600 dark:text-teal-400"
                      : "text-foreground",
                  )}
                >
                  {total}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
