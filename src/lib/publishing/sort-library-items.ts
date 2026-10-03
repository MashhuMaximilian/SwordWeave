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
  const tie = (a: LibraryItem, b: LibraryItem) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  const time = (item: LibraryItem) => item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  switch (sort) {
    case "BU":
      return arr.sort((a, b) => {
        const av = a.buCost ?? Number.POSITIVE_INFINITY;
        const bv = b.buCost ?? Number.POSITIVE_INFINITY;
        return av - bv || tie(a, b);
      });
    case "BU_DESC":
      return arr.sort((a, b) => {
        if (a.buCost === null) return b.buCost === null ? tie(a,b) : 1;
        if (b.buCost === null) return -1;
        return b.buCost - a.buCost || tie(a,b);
      });
    case "ALPHABETICAL_DESC":
      return arr.sort((a,b) => b.name.localeCompare(a.name) || a.id.localeCompare(b.id));
    case "ALPHABETICAL":
      return arr.sort((a, b) => tie(a,b));
    case "RECENT":
      return arr.sort(
        (a, b) =>
          time(b) - time(a) || tie(a,b),
      );
    case "LIKES":
      return arr.sort((a, b) => b.likesCount - a.likesCount || time(b)-time(a) || tie(a,b));
    case "FORKS":
      return arr.sort((a, b) => b.forkCount - a.forkCount || b.likesCount-a.likesCount || tie(a,b));
    case "ENGAGEMENT":
    default:
      return arr.sort((a, b) => {
        const aScore = a.likesCount * 2 + a.forkCount * 3;
        const bScore = b.likesCount * 2 + b.forkCount * 3;
        return (
          bScore - aScore ||
          b.likesCount - a.likesCount ||
          time(b) - time(a) || tie(a,b)
        );
      });
  }
}
