// Client component: sort + view-mode toggle that persists to a cookie.
// Renders the sort chips and a grid/list view toggle. On click, writes the
// new preference to `sw_lib_pref` cookie and navigates to a precomputed URL.

"use client";

import { useRouter } from "next/navigation";
import { CatalogueViewToggle } from "./catalogue-view-toggle";
import type { LibrarySort } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

interface SortUrlMap {
  ENGAGEMENT: string;
  LIKES: string;
  RECENT: string;
  FORKS: string;
  ALPHABETICAL: string;
  BU: string;
  BU_DESC?: string;
  ALPHABETICAL_DESC?: string;
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
  { key: "ENGAGEMENT", label: "Popular", hint: "likes + forks" },
  { key: "LIKES", label: "Most liked", hint: "like count" },
  { key: "FORKS", label: "Most forked", hint: "fork count" },
  { key: "RECENT", label: "Recent", hint: "newest first" },
  { key: "ALPHABETICAL", label: "Name A → Z", hint: "by name" },
  { key: "ALPHABETICAL_DESC", label: "Name Z → A", hint: "reverse name" },
  { key: "BU", label: "BU low → high", hint: "lowest cost first" },
  { key: "BU_DESC", label: "BU high → low", hint: "highest cost first" },
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
  const router = useRouter();
  return <div className="sw-library-sort">
    <label>Sort by<select value={currentSort} onChange={event=>{
      const sort=event.target.value as LibrarySort;
      writeCookie(sort,currentView);
      router.push(sortUrls[sort] ?? sortUrls.ALPHABETICAL);
    }}>{SORT_OPTIONS.filter(option=>!!sortUrls[option.key]).map(option=><option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    <CatalogueViewToggle view={currentView} onChange={view => { writeCookie(currentSort, view); router.push(viewUrls[view]); }} />
  </div>;
}
