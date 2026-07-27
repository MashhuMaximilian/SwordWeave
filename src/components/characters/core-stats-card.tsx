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
 * The PDF shows this card right ABOVE Vitality. We mount it
 * in the Overview tab on mobile only; desktop keeps its
 * existing attribute layout (PB stays in the Load/Equip band
 * for now — see note in Phase 8 sheet commit if/when we move
 * PB everywhere).
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
}

export function CoreStatsCard({
  physical,
  mental,
  magical,
  pb,
  proficientAttribute,
}: CoreStatsCardProps) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const physMod = Math.floor((physical - 10) / 2);
  const mentMod = Math.floor((mental - 10) / 2);
  const magiMod = Math.floor((magical - 10) / 2);

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
          label="PHYS"
          primary={physical}
          modifier={physMod}
          isProficient={proficientAttribute === "PHYSICAL"}
        />
        <StatBlock
          label="MENT"
          primary={mental}
          modifier={mentMod}
          isProficient={proficientAttribute === "MENTAL"}
        />
        <StatBlock
          label="MAG"
          primary={magical}
          modifier={magiMod}
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
  primary,
  modifier,
  isProficient,
}: {
  label: string;
  primary: number;
  modifier: number;
  isProficient: boolean;
}) {
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
      >
        {primary}
      </div>
      <div
        className={cn(
          "text-[10px] font-medium",
          isProficient
            ? "text-teal-600 dark:text-teal-400"
            : "text-muted-foreground",
        )}
      >
        {modifier >= 0 ? `+${modifier}` : modifier}
      </div>
    </div>
  );
}