// =============================================================================
// VersionHistoryLink — PLAN Eilxina Part E (Mashu 2026-09-09).
//
// Small client component for the character sheet header. Two visual
// states:
//   - Default: "Versions" link → /characters/[id]/versions
//   - When `count` is provided: "Versions (3)" — number of recorded
//     versions gives the user a quick "is there history?" signal.
//
// Why a separate component rather than inlining: same rationale as
// the other header controls (CharacterVisibilityControl,
// CharacterSharePanel) — keep the header surface area easy to read.
// =============================================================================

import Link from "next/link";
import { History } from "lucide-react";

interface VersionHistoryLinkProps {
  characterId: string;
  count?: number | undefined;
}

export function VersionHistoryLink({
  characterId,
  count,
}: VersionHistoryLinkProps) {
  return (
    <Link
      href={`/characters/${characterId}/versions`}
      className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-primary"
      title="Browse this character's version history"
    >
      <History className="size-3.5" />
      Versions
      {count !== undefined && count > 0 && (
        <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] font-mono">
          {count}
        </span>
      )}
    </Link>
  );
}
