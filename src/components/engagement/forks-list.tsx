// =============================================================================
// <ForksList /> — server shell
//
// Fetches up to 50 forks (the listBySource hard cap) and passes them to
// <ForksListClient /> for rendering. Server side is responsible for:
// - I/O and authorship resolution
// - Empty-state suppression (returns null at totalForks === 0)
// - Visibility filtering (only public forks + current user's private forks)
//
// Phase 5 (P5R-3) added: pass the current user's Clerk ID so private
// forks owned by the viewer are also included. Without it, only public
// forks are shown.
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { listBySource, type ForkTargetType, type ForkEntry } from "@/lib/publishing/forks-query";
import { ForksListClient } from "./forks-list-client";

interface ForksListProps {
  targetType: ForkTargetType;
  targetId: string;
  /** Initial collapsed state — how many to show before "show all" button */
  initialLimit?: number;
}

export async function ForksList({
  targetType,
  targetId,
  initialLimit = 5,
}: ForksListProps) {
  // Get the current user (if signed in) so we can show their private
  // forks. auth() returns the session — userId is the Clerk ID.
  // P5R-3+hotfix: wrap the DB call in try/catch so a transient failure
  // here doesn't 500 the entire library item page. The ForksList is a
  // "nice to have" footer element — the page is still useful without it.
  const { userId: currentUserClerkId } = await auth();

  let result: Awaited<ReturnType<typeof listBySource>> | null = null;
  try {
    result = await listBySource(
      targetType,
      targetId,
      50,
      currentUserClerkId,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ForksList] listBySource failed:", err);
    return null;
  }

  const { forks, totalForks } = result;

  return (
    <ForksListClient
      forks={forks}
      totalForks={totalForks}
      initialLimit={initialLimit}
    />
  );
}

export type { ForkEntry };