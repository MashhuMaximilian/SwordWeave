"use client";

/**
 * SlotSourceBadge — Phase 5 (T5.1).
 *
 * Renders a small color-coded badge next to a slot (capability, item, or
 * primitive on a character) showing:
 *
 *   - The slot's `slot_source` value:
 *     - OWNED (green):  the character owner is also the entity's author
 *                        AND the entity isn't a fork. Edits to the
 *                        entity flow through.
 *     - FORKED (yellow): the entity is a fork the character owner made.
 *                        Edits to the fork flow through.
 *     - PINNED (blue):  the entity belongs to someone else (system or
 *                        another user). The slot is a snapshot; the
 *                        version_id tells you which version it points to.
 *
 *   - A short version id (first 8 chars of the content-addressed UUID)
 *     to make it scannable which version of the entity the slot is on.
 *     Renders "no version" if versionId is null (e.g. entity has never
 *     been saved since Phase 4 was deployed).
 *
 *   - A "stale" indicator when the slot is on an older version than the
 *     entity's current latest. Per the Phase 5 doc this is the marker
 *     the user clicks to trigger an update walk (T5.5 — cut to manual
 *     for now; see docs/architecture/phase-5-verification.md).
 *
 * Mobile-first sizing: the badge is one line tall and wraps gracefully.
 * On hover (desktop) it expands to a tooltip with the full UUID.
 */

import type { SlotSource } from "@/db/schema/characters";

const COLORS: Record<SlotSource, { bg: string; text: string; ring: string; label: string }> = {
  OWNED: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/30",
    label: "Owned",
  },
  FORKED: {
    bg: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/30",
    label: "Forked",
  },
  PINNED: {
    bg: "bg-sky-500/15",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/30",
    label: "Pinned",
  },
};

export interface SlotSourceBadgeProps {
  slotSource: SlotSource | null;
  versionId: string | null;
  /**
   * The entity's current latest version id. If non-null AND different
   * from versionId, the badge is "stale" (the entity has a newer
   * version available).
   */
  latestVersionId?: string | null;
  /** When true, render the "stale" pill. Pass false to suppress. */
  showStale?: boolean;
  /** Compact mode: just the colored dot + version short. */
  compact?: boolean;
}

function shortId(id: string | null): string {
  if (!id) return "—";
  // First 8 chars of the UUID (post-dash). For content-addressed UUIDs
  // this is enough to be visually distinct while remaining readable.
  return id.replace(/-/g, "").slice(0, 8);
}

export function SlotSourceBadge({
  slotSource,
  versionId,
  latestVersionId,
  showStale = true,
  compact = false,
}: SlotSourceBadgeProps) {
  // Default to PINNED if the field is null (pre-Phase-5 backfill gap).
  const source: SlotSource = slotSource ?? "PINNED";
  const c = COLORS[source];
  const isStale =
    showStale &&
    latestVersionId !== undefined &&
    versionId !== null &&
    latestVersionId !== null &&
    latestVersionId !== versionId;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${c.bg} ${c.text} ring-1 ring-inset ${c.ring}`}
        title={versionId ? `v:${versionId} (${c.label})` : `no version (${c.label})`}
      >
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        v:{shortId(versionId)}
        {isStale && (
          <span className="ml-0.5 rounded bg-rose-500/20 px-1 text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/30">
            stale
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${c.bg} ${c.text} ring-1 ring-inset ${c.ring}`}
        title={versionId ? `Slot source: ${c.label}. Pinned to version ${versionId}.` : `Slot source: ${c.label}. No version pinned yet.`}
      >
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {c.label}
        {versionId && (
          <span className="ml-1 font-mono text-[10px] opacity-75">
            v:{shortId(versionId)}
          </span>
        )}
      </span>
      {isStale && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 font-medium text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300"
          title={`Source has a newer version available: ${latestVersionId}`}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          update available
          <span className="ml-1 font-mono text-[10px] opacity-75">
            → v:{shortId(latestVersionId!)}
          </span>
        </span>
      )}
    </div>
  );
}
