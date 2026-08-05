/**
 * saves-card.tsx — Phase 8.3f S5 (Mashu 2026-07-28)
 *
 * Per-attribute rows showing attribute modifier + save value
 * (the player's saving throw bonus). The Save DC is ONE GLOBAL
 * number (Mashu 2026-08-05: "we only have one DC global") —
 * rendered as a single card at the top.
 *
 * Rules (Phase 8.I i2.0, Mashu 2026-08-05):
 *   - Save VALUE (per attribute): mod + PB (if proficient) + primitives@action_roll.<attr>_save
 *   - Save DC (single global): 5 + PB + (proficient attribute mod) + primitives@defense_dc
 *   - Proficient attribute row highlighted in teal
 *
 * Layout: per-attribute row + a single Save DC row at the top.
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

/**
 * Phase 8.I i2.0 (Mashu 2026-08-05): saving throws are sub-targets
 * of action_roll, not a separate axis. `+1 to Physical Save` after
 * i2.0 is `add 1 to action_roll with sub-target physical_save`.
 */
const SAVE_TARGET: Record<Attribute, string> = {
  physical: "character.action_roll.physical_save",
  mental: "character.action_roll.mental_save",
  magical: "character.action_roll.magical_save",
};

/**
 * Single Save DC axis (Phase 8.I i2.0). Reads from the
 * character.defense.saveDc contribution. The contributed primitive
 * modifiers target the canonical short axis `defense_dc` (and
 * legacy per-attribute defense keys collapse into the same single
 * axis via modifier-scope.ts:LEGACY_TARGET_MIGRATIONS).
 */
const SAVE_DC_TARGET = "character.defense.saveDc";

export interface SavesCardProps {
  resolver: ResolvedModifiers;
  proficientAttribute: Attribute | null;
  pb: number;
}

export function SavesCard({ resolver, proficientAttribute, pb }: SavesCardProps) {
  const [provenanceTarget, setProvenanceTarget] = useState<string | null>(null);

  // Phase 8.I i2.0: derive the single Save DC from the proficient
  // attribute's modifier + PB + primitive contributions to the
  // global Save DC axis.
  const proficientAttr = proficientAttribute ?? "physical";
  const proficientMod = resolver.totals[ATTR_TARGET[proficientAttr]] ?? 0;
  const saveDcDelta = resolver.totals[SAVE_DC_TARGET] ?? 0;
  const saveDc = 5 + pb + proficientMod + saveDcDelta;
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <div className="flex flex-col gap-1 border-l border-border pl-6">
      <p className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:block">
        Saves
      </p>

      {/* Phase 8.I i2.0: single Save DC card at the top — one global DC. */}
      <button
        type="button"
        onClick={() => setProvenanceTarget(SAVE_DC_TARGET)}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs md:min-w-[170px]"
        title="Save DC — one global value, click for provenance"
      >
        <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          DC
        </span>
        <span className="text-[10px] text-muted-foreground">SAVE</span>{" "}
        <span className="font-mono font-semibold tabular-nums">{saveDc}</span>
        <span className="rounded-full bg-muted px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
          {ATTR_SHORT[proficientAttr]}
        </span>
      </button>

      {(["physical", "mental", "magical"] as const).map((attr) => {
        const isProficient = proficientAttribute === attr;
        const mod = resolver.totals[ATTR_TARGET[attr]] ?? 0;
        const saveDelta = resolver.totals[SAVE_TARGET[attr]] ?? 0;
        const saveValue = mod + (isProficient ? pb : 0) + saveDelta;

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
            provenanceTarget === SAVE_DC_TARGET
              ? "Save DC"
              : provenanceTarget.startsWith("character.attribute.")
                ? `${ATTR_LABEL[provenanceTarget.split(".").pop() as Attribute]} modifier`
                : provenanceTarget.startsWith("character.action_roll.")
                  ? `${ATTR_LABEL[provenanceTarget.split(".").pop()?.replace("_save", "") as Attribute]} save value`
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
