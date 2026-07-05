// Library preferences — persistent sort + view mode via cookies.
// Lightweight client-side persistence so the user doesn't reset their sort
// choice every time they hit the browse page.
//
// Stored as a single cookie `sw_lib_pref` with JSON:
//   { sort: "LIKES" | "RECENT" | "FORKS" | "ALPHABETICAL" | "ENGAGEMENT",
//     view: "GRID" | "LIST" }
// Falls back to defaults if missing/parse-error.

import { cookies } from "next/headers";
import type { LibrarySort } from "@/lib/publishing/library-query";

export type LibraryView = "GRID" | "LIST";

export interface LibraryPreferences {
  sort: LibrarySort;
  view: LibraryView;
}

const COOKIE_NAME = "sw_lib_pref";
const DEFAULT_PREFS: LibraryPreferences = {
  sort: "ENGAGEMENT",
  view: "GRID",
};

const VALID_SORTS: LibrarySort[] = [
  "LIKES",
  "RECENT",
  "FORKS",
  "ALPHABETICAL",
  "ENGAGEMENT",
];
const VALID_VIEWS: LibraryView[] = ["GRID", "LIST"];

/**
 * Server-side: read user library preferences from cookie.
 * Falls back to defaults if cookie missing or invalid.
 */
export async function readLibraryPreferences(): Promise<LibraryPreferences> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw);
    return {
      sort: VALID_SORTS.includes(parsed.sort) ? parsed.sort : DEFAULT_PREFS.sort,
      view: VALID_VIEWS.includes(parsed.view) ? parsed.view : DEFAULT_PREFS.view,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const LIBRARY_COOKIE_NAME = COOKIE_NAME;
export const LIBRARY_DEFAULT_PREFS = DEFAULT_PREFS;