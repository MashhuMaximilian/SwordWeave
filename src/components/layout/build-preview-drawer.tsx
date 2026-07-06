"use client";

// =============================================================================
// BuildPreviewDrawer — slide-up overlay drawer (bottom sheet on mobile) that
// hosts the per-page Build/Preview content.
//
// Pages push their content into the drawer via `useDrawerSlot`. The drawer
// auto-sizes to the content (max 80vh) and has a pinned Save/Reset footer.
// =============================================================================

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useGlobalControls } from "./global-controls";
import { DetailModal } from "@/components/ui/detail-modal";
import { Wrench, Eye, RotateCcw, Save } from "lucide-react";

const DrawerSlotCtx = (() => {
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

export function useDrawerSlot(content: ReactNode) {
  useEffect(() => {
    DrawerSlotCtx.set(content);
    return () => {
      if (DrawerSlotCtx.get() === content) DrawerSlotCtx.set(null);
    };
  }, [content]);
}
export function BuildPreviewDrawer() {
  const { drawerOpen, drawerTab, closeDrawer, setDrawerTab } =
    useGlobalControls();
  const [, setTick] = useState(0);
  useEffect(() => DrawerSlotCtx.subscribe(() => setTick((t) => t + 1)), []);
  const content = DrawerSlotCtx.get();

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
        {/* Tab strip */}
        <div
          role="tablist"
          className="sticky top-0 z-10 -mx-1 mb-2 flex shrink-0 rounded-md border border-border bg-card p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === "build"}
            onClick={() => setDrawerTab("build")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              drawerTab === "build"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
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
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              drawerTab === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="size-3.5" />
            Preview
          </button>
        </div>

        {/* Body — pages provide their own Build/Preview content; the drawer
            shows whatever the page registered. Tabs here are visual only —
            pages decide what to render. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {content ?? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No build context on this page.
            </div>
          )}
        </div>

        {/* Pinned Save/Reset footer */}
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
      </div>
    </DetailModal>
  );
}
