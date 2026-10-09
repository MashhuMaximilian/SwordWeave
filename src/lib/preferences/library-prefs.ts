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
  "BU", "BU_DESC", "ALPHABETICAL_DESC",
  "LIKES",
  "RECENT",
  "FORKS",
  "ALPHABETICAL",
  "ENGAGEMENT",
];
const VALID_VIEWS: LibraryView[] = ["GRID", "LIST"];

/** Read the saved choice; grid is the default on every screen size. */
export async function readLibraryPreferences(): Promise<LibraryPreferences> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;

  let prefs: LibraryPreferences = DEFAULT_PREFS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      prefs = {
        sort: VALID_SORTS.includes(parsed.sort) ? parsed.sort : DEFAULT_PREFS.sort,
        view: VALID_VIEWS.includes(parsed.view) ? parsed.view : DEFAULT_PREFS.view,
      };
    } catch {
      prefs = DEFAULT_PREFS;
    }
  }

  return prefs;
}

export const LIBRARY_COOKIE_NAME = COOKIE_NAME;
export const LIBRARY_DEFAULT_PREFS = DEFAULT_PREFS;