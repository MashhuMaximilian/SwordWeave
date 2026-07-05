// =============================================================================
// <ForksList /> — server component
//
// Shows forks taken FROM a source target. Used on library item detail pages.
//
// Renders 3 sections:
// 1. Header: "Forked N times"
// 2. Avatars row (up to 5)
// 3. Compact list (up to 5 entries: avatar · username · "forked this X ago")
//
// Empty state: hidden (zero forks = no render).
//
// Renders nothing if totalForks === 0 to avoid cluttering the detail page.
// Designed at 412px viewport (OnePlus 15) — single column, no horizontal scroll.
// =============================================================================

import Link from "next/link";
import Image from "next/image";
import { listBySource, type ForkTargetType } from "@/lib/publishing/forks-query";

interface ForksListProps {
  targetType: ForkTargetType;
  targetId: string;
  /** Show full list (limit 10) — library item detail uses 5 by default */
  limit?: number;
  /** Initial collapse state — Phase 6.5 add: "show all N forks" toggle */
  initialLimit?: number;
}

export async function ForksList({
  targetType,
  targetId,
  initialLimit = 5,
}: ForksListProps) {
  const { forks, totalForks } = await listBySource(
    targetType,
    targetId,
    initialLimit,
  );

  if (totalForks === 0) return null;

  return (
    <section
      aria-label="Forks"
      className="mt-6 border-t border-border pt-4"
      data-testid="forks-list"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Forked {totalForks} {totalForks === 1 ? "time" : "times"}
        </h3>
        {totalForks > initialLimit && (
          <span className="text-xs text-muted-foreground">
            showing latest {initialLimit}
          </span>
        )}
      </div>

      {/* Avatar stack — up to 5 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex -space-x-2">
          {forks.slice(0, 5).map((f) => (
            <ForkerAvatar
              key={f.id}
              username={f.forkerUsername}
              displayName={f.forkerDisplayName}
              avatarUrl={f.forkerAvatarUrl}
              size={32}
            />
          ))}
        </div>
        {totalForks > 5 && (
          <span className="text-xs text-muted-foreground">
            +{totalForks - 5} more
          </span>
        )}
      </div>

      {/* Compact entry list */}
      <ul className="divide-y divide-border/60 text-sm">
        {forks.map((f) => (
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
              <span className="ml-2 text-xs text-muted-foreground">
                forked {timeAgo(f.forkedAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =============================================================================
// <ForkerAvatar /> — tiny avatar with fallback to initial
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

  // Initial bubble fallback
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