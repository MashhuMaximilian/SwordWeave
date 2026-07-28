"use client";

/**
 * Phase 8 UI revamp (Mashu 2026-07-27): BottomStickyBar
 *
 * Mobile-only sticky bar pinned above the bottom nav + FAB.
 * Collapsed default: a single thin row with vitality (HP),
 * attributes, and PB. Right side has padding so the FAB
 * doesn't cover it.
 *
 * Tapping the row opens an expanded drawer with:
 *   - Vitality management: damage / heal / short rest / long rest
 *   - Practices grouped by attribute in a 2-column grid
 *     (Physical + Mental side-by-side, Magical below)
 *
 * The FAB is at bottom: 16px and is 48px wide / 48px tall.
 * The bar sits at bottom: 80px (16 FAB + 48 FAB + 16 gap) so
 * it never overlaps. The collapsed row uses right-side padding
 * (pr-16) so the chevron / FAB-edge never touch. The
 * expanded drawer reserves right-side padding too so practice
 * modifiers aren't covered by the FAB.
 *
 * Mashu 2026-07-27: 'all the design I am telling you about
 * that was in the PDF is for mobile only! For desktop UI
 * we'll discuss later. On desktop it's ok in general.'
 *
 * Returns null on >= md screens (768px+) via Tailwind's md:hidden.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { VitalityTracker } from "@/components/characters/vitality-tracker";

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
  practices,
}: BottomStickyBarProps) {
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const physMod = Math.floor((physical - 10) / 2);
  const mentMod = Math.floor((mental - 10) / 2);
  const magiMod = Math.floor((magical - 10) / 2);

  const phys = physMod >= 0 ? `+${physMod}` : `${physMod}`;
  const ment = mentMod >= 0 ? `+${mentMod}` : `${mentMod}`;
  const magi = magiMod >= 0 ? `+${magiMod}` : `${magiMod}`;
  const pbDisplay = pb >= 0 ? `+${pb}` : `${pb}`;

  return (
    <div
      // bottom-20 = 80px = 16 (FAB bottom) + 48 (FAB height) + 16 (gap).
      // That puts the bar above the FAB with comfortable clearance.
      // Inner content gets pr-16 so the modifier text doesn't run
      // underneath the FAB column.
      className="fixed bottom-20 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
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
          {/* PDF spec: P+5 Me+5 Ma0 — single-letter labels,
              modifier only, separated by middot. */}
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

      {/* Expanded drawer */}
      {expanded ? (
        <div className="border-t border-border bg-background/95 pr-16 pl-3 pb-3 pt-2 max-h-[60dvh] overflow-y-auto">
          {/* Vitality management */}
          <div className="mb-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <Heart className="size-3.5 text-rose-500" />
              Vitality: {currentVitality ?? maxVitality}/{maxVitality}
            </div>
            <VitalityTracker
              characterId={characterId}
              max={maxVitality}
              current={currentVitality ?? maxVitality}
            />
          </div>

          {/* Practices grid: 2 columns (Physical + Mental side-by-side),
              Magical below. Mashu 2026-07-27: "make 2 columns. Physical,
              mental each a column and the magic should be below them." */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Quick Practices
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
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
            </div>
            <PracticeColumn
              attr="MAGICAL"
              label="Magical"
              practices={practices}
              proficientAttribute={proficientAttribute}
              pb={pb}
              wide
            />
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
  wide = false,
}: {
  attr: "PHYSICAL" | "MENTAL" | "MAGICAL";
  label: string;
  practices: ReadonlyArray<PracticeRowForSticky>;
  proficientAttribute: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
  pb: number;
  wide?: boolean;
}) {
  const group = practices.filter((p) => p.attribute === attr);
  if (group.length === 0) return null;
  const isProficient = proficientAttribute === attr;
  return (
    <div className={cn("space-y-0.5", wide && "col-span-2")}>
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
            // Mashu 2026-07-27: "all of them have to start with big
            // letters" — capitalize the first letter of the practice
            // name. Source data is lowercase; we transform here.
            const displayName = p.practice.length > 0
              ? p.practice.charAt(0).toUpperCase() + p.practice.slice(1)
              : p.practice;
            return (
              <li
                key={p.practice}
                className="flex items-center justify-between gap-1 text-xs"
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