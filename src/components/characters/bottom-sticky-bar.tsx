"use client";

/**
 * Phase 8 UI revamp (Mashu 2026-07-27): BottomStickyBar
 *
 * Mobile-only sticky bar at the bottom of the character sheet.
 * Collapsed default: a single thin row with vitality (HP),
 * attributes, and PB.
 *
 * Tapping the row (or the chevron) opens an expanded drawer with:
 *   - Vitality management: damage / heal / short rest / long rest
 *   - Practices flat list grouped by attribute
 *
 * Why mobile-only:
 *   Mashu 2026-07-27: 'all the design I am telling you about
 *   that was in the PDF is for mobile only! For desktop UI we'll
 *   discuss later. On desktop it's ok in general.'
 *
 * The component returns null on >= md screens (768px+). The
 * existing in-page layout handles desktop.
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

  // Don't render anything on desktop. We use a CSS media query
  // trick: render the element with `md:hidden` so Tailwind's
  // `display: none` on md+ removes it from the layout entirely.
  // This means SSR includes the markup (harmless, just hidden),
  // and hydration picks it up. Cheaper than a JS-based check.
  if (!hydrated) return null;

  const physicalMod = Math.floor((physical - 10) / 2);
  const mentalMod = Math.floor((mental - 10) / 2);
  const magicalMod = Math.floor((magical - 10) / 2);

  const phys = physicalMod >= 0 ? `+${physicalMod}` : `${physicalMod}`;
  const ment = mentalMod >= 0 ? `+${mentalMod}` : `${mentalMod}`;
  const magi = magicalMod >= 0 ? `+${magicalMod}` : `${magicalMod}`;
  const pbDisplay = pb >= 0 ? `+${pb}` : `${pb}`;

  return (
    <div
      className="fixed bottom-12 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      data-testid="bottom-sticky-bar"
      data-expanded={expanded}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-secondary/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse quick dock" : "Expand quick dock"}
      >
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-mono font-semibold text-foreground">
            <Heart className="size-3.5 text-rose-500" />
            {currentVitality ?? maxVitality}/{maxVitality}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">
            P{phys} M{ment} M{magi}
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
        <div className="border-t border-border bg-background/95 px-3 pb-3 pt-2 max-h-[60dvh] overflow-y-auto">
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

          {/* Practices flat list */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Quick Practices
            </div>
            {(["PHYSICAL", "MENTAL", "MAGICAL"] as const).map((attr) => {
              const group = practices.filter((p) => p.attribute === attr);
              if (group.length === 0) return null;
              const groupLabel =
                attr === "PHYSICAL"
                  ? "Physical"
                  : attr === "MENTAL"
                    ? "Mental"
                    : "Magical";
              return (
                <div key={attr} className="mb-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {groupLabel}
                    {proficientAttribute === attr ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                        Proficient (+{pb} PB)
                      </span>
                    ) : null}
                  </div>
                  <ul className="space-y-0.5">
                    {group
                      .sort((a, b) => b.total - a.total)
                      .map((p) => {
                        const total =
                          p.total >= 0 ? `+${p.total}` : `${p.total}`;
                        return (
                          <li
                            key={p.practice}
                            className="flex items-center justify-between text-xs"
                          >
                            <span
                              className={cn(
                                "truncate",
                                proficientAttribute === attr
                                  ? "text-teal-600 dark:text-teal-400"
                                  : "text-foreground",
                              )}
                            >
                              {p.practice}
                            </span>
                            <span
                              className={cn(
                                "font-mono font-semibold",
                                proficientAttribute === attr
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
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}