// =============================================================================
// Library URL params parser — SERVER SAFE.
//
// Parses the raw string|undefined values from Next.js searchParams into
// typed LibrarySort, LibraryView, and LibraryTargetType values, falling
// back to defaults when the value is missing or unrecognized.
//
// IMPORTANT: This file must remain server-safe (no "use client" directive)
// because /library/browse/page.tsx is a server component that calls these
// helpers directly during render. If you put them inside a "use client"
// module, Next.js will throw an error when the server page tries to call them.
// =============================================================================

import type { LibrarySort, LibraryTargetType } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

export function parseSort(value: string | undefined | null): LibrarySort {
  if (
    value === "LIKES" ||
    value === "RECENT" ||
    value === "FORKS" ||
    value === "ALPHABETICAL" ||
    value === "ENGAGEMENT"
  ) {
    return value;
  }
  return "ENGAGEMENT";
}

export function parseView(value: string | undefined | null): LibraryView {
  return value === "LIST" ? "LIST" : "GRID";
}

export function parseType(value: string | undefined | null): LibraryTargetType | "ALL" {
  if (
    value === "PRIMITIVE" ||
    value === "CAPABILITY" ||
    value === "EFFECT" ||
    value === "CHARACTER" ||
    value === "ITEM" ||
    value === "LINEAGE_TEMPLATE" ||
    value === "UPBRINGING_TEMPLATE" ||
    value === "MANIFEST_TEMPLATE" ||
    // Mashu 2026-07-09: builds now exposed via the library browse URL
    // `?type=BUILD_TEMPLATE`. The display label is "Builds" — see
    // library-toolbar.tsx for the chip.
    value === "BUILD_TEMPLATE"
  ) {
    return value;
  }
  return "ALL";
}