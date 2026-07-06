"use client";

// =============================================================================
// RightFilterPanel — slide-in side panel for filters.
//
// Opened/closed by GlobalControls (via the FAB's "Filters" toggle). Slides in
// from the right edge of the screen. On mobile takes 85% width; on desktop
// it's a 380px-wide side sheet.
//
// The panel renders whatever the active page's filter content is. Pages push
// their filter content into a portal slot via `useFilterSlot`. If no page has
// registered content, the panel shows a friendly empty state.
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { Filter as FilterIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalControls } from "./global-controls";

const FilterSlotCtx = (() => {
  // Use a module-level pub-sub for the slot so any page can register/unregister
  // its filter content without prop-drilling.
  let content: ReactNode = null;
  const listeners = new Set<() => void>();
  return {
    set: (next: ReactNode) => {
      content = next;
      listeners.forEach((l) => l());
    },
    get: () => content,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
})();

export function useFilterSlot(content: ReactNode) {
  useEffect(() => {
    FilterSlotCtx.set(content);
    return () => {
      // Only clear if WE set the value (avoid clearing another page's slot).
      if (FilterSlotCtx.get() === content) FilterSlotCtx.set(null);
    };
  }, [content]);
}

export function RightFilterPanel() {
  const { filterPanelOpen, setFilterPanelOpen } = useGlobalControls();
  const [, setTick] = useState(0);
  useEffect(() => FilterSlotCtx.subscribe(() => setTick((t) => t + 1)), []);
  const content = FilterSlotCtx.get();

  // Lock body scroll while open.
  useEffect(() => {
    if (!filterPanelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filterPanelOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!filterPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterPanelOpen, setFilterPanelOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setFilterPanelOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          filterPanelOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-[420px] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out",
          filterPanelOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="size-4 text-primary" />
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
              Filters
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setFilterPanelOpen(false)}
            aria-label="Close filters"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {content ?? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <FilterIcon className="size-8 opacity-30" />
              <p>No filters on this page.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
