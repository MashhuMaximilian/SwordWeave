"use client";

import { LayoutGrid, List } from "lucide-react";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import "./catalogue-layout.css";

/** Show the current layout; one action switches to the other layout. Keep it beside search, outside filters. */
export function CatalogueViewToggle({
  view,
  onChange,
}: {
  view: LibraryView;
  onChange: (view: LibraryView) => void;
}) {
  const next = view === "LIST" ? "GRID" : "LIST";
  const label = `Switch to ${next.toLowerCase()} view`;
  return (
    <button
      type="button"
      className="sw-metal-button sw-catalogue-view-toggle"
      onClick={() => onChange(next)}
      aria-label={label}
      title={label}
    >
      {view === "GRID" ? (
        <LayoutGrid size={18} aria-hidden="true" />
      ) : (
        <List size={18} aria-hidden="true" />
      )}
    </button>
  );
}
