/**
 * saves-card.tsx — Phase 8.3f S5 (Mashu 2026-07-28)
 *
 * Compact per-attribute card showing attribute modifier, save
 * value, and save DC. Each row opens the ProvenanceModal on
 * click. Replaces the legacy "Defensive DCs" duplicate column
 * in the in-page Vitality band.
 *
 * Rules (per Mashu 2026-07-28 + target-registry.ts):
 *   - Save VALUE: mod + PB (if proficient) + primitives@SAVE
 *   - Save DC: 5 + PB + mod + primitives@SAVE
 *   - Proficient attribute card highlighted in teal
 *
 * Layout: 3 rows × 4 columns (label | mod | SV | DC). Mobile:
 * horizontal scroll. Desktop: fits the right column of the
 * Vitality band.
 */

import { useState } from "react";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";
import { ProvenanceModal } from "./provenance-modal";

type Attribute = "physical" | "mental" | "magical";

const ATTR_SHORT: Record<Attribute, string> = {
  physical: "PHYS",
  mental: "MENT",
  magical: "MAGI",
};

const ATTR_LABEL: Record<Attribute, string> = {
  physical: "Physical",
  mental: "Mental",
  magical: "Magical",
};

const ATTR_TARGET: Record<Attribute, string> = {
  physical: "character.attribute.physical",
  mental: "character.attribute.mental",
  magical: "character.attribute.magical",
};

const SAVE_TARGET: Record<Attribute, string> = {
  physical: "character.defense.physicalDc",
  mental: "character.defense.mentalDc",
  magical: "character.defense.magicalDc",
};

export interface SavesCardProps {
  resolver: ResolvedModifiers;
  proficientAttribute: Attribute | null;
  pb: number;
}

export function SavesCard({ resolver, proficientAttribute, pb }: SavesCardProps) {
  const [provenanceTarget, setProvenanceTarget] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1 border-l border-border pl-6">
      <p className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:block">
        Saves
      </p>
      {(["physical", "mental", "magical"] as const).map((attr) => {
        const isProficient = proficientAttribute === attr;
        const mod = resolver.totals[ATTR_TARGET[attr]] ?? 0;
        const saveDelta = resolver.totals[SAVE_TARGET[attr]] ?? 0;
        const saveValue = mod + (isProficient ? pb : 0) + saveDelta;
        const saveDc = 5 + pb + mod + saveDelta;
        const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

        return (
          <div
            key={attr}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs md:min-w-[170px] ${
              isProficient
                ? "border-teal-500/40 bg-teal-500/5"
                : "border-border bg-background"
            }`}
          >
            <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {ATTR_SHORT[attr]}
            </span>
            <button
              type="button"
              onClick={() => setProvenanceTarget(ATTR_TARGET[attr])}
              className="shrink-0 rounded px-1 transition-colors hover:bg-muted/60"
              title={`${ATTR_LABEL[attr]} modifier — click for provenance`}
            >
              <span className="font-mono font-semibold tabular-nums">
                {fmt(mod)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setProvenanceTarget(SAVE_TARGET[attr])}
              className="shrink-0 rounded px-1 transition-colors hover:bg-muted/60"
              title={`${ATTR_LABEL[attr]} save value — click for provenance`}
            >
              <span className="text-[10px] text-muted-foreground">SV</span>{" "}
              <span className="font-mono font-semibold tabular-nums">
                {fmt(saveValue)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setProvenanceTarget(SAVE_TARGET[attr])}
              className="shrink-0 rounded px-1 transition-colors hover:bg-muted/60"
              title={`${ATTR_LABEL[attr]} save DC — click for provenance`}
            >
              <span className="text-[10px] text-muted-foreground">DC</span>{" "}
              <span className="font-mono font-semibold tabular-nums">
                {saveDc}
              </span>
            </button>
            {isProficient && (
              <span className="rounded-full bg-teal-500/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                P
              </span>
            )}
          </div>
        );
      })}

      {provenanceTarget && (
        <ProvenanceModal
          target={provenanceTarget}
          targetLabel={
            provenanceTarget.startsWith("character.attribute.")
              ? `${ATTR_LABEL[provenanceTarget.split(".").pop() as Attribute]} modifier`
              : provenanceTarget.startsWith("character.defense.")
                ? `${ATTR_LABEL[provenanceTarget.split(".").pop() as Attribute]} save`
                : provenanceTarget
          }
          totals={resolver.totals}
          byTarget={resolver.byTarget}
          onClose={() => setProvenanceTarget(null)}
        />
      )}
    </div>
  );
}