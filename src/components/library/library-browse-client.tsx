"use client";

// =============================================================================
// LibraryBrowseClient — client wrapper that owns the toolbar state and pushes
// URL changes via Next router. Replaces the inline URL-driven <form> + filter
// chips that /library/browse shipped with so the same LibraryToolbar is
// reusable across the sandbox left column.
// =============================================================================

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  LibraryToolbar,
  type LibraryToolbarState,
  EMPTY_LIBRARY_TOOLBAR_STATE,
} from "@/components/library/library-toolbar";
import { LibraryTable } from "@/components/library/library-table";
import type { LibraryItem, LibraryTargetType } from "@/lib/publishing/library-query";
import type { LibrarySort } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import type { LibraryEngagement } from "@/components/library/library-table";

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

export type { LibraryToolbarState } from "@/components/library/library-toolbar";
export type { LibraryEngagement } from "@/components/library/library-table";

function parseSort(value: string | null): LibrarySort {
  if (
    value === "LIKES" ||
    value === "RECENT" ||
    value === "FORKS" ||
    value === "ALPHABETICAL" ||
    value === "ENGAGEMENT"
  ) {
    return value;
  }
  return "ENGAGEMENT";
}

function parseView(value: string | null): LibraryView {
  return value === "LIST" ? "LIST" : "GRID";
}

function parseType(value: string | null): LibraryTargetType | "ALL" {
  if (
    value === "PRIMITIVE" ||
    value === "CAPABILITY" ||
    value === "EFFECT" ||
    value === "CHARACTER" ||
    value === "ITEM" ||
    value === "RACE_TEMPLATE" ||
    value === "BACKGROUND_TEMPLATE" ||
    value === "ARCHETYPE_TEMPLATE"
  ) {
    return value;
  }
  return "ALL";
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
      // Any filter/sort/view change resets pagination to 0.
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

  return (
    <div className="space-y-6">
      <LibraryToolbar
        state={state}
        onStateChange={onStateChange}
        primitiveCategories={primitiveCategories}
      />
      <section>
        <LibraryTable
          items={initialItems}
          view={state.view}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
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
      </section>
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
    <div className="mt-6 flex items-center justify-between gap-2 text-sm">
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

// Re-export parse helpers so the server page can use them without
// duplicating logic.
export { parseSort, parseView, parseType, EMPTY_LIBRARY_TOOLBAR_STATE };