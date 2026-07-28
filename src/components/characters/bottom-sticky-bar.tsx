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
import { ProvenanceModal } from "./provenance-modal";

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
  const [provenanceTarget, setProvenanceTarget] = useState<string | null>(null);

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

  function saveFor(attr: "physical" | "mental" | "magical", mod: number): number {
    const isProf = proficientAttribute?.toLowerCase() === attr;
    const base = mod + (isProf ? pb : 0);
    const prim = resolver?.totals[`defense_dc.${attr}`] ?? 0;
    return base + prim;
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

  const closeProvenance = () => setProvenanceTarget(null);

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
          header. Contains: vitality + actions, save chips,
          practices. */}
      {expanded && (
        <div
          className="px-3 pb-20 pt-2 max-h-[60dvh] overflow-y-auto"
          data-testid="bottom-sticky-bar-drawer"
        >
          {/* Vitality + actions (compact) */}
          <div className="mb-3">
            <VitalityTracker
              characterId={characterId}
              max={maxVitality}
              current={currentVitality ?? maxVitality}
              compact
            />
          </div>

          {/* Save chips: 2 rows each (mod + save in one chip) */}
          <div className="mb-3">
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
                  <button
                    type="button"
                    key={attr}
                    onClick={() =>
                      setProvenanceTarget(
                        attr === primaryAttr
                          ? `defense_dc.${attr}`
                          : `attribute.${attr}`,
                      )
                    }
                    className={`flex flex-col items-center justify-center rounded-md border-2 px-2 py-1.5 text-center transition-colors ${
                      isProf
                        ? "border-teal-500 bg-teal-500/15"
                        : "border-border bg-card hover:bg-secondary/40"
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* Practices — RESTORED. Per Mashu: "Where are
              practices? Did I say anything about removing
              the practices?" Each practice is a row with
              name + value. NO drop-down — clicking opens a
              modal (same modal pattern as everywhere
              else). */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Practices
            </p>
            {practices.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No practices slotted.
              </p>
            ) : (
              <div className="space-y-0.5">
                {practices.map((p) => {
                  const isProf = proficientAttribute === p.attribute;
                  return (
                    <button
                      type="button"
                      key={p.id ?? p.name}
                      onClick={() => setProvenanceTarget(`attribute.${p.attribute.toLowerCase()}`)}
                      className="flex w-full items-center justify-between gap-2 rounded border border-border bg-card/40 px-3 py-1.5 text-left transition-colors hover:bg-secondary/40"
                    >
                      <span
                        className={`truncate text-xs ${
                          isProf
                            ? "font-semibold text-teal-600 dark:text-teal-400"
                            : "text-foreground"
                        }`}
                      >
                        {p.name}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-xs font-semibold ${
                          isProf
                            ? "text-teal-600 dark:text-teal-400"
                            : "text-foreground"
                        }`}
                      >
                        {fmt(p.total)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {provenanceTarget && resolver && (
        <ProvenanceModal
          target={provenanceTarget}
          targetLabel={
            provenanceTarget.startsWith("attribute.")
              ? `${
                  provenanceTarget.split(".").pop() === "physical"
                    ? "Physical"
                    : provenanceTarget.split(".").pop() === "mental"
                      ? "Mental"
                      : "Magical"
                } attribute`
              : provenanceTarget.startsWith("defense_dc.")
                ? `${
                    provenanceTarget.split(".").pop() === "physical"
                      ? "Physical"
                      : provenanceTarget.split(".").pop() === "mental"
                        ? "Mental"
                        : "Magical"
                  } save`
                : provenanceTarget
          }
          totals={resolver.totals}
          byTarget={resolver.byTarget}
          onClose={closeProvenance}
        />
      )}
    </div>
  );
}