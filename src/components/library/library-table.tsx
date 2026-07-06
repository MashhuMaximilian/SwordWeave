"use client";

// =============================================================================
// LibraryTable — the canonical library listing.
//
// Renders the result set from `queryLibrary()` as either a grid or a list,
// preserving the visual output that /library/browse shipped with.
//
// Two rendering modes:
// - Link mode (default): each row is an <a href="/library/item/..."> for
//   navigation in the standalone /library/browse page.
// - Select mode (when `onSelect` is provided): rows are <button> elements that
//   fire `onSelect(item)` so the sandbox left column can route clicks into
//   its build form + dirty-modal gate.
//
// Empty state, pagination, engagement bar, and per-row metadata all match
// the original /library/browse page byte-for-byte. This file replaces the
// inline rendering in page.tsx so the same table can be reused in the
// sandbox left column.
// =============================================================================

import Link from "next/link";
import { ArrowRight, ExternalLink, SearchX, User as UserIcon } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { EmptyState } from "@/components/ui/empty-state";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { cn } from "@/lib/utils";
import type { LibraryItem, LibraryTargetType } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

type LibraryEngagement = {
  reactions: Record<string, "LIKE" | "DISLIKE" | null>;
  following: Record<string, boolean>;
};

export type { LibraryEngagement };

interface LibraryTableProps {
  items: LibraryItem[];
  view: LibraryView;
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
  /**
   * If provided, rows render as buttons and clicking one fires this callback
   * instead of navigating. Used by the sandbox left column.
   * If omitted, rows render as links to `/library/item/<id>`.
   */
  onSelect?: ((item: LibraryItem) => void) | undefined;
  /**
   * Stable key for the currently-edited row. Highlighted in the list/grid.
   */
  selectedKey?: string | null | undefined;
  /**
   * If true, render empty-state copy + a "clear filters" affordance when the
   * result set is empty. Defaults to true (matches /library/browse).
   * Set false when the sandbox is pre-filtered by build mode (the empty state
   * there is "no entries match" with different messaging).
   */
  showClearFilters?: boolean;
  /**
   * Optional pagination footer. Pass `null` to disable.
   */
  pagination?: React.ReactNode;
  /**
   * Override copy for the empty state title when the result set is empty.
   */
  emptyTitle?: string;
  /**
   * Override copy for the empty state description when the result set is empty.
   */
  emptyDescription?: string;
}

export function LibraryTable({
  items,
  view,
  engagement,
  currentUserInternalId,
  onSelect,
  selectedKey,
  showClearFilters = true,
  pagination,
  emptyTitle,
  emptyDescription,
}: LibraryTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={emptyTitle ?? "No matches for these filters"}
        description={
          emptyDescription ??
          "Try removing a filter, broadening the search, or changing the sort."
        }
        primaryAction={
          showClearFilters
            ? { label: "Clear filters", href: "/library/browse" }
            : { label: "Browse BU Market", href: "/bu-market" }
        }
        {...(showClearFilters
          ? {}
          : {
              secondaryAction: {
                label: "Open sandbox",
                href: "/sandbox",
              },
            })}
      />
    );
  }

  if (view === "LIST") {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <ListItem
            key={item.id}
            item={item}
            engagement={engagement}
            currentUserInternalId={currentUserInternalId}
            onSelect={onSelect}
            selected={selectedKey === item.id}
          />
        ))}
        {pagination}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <GridCard
              key={item.id}
              item={item}
              engagement={engagement}
              currentUserInternalId={currentUserInternalId}
              onSelect={onSelect}
              selected={selectedKey === item.id}
            />
          ))}
        </div>
        {pagination}
      </div>
    </div>
  );
}

// =============================================================================
// ListItem — compact horizontal card for list view.
// =============================================================================

interface ListItemProps {
  item: LibraryItem;
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
  onSelect?: ((item: LibraryItem) => void) | undefined;
  selected?: boolean | undefined;
}

function ListItem({
  item,
  engagement,
  currentUserInternalId,
  onSelect,
  selected,
}: ListItemProps) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <h3 className="truncate text-sm font-semibold leading-tight">{item.name}</h3>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {item.targetType.replace(/_/g, " ").toLowerCase()}
            {item.category ? ` · ${item.category.replace(/_/g, " ")}` : ""}
          </span>
          {item.buCost !== null && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0 font-mono text-[10px] font-semibold text-primary">
              {item.buCost} BU
            </span>
          )}
        </div>
        {item.description && (
          <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground [&_p]:m-0 [&_strong]:font-semibold [&_em]:italic">
            <Markdown>{item.description}</Markdown>
          </div>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>♥ {item.likesCount}</span>
          <span>★ {item.forkCount}</span>
          {item.authorUsername && (
            <span className="truncate">by {item.authorDisplayName ?? item.authorUsername}</span>
          )}
        </div>
      </div>
      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
    </>
  );

  const baseClass = cn(
    "flex items-start gap-2 rounded-md border bg-card p-2 transition-colors md:gap-3 md:p-3",
    selected
      ? "border-primary bg-primary/5"
      : "border-border hover:border-primary",
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={cn(baseClass, "w-full text-left")}
      >
        {inner}
      </button>
    );
  }
  return (
    <Link href={`/library/item/${item.id}`} className={baseClass}>
      {inner}
    </Link>
  );
}

// =============================================================================
// GridCard — full card for grid view.
// =============================================================================

interface GridCardProps {
  item: LibraryItem;
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
  onSelect?: ((item: LibraryItem) => void) | undefined;
  selected?: boolean | undefined;
}

function GridCard({
  item,
  engagement,
  currentUserInternalId,
  onSelect,
  selected,
}: GridCardProps) {
  const inner = (
    <>
      <header className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{item.name}</h3>
          <p className="mt-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            {item.targetType.replace(/_/g, " ").toLowerCase()}
            {item.category ? ` · ${item.category.replace(/_/g, " ")}` : ""}
          </p>
        </div>
        {item.buCost !== null && (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0 font-mono text-[10px] font-semibold text-primary">
            {item.buCost} BU
          </span>
        )}
      </header>

      {item.description && (
        <div className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground [&_p]:m-0 [&_strong]:font-semibold [&_em]:italic">
          <Markdown>{item.description}</Markdown>
        </div>
      )}

      {item.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-1.5 py-0 text-[10px]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {item.authorUsername && (
        <Link
          href={`/u/${item.authorUsername}`}
          className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {item.authorAvatarUrl ? (
            <img
              src={item.authorAvatarUrl}
              alt=""
              className="size-3.5 rounded-full"
            />
          ) : (
            <UserIcon className="size-3" />
          )}
          <span className="truncate">
            by{" "}
            <span className="font-semibold">
              {item.authorDisplayName ?? item.authorUsername}
            </span>
          </span>
        </Link>
      )}

      <footer className="mt-auto border-t border-border pt-1.5">
        <LikeForkBar
          targetType={item.targetType as GridLikeForkTargetType}
          targetId={item.targetId}
          initialLikes={item.likesCount}
          initialDislikes={item.dislikesCount}
          initialForks={item.forkCount}
          initialUserReaction={engagement.reactions[item.id] ?? null}
          authorId={item.authorId}
          authorUsername={item.authorUsername}
          currentUserId={currentUserInternalId}
          compact
        />
      </footer>
    </>
  );

  // The whole card is a click target. We render as a <button> when an action
  // is available (sandbox / library browse) so it's keyboard-accessible. The
  // card click handles the primary action — there are no inner View/Add
  // buttons to compete with the gesture.
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={cn(
          "flex min-h-[7rem] flex-col rounded-md border bg-card p-2 text-left transition-colors md:p-2.5",
          selected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary",
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <article
      className={cn(
        "flex min-h-[7rem] flex-col rounded-md border bg-card p-2 transition-colors md:p-2.5",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary",
      )}
    >
      {inner}
    </article>
  );
}

// LikeForkBar accepts a narrower union than LibraryTargetType (no EFFECT yet
// in some places). Cast here so the table can render any LibraryItem.
type GridLikeForkTargetType =
  | "PRIMITIVE"
  | "CAPABILITY"
  | "CHARACTER"
  | "ITEM"
  | "RACE_TEMPLATE"
  | "BACKGROUND_TEMPLATE"
  | "ARCHETYPE_TEMPLATE";