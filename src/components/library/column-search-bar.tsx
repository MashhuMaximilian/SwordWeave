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
import { cn } from "@/lib/utils";

interface ColumnSearchBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  onOpenFilters?: () => void;
  hasActiveFilters?: boolean;
  placeholder?: string;
}

export function ColumnSearchBar({
  search,
  onSearchChange,
  onOpenFilters,
  hasActiveFilters = false,
  placeholder = "Search…",
}: ColumnSearchBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>
      {onOpenFilters ? (
        <button
          type="button"
          onClick={onOpenFilters}
          title="Open filters"
          aria-label="Open filters"
          className={cn(
            "relative inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
            hasActiveFilters
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:border-primary",
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
        </button>
      ) : null}
    </div>
  );
}
