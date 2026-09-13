"use client";

// =============================================================================
// StaleUpdatesIndicatorWithBump — PLAN Eilxina Part D follow-up
// (Mashu 2026-09-09).
//
// Thin client wrapper around StaleUpdatesIndicator that wires
// the onClick to useBumpAllSlots. The server-rendered
// CharacterSheetView can drop this in directly.
//
// Why a wrapper: StaleUpdatesIndicator is already a client
// component, but it doesn't know about characterId / hooks.
// Rather than making the indicator itself a stateful hook user,
// we wrap it here — keeps the indicator presentational and
// the data flow server → wrapper → indicator.
// =============================================================================

import { useBumpAllSlots } from "@/lib/character/use-bump-all-slots";
import { StaleUpdatesIndicator } from "@/components/characters/stale-updates-indicator";

interface StaleUpdatesIndicatorWithBumpProps {
  characterId: string;
  count: number;
  mode: "PLAY" | "BUILD" | "EDIT";
  /**
   * PLAN Eilxina Part F (Mashu 2026-09-10): when provided, the
   * "update all" pill routes through this callback instead of
   * calling useBumpAllSlots directly. The parent will open the
   * UpdateAllModal which fetches /slots/stale-diffs and shows
   * per-row diffs before applying.
   */
  onOpenUpdateModal?: () => void;
}

export function StaleUpdatesIndicatorWithBump({
  characterId,
  count,
  mode,
  onOpenUpdateModal,
}: StaleUpdatesIndicatorWithBumpProps) {
  const { bumpAll, pending, error } = useBumpAllSlots(characterId);

  const interactive = mode !== "PLAY";

  // PLAN Eilxina Part F (Mashu 2026-09-10): if the parent
  // provided an onOpenUpdateModal callback we route through
  // it — that opens the new diff-review modal. Fall back to
  // the silent bumpAll() for callers that didn't wire it (e.g.
  // the legacy in-page action header before the modal landed).
  const handleUpdateAll =
    onOpenUpdateModal ?? (() => void bumpAll());

  return (
    <div className="flex flex-col items-end gap-1">
      <StaleUpdatesIndicator
        count={count}
        mode={mode}
        {...(interactive
          ? { onUpdateAll: handleUpdateAll }
          : {})}
        pending={pending}
      />
      {error && (
        <span className="text-[10px] text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
