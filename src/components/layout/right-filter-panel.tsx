"use client";

// =============================================================================
// RightFilterPanel — slide-in side panel for filters.
//
// Opened/closed by GlobalControls (via the FAB's "Filters" toggle). Slides in
// from the right edge of the screen. On mobile takes 85% width; on desktop
// it's a 380px-wide side sheet.
//
// The panel renders whatever the active page's filter content is. Pages push
// their filter content into a slot via `useFilterSlot`. If no page has
// registered content, the panel shows a friendly empty state.
//
// Implementation note: the previous version used a module-level pub-sub that
// suffered from a re-render loop (call-site JSX is a new reference every
// render, so the effect always refired, and the panel read-then-render
// sequence caused a noticeable delay between "tap Show filters" and seeing
// chips). Switching to React state + a setter ref fixes both.
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Filter as FilterIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalControls } from "./global-controls";

// -----------------------------------------------------------------------------
// Slot — one global slot, set by useFilterSlot, read by RightFilterPanel.
// A ref holds the "last-set" reference so the effect can detect "did I set
// this value or did someone else?" without re-firing on every parent render.
// -----------------------------------------------------------------------------

type Setter = (next: ReactNode) => void;

let _setter: Setter | null = null;

export function _registerSlotSetter(s: Setter) {
  _setter = s;
}
export function _unregisterSlotSetter() {
  _setter = null;
}

/**
 * Push filter content into the right-side filter panel slot.
 *
 * Pass a memoized element (e.g. `useMemo(() => <Toolbar .../>, [deps])`) so
 * the effect doesn't refire on every parent render — that's exactly what
 * caused the "tap Show filters, wait a beat, chips appear" jank in the
 * previous module-pub-sub implementation.
 */
export function useFilterSlot(content: ReactNode) {
  // Re-render on every push so RightFilterPanel can read the latest value
  // (it's a sibling component, not the same render tree).
  const [, setTick] = useState(0);
  const lastContentRef = useRef<ReactNode>(null);
  useEffect(() => {
    _setter?.(content);
    lastContentRef.current = content;
    setTick((t) => t + 1);
    return () => {
      // Only clear if WE set the value (avoid clearing another page's slot).
      if (lastContentRef.current !== null) {
        _setter?.(null);
        lastContentRef.current = null;
      }
    };
  }, [content]);
}

export function RightFilterPanel() {
  const { filterPanelOpen, setFilterPanelOpen } = useGlobalControls();
  const [content, setContent] = useState<ReactNode>(null);

  // Wire the slot setter once. Pages call _setter(content) via useFilterSlot
  // and we re-render with the new content.
  useEffect(() => {
    _registerSlotSetter(setContent);
    return _unregisterSlotSetter;
  }, []);

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
