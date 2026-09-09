"use client";

// =============================================================================
// PendingProposalsIndicator — PLAN Eilxina Part C (Mashu 2026-09-09).
//
// Small client chip that appears in the character sheet header when
// the viewer is the OWNER and there's at least one PENDING proposal.
// Links to the most recent pending proposal's review screen.
//
// Why a separate component: the indicator itself is small, but it
// must be a client component (Link with onClick for the badge).
// Co-locating it next to CharacterSharePanel keeps the header
// surface area easy to read.
// =============================================================================

import Link from "next/link";
import { GitPullRequest } from "lucide-react";

interface PendingProposalsIndicatorProps {
  characterId: string;
  pendingCount: number;
  /** The first pending proposal's id (sorted by created_at desc). */
  firstPendingId: string | null;
}

export function PendingProposalsIndicator({
  characterId,
  pendingCount,
  firstPendingId,
}: PendingProposalsIndicatorProps) {
  if (pendingCount === 0 || !firstPendingId) return null;
  return (
    <Link
      href={`/characters/${characterId}/proposals/${firstPendingId}`}
      className="flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
      title={`${pendingCount} pending proposal${pendingCount === 1 ? "" : "s"} to review`}
    >
      <GitPullRequest className="size-3.5" />
      {pendingCount} pending proposal{pendingCount === 1 ? "" : "s"}
    </Link>
  );
}
