"use client";

// =============================================================================
// LibraryToolbar — controlled filter + sort + view toolbar.
//
// All state lives in the parent. The toolbar is purely presentational.
//
// The available type-filter chips are gated by the `availableTypes` prop so
// the sandbox left column can hide chips that don't make sense for the
// current build mode (e.g. hiding the Capability chip when in Primitive mode).
//
// Sub-kind filtering (Templates → RACE/BACKGROUND/ARCHETYPE) is supported via
// the `subKindAvailable` + `subKinds` + `onSubKindsChange` props. When set, a
// second chip row appears under the type chips, scoped to the active type.
//
// This replaces the inline filter UI that /library/browse shipped with so the
// same controls can be reused in the sandbox left column.
// =============================================================================

import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LibraryTargetType } from "@/lib/publishing/library-query";
import type { LibrarySort } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

export interface LibraryToolbarState {
  search: string;
  sort: LibrarySort;
  view: LibraryView;
  typeFilter: LibraryTargetType | "ALL";
  category: string;
  author: string;
  minLikes: string;
  hasForks: boolean;
  /** Advanced filters (all optional). */
  minForks?: string;
  minBu?: string;
  maxBu?: string;
  fromDate?: string;
  toDate?: string;
  /** "ANY" (default), "PUBLIC", or "PRIVATE". */
  visibility?: "ANY" | "PUBLIC" | "PRIVATE";
  mirrorableOnly?: boolean;
  /** Comma-separated tag list. */
  tags?: string;
}

export const EMPTY_LIBRARY_TOOLBAR_STATE: LibraryToolbarState = {
  search: "",
  sort: "ENGAGEMENT",
  view: "GRID",
  typeFilter: "ALL",
  category: "",
  author: "",
  minLikes: "",
  hasForks: false,
  minForks: "",
  minBu: "",
  maxBu: "",
  fromDate: "",
  toDate: "",
  visibility: "ANY",
  mirrorableOnly: false,
  tags: "",
};

export interface LibraryTypeChip {
  key: LibraryTargetType | "ALL";
  label: string;
}

export interface LibrarySubKindChip {
  key: string;
  label: string;
}

interface LibraryToolbarProps {
  state: LibraryToolbarState;
  onStateChange: (next: LibraryToolbarState) => void;
  /**
   * The chip row shown above the result set. If omitted, a default set
   * (ALL/PRIMITIVE/CAPABILITY/EFFECT/RACE/BACKGROUND/ARCHETYPE) is rendered.
   */
  availableTypes?: LibraryTypeChip[];
  /**
   * If provided, an additional sub-chip row appears under the type chips.
   * Visible only when the active type filter matches `subKindParent`.
   */
  subKindParent?: LibraryTargetType;
  subKinds?: LibrarySubKindChip[];
  activeSubKinds?: string[];
  onSubKindsChange?: (next: string[]) => void;
  /**
   * Primitive categories for the "Category" chip row in advanced filters.
   * Pass empty array to hide the section.
   */
  primitiveCategories?: Array<{ value: string; label: string; count: number }>;
  /**
   * Distinct item tags (with counts) for the chip-based tag filter.
   * Rendered as a chip row above the type chips when the active type
   * is ITEM. Clicking a chip toggles it in the active set and pushes
   * the new tag list to the URL.
   */
  itemTags?: Array<{ value: string; label: string; count: number }>;
  /**
   * Initial active tag set. Mirrors the URL ?tag= param so chips
   * render in their active state on first paint. Once mounted, the
   * toolbar derives the active set from `state.tags` instead.
   */
  activeTags?: string[];
  /**
   * If true, render advanced filters (category, hasForks, minLikes).
   * Defaults to true.
   */
  showAdvancedFilters?: boolean;
  /**
   * If true, render the search bar. Defaults to true.
   */
  showSearch?: boolean;
  /**
   * Placeholder for the search input.
   */
  searchPlaceholder?: string;
  /**
   * When the toolbar is mounted inside the right-side GlobalControls filter
   * panel, the user has already explicitly chosen to see filters — there is
   * no point collapsing the chip rows on mobile. Setting this to true makes
   * the toolbar always render its filter sections, regardless of viewport.
   */
  forceExpandFilters?: boolean;
}

const DEFAULT_TYPE_CHIPS: LibraryTypeChip[] = [
  { key: "ALL", label: "All" },
  { key: "PRIMITIVE", label: "Primitives" },
  { key: "CAPABILITY", label: "Capabilities" },
  { key: "EFFECT", label: "Effects" },
  { key: "ITEM", label: "Items" },
  { key: "RACE_TEMPLATE", label: "Races" },
  { key: "BACKGROUND_TEMPLATE", label: "Backgrounds" },
  { key: "ARCHETYPE_TEMPLATE", label: "Archetypes" },
];

function FilterField({
  label,
  children,
  hint,
  id,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  id?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex flex-col gap-1 rounded-md border border-border/60 bg-card/50 p-2",
        className,
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[10px] leading-tight text-muted-foreground/70">{hint}</span>
      ) : null}
    </label>
  );
}

export function LibraryToolbar({
  state,
  onStateChange,
  availableTypes = DEFAULT_TYPE_CHIPS,
  subKindParent,
  subKinds,
  activeSubKinds = [],
  onSubKindsChange,
  primitiveCategories = [],
  itemTags = [],
  activeTags = [],
  showAdvancedFilters = true,
  showSearch = true,
  searchPlaceholder = "Search by name…",
  forceExpandFilters = false,
}: LibraryToolbarProps) {
  // Mobile-only: filters panel collapsed by default to give the result set
  // more vertical real-estate on a 393×852 viewport. Desktop ignores this.
  // When the toolbar is mounted inside the GlobalControls filter panel
  // (`forceExpandFilters=true`), the user has already explicitly opened
  // filters — start with the chip rows visible.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(forceExpandFilters);

  // Active tag set — derived from `state.tags` (comma-separated) AFTER
  // the toolbar mounts and re-derives on every state change. The
  // `activeTags` prop seeds the initial value for the first paint.
  const [tagState, setTagState] = useState<string[]>(activeTags);
  // Sync tagState with the URL-mirrored state.tags. We parse the
  // comma-separated value into a deduped array. Effect runs whenever
  // state.tags changes (URL change → pushUrl → state.tags).
  useEffect(() => {
    const parsed = (state.tags ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setTagState((prev) => {
      if (
        prev.length === parsed.length &&
        prev.every((p, i) => p === parsed[i])
      ) {
        return prev;
      }
      return parsed;
    });
  }, [state.tags]);

  // Toggle a tag in the active set + push the new value to the parent.
  // Multiple selected tags are AND-matched by the server. Clicking an
  // already-active tag removes it.
  function toggleTag(value: string) {
    const next = tagState.includes(value)
      ? tagState.filter((t) => t !== value)
      : [...tagState, value];
    setTagState(next);
    update("tags", next.join(","));
  }

  const hasActiveFilters =
    state.typeFilter !== "ALL" ||
    state.category !== "" ||
    state.author !== "" ||
    state.minLikes !== "" ||
    state.hasForks ||
    state.sort !== "ENGAGEMENT" ||
    activeSubKinds.length > 0 ||
    tagState.length > 0;

  function update<K extends keyof LibraryToolbarState>(
    key: K,
    value: LibraryToolbarState[K],
  ) {
    onStateChange({ ...state, [key]: value });
  }

  function toggleSubKind(key: string) {
    if (!onSubKindsChange) return;
    if (activeSubKinds.includes(key)) {
      onSubKindsChange(activeSubKinds.filter((k) => k !== key));
    } else {
      onSubKindsChange([...activeSubKinds, key]);
    }
  }

  const showSubKinds =
    subKindParent !== undefined &&
    subKinds !== undefined &&
    subKinds.length > 0 &&
    state.typeFilter === subKindParent;

  return (
    <div className="space-y-3">
      {/* Search bar (when enabled) + mobile filter toggle. The toggle lives
          alongside the search bar but is independently rendered — when search
          is hidden (e.g. sandbox Library column) we still need the toggle. */}
      <div className="flex items-center gap-2">
        {showSearch ? (
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={state.search}
              onChange={(e) => update("search", e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
        ) : (
          <div className="flex-1 md:hidden" aria-hidden="true" />
        )}
        {/* Mobile-only filter toggle — opens the filter panel below. Shown
            even when the search bar is hidden so the sandbox can still
            collapse its filters on mobile. Desktop ignores this entirely.
            Suppressed when forceExpandFilters is true (the toolbar is already
            inside the global filter panel — no need for a collapse toggle). */}
        {forceExpandFilters ? null : (
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="library-toolbar-filters"
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors md:hidden",
              mobileFiltersOpen || hasActiveFilters
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary",
            )}
            title={mobileFiltersOpen ? "Hide filters" : "Show filters"}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {hasActiveFilters && !mobileFiltersOpen ? (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 text-[10px] font-bold text-primary">
                •
              </span>
            ) : null}
            {mobileFiltersOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Filter panel — always visible on desktop, collapsible on mobile.
          When `forceExpandFilters` is true (toolbar mounted in the global
          filter panel), the user has already chosen to see filters — keep
          them open regardless of viewport. */}
      <div
        id="library-toolbar-filters"
        className={cn(
          "space-y-3",
          forceExpandFilters
            ? "block"
            : mobileFiltersOpen
              ? "block"
              : "hidden md:block",
        )}
      >
        {/* Sort + view toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Sort
          </span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["ENGAGEMENT", "Engagement"],
                ["LIKES", "Most liked"],
                ["FORKS", "Most forked"],
                ["RECENT", "Recent"],
                ["ALPHABETICAL", "A → Z"],
              ] as const
            ).map(([key, label]) => {
              const active = state.sort === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => update("sort", key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => update("view", "GRID")}
              title="Grid view"
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs",
                state.view === "GRID"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => update("view", "LIST")}
              title="List view"
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs",
                state.view === "LIST"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              List
            </button>
          </div>
        </div>

        {/* Tag chips (visible only when the active type is ITEM and the
            parent passed `itemTags`). Server-loaded list of distinct tags
            across public items. Multiple selected tags are AND-matched
            server-side (every listed tag must be present on the item). */}
        {itemTags.length > 0 && state.typeFilter === "ITEM" ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </span>
            {itemTags.map((chip) => {
              const active = tagState.includes(chip.value);
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => toggleTag(chip.value)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70",
                  )}
                  title={
                    active
                      ? `Click to remove "${chip.value}" from the filter`
                      : `Click to filter by "${chip.value}"`
                  }
                >
                  {chip.label}{" "}
                  <span className="ml-0.5 opacity-70">({chip.count})</span>
                </button>
              );
            })}
            {tagState.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setTagState([]);
                  update("tags", "");
                }}
                className="ml-auto rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium hover:border-primary"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Type chips */}
        <div className="flex flex-wrap gap-2">
          {availableTypes.map((chip) => {
            const active = state.typeFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => update("typeFilter", chip.key)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Sub-kind chips (visible only when active type matches the parent) */}
        {showSubKinds ? (
          <div className="flex flex-wrap gap-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sub-kind
            </span>
            {subKinds!.map((chip) => {
              const active = activeSubKinds.includes(chip.key);
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => toggleSubKind(chip.key)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Advanced filters */}
        {showAdvancedFilters ? (
          <details className="rounded-md border border-border bg-card/50">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
              <span>Advanced filters</span>
              <ChevronDown className="size-4 md:hidden" />
              <ChevronUp className="hidden size-4 md:block" />
            </summary>
            <div className="grid gap-3 border-t border-border p-3 md:grid-cols-3">
              {/* Category — only for primitives */}
              {primitiveCategories.length > 0 &&
              (state.typeFilter === "PRIMITIVE" || state.typeFilter === "ALL") ? (
                <FilterField label="Category" id="filter-category">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => update("category", "")}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                        !state.category
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/70",
                      )}
                    >
                      All
                    </button>
                    {primitiveCategories.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => update("category", c.value)}
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                          state.category === c.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary hover:bg-secondary/70",
                        )}
                      >
                        {c.label} ({c.count})
                      </button>
                    ))}
                  </div>
                </FilterField>
              ) : null}

              {/* Author username */}
              <FilterField label="Author" id="filter-author">
                <input
                  id="filter-author"
                  type="text"
                  value={state.author}
                  onChange={(e) => update("author", e.target.value)}
                  placeholder="username"
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>

              {/* Min likes */}
              <FilterField label="Min likes" id="filter-min-likes">
                <input
                  id="filter-min-likes"
                  type="number"
                  value={state.minLikes}
                  min={0}
                  onChange={(e) => update("minLikes", e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>

              {/* Min forks */}
              <FilterField label="Min forks" id="filter-min-forks">
                <input
                  id="filter-min-forks"
                  type="number"
                  value={state.minForks ?? ""}
                  min={0}
                  onChange={(e) => update("minForks", e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>

              {/* Min BU cost */}
              <FilterField label="Min BU" id="filter-min-bu">
                <input
                  id="filter-min-bu"
                  type="number"
                  value={state.minBu ?? ""}
                  min={0}
                  onChange={(e) => update("minBu", e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>

              {/* Max BU cost */}
              <FilterField label="Max BU" id="filter-max-bu">
                <input
                  id="filter-max-bu"
                  type="number"
                  value={state.maxBu ?? ""}
                  min={0}
                  onChange={(e) => update("maxBu", e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>

              {/* Date range */}
              <FilterField label="From" id="filter-from-date">
                <input
                  id="filter-from-date"
                  type="date"
                  value={state.fromDate ?? ""}
                  onChange={(e) => update("fromDate", e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>
              <FilterField label="To" id="filter-to-date">
                <input
                  id="filter-to-date"
                  type="date"
                  value={state.toDate ?? ""}
                  onChange={(e) => update("toDate", e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>

              {/* Visibility: Public / Private / Any */}
              <FilterField label="Visibility" id="filter-visibility">
                <div className="flex flex-wrap gap-1">
                  {(["ANY", "PUBLIC", "PRIVATE"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update("visibility", v)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                        (state.visibility ?? "ANY") === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/70",
                      )}
                    >
                      {v === "ANY" ? "Any" : v === "PUBLIC" ? "Public" : "Private"}
                    </button>
                  ))}
                </div>
              </FilterField>

              {/* Mirrorable toggle */}
              <FilterField label="Mirrorable" id="filter-mirrorable">
                <button
                  type="button"
                  onClick={() => update("mirrorableOnly", !state.mirrorableOnly)}
                  aria-pressed={!!state.mirrorableOnly}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] transition-colors",
                    state.mirrorableOnly
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70",
                  )}
                >
                  <span>Only mirrorable</span>
                  {state.mirrorableOnly ? "✓" : ""}
                </button>
              </FilterField>

              {/* Forked only */}
              <FilterField label="Forked" id="filter-forked">
                <button
                  type="button"
                  onClick={() => update("hasForks", !state.hasForks)}
                  aria-pressed={!!state.hasForks}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] transition-colors",
                    state.hasForks
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70",
                  )}
                >
                  <span>Only forked</span>
                  {state.hasForks ? "✓" : ""}
                </button>
              </FilterField>

              {/* Tags */}
              <FilterField label="Tags" id="filter-tags" className="md:col-span-2">
                <input
                  id="filter-tags"
                  type="text"
                  value={state.tags ?? ""}
                  onChange={(e) => update("tags", e.target.value)}
                  placeholder="comma-separated"
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] outline-none focus:border-primary"
                />
              </FilterField>

              {/* Clear all */}
              <FilterField label=" " id="filter-clear">
                <button
                  type="button"
                  onClick={() =>
                    onStateChange({
                      ...state,
                      category: "",
                      author: "",
                      minLikes: "",
                      minForks: "",
                      minBu: "",
                      maxBu: "",
                      fromDate: "",
                      toDate: "",
                      visibility: "ANY",
                      mirrorableOnly: false,
                      hasForks: false,
                      tags: "",
                    })
                  }
                  className="h-7 w-full rounded-md border border-border bg-background text-[11px] font-medium hover:bg-accent"
                >
                  Clear filters
                </button>
              </FilterField>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}