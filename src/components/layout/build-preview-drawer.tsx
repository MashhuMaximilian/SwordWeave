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
import { DetailModal } from "@/components/ui/detail-modal";
import { Wrench, Eye, RotateCcw, Save } from "lucide-react";

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
 */
export function useDrawerSlot(content: Partial<DrawerSlotState>) {
  useEffect(() => {
    DrawerSlotCtx.set({
      build: content.build ?? DrawerSlotCtx.get().build,
      preview: content.preview ?? DrawerSlotCtx.get().preview,
    });
    return () => {
      // Only clear slots we set (so another page's content survives).
      const next: DrawerSlotState = { build: null, preview: null };
      if (content.build !== undefined) next.build = null;
      if (content.preview !== undefined) next.preview = null;
      DrawerSlotCtx.set(next);
    };
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
    <DetailModal
      isOpen={drawerOpen}
      onClose={closeDrawer}
      title="Build & Preview"
      subtitle="Compose your entity and watch the preview update live"
      size="lg"
    >
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
            active tab's content. */}
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
    </DetailModal>
  );
}
