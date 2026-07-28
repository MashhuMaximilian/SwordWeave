/**
 * vitality-display-card.tsx — Phase 8.3g (Mashu 2026-07-28)
 *
 * Pure-display vitality card for the top of the in-page sheet.
 * Per Mashu 2026-07-28:
 *
 *   "VITALITY 288/268, [bar 100%], then below it 4 cells:
 *    PHYS +2 / MENT +8 (proficient, teal) / MAGI +0 / PROF +6
 *    each cell is clickable and shows provenance.
 *    The DC (one number, from the proficient attribute) is
 *    inline with the vitality number. Save value is small,
 *    under each attribute cell."
 *
 * Layout:
 *
 *   VITALITY                              DC 16
 *   288 / 268
 *   [================= 100%]
 *   ┌─────────┬─────────┬─────────┬─────────┐
 *   │  PHYS   │  MENT   │  MAGI   │  PROF   │
 *   │   +2    │   +8    │   +0    │   +6    │  ← mod (clickable)
 *   │ save +2 │ save +8 │ save +0 │  PB +6  │  ← small save / PB
 *   └─────────┴─────────┴─────────┴─────────┘
 *
 * The 4 action buttons (Damage / Heal / Long rest / Short rest)
 * live in a separate VitalityTracker below this card.
 */

import { useState } from "react";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";
import {
  resolveAttributeModifier,
  resolveSaveValue,
  resolvePrimarySaveDc,
  type Attribute,
} from "@/lib/engine/target-registry";
import { ProvenanceModal } from "./provenance-modal";

const ATTR_LABEL: Record<Attribute, string> = {
  physical: "PHYS",
  mental: "MENT",
  magical: "MAGI",
};

const ATTR_FULL: Record<Attribute, string> = {
  physical: "Physical",
  mental: "Mental",
  magical: "Magical",
};

const ATTR_TARGET: Record<Attribute, string> = {
  physical: "attribute.physical",
  mental: "attribute.mental",
  magical: "attribute.magical",
};

// Phase 8.3g v2: the resolver stores per-attribute save
// contributions under the SCOPED key
// (`defense_dc.physical` etc.). The modal needs the
// scoped key to look up `byTarget[target]`.
const SAVE_TARGET: Record<Attribute, string> = {
  physical: "defense_dc.physical",
  mental: "defense_dc.mental",
  magical: "defense_dc.magical",
};

const MAX_VITALITY_TARGET = "max_vitality";

export interface VitalityDisplayCardProps {
  current: number;
  max: number;
  pb: number;
  proficientAttribute: Attribute | null;
  resolver: ResolvedModifiers;
  /** Direct resolver input. Used for the helper functions that
   * need slots + PB + proficient + attributes. */
  resolverInput: Parameters<typeof resolveAttributeModifier>[0];
}

export function VitalityDisplayCard({
  current,
  max,
  pb,
  proficientAttribute,
  resolver,
  resolverInput,
}: VitalityDisplayCardProps) {
  const [provenanceTarget, setProvenanceTarget] = useState<string | null>(null);

  const percent =
    max > 0
      ? Math.max(0, Math.min(100, Math.round((current / max) * 100)))
      : 0;

  // Compute the primary save DC (one number, from the proficient
  // attribute). If no proficient, falls back to physical.
  const primaryDc = resolvePrimarySaveDc(resolverInput);

  const closeProvenance = () => setProvenanceTarget(null);

  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <div>
      {/* Header: 2 columns. Phase 8.3g v3 (Mashu
          2026-07-28): the DC must be its own visually
          distinct box on the RIGHT. Per Mashu: "one
          column should be vitality title and below the
          numbers as they are. And the column with save
          DC should be on the right. So 2 rows left 1
          row right or idk exactly how you made the grid
          or containers or UI whatever." Layout:
            [VITALITY   ] [ SAVE DC ]
            [308/268    ] [   16    ]
            [██████ 100%]
          The DC box has a teal background to match the
          proficient attribute color (Mashu said "put a
          bg or something... make it more visible"). The
          DC = 5 + PB + (proficient attribute mod) +
          primitives@SAVE. Clicking the DC opens the
          provenance modal. */}
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Vitality
          </p>
        </div>
        <button
          type="button"
          onClick={() => setProvenanceTarget(SAVE_TARGET[primaryDc.attr])}
          className="group flex flex-col items-center justify-center rounded-md border-2 border-teal-500 bg-teal-500/15 px-3 py-1 text-center transition-colors hover:bg-teal-500/25"
          aria-label={`Show save DC provenance (${ATTR_FULL[primaryDc.attr]})`}
          title={`DC = 5 + PB + ${ATTR_FULL[primaryDc.attr]} modifier + primitive contributions`}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300 group-hover:text-teal-800 dark:group-hover:text-teal-200">
            Save DC
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums leading-none text-teal-700 dark:text-teal-200">
            {primaryDc.total}
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => setProvenanceTarget(MAX_VITALITY_TARGET)}
        className="mt-1 flex w-full items-baseline gap-1 rounded text-left transition-colors hover:bg-muted/30"
        aria-label="Show max vitality provenance"
      >
        <span className="font-mono text-2xl font-bold tabular-nums">
          {current}
        </span>
        <span className="font-mono text-base text-muted-foreground">
          / {max}
        </span>
      </button>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${
            percent < 25
              ? "bg-destructive"
              : percent < 50
                ? "bg-amber-500"
                : "bg-green-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{percent}%</p>

      {/* Attribute row: 4 cells, each with mod + small save below.
          Phase 8.3g v3 (Mashu 2026-07-28): the proficient
          attribute is highlighted with a teal BORDER, a
          teal-tinted BACKGROUND, AND the text inside the
          cell is teal-700/200 (light/dark mode). Per
          Mashu: "Proficient attribute modifier text still
          not teal." The earlier bg-only was too subtle
          to read as a clear distinction. */}
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {(["physical", "mental", "magical"] as const).map((attr) => {
          const isProficient = proficientAttribute === attr;
          const mod = resolveAttributeModifier(resolverInput, attr);
          const sv = resolveSaveValue(resolverInput, attr);
          return (
            <div
              key={attr}
              className={`flex flex-col items-center justify-center rounded-md border-2 px-1 py-1 text-center ${
                isProficient
                  ? "border-teal-500 bg-teal-500/15"
                  : "border-border bg-background"
              }`}
            >
              <span
                className={`text-[9px] font-semibold uppercase ${
                  isProficient
                    ? "text-teal-700 dark:text-teal-300"
                    : "text-muted-foreground"
                }`}
              >
                {ATTR_LABEL[attr]}
              </span>
              <button
                type="button"
                onClick={() => setProvenanceTarget(ATTR_TARGET[attr])}
                className="rounded px-1 transition-colors hover:bg-muted/60"
                aria-label={`Show ${ATTR_FULL[attr]} modifier provenance`}
              >
                <span
                  className={`font-mono text-sm font-bold tabular-nums ${
                    isProficient
                      ? "text-teal-700 dark:text-teal-200"
                      : "text-foreground"
                  }`}
                >
                  {fmt(mod.total)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setProvenanceTarget(SAVE_TARGET[attr])}
                className="rounded px-1 transition-colors hover:bg-muted/60"
                aria-label={`Show ${ATTR_FULL[attr]} save value provenance`}
                title={`Save value = mod + PB (if proficient) + primitive contributions`}
              >
                <span
                  className={`text-[9px] ${
                    isProficient
                      ? "text-teal-700/80 dark:text-teal-300/80"
                      : "text-muted-foreground"
                  }`}
                >
                  save
                </span>{" "}
                <span
                  className={`font-mono text-[10px] font-semibold tabular-nums ${
                    isProficient
                      ? "text-teal-700 dark:text-teal-200"
                      : "text-foreground"
                  }`}
                >
                  {fmt(sv.total)}
                </span>
              </button>
            </div>
          );
        })}
        {/* PROF cell (PB) — single line, no save. Phase
            8.3g v3: clickable for provenance (per Mashu:
            "I need for proficiency to see on click about
            it too"). The PB source target is
            `proficiency_bonus` in the resolver (or, if
            the character isn't using the resolver's
            target system, the modal will just show "no
            primitive contributions"). */}
        <button
          type="button"
          onClick={() => setProvenanceTarget("proficiency_bonus")}
          className="flex flex-col items-center justify-center rounded-md border border-border bg-secondary/30 px-1 py-1 text-center transition-colors hover:bg-secondary/50"
          aria-label="Show proficiency bonus provenance"
        >
          <span className="text-[9px] font-semibold uppercase text-muted-foreground">
            PROF
          </span>
          <span className="mt-0.5 font-mono text-sm font-bold tabular-nums">
            {fmt(pb)}
          </span>
          <span className="text-[9px] text-muted-foreground">PB</span>
        </button>
      </div>

      {provenanceTarget && (
        <ProvenanceModal
          target={provenanceTarget}
          targetLabel={
            provenanceTarget === MAX_VITALITY_TARGET
              ? "Max Vitality"
              : provenanceTarget === "proficiency_bonus"
                ? "Proficiency Bonus"
                : provenanceTarget.startsWith("attribute.")
                  ? `${ATTR_FULL[provenanceTarget.split(".").pop() as Attribute]} modifier`
                  : provenanceTarget.startsWith("defense_dc.")
                    ? `${ATTR_FULL[provenanceTarget.split(".").pop() as Attribute]} save`
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