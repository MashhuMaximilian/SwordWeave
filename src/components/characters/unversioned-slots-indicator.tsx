"use client";

// =============================================================================
// UnversionedSlotsIndicator — PLAN Eilxina Part G (Mashu 2026-09-10).
//
// Header chip for characters with slots whose versionId is NULL but the
// underlying entity has a published latest version. These are legacy
// pre-Phase-3 slots that never got pinned to a version. Clicking the
// chip bulk-pins every such slot to its entity's latest version via
// POST /api/characters/[id]/slots/bump-all with includeUnversioned:true.
//
// Why a separate chip from StaleUpdatesIndicator:
//   - Stale = "versionId !== latestVersionId (both non-null)" → real diff
//   - Unversioned = "versionId IS NULL" → no diff to show, just a pin
//   - The previous version counted both as stale; the modal showed no
//     diffs for the NULL rows because there's no current snapshot to
//     diff against — confusing "17 updates available, nothing to update".
// =============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UnversionedSlotsIndicatorProps {
  /** Total slots with versionId=NULL. */
  readonly count: number;
  readonly characterId: string;
  /** PLAY → passive; BUILD/EDIT → clickable to pin all. */
  readonly mode?: "PLAY" | "BUILD" | "EDIT";
}

export function UnversionedSlotsIndicator({
  count,
  characterId,
  mode = "PLAY",
}: UnversionedSlotsIndicatorProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  const interactive = mode !== "PLAY";

  const onClick = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/slots/bump-all`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "ALL", includeUnversioned: true }),
        },
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? `Failed (${res.status}).`);
        return;
      }
      // Server has bulk-updated version_id on the slot rows. The page
      // reads these via Drizzle on each navigation, so refreshing the
      // route picks up the new values without a manual reload.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(false);
    }
  };

  const label =
    count === 1
      ? "1 slot needs pinning"
      : `${count} slots need pinning`;

  const Tag = interactive ? "button" : "span";

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={pending}
      title={
        interactive
          ? "Pin every unversioned slot to its entity's latest version"
          : `${count} slot${
              count === 1 ? "" : "s"
            } have no version pinned (pre-Phase-3 legacy rows)`
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/30",
        "dark:text-amber-300",
        interactive &&
          "cursor-pointer transition-colors hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500",
        pending && "opacity-60",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <Link2 className="size-3" aria-hidden />
      )}
      {error ? (
        <span className="text-rose-600 dark:text-rose-400">{error}</span>
      ) : (
        <span>{label}</span>
      )}
    </Tag>
  );
}
