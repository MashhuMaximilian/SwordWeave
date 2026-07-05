// Client component: sort + view-mode toggle that persists to a cookie.
// Renders the sort chips and a grid/list view toggle. On click, writes the
// new preference to `sw_lib_pref` cookie and navigates to a precomputed URL.

"use client";

import Link from "next/link";
import { Grid3x3, List } from "lucide-react";
import type { LibrarySort } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

interface SortUrlMap {
  ENGAGEMENT: string;
  LIKES: string;
  RECENT: string;
  FORKS: string;
  ALPHABETICAL: string;
}

interface ViewUrlMap {
  GRID: string;
  LIST: string;
}

interface Props {
  currentSort: LibrarySort;
  currentView: LibraryView;
  /** Pre-resolved URLs for each sort option, preserving current filters. */
  sortUrls: SortUrlMap;
  /** Pre-resolved URLs for each view option, preserving current filters. */
  viewUrls: ViewUrlMap;
}

const SORT_OPTIONS: { key: LibrarySort; label: string; hint: string }[] = [
  { key: "ENGAGEMENT", label: "Engagement", hint: "likes + forks − dislikes" },
  { key: "LIKES", label: "Most liked", hint: "net reactions" },
  { key: "FORKS", label: "Most forked", hint: "fork count" },
  { key: "RECENT", label: "Recent", hint: "newest first" },
  { key: "ALPHABETICAL", label: "A → Z", hint: "by name" },
];

function writeCookie(sort: LibrarySort, view: LibraryView) {
  if (typeof document === "undefined") return;
  const value = JSON.stringify({ sort, view });
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `sw_lib_pref=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function LibrarySortControl({
  currentSort,
  currentView,
  sortUrls,
  viewUrls,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Sort label + chips */}
      <span className="text-xs font-semibold uppercase text-muted-foreground">
        Sort
      </span>
      <div className="flex flex-wrap gap-1">
        {SORT_OPTIONS.map((opt) => {
          const active = currentSort === opt.key;
          return (
            <Link
              key={opt.key}
              href={sortUrls[opt.key]}
              onClick={() => writeCookie(opt.key, currentView)}
              title={opt.hint}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/70"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* View mode toggle */}
      <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
        <Link
          href={viewUrls.GRID}
          onClick={() => writeCookie(currentSort, "GRID")}
          title="Grid view"
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            currentView === "GRID"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Grid3x3 className="size-3.5" />
          Grid
        </Link>
        <Link
          href={viewUrls.LIST}
          onClick={() => writeCookie(currentSort, "LIST")}
          title="List view"
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            currentView === "LIST"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="size-3.5" />
          List
        </Link>
      </div>
    </div>
  );
}