"use client";

/**
 * Phase 8.4 (Mashu 2026-07-28): SheetIdentityHeader rewrite.
 *
 * Mobile-only compact identity header for the character sheet.
 *
 * Collapsed (default): a single block at the top of the viewport
 * with the portrait, name, level, size, lineage/manifest, BU
 * metric, and expand chevron. ~60px tall.
 *
 * Expanded: tap the bar to reveal
 *   - DM Bonus chip (with DmBonusEditor inline)
 *   - Item BU chip
 *   - Remaining chip
 *   - Budget Usage bar
 *   - Debt Usage bar (with bracket: used / available / max)
 *   - Mirrored primitives accordion (NEW v3)
 *   - Edit / Clone / Level Up button row (NEW v3)
 *
 * Mashu 2026-07-28 feedback (v3):
 *   - "the image is not rendered in collapsed view on top" — the
 *     previous version had `portraitUrl={null}` hard-coded at the
 *     call site. Fixed at the call site (portraitUrl is now
 *     forwarded from props); the chip-side rendering was already
 *     correct.
 *   - "we need the clone and level up buttons too there" — added
 *     Level Up + Clone buttons in the expanded action row.
 *   - "In the expanded we need to modify the DM bonus too" —
 *     wired DmBonusEditor inline so the DM bonus chip is editable.
 *   - "We don't have the BU debt like it should: used/available/max
 *     for bracket" — re-rendered the debt chip as
 *     `8 / 8 (L5-L8)` so the user sees the bracket ceiling.
 *   - "We don't have the expanded mirror Primitives in the upper
 *     part collapsible" — added a Mirrored primitives accordion
 *     in the expanded panel.
 *
 * Hide on >= md screens via Tailwind's md:hidden.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ArrowUp, RotateCcw, Pencil } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CharacterEditButton } from "@/components/characters/character-edit-button";
import { IdentityCell } from "@/components/characters/identity-cell";
import { DmBonusEditor } from "@/components/characters/dm-bonus-editor";

export interface SheetIdentityHeaderProps {
  readonly characterId: string;
  readonly name: string;
  readonly level: number;
  readonly size: string;
  readonly lineageName: string | null;
  readonly lineageDescription: string | null;
  readonly upbringingName: string | null;
  readonly upbringingDescription: string | null;
  readonly manifestName: string | null;
  /**
   * Phase 8.4 v11 (Mashu 2026-07-28): attribute values
   * for the identity card's "Attributes" cell (sum +
   * validity check).
   */
  readonly attrSum: number;
  readonly portraitUrl: string | null;
  readonly canLevelUp: boolean;
  /**
   * Phase 8.4: when the user taps the Level Up button in the
   * expanded panel, the parent shows the level-up confirmation
   * modal. (We delegate the modal so the parent can reuse the
   * same wiring as the in-page Level Up button.)
   */
  readonly onLevelUp?: () => void;
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
    /**
     * Phase 8.4: mirror primitives surfaced so the expanded
     * panel can render an accordion with click-to-expand rows.
     */
    readonly mirroredPrimitives?: ReadonlyArray<{
      readonly id: number;
      readonly name: string;
      readonly mirrorBuCredit: number;
      readonly acquiredAtLevel: number;
    }>;
  };
}

export function SheetIdentityHeader({
  characterId,
  name,
  level,
  size,
  lineageName,
  lineageDescription,
  upbringingName,
  upbringingDescription,
  manifestName,
  attrSum,
  portraitUrl,
  canLevelUp,
  onLevelUp,
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
  // Phase 8.4: the debt display shows used / available / max with
  // the bracket ceiling, e.g. `8 / 8 (L5-L8)`. The `available`
  // piece is `ceiling - rating` (clamped to 0).
  const debtUsed = volatility.rating;
  const debtAvailable = Math.max(0, volatility.ceiling - volatility.rating);
  const debtMax = volatility.ceiling;
  const debtDisplay = `${debtUsed} / ${debtMax} (${volatility.levelBracket})`;

  return (
    <div
      // Phase 8.4 v15 (Mashu 2026-07-28): the bar is shown on
      // ALL screen sizes. Previously mobile-only (`md:hidden`).
      // On desktop it replaces the static in-page header.
      // The content gets a top spacer to clear it (see
      // character-sheet-view.tsx).
      className="fixed left-0 right-0 top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md"
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
        {/* Portrait — never empty. Falls back to the first letter
            of the name when no portraitUrl is set. */}
        <div className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portraitUrl}
              alt={`${name}'s portrait`}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm font-bold text-muted-foreground">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
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
        {/* BU metric badge */}
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
          {/* DM Bonus / Item BU / Remaining. The DM Bonus chip is
              editable in place via DmBonusEditor. Mashu 2026-07-28:
              "In the expanded we need to modify the DM bonus too." */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold uppercase text-muted-foreground">
                DM Bonus
              </span>
              <DmBonusEditor
                characterId={characterId}
                initialValue={buBalance.dmBonusBu}
              />
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

          {/* Debt Usage Bar — shows used / available / max with bracket. */}
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
          {/* Phase 8.4 v2 (Mashu 2026-07-28): reformat the debt
              line as "Debt 8 used | 0 available | 8 max allowed".
              The previous "8 / 0 avail / 8 max" was ambiguous —
              the user wanted used / available / max explicitly. */}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono">
              {volatility.levelBracket}
            </span>
            <span title="Used / Available / Max allowed for bracket">
              Debt <span className="font-mono">{debtUsed}</span> used |{" "}
              <span className="font-mono">{debtAvailable}</span> available |{" "}
              <span className="font-mono">{debtMax}</span> max allowed
            </span>
          </div>

          {/* Mirrored primitives accordion (NEW v3) */}
          {volatility.mirroredPrimitives && volatility.mirroredPrimitives.length > 0 ? (
            <details className="mt-3 rounded-md border border-border bg-background/50">
              <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <RotateCcw className="size-3" />
                  {volatility.mirroredPrimitives.length} mirrored primitive
                  {volatility.mirroredPrimitives.length === 1 ? "" : "s"} (click to expand)
                </span>
              </summary>
              <ul className="border-t border-border px-3 py-2 text-xs">
                {volatility.mirroredPrimitives.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 font-mono text-muted-foreground">
                      −{p.mirrorBuCredit} BU
                      <span className="ml-2 text-[10px]">L{p.acquiredAtLevel}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {/* Phase 8.4 v11 (Mashu 2026-07-28): identity
              card INSIDE the expanded top deck. Shows
              Lineage / Upbringing / Manifest / Attributes
              in a 2-column grid just above the action
              buttons. Per the user's annotated screenshot:
              "INSIDE THAT GOD DAMN expanded top deck I
              want to put the identity card. Just above
              the existing buttons for lvl up edit clone." */}
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-card">
            <div className="grid grid-cols-2 gap-px bg-border">
              <IdentityCell
                label="Lineage"
                value={lineageName ?? "—"}
                note={lineageDescription}
              />
              <IdentityCell
                label="Upbringing"
                value={upbringingName ?? "—"}
                note={upbringingDescription}
              />
              <IdentityCell label="Manifest" value={manifestName ?? "—"} />
              <IdentityCell
                label="Attributes"
                value={`${attrSum} / 10`}
                tone={attrSum === 10 ? "ok" : "bad"}
                note={attrSum === 10 ? "✓ valid" : `✗ off by ${attrSum - 10}`}
              />
            </div>
          </div>

          {/* Edit / Clone / Level Up — Mashu 2026-07-28:
              "we need the clone and level up buttons too there." */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CharacterEditButton
              characterId={characterId}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
            />
            <Link
              href={`/characters/${characterId}/clone`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
              title="Clone this character"
            >
              <Pencil className="size-3" />
              Clone
            </Link>
            {canLevelUp && onLevelUp ? (
              <button
                type="button"
                onClick={onLevelUp}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ArrowUp className="size-3" />
                Level Up
              </button>
            ) : null}
          </div>
          {!canLevelUp ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Max level reached.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
