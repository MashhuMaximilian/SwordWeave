/**
 * vitality-card.tsx — Phase 8.3f S5 (Mashu 2026-07-28)
 *
 * Vitality tracker + per-attribute saves + ONE global Save DC.
 * Phase 8.I i2.0 (Mashu 2026-08-05): per user feedback, there is
 * ONE global Save DC — not per-attribute. The 3 per-attribute DC
 * columns were removed and replaced with a single Save DC card
 * at the bottom, derived from the proficient attribute.
 *
 * Reads values from the canonical resolver so the "Max Vitality"
 * line is `(10 + PB) × level + primitive augments`.
 */

import { useState } from "react";
import type { ResolvedModifiers } from "@/lib/engine/resolve-modifiers";
import { ProvenanceModal } from "./provenance-modal";

type Attribute = "physical" | "mental" | "magical";

const ATTR_LABEL: Record<Attribute, string> = {
  physical: "Physical",
  mental: "Mental",
  magical: "Magical",
};

const ATTR_SHORT: Record<Attribute, string> = {
  physical: "P",
  mental: "Me",
  magical: "Ma",
};

const ATTR_TARGET: Record<Attribute, string> = {
  physical: "character.attribute.physical",
  mental: "character.attribute.mental",
  magical: "character.attribute.magical",
};

/**
 * Phase 8.I i2.0: saving throws are sub-targets of action_roll,
 * not a separate axis. `+1 to Physical Save` after i2.0 is
 * `add 1 to action_roll with sub-target physical_save`.
 */
const SAVE_TARGET: Record<Attribute, string> = {
  physical: "character.action_roll.physical_save",
  mental: "character.action_roll.mental_save",
  magical: "character.action_roll.magical_save",
};

const MAX_VITALITY_TARGET = "character.maxVitality";

/**
 * Phase 8.I i2.0: single Save DC. Reads from the
 * character.defense.saveDc contribution.
 */
const SAVE_DC_TARGET = "character.defense.saveDc";

export interface VitalityCardProps {
  current: number | null;
  /** Resolver's max vitality total = (10 + PB) × level + primitive augments. */
  max: number;
  /** Resolver output. */
  resolver: ResolvedModifiers;
  /** The character's proficient attribute (lowercase). */
  proficientAttribute: Attribute | null;
  /** PB value (PB is global per character). */
  pb: number;
  /** True if there's at least one mirrored primitive (drives the
   * "MIRRORED" pill on the modifier card). */
  hasMirrored: boolean;
}

export function VitalityCard({
  current,
  max,
  resolver,
  proficientAttribute,
  pb,
  hasMirrored,
}: VitalityCardProps) {
  const [provenanceTarget, setProvenanceTarget] = useState<string | null>(null);

  const percent =
    current !== null && max > 0
      ? Math.max(0, Math.min(100, Math.round((current / max) * 100)))
      : null;

  const open = (target: string) => setProvenanceTarget(target);
  const close = () => setProvenanceTarget(null);

  return (
    <div className="space-y-3">
      {/* Vitality row */}
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Vitality
        </p>
        <button
          type="button"
          onClick={() => open(MAX_VITALITY_TARGET)}
          className="mt-1 flex w-full items-baseline gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/40"
          aria-label="Show vitality provenance"
        >
          <span className="font-mono text-2xl font-bold tabular-nums">
            {current ?? "—"}
          </span>
          <span className="font-mono text-base text-muted-foreground">
            / {max}
          </span>
          {hasMirrored && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Mirrored
            </span>
          )}
        </button>
        {percent !== null && (
          <>
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
            <p className="mt-1 text-xs text-muted-foreground">{percent}%</p>
          </>
        )}
      </div>

      {/* Per-attribute rows (mod + save value) */}
      <div className="grid grid-cols-1 gap-1.5">
        {(["physical", "mental", "magical"] as const).map((attr) => {
          const isProficient = proficientAttribute === attr;
          const mod = resolver.totals[ATTR_TARGET[attr]] ?? 0;
          const saveValue = mod + (isProficient ? pb : 0) + (resolver.totals[SAVE_TARGET[attr]] ?? 0);
          const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

          return (
            <div
              key={attr}
              className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-sm ${
                isProficient
                  ? "border-teal-500/40 bg-teal-500/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-7 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                  {ATTR_SHORT[attr]}
                </span>
                <button
                  type="button"
                  onClick={() => open(ATTR_TARGET[attr])}
                  className="rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
                  aria-label={`Show ${ATTR_LABEL[attr]} modifier provenance`}
                >
                  <span className="font-mono font-semibold tabular-nums">
                    {fmt(mod)}
                  </span>
                </button>
                {isProficient && (
                  <span className="rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                    Prof
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => open(SAVE_TARGET[attr])}
                  className="rounded px-1 py-0.5 transition-colors hover:bg-muted/60"
                  aria-label={`Show ${ATTR_LABEL[attr]} save value provenance`}
                  title="Save value (d20 modifier when making a save)"
                >
                  <span className="text-muted-foreground">SV</span>{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {fmt(saveValue)}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase 8.I i2.0: ONE global Save DC card at the bottom. */}
      <SaveDcCard
        resolver={resolver}
        proficientAttribute={proficientAttribute}
        pb={pb}
        onOpen={open}
      />

      {/* Provenance modal (only rendered when a target is selected) */}
      {provenanceTarget && (
        <ProvenanceModal
          target={provenanceTarget}
          targetLabel={
            provenanceTarget === MAX_VITALITY_TARGET
              ? "Max Vitality"
              : provenanceTarget === SAVE_DC_TARGET
                ? "Save DC"
                : provenanceTarget.startsWith("character.attribute.")
                  ? `${ATTR_LABEL[provenanceTarget.split(".").pop() as Attribute]} modifier`
                  : provenanceTarget.startsWith("character.action_roll.")
                    ? `${ATTR_LABEL[provenanceTarget.split(".").pop()?.replace("_save", "") as Attribute]} save value`
                    : provenanceTarget
          }
          totals={resolver.totals}
          byTarget={resolver.byTarget}
          onClose={close}
        />
      )}
    </div>
  );
}

/**
 * Phase 8.I i2.0 (Mashu 2026-08-05): the single Save DC card.
 * Reads from the resolver's character.defense.saveDc contribution
 * (single global axis). Derived from the proficient attribute's
 * modifier + PB + primitive contributions.
 */
function SaveDcCard({
  resolver,
  proficientAttribute,
  pb,
  onOpen,
}: {
  resolver: ResolvedModifiers;
  proficientAttribute: Attribute | null;
  pb: number;
  onOpen: (target: string) => void;
}) {
  const proficientAttr = proficientAttribute ?? "physical";
  const proficientMod = resolver.totals[ATTR_TARGET[proficientAttr]] ?? 0;
  const saveDcDelta = resolver.totals[SAVE_DC_TARGET] ?? 0;
  const saveDc = 5 + pb + proficientMod + saveDcDelta;

  return (
    <button
      type="button"
      onClick={() => onOpen(SAVE_DC_TARGET)}
      className="flex w-full items-center justify-between rounded-md border border-border bg-card px-2 py-1.5 text-sm transition-colors hover:bg-muted/40"
      title="Save DC — one global value, click for provenance"
    >
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Save DC
      </span>
      <span className="font-mono font-bold tabular-nums">{saveDc}</span>
    </button>
  );
}