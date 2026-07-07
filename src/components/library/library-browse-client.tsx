"use client";

// =============================================================================
// LibraryBrowseClient — client wrapper that owns the toolbar state and pushes
// URL changes via Next router.
//
// Layout: <LibraryToolbar /> + <LibraryTable /> + an iframe detail modal.
//
// When the user taps a row, we open a full-size DetailModal that loads the
// canonical detail page (/library/item/[id]) in an iframe. The user gets the
// real source page rendered inline (not a stripped-down card preview) while
// keeping the browse list visible behind. ESC / backdrop click closes it.
// =============================================================================

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { LibraryTable } from "@/components/library/library-table";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { DetailModal } from "@/components/ui/detail-modal";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "@/components/library/library-table";
import type { LibraryToolbarState } from "@/components/library/library-toolbar";

interface Props {
  initialItems: LibraryItem[];
  total: number;
  page: number;
  totalPages: number;
  initialState: LibraryToolbarState;
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
  /**
   * Distinct item tags (with counts) for the chip-based tag filter
   * in the toolbar. Server-loaded so the chips render in a single
   * round-trip; the client just toggles the active set and pushes
   * the new tag list to the URL.
   */
  itemTags?: Array<{ value: string; label: string; count: number }>;
  /**
   * Currently-active tag filter values, mirrored from the URL ?tag=
   * param. Passed so the chips can render their active state on the
   * initial render (the toolbar derives the active set from
   * `state.tags`, but we also need it to highlight chips on first
   * paint before the toolbar mounts its effect).
   */
  activeTags?: string[];
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
}

export function LibraryBrowseClient({
  initialItems,
  total,
  page,
  totalPages,
  initialState,
  primitiveCategories,
  itemTags = [],
  activeTags = [],
  engagement,
  currentUserInternalId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);

  const state = useMemo<LibraryToolbarState>(() => initialState, [initialState]);

  const pushUrl = useCallback(
    (next: LibraryToolbarState, overridePage?: number) => {
      const params = new URLSearchParams();
      if (next.typeFilter !== "ALL") params.set("type", next.typeFilter);
      if (next.category) params.set("category", next.category);
      if (next.search) params.set("q", next.search);
      if (next.author) params.set("author", next.author);
      if (next.minLikes) params.set("minLikes", next.minLikes);
      if (next.hasForks) params.set("hasForks", "1");
      if (next.sort !== "ENGAGEMENT") params.set("sort", next.sort);
      if (next.view !== "GRID") params.set("view", next.view);
      // Tag filter — comma-separated. Only emit the param when the
      // active type is ITEM (other types ignore the tag filter
      // server-side, and emitting it for those would be confusing).
      if (
        next.typeFilter === "ITEM" &&
        next.tags &&
        next.tags.trim().length > 0
      ) {
        params.set("tag", next.tags);
      }
      const nextPage = overridePage ?? 0;
      if (nextPage > 0) params.set("page", String(nextPage));
      const qs = params.toString();
      router.push(qs ? `/library/browse?${qs}` : "/library/browse");
    },
    [router],
  );

  const onStateChange = useCallback(
    (next: LibraryToolbarState) => {
      pushUrl(next, 0);
    },
    [pushUrl],
  );

  const onPageChange = useCallback(
    (newPage: number) => {
      pushUrl(state, newPage);
    },
    [pushUrl, state],
  );

  // When the user clicks a row, open the iframe detail modal.
  const onRowSelect = useCallback((item: LibraryItem) => {
    setSelectedItem(item);
  }, []);

  // Right-side filter panel slot: full toolbar lives inside the panel.
  // The column header has a search bar + filter-open button.
  // Memoize the slot content to avoid the re-render loop that previously
  // produced a noticeable delay between "tap Show filters" and seeing chips.
  const { setFilterPanelOpen } = useGlobalControls();
  const filterPanelContent = useMemo(
    () => (
      <div className="space-y-3">
        <LibraryToolbar
          state={state}
          onStateChange={onStateChange}
          primitiveCategories={primitiveCategories}
          // Tag chips for items — only shown by the toolbar when the
          // active type filter is ITEM. The activeTags array mirrors
          // the URL ?tag= param so chips render in their active state
          // on first paint (the toolbar also derives the active set
          // from `state.tags`, but `activeTags` is the source of
          // truth for the initial highlight).
          itemTags={itemTags}
          activeTags={activeTags}
          showSearch={true}
          showAdvancedFilters={true}
          forceExpandFilters
        />
      </div>
    ),
    [state, onStateChange, primitiveCategories, itemTags, activeTags],
  );
  useFilterSlot(filterPanelContent);

  const hasActiveFilters =
    state.typeFilter !== "ALL" ||
    state.category !== "" ||
    state.author !== "" ||
    state.minLikes !== "" ||
    state.hasForks ||
    state.sort !== "ENGAGEMENT";

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <ColumnSearchBar
          search={state.search}
          onSearchChange={(s: string) =>
            onStateChange({ ...state, search: s })
          }
          onOpenFilters={() => setFilterPanelOpen(true)}
          hasActiveFilters={hasActiveFilters}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <LibraryTable
          items={initialItems}
          view={state.view}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
          onSelect={onRowSelect}
          selectedKey={selectedItem?.id ?? null}
          pagination={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={onPageChange}
              />
            ) : null
          }
          showClearFilters={false}
          emptyTitle="No entries match"
          emptyDescription="Try a different filter, broader search, or another sort."
        />
      </div>

      {/* Iframe detail modal — renders the full canonical detail page when
          the user taps a row. ESC / backdrop / close button dismiss. */}
      <DetailModal
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name ?? ""}
        size="lg"
      >
        {selectedItem ? (
          // Inline detail preview (was previously an iframe loading
          // /library/item/<id>). The iframe was susceptible to a class
          // of cache/iframe-related rendering issues — and on Vercel
          // + Clerk + iframes, certain request contexts got stuck on
          // a stale DATABASE_URL error even after the server was
          // healthy. Inline rendering eliminates that entire failure
          // mode.
          //
          // The summary shows: name, description, BU, tags, author,
          // engagement counts, and an "Open full page" link for the
          // canonical detail view.
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-semibold text-primary">
                {selectedItem.buCost ?? 0} BU
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-wide">
                {selectedItem.targetType.replace(/_/g, " ").toLowerCase()}
              </span>
              {selectedItem.category && (
                <span className="rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-wide">
                  {selectedItem.category.replace(/_/g, " ")}
                </span>
              )}
            </div>
            {selectedItem.description && (
              <div className="text-sm leading-relaxed text-foreground">
                {selectedItem.description}
              </div>
            )}
            {selectedItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {selectedItem.authorUsername && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>by</span>
                <span className="font-semibold">
                  {selectedItem.authorDisplayName ?? selectedItem.authorUsername}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>♥ {selectedItem.likesCount}</span>
              <span>★ {selectedItem.forkCount} forks</span>
            </div>
            <div className="border-t border-border pt-3">
              <a
                href={`/library/item/${selectedItem.id}`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Open full source page →
              </a>
            </div>
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      {page > 0 ? (
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Previous
        </button>
      ) : (
        <span />
      )}
      <span className="text-xs text-muted-foreground">
        Page {page + 1} of {totalPages} ({total.toLocaleString()} total)
      </span>
      {page + 1 < totalPages ? (
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          className="text-muted-foreground hover:text-foreground"
        >
          Next →
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}