// =============================================================================
// <ForksListClient /> — client component
//
// Receives the full list (up to 50 forks) from the server and renders:
// 1. Header: "Forked N times" + show-all toggle button
// 2. Avatar stack (first 5)
// 3. Entry list — toggles between `initialLimit` (default 5) and full count
// =============================================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ForkEntry } from "@/lib/publishing/forks-query";

interface ForksListClientProps {
  forks: ForkEntry[];
  totalForks: number;
  initialLimit: number;
}

export function ForksListClient({
  forks,
  totalForks,
  initialLimit,
}: ForksListClientProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleForks = expanded ? forks : forks.slice(0, initialLimit);
  const hiddenCount = totalForks - visibleForks.length;

  return (
    <section
      aria-label="Forks"
      className="mt-6 border-t border-border pt-4"
      data-testid="forks-list"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Forked {totalForks} {totalForks === 1 ? "time" : "times"}
        </h3>
        {totalForks > initialLimit && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="size-3" />
              </>
            ) : (
              <>
                Show all {totalForks} <ChevronDown className="size-3" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Avatar stack — first 5 unique (collapsed) or 5 (expanded) */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex -space-x-2">
          {forks.slice(0, 5).map((f, i) => (
            <ForkerAvatar
              key={`${f.id}-${i}`}
              username={f.forkerUsername}
              displayName={f.forkerDisplayName}
              avatarUrl={f.forkerAvatarUrl}
              size={32}
            />
          ))}
        </div>
        {hiddenCount > 0 && !expanded && (
          <span className="text-xs text-muted-foreground">
            +{hiddenCount} more
          </span>
        )}
      </div>

      {/* Compact entry list — each row links to the fork's source page
          so the user can drill into a specific fork. We show the forker
          + when they forked + which source entity this came from. */}
      <ul className="divide-y divide-border/60 text-sm">
        {visibleForks.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2">
            <ForkerAvatar
              username={f.forkerUsername}
              displayName={f.forkerDisplayName}
              avatarUrl={f.forkerAvatarUrl}
              size={24}
            />
            <div className="min-w-0 flex-1 truncate">
              {f.forkerUsername ? (
                <Link
                  href={`/u/${encodeURIComponent(f.forkerUsername)}`}
                  className="font-medium text-foreground hover:underline"
                >
                  @{f.forkerUsername}
                </Link>
              ) : (
                <span className="text-muted-foreground">deleted user</span>
              )}
              {f.sourceAuthorUsername && (
                <>
                  <span className="mx-1 text-muted-foreground">from</span>
                  <Link
                    href={`/u/${encodeURIComponent(f.sourceAuthorUsername)}`}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    @{f.sourceAuthorUsername}
                  </Link>
                </>
              )}
              <span className="ml-2 text-xs text-muted-foreground">
                · {timeAgo(f.forkedAt)}
              </span>
            </div>
            {/* Link to the fork's source page so the user can drill
                into it. The fork is identified by its (type, id) tuple
                in the standard library URL format. */}
            <Link
              href={`/library/item/${f.forkedTargetType}:${encodeURIComponent(f.forkedTargetId)}`}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
              title={`View fork: ${f.forkedTargetName ?? "untitled"}`}
            >
              View fork →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =============================================================================
// <ForkerAvatar /> — avatar with initial-bubble fallback
// =============================================================================

function ForkerAvatar({
  username,
  displayName,
  avatarUrl,
  size,
}: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  size: number;
}) {
  const fallbackText = (username ?? displayName ?? "?").charAt(0).toUpperCase();
  const sizeClass =
    size === 32
      ? "h-8 w-8 ring-2 ring-background"
      : "h-6 w-6 ring-1 ring-background";

  if (avatarUrl) {
    return (
      <span
        className={`relative inline-block overflow-hidden rounded-full ${sizeClass}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={avatarUrl}
          alt={username ?? displayName ?? "user"}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground ${sizeClass}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {fallbackText}
    </span>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}