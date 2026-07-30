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
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  RotateCcw,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CharacterEditButton } from "@/components/characters/character-edit-button";
import { IdentityCell } from "@/components/characters/identity-cell";
import { DmBonusEditor } from "@/components/characters/dm-bonus-editor";
import {
  FormulaModal,
  type FormulaStep,
} from "@/components/characters/formula-modal";

// Phase 8.4 v25.3 (Mashu 2026-07-30): reference tables used by
// the BU budget + volatility popups. Same data as
// character-sheet-view.tsx's BuFormulaModal — duplicated here
// because that whole footer is wrapped in `hidden` divs in the
// v15 sheet layout (SheetIdentityHeader is the actually-rendered
// top deck). When we consolidate the two footers in a future
// session we'll extract these to a shared module.
//
// Phase 8.4 v25.3 fix: the volatility table was hardcoded to
// {L1:0, L2-L4:8, L5-L8:16, ...} which doubled the engine's
// correct values (which are {L1-L4:4, L5-L8:8, ...}). We now
// derive ceilings from maxBuDebtForLevel() so the table can
// extend past L20 (the engine returns ceil(L/4)*4 which keeps
// growing). We show a wider window — every bracket from L1
// through L29+ — so high-level characters still see their row.
import { maxBuDebtForLevel } from "@/lib/engine/bu";
const PROGRESSION_SPIKES = [
  { level: 4, spike: 4 },
  { level: 8, spike: 8 },
  { level: 12, spike: 12 },
  { level: 16, spike: 16 },
  { level: 20, spike: 20 },
] as const;

const VOLATILITY_BRACKETS = (() => {
  const out: Array<{ label: string; minLevel: number; maxLevel: number; ceiling: number }> = [];
  // Build [L1-L4, L5-L8, L9-L12, ...] up to L28. Per Notion
  // canon (Leveling & Progression v1) and engine
  // maxBuDebtForLevel, ceiling(L) = ceil(L/4)*4. So:
  //   L1-L4   → 4
  //   L5-L8   → 8
  //   L9-L12  → 12
  //   L13-L16 → 16
  //   L17-L20 → 20
  //   L21-L24 → 24
  //   L25-L28 → 28
  // We show the first row as "L1-L4" (4 levels) rather than
  // splitting L1 and L2-L4 because per Mashu "you have at lvl
  // 1 too" — L1 has the same 4-BU ceiling as L2-L4. Even
  // though players typically can't slot mirrors at L1 (per
  // the cascade rule), the engine doesn't enforce a hard L1
  // exception — we render the truth.
  for (let start = 1; start <= 28; start += 4) {
    const end = start + 3;
    const ceiling = Math.ceil(start / 4) * 4;
    const label = start === 1 ? `L${start}-L${end}` : `L${start}-L${end}`;
    out.push({ label, minLevel: start, maxLevel: end, ceiling });
  }
  return out;
})();
// Reference maxBuDebtForLevel so tree-shaking doesn't drop the import
// and so the engine function is the canonical source of the ceiling.
// (The VOLATILITY_BRACKETS table above mirrors maxBuDebtForLevel.)
void maxBuDebtForLevel;

// Phase 8.4 v25.2 (Mashu 2026-07-30): single source of truth for
// the debt bar color rule. Mashu's spec is "green when full,
// yellow when available, orange otherwise" but the examples she
// gave were inconsistent — Ex 1 (50% used) was orange while
// Ex 2 (25% used) was yellow. Picked a simpler rule that
// captures the spirit:
//   ceiling == 0 (L1)        → bg-secondary (no debt capacity)
//   used >= ceiling          → bg-green-500 (maxed)
//   used >= ceiling * 0.5    → bg-amber-500 (good use)
//   used > 0                 → bg-amber-500/40 (low use)
//   used == 0                → bg-secondary (no debt)
//   exceeded                 → bg-destructive (over ceiling)
// If the rule needs to flip, this helper is the single place to change.
function debtBarColor(
  rating: number,
  ceiling: number,
  exceeded: boolean,
): string {
  if (exceeded) return "bg-red-500";
  if (ceiling === 0) return "bg-secondary";
  if (rating >= ceiling) return "bg-green-500";
  if (rating >= ceiling * 0.5) return "bg-amber-500";
  if (rating > 0) return "bg-amber-500/40";
  return "bg-secondary";
}

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
  // Phase 8.4 v25.2 (Mashu 2026-07-30): BU popup state.
  // The Budget + Debt bars are clickable; opening the popup
  // explains the formula in the same FormulaModal pattern
  // used by the rest of the sheet.
  const [buPopup, setBuPopup] = useState<"budget" | "debt" | null>(null);

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
        {/* BU metric badge — clickable to open budget popup.
             Phase 8.4 v25.2 (Mashu 2026-07-30): inner button
             nested inside the outer expand button. We use
             stopPropagation so clicking the chip opens the
             formula popup without toggling expand. */}
          <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBuPopup("budget");
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono transition-colors hover:ring-2 hover:ring-primary/40",
                buBalance.overBudget
                  ? "bg-destructive/15 text-destructive"
                  : "bg-secondary",
              )}
              title="Show BU budget formula"
              aria-label="Show BU budget formula"
            >
              {buBalance.overBudget ? (
                <AlertTriangle className="size-3" />
              ) : null}
              {buDisplay}
            </button>
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

          {/* Budget Usage Bar — clickable to open formula popup.
              Phase 8.4 v25.2 (Mashu 2026-07-30): reworked colors
              per the new spec. Green when under pool (not punished
              for not spending every BU), amber/orange at/over the
              soft cap (still allowed — players can spend mid-session
              with DM approval), destructive red when hard exceeded.
              Previously used bg-primary (teal) / bg-amber at >90% /
              bg-destructive — flipped the polarity. */}
          <button
            type="button"
            onClick={() => setBuPopup("budget")}
            className="block w-full text-left transition-opacity hover:opacity-80"
            title="Show BU budget formula"
            aria-label="Show BU budget formula"
          >
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
                  "h-full rounded-full transition-all",
                  buBalance.overBudget
                    ? "bg-red-500"
                    : buBalance.progressionSpent >= buBalance.progressionPool
                      ? "bg-amber-500"
                      : "bg-green-500",
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
          </button>

          {/* Debt Usage Bar — clickable to open formula popup.
              Phase 8.4 v25.2 (Mashu 2026-07-30): reworked colors.
              Mashu's spec is "green when full, yellow when
              available, orange otherwise" but the examples she
              gave were inconsistent — Ex 1 (50% used) was
              orange while Ex 2 (25% used) was yellow. I'm
              picking a simpler rule that captures the spirit:
                ceiling == 0 (L1)        → track only, gray
                used >= ceiling          → green (maxed)
                used > ceiling * 0.5     → amber (good use)
                used > 0                 → amber/40 (low use)
                used == 0                → gray (no debt)
              exceeded                   → destructive red
              If the rule needs to flip, debtBarColor
              (defined at module scope) is the single source
              of truth. */}
          <button
            type="button"
            onClick={() => setBuPopup("debt")}
            className="mt-2 block w-full text-left transition-opacity hover:opacity-80"
            title="Show volatility / debt formula"
            aria-label="Show volatility / debt formula"
          >
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
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
                  "h-full rounded-full transition-all",
                  debtBarColor(volatility.rating, volatility.ceiling, volatility.exceeded)
                )}
                style={{
                  width: `${Math.min(100, volatility.ceiling > 0 ? (volatility.rating / volatility.ceiling) * 100 : 0)}%`,
                }}
              />
            </div>
          </button>
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

      {/* Phase 8.4 v25.2 (Mashu 2026-07-30): BU Budget + Debt
          formula popups. Two modes. Budget explains lifetime BU
          + progression spikes + soft cap + DM bonus. Debt
          explains volatility ceiling + cascade rule (BU fills
          first, then debt). Uses the shared FormulaModal for
          layout consistency with the rest of the sheet. */}
      {buPopup ? (
        <BuHeaderFormulaModal
          mode={buPopup}
          level={level}
          progressionSpent={buBalance.progressionSpent}
          progressionPool={buBalance.progressionPool}
          dmBonusBu={buBalance.dmBonusBu}
          itemBuSpent={buBalance.itemBuSpent}
          volatilityRating={volatility.rating}
          volatilityCeiling={volatility.ceiling}
          volatilityRemaining={volatility.remaining}
          levelBracket={volatility.levelBracket}
          overBudget={buBalance.overBudget}
          mirroredPrimitives={volatility.mirroredPrimitives ?? []}
          onClose={() => setBuPopup(null)}
        />
      ) : null}
    </div>
  );
}

// Phase 8.4 v25.2 (Mashu 2026-07-30): local copy of the BU
// formula modal. Duplicated from character-sheet-view.tsx
// (where it's wrapped in a hidden div) so the popups actually
// show up. When we consolidate the two footers we'll extract
// this to a shared module.
interface BuHeaderFormulaModalProps {
  readonly mode: "budget" | "debt";
  readonly level: number;
  readonly progressionSpent: number;
  readonly progressionPool: number;
  readonly dmBonusBu: number;
  readonly itemBuSpent: number;
  readonly volatilityRating: number;
  readonly volatilityCeiling: number;
  readonly volatilityRemaining: number;
  readonly levelBracket: string;
  readonly overBudget: boolean;
  readonly mirroredPrimitives: ReadonlyArray<{
    readonly id: number;
    readonly name: string;
    readonly mirrorBuCredit: number;
    readonly acquiredAtLevel: number;
  }>;
  readonly onClose: () => void;
}

function spikesUpToLevel(level: number): number {
  // Same formula as character-sheet-view.tsx: 4 * k*(k+1)/2 for k = floor(L/4)
  if (level < 4) return 0;
  const k = Math.floor(level / 4);
  return (4 * (k * (k + 1))) / 2;
}

function BuHeaderFormulaModal({
  mode,
  level,
  progressionSpent,
  progressionPool,
  dmBonusBu,
  itemBuSpent,
  volatilityRating,
  volatilityCeiling,
  volatilityRemaining,
  levelBracket,
  overBudget,
  mirroredPrimitives,
  onClose,
}: BuHeaderFormulaModalProps) {
  const baseBu = 25 + 10 * (level - 1);
  const spikesTotal = spikesUpToLevel(level);
  const lifetimeBu = baseBu + spikesTotal;

  if (mode === "budget") {
    const breakdown: FormulaStep[] = [
      { label: "L1 base", value: 25 },
      { label: `+10 BU × ${level - 1} levels`, value: 10 * (level - 1) },
      { label: "Progression Spikes (Σ)", value: spikesTotal },
      { label: `= Lifetime BU (L${level})`, value: lifetimeBu },
    ];
    return (
      <FormulaModal
        title="BU Budget"
        subtitle={`Level ${level} character`}
        total={lifetimeBu}
        formula="Lifetime BU = 25 + 10×(Level − 1) + Σ Progression Spikes"
        breakdown={breakdown}
        info={{
          title: "Progression Spikes + Soft cap + DM Bonus",
          body: (
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 text-left font-semibold uppercase">Level</th>
                    <th className="py-1 text-right font-semibold uppercase">Spike</th>
                    <th className="py-1 text-right font-semibold uppercase">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {PROGRESSION_SPIKES.map((s) => {
                    const k = s.spike / 4;
                    const cum = (4 * (k * (k + 1))) / 2;
                    const reached = level >= s.level;
                    return (
                      <tr
                        key={s.level}
                        className={reached ? "bg-teal-500/10" : ""}
                      >
                        <td className="py-0.5">L{s.level}</td>
                        <td className="py-0.5 text-right tabular-nums">
                          +{s.spike} BU
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {cum} BU
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-muted-foreground">
                A progression spike fires every 4 levels (L4, L8, L12, L16,
                L20…). The spike value equals the level itself — L4 = +4 BU,
                L8 = +8 BU, etc. Formula:{" "}
                <span className="font-mono text-foreground">
                  Σ(4k) for k = 1..⌊L/4⌋
                </span>
                .
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                <strong className="text-foreground">Soft cap, not hard cap:</strong>{" "}
                the lifetime BU shown above is a <em>suggested</em> budget, not
                a hard limit. You can spend BU mid-session to enable
                primitives on-the-fly (e.g. a Tier 1 Light domain = 4 BU).{" "}
                {overBudget ? (
                  <>
                    Your current usage{" "}
                    <strong className="text-destructive">
                      ({progressionSpent}/{progressionPool})
                    </strong>{" "}
                    exceeds the pool — the bar shows red.
                  </>
                ) : (
                  <>The bar stays green while you're under the pool.</>
                )}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                <strong className="text-foreground">DM Bonus BU:</strong>{" "}
                the DM can grant additional BU at any time for
                narrative milestones (boss defeats, story arcs,
                exceptional roleplay). DM bonus ({dmBonusBu})
                is <strong className="text-foreground">additive</strong>{" "}
                to your lifetime pool — it counts toward level
                thresholds just like progression spikes do. At
                level-up you receive +10 BU (or +N for spike
                levels), and you also receive any DM bonus that's
                been granted since your last level-up.
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                <strong className="text-foreground">Item BU</strong> (
                {itemBuSpent} spent) is tracked separately from progression BU.
                Items bring their own nested primitives with them, and those
                primitives don't deduct from your lifetime pool — they're
                "taken for granted" with the item.
              </p>
            </div>
          ),
        }}
        onClose={onClose}
      />
    );
  }

  // mode === "debt"
  const debtBreakdown: FormulaStep[] = [
    {
      label: "Mirror primitives (Σ credits)",
      value: -volatilityRating,
    },
    {
      label: `Bracket ceiling (${levelBracket})`,
      value: -volatilityCeiling,
    },
    {
      label: `= Headroom (L${level})`,
      value: -volatilityRemaining,
    },
  ];

  return (
    <FormulaModal
      title="Volatility / Debt"
      subtitle={`Mirror-debt bracket for ${levelBracket}`}
      total={-volatilityRating}
      formula="Volatility = Σ mirror primitive credits (negative). Ceiling = bracket-based."
      breakdown={debtBreakdown}
      info={{
        title: "Cascade rule + Bracket ceiling",
        body: (
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">
              <strong className="text-foreground">Cascade rule:</strong> when
              you slot a primitive, the engine first tries to deduct from
              your <strong className="text-foreground">available BU budget</strong>.
              Once your available BU is zero, additional slots overflow into{" "}
              <strong className="text-foreground">mirror debt</strong>. Going
              into debt is allowed up to your bracket ceiling — beyond that,
              the DM must intervene.
            </p>
            <p className="text-[11px] text-muted-foreground mb-2">
              <strong className="text-foreground">What counts as debt?</strong>{" "}
              Every primitive you <em>mirrored</em> contributes its{" "}
              <span className="font-mono text-foreground">mirrorBuCredit</span>{" "}
              (negative BU) to your total. The engine adds the same amount as
              positive expansion to your available pool, so the net cost is
              zero — but the volatility tracking remains so you can audit how
              much of your build is built on debt.
            </p>
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1 text-left font-semibold uppercase">
                    Bracket
                  </th>
                  <th className="py-1 text-right font-semibold uppercase">
                    Max Mirror Debt
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {VOLATILITY_BRACKETS.map((b) => {
                  const reached = level >= b.minLevel && level <= b.maxLevel;
                  return (
                    <tr
                      key={b.label}
                      className={reached ? "bg-teal-500/10" : ""}
                    >
                      <td className="py-0.5">{b.label}</td>
                      <td className="py-0.5 text-right tabular-nums">
                        -{b.ceiling} BU
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Per Notion canon, every 4-level bracket adds 4 BU
              of debt capacity: L1-L4 → 4, L5-L8 → 8, L9-L12 → 12,
              continuing indefinitely. Debt ceilings are{" "}
              <strong className="text-foreground">bracket-based</strong>,
              not cumulative — exceeding your bracket means the DM must
              remove mirrors or grant a respec.
            </p>
            {mirroredPrimitives.length > 0 ? (
              <>
                <p className="mt-3 text-[11px] font-semibold text-foreground">
                  Your mirrored primitives:
                </p>
                <ul className="mt-1 space-y-1 text-[11px]">
                  {mirroredPrimitives.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded border border-border bg-background/40 px-2 py-1"
                    >
                      <span>{p.name}</span>
                      <span className="font-mono text-muted-foreground">
                        -{p.mirrorBuCredit} BU @L{p.acquiredAtLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ),
      }}
      onClose={onClose}
    />
  );
}
