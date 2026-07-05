// =============================================================================
// <ForksList /> — server shell
//
// Fetches up to 50 forks (the listBySource hard cap) and passes them to
// <ForksListClient /> for rendering. Server side is responsible for:
// - I/O and authorship resolution
// - Empty-state suppression (returns null at totalForks === 0)
// Client side handles the "show N more" expand toggle.
// =============================================================================

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
  // Fetch up to 50 (max allowed by listBySource). Client decides how many to render.
  const { forks, totalForks } = await listBySource(targetType, targetId, 50);

  if (totalForks === 0) return null;

  return (
    <ForksListClient
      forks={forks}
      totalForks={totalForks}
      initialLimit={initialLimit}
    />
  );
}

export type { ForkEntry };