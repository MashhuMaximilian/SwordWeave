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

      {/* Expanded drawer — Phase 8.4 v4 (Mashu 2026-07-28):
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
            in z index, but expanded above it in z index." */}
      {expanded ? (
        <div
          className="fixed bottom-12 left-0 right-0 z-50 border-t border-border bg-background/95 px-3 pb-3 pt-2 max-h-[60dvh] overflow-y-auto"
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

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Quick Practices
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PracticeColumn
                attr="PHYSICAL"
                label="Physical"
                practices={practices}
                proficientAttribute={proficientAttribute}
                pb={pb}
              />
              <PracticeColumn
                attr="MENTAL"
                label="Mental"
                practices={practices}
                proficientAttribute={proficientAttribute}
                pb={pb}
              />
              <PracticeColumn
                attr="MAGICAL"
                label="Magical"
                practices={practices}
                proficientAttribute={proficientAttribute}
                pb={pb}
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
  pb,
}: {
  attr: "PHYSICAL" | "MENTAL" | "MAGICAL";
  label: string;
  practices: ReadonlyArray<PracticeRowForSticky>;
  proficientAttribute: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
  pb: number;
}) {
  const group = practices.filter((p) => p.attribute === attr);
  if (group.length === 0) return null;
  const isProficient = proficientAttribute === attr;
  return (
    <div className="space-y-0.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {isProficient ? (
          <span className="ml-2 rounded-full bg-teal-600/10 px-1.5 py-0.5 text-[9px] font-medium text-teal-600 dark:text-teal-400">
            Prof +{pb} PB
          </span>
        ) : null}
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
