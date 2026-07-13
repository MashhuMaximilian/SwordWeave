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
import { IconDisplay } from "@/components/icons/icon-display";
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
        // When invoked from the sandbox (showClearFilters=false), the
        // empty state previously pointed at /bu-market — a route that
        // does not exist. The user said "Browse BU Market should
        // get me either to library pre-filtered on primitives or in
        // sandbox/grammar pre filtered on primitives in primitives
        // tab." We pick the latter: the sandbox's grammar page
        // already pre-filters via the build sub-mode. The secondary
        // action jumps to the public library, filtered on primitives.
        primaryAction={
          showClearFilters
            ? { label: "Clear filters", href: "/library/browse" }
            : { label: "Build a primitive", href: "/sandbox/grammar?build=primitive" }
        }
        {...(showClearFilters
          ? {}
          : {
              secondaryAction: {
                label: "Browse primitives",
                href: "/library/browse?type=PRIMITIVE",
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
        <div
          className="grid auto-rows-fr grid-cols-2 gap-3 p-3 md:grid-cols-2 lg:grid-cols-3"
          style={{
            // The grid is sized to its CONTENT (no h-full). With
            // auto-rows-fr each row takes an equal share of whatever
            // height the grid naturally has — but since there's no
            // h-full, the grid stops growing once the cards are laid
            // out. The cards' own min-h-[7rem] ensures they're never
            // shorter than 7rem. The previous h-full+minmax(7rem,1fr)
            // combo forced rows to stretch to fill the entire scroll
            // container (e.g. a single 1-card row became 600px tall,
            // producing a tall card with empty space inside it). The
            // double-wrapper (flex h-full + flex-1 overflow-auto) is
            // what was creating the "empty space" — the scroll
            // container had leftover height that the grid then
            // distributed as stretched rows.
            //
            // Mobile gets 2 columns (was 1) so the grid view is
            // visually distinct from the list view at 393px wide.
            // Without this, the view toggle appeared to do nothing on
            // mobile (both views were 1-column stacks).
            gridAutoRows: "minmax(7rem, auto)",
          }}
        >
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
      {/* Phase 8: entity icon to the left of the text. Falls back to a
          muted glyph when no icon is set, so the layout doesn't shift
          between rows. */}
      <div className="shrink-0">
        {item.iconSource ? (
          <IconDisplay
            iconSource={item.iconSource}
            iconKey={item.iconKey}
            iconUrl={item.iconUrl}
            iconColor={item.iconColor}
            size={36}
            className="rounded-md"
            alt={item.name}
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {item.targetType.replace(/_/g, " ").slice(0, 3)}
          </div>
        )}
      </div>
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
      {/* Phase 8: header row with the icon sitting LEFT of the title —
          inline, not a separate full-width row. On mobile this matters
          because the previous 56px hero icon forced the card to render
          as two stacked rows (icon strip + text strip), which made the
          grid feel like a list of fat cards. Inlining the 28px icon
          next to a smaller title makes the grid feel dense again.

          Title size drops one step (text-base on the base mobile
          viewport, text-sm below md). The "sm" / "md" breakpoints
          inherit the size from the parent, so we only need one
          explicit class per tier. */}
      <header className="flex items-center gap-2">
        {item.iconSource ? (
          <IconDisplay
            iconSource={item.iconSource}
            iconKey={item.iconKey}
            iconUrl={item.iconUrl}
            iconColor={item.iconColor}
            size={28}
            alt={item.name}
            className="shrink-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {item.targetType.replace(/_/g, " ").slice(0, 3)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight md:text-sm">
            {item.name}
          </h3>
          <p className="mt-0 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
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

  // The whole card is a click target. We render as a div with role="button"
  // (not a real <button>) when onSelect is set so the LikeForkBar's nested
  // <button>s work without both click handlers firing. Native HTML
  // disallows interactive descendants inside <button> anyway, but React's
  // synthetic event system still bubbles nested button clicks to the
  // outer <button> in some browsers — which caused "click Like opens the
  // modal AND increments the count" double-firing. Using a div+role
  // makes the LikeForkBar's own stopPropagation reliable.
  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(item);
          }
        }}
        className={cn(
          "flex h-full min-h-[7rem] flex-col rounded-md border bg-card p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary md:p-2.5",
          selected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary",
        )}
      >
        {inner}
      </div>
    );
  }

  return (
    <article
      className={cn(
        "flex h-full min-h-[7rem] flex-col rounded-md border bg-card p-2 transition-colors md:p-2.5",
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
  | "ARCHETYPE_TEMPLATE"
  // Mashu 2026-07-09: builds now appear in the library grid.
  | "BUILD_TEMPLATE";