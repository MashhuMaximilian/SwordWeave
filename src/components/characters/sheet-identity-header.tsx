"use client";

/**
 * Phase 8 UI revamp (Mashu 2026-07-27): SheetIdentityHeader
 *
 * Mobile-only compact identity header for the character sheet.
 *
 * Per the user's PDF (Section 1):
 *   - Locked at the very top as a single compact block
 *   - Collapsed: avatar + name + level + lineage + manifest
 *     + BU alert metrics + expand chevron, ~60px max
 *   - Expanded: same as collapsed + DM Bonus / Item BU / Remaining
 *     + Budget Usage Bar + Debt Usage Bar + Edit / Level Up / Clone
 *     button row
 *
 * Hide on >= md screens via Tailwind's md:hidden.
 *
 * Implementation choices:
 *   - The desktop sheet's existing in-page header (which
 *     always shows Edit/Level Up/Clone inline) is preserved
 *     on md+. We do NOT hide it on mobile because the user
 *     didn't explicitly ask for that — they just asked for the
 *     compact top header to exist. If they want it to fully
 *     replace the desktop layout on mobile, that's a follow-up.
 *   - The bar respects BottomStickyBar's stacking (z-30 vs
 *     z-40 for the bottom bar). The bottom bar overdraws the
 *     top one if they ever share a corner.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CharacterEditButton } from "@/components/characters/character-edit-button";

export interface SheetIdentityHeaderProps {
  readonly characterId: string;
  readonly name: string;
  readonly level: number;
  readonly size: string;
  readonly lineageName: string | null;
  readonly manifestName: string | null;
  readonly portraitUrl: string | null;
  readonly canLevelUp: boolean;
  readonly buBalance: {
    readonly progressionSpent: number;
    readonly progressionPool: number;
    readonly overBudget: boolean;
    readonly dmBonusBu: number;
    readonly itemBuSpent: number;
  };
  readonly volatility: {
    readonly rating: number;
    readonly ceiling: number;
    readonly levelBracket: string;
    readonly remaining: number;
    readonly exceeded: boolean;
  };
}

export function SheetIdentityHeader({
  characterId,
  name,
  level,
  size,
  lineageName,
  manifestName,
  portraitUrl,
  canLevelUp,
  buBalance,
  volatility,
}: SheetIdentityHeaderProps) {
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const overSpent = buBalance.progressionSpent - buBalance.progressionPool;
  const buDisplay = `${buBalance.progressionSpent}/${buBalance.progressionPool}`;
  const debtDisplay = `${volatility.rating}/${volatility.ceiling}`;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md md:hidden",
      )}
      data-testid="sheet-identity-header"
      data-expanded={expanded}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse identity" : "Expand identity"}
      >
        <div className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portraitUrl}
              alt={`${name}'s portrait`}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate font-semibold">{name}</span>
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold text-secondary-foreground">
              L{level}
            </span>
            <span className="text-[10px] text-muted-foreground">{size}</span>
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {lineageName ?? ""}
            {lineageName && manifestName ? " · " : ""}
            {manifestName ?? ""}
          </div>
        </div>
        {/* BU metric badge — the PDF's "BU: 74/69 (+5)" pill */}
        <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
          {buBalance.overBudget ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-mono text-destructive">
              <AlertTriangle className="size-3" />
              {buDisplay}
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono">
              {buDisplay}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-border bg-background/95 px-3 py-2 text-xs">
          {/* DM Bonus / Item BU / Remaining — PDF line 1 */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-muted-foreground">
                DM Bonus
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono">
                {buBalance.dmBonusBu} BU
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-muted-foreground">
                Item BU
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono">
                {buBalance.itemBuSpent} (separate)
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-muted-foreground">
                Remaining
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono">
                {volatility.remaining} BU
              </span>
            </span>
          </div>

          {/* Budget Usage Bar */}
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Budget usage</span>
            <span>
              {buBalance.progressionPool > 0
                ? Math.round(
                    (buBalance.progressionSpent / buBalance.progressionPool) *
                      100,
                  )
                : 0}
              %
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full",
                buBalance.overBudget
                  ? "bg-destructive"
                  : buBalance.progressionSpent / buBalance.progressionPool > 0.9
                    ? "bg-amber-500"
                    : "bg-primary",
              )}
              style={{
                width: `${Math.min(100, buBalance.progressionPool > 0 ? (buBalance.progressionSpent / buBalance.progressionPool) * 100 : 0)}%`,
              }}
            />
          </div>
          {buBalance.overBudget ? (
            <p className="mt-1 text-[10px] text-destructive">
              BU spent exceeds progression cap by {overSpent}
            </p>
          ) : null}

          {/* Debt Usage Bar */}
          <div className="mt-2 mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Debt usage</span>
            <span>
              {volatility.ceiling > 0
                ? Math.round((volatility.rating / volatility.ceiling) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full",
                volatility.exceeded
                  ? "bg-destructive"
                  : volatility.rating / volatility.ceiling > 0.8
                    ? "bg-amber-500"
                    : "bg-primary",
              )}
              style={{
                width: `${Math.min(100, volatility.ceiling > 0 ? (volatility.rating / volatility.ceiling) * 100 : 0)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono">
              {volatility.levelBracket}
            </span>
            <span>Debt: {debtDisplay}</span>
          </div>

          {/* Edit / Level Up / Clone — PDF line 2 */}
          <div className="mt-3 flex flex-wrap gap-2">
            <CharacterEditButton
              characterId={characterId}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
              title="Open in the atelier for editing"
            />
            {canLevelUp ? (
              <span className="self-center text-[10px] text-muted-foreground">
                Level Up via the in-page Level Up button below.
              </span>
            ) : (
              <span className="self-center text-[10px] text-muted-foreground">
                Max level reached.
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
