"use client";

// =============================================================================
// BuildPreviewDrawer — slide-up overlay drawer (bottom sheet on mobile) that
// hosts the per-page Build/Preview content.
//
// Pages push their content into the drawer via `useDrawerSlot`. The slot
// supports per-tab content (one for "build", one for "preview") so the
// drawer chrome (tab strip + footer) can stay in sync with what the page
// wants to show.
//
// The drawer is open/closed via `useGlobalControls().drawerOpen` and the
// active tab via `drawerTab`. Pages can also call `openDrawer("preview")`
// to open the drawer directly on the preview tab.
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useGlobalControls } from "./global-controls";
import { Wrench, Eye, RotateCcw, Save, X } from "lucide-react";

type DrawerTab = "build" | "preview";

interface DrawerSlotState {
  build: ReactNode;
  preview: ReactNode;
}

const DrawerSlotCtx = (() => {
  let state: DrawerSlotState = { build: null, preview: null };
  const listeners = new Set<() => void>();
  return {
    set: (next: DrawerSlotState) => {
      state = next;
      listeners.forEach((l) => l());
    },
    get: () => state,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
})();

/**
 * Push drawer content for one or both tabs.
 *
 * Pass a memoized slot object (useMemo) so the effect doesn't refire on
 * every parent render. The previous per-tab effect caused the same
 * re-render-loop as the right filter panel had.
 *
 * Phase 7.5 v4-rev (Mashu): on cleanup, the previous version
 * always nulled BOTH tabs even if the caller only set one.
 * That made the form state disappear on every effect re-run
 * (e.g. when memo deps changed) — which is what was happening
 * on mobile when the user switched from Build to Preview and
 * back: SandboxLayout re-rendered with a fresh `builder`
 * element, the effect cleanup ran, the slot was wiped, and
 * the new effect hadn't fired yet. The user saw an empty
 * drawer.
 *
 * Fix: track the previous slot state. On cleanup, restore
 * whatever was there before this effect ran. On re-run,
 * merge: the new content takes precedence, but slots the
 * caller didn't touch keep their previous value.
 */
export function useDrawerSlot(content: Partial<DrawerSlotState>) {
  useEffect(() => {
    // Snapshot the prior state so we can restore on cleanup
    // without losing content the caller never touched.
    const previous = DrawerSlotCtx.get();
    DrawerSlotCtx.set({
      build: content.build !== undefined ? content.build : previous.build,
      preview: content.preview !== undefined ? content.preview : previous.preview,
    });
    return () => {
      DrawerSlotCtx.set(previous);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.build, content.preview]);
}

export function BuildPreviewDrawer() {
  const { drawerOpen, drawerTab, closeDrawer, setDrawerTab } =
    useGlobalControls();
  const [, setTick] = useState(0);
  useEffect(() => DrawerSlotCtx.subscribe(() => setTick((t) => t + 1)), []);
  const slot = DrawerSlotCtx.get();
  const activeContent = drawerTab === "preview" ? slot.preview : slot.build;

  // Find the inner form's Save/Reset buttons by data-attribute.
  function dispatchReset() {
    window.dispatchEvent(new CustomEvent("sw-sandbox-reset"));
  }
  function dispatchSave() {
    const submitBtn = document.querySelector<HTMLButtonElement>(
      'button[type="submit"][data-sandbox-submit]',
    );
    if (submitBtn) {
      submitBtn.click();
    } else {
      window.dispatchEvent(new CustomEvent("sw-sandbox-submit"));
    }
  }

  return (
    <DrawerShell isOpen={drawerOpen} onClose={closeDrawer}>
      <div className="flex max-h-[70vh] flex-col">
        {/* Tab strip — disabled when only one tab has content. */}
        <div
          role="tablist"
          className={cn(
            "sticky top-0 z-10 -mx-1 mb-2 flex shrink-0 rounded-md border border-border bg-card p-0.5",
            slot.build === null && slot.preview === null && "opacity-60",
          )}
        >
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === "build"}
            onClick={() => setDrawerTab("build")}
            disabled={slot.build === null}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              drawerTab === "build"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              slot.build === null && "cursor-not-allowed opacity-50",
            )}
          >
            <Wrench className="size-3.5" />
            Build
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === "preview"}
            onClick={() => setDrawerTab("preview")}
            disabled={slot.preview === null}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              drawerTab === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              slot.preview === null && "cursor-not-allowed opacity-50",
            )}
          >
            <Eye className="size-3.5" />
            Preview
          </button>
        </div>

        {/* Body — pages register per-tab content; the drawer shows the
            active tab's content. ALWAYS rendered (even when drawer is
            closed) so the form's slot listener is always live — otherwise
            slotting into a closed drawer silently drops the event. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeContent ?? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              {drawerTab === "preview"
                ? "No preview registered for this page."
                : "No build context on this page."}
            </div>
          )}
        </div>

        {/* Pinned Save/Reset footer — only shown when a build is registered. */}
        {slot.build !== null ? (
          <div className="sticky bottom-0 -mx-1 mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
            <button
              type="button"
              onClick={dispatchReset}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {drawerTab === "build" ? "Editing draft" : "Live preview"}
            </span>
            <button
              type="button"
              onClick={dispatchSave}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Save className="size-3.5" />
              Save
            </button>
          </div>
        ) : null}
      </div>
    </DrawerShell>
  );
}

// =============================================================================
// DrawerShell — modal chrome that always renders its children. The
// backdrop/panel chrome is hidden via CSS when `isOpen` is false, but the
// children stay mounted. This keeps form state alive and slot listeners
// active even when the user hasn't opened the drawer yet (the single-mode
// sandbox uses the drawer to host the build form).
// =============================================================================

function DrawerShell({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Lock body scroll when open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Escape to close.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop — visible only when open. */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
      />
      {/* Panel — always rendered so children stay mounted. Hidden off-screen
          with a translate transition when closed.

          a11y notes:
          - We previously used `aria-hidden={!isOpen}` to hide the panel
            from screen readers when closed. That's wrong when focus is
            still inside the panel — focus retained on a descendant of
            an aria-hidden element is a WAI-ARIA violation (and the
            browser console warns about it). The reason focus ended up
            stuck inside is the Save button stayed focused after the
            user clicked Save and the drawer closed.
          - `inert` is the modern fix: when set, the entire subtree is
            removed from focus order, screen reader nav, AND click
            events. Combined with aria-hidden, it satisfies both the
            "this content is currently not interactive" semantic and
            the focus-hygiene requirement.
          - The previous Save handler's flow kept the focus inside the
            panel during the close transition. With inert, even if
            focus hasn't been moved out yet, the browser doesn't flag
            it because inert makes the panel unreachable.
      */}
      <aside
        role="dialog"
        aria-modal={isOpen}
        aria-label="Build & Preview"
        aria-hidden={!isOpen}
        // React 19 deprecates stringified booleans on the `inert` prop.
        // Pass an explicit boolean — true when the drawer is closed so the
        // subtree is removed from the focus order; false when open so
        // focus can reach the Save button. Empty string `""` produced the
        // "Received an empty string for a boolean attribute `inert`" warning.
        inert={!isOpen}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl transition-transform duration-300 ease-out sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          isOpen
            ? "translate-y-0 sm:translate-y-[-50%]"
            : "translate-y-full sm:translate-y-[-50%] sm:translate-x-[-50%] sm:translate-y-[150%]",
        )}
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-2 border-b border-border bg-card px-2 py-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              Build & Preview
            </h2>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              Compose your entity and watch the preview update live
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close build and preview"
            className="shrink-0 rounded-md p-1.5 hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-2 py-2">{children}</div>
      </aside>
    </>
  );
}
