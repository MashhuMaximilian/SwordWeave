// Library preferences — persistent sort + view mode via cookies.
// Lightweight client-side persistence so the user doesn't reset their sort
// choice every time they hit the browse page.
//
// Stored as a single cookie `sw_lib_pref` with JSON:
//   { sort: "LIKES" | "RECENT" | "FORKS" | "ALPHABETICAL" | "ENGAGEMENT",
//     view: "GRID" | "LIST" }
// Falls back to defaults if missing/parse-error.

import { cookies, headers } from "next/headers";
import type { LibrarySort } from "@/lib/publishing/library-query";

export type LibraryView = "GRID" | "LIST";

export interface LibraryPreferences {
  sort: LibrarySort;
  view: LibraryView;
}

const COOKIE_NAME = "sw_lib_pref";
const DEFAULT_PREFS: LibraryPreferences = {
  sort: "ENGAGEMENT",
  view: "LIST",
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
 *
 * Mobile override: the user reported that GRID on a 393px viewport
 * is cramped and the 2-col mobile layout fights the list. We force
 * LIST on mobile regardless of the cookie value — the desktop
 * preference is preserved in the cookie for when the same browser
 * later opens the page on a wide screen. Detection is User-Agent
 * based (the server can't read window.innerWidth). The heuristic
 * is intentionally broad: any device that self-identifies as mobile
 * OR tablet gets the list view. Bots are passed through (no UA
 * override) so analytics / crawlers see the saved preference.
 */
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

  if (prefs.view === "GRID" && (await isMobileUserAgent())) {
    // Force list view on phones/tablets. The cookie still says GRID so
    // when the user opens the site on desktop the saved preference is
    // restored — only the active render is forced to list.
    return { ...prefs, view: "LIST" };
  }
  return prefs;
}

async function isMobileUserAgent(): Promise<boolean> {
  // Touch devices, phones, tablets. Heuristic — not perfect — but
  // matches the same devices Tailwind's `md:` breakpoint would
  // consider "small" for our purposes.
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (!ua) return false;
  // Common crawler / preview / library tokens that should NOT be
  // classified as mobile even if they include a phone UA elsewhere
  // (e.g. Slack's link preview fetcher can spoof a mobile UA).
  if (/bot|spider|crawl|preview|lighthouse|headless/i.test(ua)) return false;
  return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export const LIBRARY_COOKIE_NAME = COOKIE_NAME;
export const LIBRARY_DEFAULT_PREFS = DEFAULT_PREFS;