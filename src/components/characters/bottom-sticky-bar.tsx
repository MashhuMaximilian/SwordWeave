"use client";

/**
 * bottom-sticky-bar.tsx — Phase 8.3g v2 (Mashu 2026-07-28)
 *
 * Mobile-only bottom dock. ONE docked card at the bottom of
 * the screen. The card has:
 *
 *   - A small "header" bar at the TOP of the card showing
 *     collapsed info: ♥ 288/268 · DC 16 · P+0 Me+0 Ma+0 · PB +6.
 *     Tap to expand. Tap again to collapse.
 *   - When expanded: the bar is the toggle, the card content
 *     below shows full info (vitality + actions, save chips,
 *     practices).
 *
 * Per Mashu 2026-07-28: "Why isn't the small quick bar on top
 * of the expanded one?" The bar IS on top — it's the header of
 * the docked card. The "expanded" content sits BELOW the bar.
 *
 * Save chips: 2 rows each (mod on top, save value below) in
 * ONE chip. NO separate SV chips. Proficient attribute is
 * teal. Per Mashu: "I said chips like it was before, but not
 * 2 separate chips for modifier and save but same chip for
 * attribute and save in 2 rows."
 *
 * Practices list: RESTORED. Per Mashu: "Where are practices?
 * Did I say anything about removing the practices?" — I
 * removed them by mistake.
 *
 * Practices drop-down is REPLACED with a click-through modal
 * (per the same modal-everywhere rule as the rest of the
 * sheet). Practice value = attribute + PB (if proficient) +
 * primitive contributions.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart } from "lucide-react";
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
   * Phase 8.3g v2: practice value = attribute modifier + PB
   * (if proficient) + primitive contributions. Computed by
   * the page-level resolver and passed in here.
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
  const phys = physMod >= 0 ? `+${physMod}` : `${physMod}`;
  const ment = mentMod >= 0 ? `+${mentMod}` : `${mentMod}`;
  const magi = magiMod >= 0 ? `+${magiMod}` : `${magiMod}`;
  const pbDisplay = pb >= 0 ? `+${pb}` : `${pb}`;

  // Phase 8.3g v2: the save VALUE is the d20 modifier
  // the character adds when making a save — just
  // mod + PB (if proficient). NO save-target primitives
  // (those bump the DC, not the save).
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
  const primaryMod =
    primaryAttr === "physical" ? physMod : primaryAttr === "mental" ? mentMod : magiMod;
  const primarySaveDelta = resolver?.totals[`defense_dc.${primaryAttr}`] ?? 0;
  const primaryDc = 5 + pb + primaryMod + primarySaveDelta;
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <div
      // ONE docked card. Always at bottom-12 (above the tabs).
      // The card has a header bar (always visible) and an
      // expanded content area (visible when expanded). Per
      // Mashu: "the small quick bar on top of the expanded
      // one" = the header is always on top of the content.
      className="fixed bottom-12 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      data-testid="bottom-sticky-bar"
      data-expanded={expanded}
    >
      {/* Header bar — always visible. The TOGGLE.
          Phase 8.3g v2: when expanded, this bar is at the
          TOP of the docked card. The drawer content sits
          BELOW it. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 border-b border-border pr-16 pl-3 py-1.5 text-sm hover:bg-secondary/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse quick dock" : "Expand quick dock"}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-mono font-semibold text-foreground">
            <Heart className="size-3.5 text-rose-500" />
            {currentVitality ?? maxVitality}/{maxVitality}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">DC {primaryDc}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">P{phys} Me{ment} Ma{magi}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">PB {pbDisplay}</span>
        </div>
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" />
        )}
      </button>

      {/* Drawer content — only when expanded. Below the
          header. Per Mashu 2026-07-28: "I need it to be
          compact. In it I don't need to click on them and
          see info, only in the card in overview tab. In
          drawer we need to have the modifiers and saves
          more compact. We need to show save DC too. And
          the practices are on 3 columns each for mental,
          physical, magical."
          - NO clickable provenance in the drawer (it's a
            glance-only view; the in-page card handles
            provenance).
          - Save DC visible at top.
          - Save chips compact: 1 row, mod + save in same
            chip, smaller font.
          - Practices in 3 columns (PHYSICAL | MENTAL |
            MAGICAL) — same layout as the in-page
            PracticesPanel but tighter. */}
      {expanded && (
        <div
          // Phase 8.3g v3 (Mashu 2026-07-28): tighter
          // padding, smaller text. Bottom padding so the
          // last row isn't covered by the tab bar.
          className="px-2 pb-24 pt-1.5 max-h-[65dvh] overflow-y-auto"
          data-testid="bottom-sticky-bar-drawer"
        >
          {/* Save DC (prominent at the top of the
              drawer). No click handler — glance only. */}
          <div className="mb-2 flex items-center justify-between rounded-md border-2 border-teal-500 bg-teal-500/15 px-2.5 py-1.5">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                Save DC
              </p>
              <p className="text-[9px] text-teal-700/80 dark:text-teal-300/80">
                from {primaryAttr} (proficient)
              </p>
            </div>
            <span className="font-mono text-xl font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
              {primaryDc}
            </span>
          </div>

          {/* Vitality actions (compact = buttons only). */}
          <div className="mb-2">
            <VitalityTracker
              characterId={characterId}
              max={maxVitality}
              current={currentVitality ?? maxVitality}
              compact
            />
          </div>

          {/* Save chips — compact, 1 row, mod + save in
              the same chip. NOT clickable (per Mashu:
              "I don't need to click on them and see info"). */}
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
                    className={`flex flex-col items-center justify-center rounded border-2 px-1 py-1 text-center ${
                      isProf
                        ? "border-teal-500 bg-teal-500/15"
                        : "border-border bg-card"
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
                    <span
                      className={`font-mono text-sm font-bold tabular-nums leading-none ${
                        isProf
                          ? "text-teal-700 dark:text-teal-200"
                          : "text-foreground"
                      }`}
                    >
                      {fmt(m)}
                    </span>
                    <span
                      className={`font-mono text-[10px] tabular-nums leading-none ${
                        isProf
                          ? "text-teal-700/80 dark:text-teal-300/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {fmt(s)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Practices — 3 columns: PHYSICAL | MENTAL |
              MAGICAL. Per Mashu: "the practices are on 3
              columns each for mental, physical, magical".
              Compact rows. Each practice is just a label
              + value, NOT clickable for breakdown (use
              the in-page card for that). */}
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
                      className={`rounded border-2 px-1.5 py-1 ${
                        isProf
                          ? "border-teal-500 bg-teal-500/10"
                          : "border-border bg-card/40"
                      }`}
                    >
                      <p
                        className={`mb-1 text-[8px] font-semibold uppercase tracking-wide ${
                          isProf
                            ? "text-teal-700 dark:text-teal-300"
                            : "text-muted-foreground"
                        }`}
                      >
                        {attr}
                      </p>
                      {rows.length === 0 ? (
                        <p className="text-[9px] text-muted-foreground italic">
                          —
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {rows.map((p) => (
                            <li
                              key={p.id ?? p.name}
                              className="flex items-center justify-between gap-1"
                            >
                              <span
                                className={`truncate text-[10px] ${
                                  isProf
                                    ? "text-teal-700 dark:text-teal-200"
                                    : "text-foreground"
                                }`}
                              >
                                {p.name}
                              </span>
                              <span
                                className={`shrink-0 font-mono text-[10px] font-semibold tabular-nums ${
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

      {/* Provenance modal — REMOVED in Phase 8.3g v3.
          The drawer is glance-only (per Mashu 2026-07-28:
          "In it I don't need to click on them and see
          info, only in the card in overview tab").
          Provenance happens in the in-page VitalityDisplayCard
          + PracticesPanel. The bar/drawer is for at-a-glance
          values during play. */}
    </div>
  );
}