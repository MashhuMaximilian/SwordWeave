"use client";

/**
 * Phase 8 UI revamp (Mashu 2026-07-27): CoreStatsCard
 *
 * Mobile-only hero card showing PHYS / MENT / MAG / PROF (PB)
 * together in a single horizontal row, per the user's PDF.
 *
 * Mashu 2026-07-27: 'Elevating PB next to attributes gives
 * the core mathematical baseline in one clean sweep.'
 *
 * v2 (Mashu 2026-07-27): show modifier ONLY as the primary
 * big number. The PDF specifies P+5 / M+5 / M0 / +6 — i.e.
 * just the modifier. The previous version showed raw score
 * (5) with modifier below (-3), which the user correctly
 * identified as confusing. Also added a smaller secondary
 * line showing the Saves modifier (modifier + PB + primitive
 * modifiers), since the user pointed out that belongs here.
 *
 * Returns null on >= md screens (768px+).
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface CoreStatsCardProps {
  readonly physical: number;
  readonly mental: number;
  readonly magical: number;
  readonly pb: number;
  readonly proficientAttribute: "PHYSICAL" | "MENTAL" | "MAGICAL" | null;
  /**
   * Optional total modifier deltas from primitives per
   * attribute (e.g. "+2 from Sharp Mind"). Added to the
   * base attribute modifier to get the effective save value.
   * Defaults to 0 when omitted.
   */
  readonly primitiveModifierDelta?: {
    readonly physical: number;
    readonly mental: number;
    readonly magical: number;
  };
}

export function CoreStatsCard({
  physical,
  mental,
  magical,
  pb,
  proficientAttribute,
  primitiveModifierDelta,
}: CoreStatsCardProps) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const physMod = Math.floor((physical - 10) / 2);
  const mentMod = Math.floor((mental - 10) / 2);
  const magiMod = Math.floor((magical - 10) / 2);

  const physDelta = primitiveModifierDelta?.physical ?? 0;
  const mentDelta = primitiveModifierDelta?.mental ?? 0;
  const magiDelta = primitiveModifierDelta?.magical ?? 0;

  // Phase 8.4 (Mashu 2026-07-28): the displayed modifier is the
  // raw attribute modifier plus the per-primitive contribution
  // (e.g. "+2 from Sharp Mind"). Mirrored primitives flip sign.
  const physEffective = physMod + physDelta;
  const mentEffective = mentMod + mentDelta;
  const magiEffective = magiMod + magiDelta;

  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <section
      className="rounded-md border border-border bg-card p-3 md:hidden"
      data-testid="core-stats-card"
      aria-label="Core stats: physical, mental, magical, proficiency bonus"
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Core Attributes
      </div>
      <div className="grid grid-cols-4 divide-x divide-border text-center">
        <StatBlock
          label="P"
          fullLabel="PHYS"
          modifier={physEffective}
          saveModifier={physEffective + (proficientAttribute === "PHYSICAL" ? pb : 0)}
          isProficient={proficientAttribute === "PHYSICAL"}
        />
        <StatBlock
          label="M"
          fullLabel="MENT"
          modifier={mentEffective}
          saveModifier={mentEffective + (proficientAttribute === "MENTAL" ? pb : 0)}
          isProficient={proficientAttribute === "MENTAL"}
        />
        <StatBlock
          label="M"
          fullLabel="MAG"
          modifier={magiEffective}
          saveModifier={magiEffective + (proficientAttribute === "MAGICAL" ? pb : 0)}
          isProficient={proficientAttribute === "MAGICAL"}
        />
        <div className="px-1 py-2">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            PROF
          </div>
          <div className="font-mono text-lg font-bold text-foreground">
            {fmt(pb)}
          </div>
          <div
            className={cn(
              "text-[10px] font-medium",
              proficientAttribute
                ? "text-teal-600 dark:text-teal-400"
                : "text-muted-foreground",
            )}
          >
            PB
          </div>
        </div>
      </div>
    </section>
  );
}

function StatBlock({
  label,
  fullLabel,
  modifier,
  saveModifier,
  isProficient,
}: {
  label: string;
  fullLabel: string;
  modifier: number;
  saveModifier: number;
  isProficient: boolean;
}) {
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  // The proficient attribute's save modifier already includes the PB
  // in the formula above, so the displayed save == total roll.
  const saveColor = isProficient
    ? "text-teal-600 dark:text-teal-400"
    : "text-muted-foreground";
  return (
    <div className="px-1 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-lg font-bold",
          isProficient
            ? "text-teal-600 dark:text-teal-400"
            : "text-foreground",
        )}
        title={fullLabel}
      >
        {fmt(modifier)}
      </div>
      <div className={cn("text-[10px] font-medium", saveColor)}>
        save {fmt(saveModifier)}
      </div>
    </div>
  );
}