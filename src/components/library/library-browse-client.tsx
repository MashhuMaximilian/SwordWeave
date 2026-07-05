"use client";

// =============================================================================
// LibraryBrowseClient — client wrapper that owns the toolbar state and pushes
// URL changes via Next router. Now hosts the two-pane LibrarySplitView.
//
// Layout: <LibraryToolbar /> + <LibrarySplitView>
// The split view renders the table on one side and the preview pane on
// the other (desktop horizontal, mobile vertical). Selecting a row in the
// table updates `selectedItem`, which renders the full preview.
// =============================================================================

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  LibraryToolbar,
  EMPTY_LIBRARY_TOOLBAR_STATE,
} from "@/components/library/library-toolbar";
import { LibraryTable } from "@/components/library/library-table";
import { LibrarySplitView } from "@/components/library/library-split-view";
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

  // When the user clicks a row, capture the full LibraryItem so the
  // preview pane can render all available fields.
  const onRowSelect = useCallback((item: LibraryItem) => {
    setSelectedItem(item);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-4 py-3">
        <LibraryToolbar
          state={state}
          onStateChange={onStateChange}
          primitiveCategories={primitiveCategories}
        />
      </div>
      <div className="min-h-0 flex-1">
        <LibrarySplitView
          selectedItem={selectedItem}
          onSelectItem={(item) => setSelectedItem(item)}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
          tableContent={
            <LibraryTable
              items={initialItems}
              view={state.view}
              engagement={engagement}
              currentUserInternalId={currentUserInternalId}
              onSelect={onRowSelect}
              selectedKey={selectedItem?.id ?? null}
              pagination={null}
              showClearFilters={false}
              emptyTitle="No entries match"
              emptyDescription="Try a different filter, broader search, or another sort."
            />
          }
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
        />
      </div>
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