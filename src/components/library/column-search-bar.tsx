"use client";

// =============================================================================
// ColumnSearchBar — search input + filter open button for sandbox/library columns.
//
// When a page uses GlobalControls' right-side filter panel, the search bar stays
// in the column header for quick access and the "Filters" button opens the panel.
// Pages that don't have a filter panel can still render the search alone by
// passing `onOpenFilters` undefined.
// =============================================================================

import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CatalogueViewToggle } from "./catalogue-view-toggle";
import type { LibraryView } from "@/lib/preferences/library-prefs";

interface ColumnSearchBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  onOpenFilters?: () => void;
  hasActiveFilters?: boolean;
  placeholder?: string;
  view?: LibraryView;
  onViewChange?: (view: LibraryView) => void;
}

export function ColumnSearchBar({
  search,
  onSearchChange,
  onOpenFilters,
  hasActiveFilters = false,
  placeholder = "Search…",
  view,
  onViewChange,
}: ColumnSearchBarProps) {
  const [draft, setDraft] = useState(search);
  const [lastCommittedSearch, setLastCommittedSearch] = useState(search);

  if (search !== lastCommittedSearch) {
    setLastCommittedSearch(search);
    setDraft(search);
  }
  useEffect(() => {
    if (draft === search) return;
    const timer = window.setTimeout(() => onSearchChange(draft), 350);
    return () => window.clearTimeout(timer);
  }, [draft, onSearchChange, search]);

  return (
    <div className="flex items-center gap-2">
      <div className="v12-library-search-field relative min-w-0 flex-1">
        <Search className="v12-library-search-icon pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>
      {view && onViewChange ? <CatalogueViewToggle view={view} onChange={onViewChange} /> : null}
      {onOpenFilters ? (
        <button
          type="button"
          onClick={onOpenFilters}
          title="Open filters"
          aria-label="Open filters"
          className={cn("sw-metal-button sw-catalogue-filter-toggle", hasActiveFilters && "is-filtered")}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          {hasActiveFilters && <span className="sw-catalogue-filter-dot" aria-label="Filters applied" />}
        </button>
      ) : null}
    </div>
  );
}
