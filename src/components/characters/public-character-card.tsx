// =============================================================================
// PublicCharacterCard — PLAN Eilxina Part B (Mashu 2026-09-09).
//
// Card for the "Public library" tab on /characters. Renders a single
// LibraryItem of targetType='CHARACTER' with a "Fork as my own"
// button alongside the standard library preview link.
//
// The visual skeleton mirrors SharedCharacterCard for consistency —
// the three tabs use the same card shape so users learn the layout
// once. Differences from SharedCharacterCard:
// - Author (NOT granter) attribution
// - Description from queryLibrary() (L<size> · P.. M.. Mg..)
// - Open Sheet replaced with Fork button (cloning is the action)
//
// We render the Fork button as a separate client island so the
// server can stream the cards immediately and only the button
// hydrates.
// =============================================================================

import Link from "next/link";
import { Swords } from "lucide-react";
import { ForkCharacterButton } from "@/components/characters/fork-character-button";
import type { LibraryItem } from "@/lib/publishing/library-query";

interface PublicCharacterCardProps {
  item: LibraryItem;
}

export function PublicCharacterCard({ item }: PublicCharacterCardProps) {
  // item.id is "CHARACTER:<uuid>"; item.targetId is the raw uuid.
  const characterId = item.targetId;
  const initials = item.name.charAt(0).toUpperCase();

  return (
    <div className="group relative flex flex-col rounded-md border border-border bg-card p-5 transition-colors hover:border-primary">
      <div className="flex items-start gap-3">
        <div className="flex size-14 items-center justify-center rounded-md border border-border bg-background text-2xl font-bold text-muted-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{item.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono font-bold text-secondary-foreground">
              {item.description ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Author attribution — who built this publicly? */}
      <div className="mt-3 text-xs text-muted-foreground">
        By{" "}
        <span className="font-medium text-foreground">
          {item.authorDisplayName ?? item.authorUsername ?? "unknown"}
        </span>
      </div>

      {/* Engagement bar (likes/forks) — read-only, mirrors the
          library table visual. Phase A's fetchCharacters already
          resolves the engagement counts via resolveEngagementMap. */}
      {(item.likesCount > 0 || item.forkCount > 0) && (
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {item.likesCount > 0 && (
            <span title={`${item.likesCount} like(s)`}>
              ♥ {item.likesCount}
            </span>
          )}
          {item.forkCount > 0 && (
            <span title={`${item.forkCount} fork(s)`}>
              ⑂ {item.forkCount}
            </span>
          )}
        </div>
      )}

      {/* Actions: Preview + Fork */}
      <div className="mt-5 flex items-center gap-2">
        <Link
          href={`/library/item/${item.id}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card"
          title="Open the full library preview"
        >
          <Swords className="size-3.5" />
          Preview
        </Link>
        <ForkCharacterButton characterId={characterId} />
      </div>
    </div>
  );
}
