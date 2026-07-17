// Client-safe LibraryItem sort helper.
//
// Lives in its own module on purpose: it imports `LibraryItem` / `LibrarySort`
// as TYPES only (erased at compile time), so pulling this into a client
// component does NOT drag in `library-query.ts` (which transitively imports
// the server-only DB client and `@next/env` → `fs`). Keep all imports here
// type-only.

import type { LibraryItem, LibrarySort } from "@/lib/publishing/library-query";

/**
 * Sort a list of LibraryItems by the given LibrarySort. BU cost sorts
 * ascending (nulls last) so the cheapest entries surface first. Pure —
 * returns a new array, never mutates the input.
 */
export function sortLibraryItems(
  items: LibraryItem[],
  sort: LibrarySort,
): LibraryItem[] {
  const arr = items.slice();
  switch (sort) {
    case "BU":
      return arr.sort((a, b) => {
        const av = a.buCost ?? Number.POSITIVE_INFINITY;
        const bv = b.buCost ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
    case "ALPHABETICAL":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "RECENT":
      return arr.sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      );
    case "LIKES":
      return arr.sort((a, b) => b.likesCount - a.likesCount);
    case "FORKS":
      return arr.sort((a, b) => b.forkCount - a.forkCount);
    case "ENGAGEMENT":
    default:
      return arr.sort(
        (a, b) =>
          b.netReactions - a.netReactions ||
          b.likesCount - a.likesCount ||
          b.forkCount - a.forkCount,
      );
  }
}
