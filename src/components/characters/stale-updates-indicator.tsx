"use client";

// =============================================================================
// StaleUpdatesIndicator — PLAN Eilxina Part D (Mashu 2026-09-09).
//
// Header-level summary of how many slotted primitives/capabilities/items
// have a newer version available. Renders:
//
//   - PLAY mode: passive read-only badge ("3 updates available")
//   - BUILD/EDIT mode: clickable button that opens the "Update all stale
//     slots" batch modal/route (Part D follow-up; for v1 it just refreshes)
//
// The per-slot "update available → v:..." pill on each chip is rendered by
// SlotSourceBadge. This header-level count is the at-a-glance summary.
//
// Why this matters: PLAY users shouldn't be ambushed by surprise BU shifts.
// The pill on each chip is already clickable in BUILD/EDIT; this component
// gives the user a single number to know "how many things have drifted".
// =============================================================================

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StaleUpdatesIndicatorProps {
  /** Total slots with a newer version available. */
  readonly count: number;
  /** PLAY → passive text only. BUILD/EDIT → clickable button. */
  readonly mode?: "PLAY" | "BUILD" | "EDIT";
  /** Called when the user clicks "Update all" in BUILD/EDIT mode. */
  readonly onUpdateAll?: () => void;
  /** Pending state — true while batch is in flight. */
  readonly pending?: boolean;
}

export function StaleUpdatesIndicator({
  count,
  mode = "PLAY",
  onUpdateAll,
  pending = false,
}: StaleUpdatesIndicatorProps) {
  if (count === 0) return null;

  const interactive = mode !== "PLAY";

  const content = (
    <span className="inline-flex items-center gap-1.5">
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-3" aria-hidden />
      )}
      <span className="text-xs font-medium">
        {count} update{count === 1 ? "" : "s"} available
      </span>
      {interactive && onUpdateAll ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
          update all
        </span>
      ) : null}
    </span>
  );

  const baseClass = cn(
    "inline-flex items-center rounded-full px-2.5 py-1 ring-1 ring-inset transition-colors",
    "bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300",
    interactive && onUpdateAll
      ? "hover:bg-rose-500/20 cursor-pointer"
      : "cursor-default",
  );

  if (interactive && onUpdateAll) {
    return (
      <button
        type="button"
        onClick={onUpdateAll}
        className={baseClass}
        disabled={pending}
        title="Click to bump every stale slot to its entity's latest version"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={baseClass} title="Slots with a newer entity version available">
      {content}
    </div>
  );
}
