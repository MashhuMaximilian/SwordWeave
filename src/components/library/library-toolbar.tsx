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

import { ChevronDown, ChevronUp, Search } from "lucide-react";
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
}

const DEFAULT_TYPE_CHIPS: LibraryTypeChip[] = [
  { key: "ALL", label: "All" },
  { key: "PRIMITIVE", label: "Primitives" },
  { key: "CAPABILITY", label: "Capabilities" },
  { key: "EFFECT", label: "Effects" },
  { key: "RACE_TEMPLATE", label: "Races" },
  { key: "BACKGROUND_TEMPLATE", label: "Backgrounds" },
  { key: "ARCHETYPE_TEMPLATE", label: "Archetypes" },
];

export function LibraryToolbar({
  state,
  onStateChange,
  availableTypes = DEFAULT_TYPE_CHIPS,
  subKindParent,
  subKinds,
  activeSubKinds = [],
  onSubKindsChange,
  primitiveCategories = [],
  showAdvancedFilters = true,
  showSearch = true,
  searchPlaceholder = "Search by name…",
}: LibraryToolbarProps) {
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
      {showSearch ? (
        <div className="flex items-center gap-2">
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
        </div>
      ) : null}

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
                  "rounded-md px-3 py-1.5 text-xs transition-colors",
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
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
          <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2">
            {primitiveCategories.length > 0 &&
            (state.typeFilter === "PRIMITIVE" || state.typeFilter === "ALL") ? (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                  Category
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => update("category", "")}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs transition-colors",
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
                        "rounded-md px-2 py-1 text-xs transition-colors",
                        state.category === c.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/70",
                      )}
                    >
                      {c.label} ({c.count})
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => update("hasForks", !state.hasForks)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors",
                  state.hasForks
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/70",
                )}
              >
                <span>Only forked</span>
                {state.hasForks ? "✓" : ""}
              </button>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Min likes:</span>
                <input
                  type="number"
                  value={state.minLikes}
                  min={0}
                  onChange={(e) => update("minLikes", e.target.value)}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}