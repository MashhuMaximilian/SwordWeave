"use client";

// =============================================================================
// LibrarySplitView — two-pane resizable split for /library/browse.
//
// Layout:
// - Desktop (≥md): horizontal split. Library table on the LEFT, preview pane
//   on the RIGHT. Drag-resize divider in between.
// - Mobile (<md): single scrollable table. Preview pane opens as a bottom-sheet
//   modal (DetailModal) when a row is tapped. The "Preview" column header in
//   the toolbar also exposes an explicit open button.
//
// Split sizes are persisted to localStorage per orientation (separate keys
// for mobile vs desktop) so the user doesn't lose their preferred layout
// when switching devices or rotating.
//
// The default split is 60/40 in favor of the table pane.
// =============================================================================

import { useEffect, useState } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { LibraryPreviewPane } from "@/components/library/library-preview-pane";
import { DetailModal } from "@/components/ui/detail-modal";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "@/components/library/library-table";

interface LibrarySplitViewProps {
  selectedItem: LibraryItem | null;
  onSelectItem: (item: LibraryItem | null) => void;
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
  tableContent: React.ReactNode;
  /**
   * Pagination footer rendered below the table inside the table panel.
   */
  pagination?: React.ReactNode;
}

const safeStorage: Pick<Storage, "getItem" | "setItem"> =
  typeof window === "undefined"
    ? {
        getItem: () => null,
        setItem: () => undefined,
      }
    : {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) =>
          window.localStorage.setItem(key, value),
      };

export function LibrarySplitView({
  selectedItem,
  onSelectItem,
  engagement,
  currentUserInternalId,
  tableContent,
  pagination,
}: LibrarySplitViewProps) {
  // Detect mobile vs desktop on mount and on resize. Used to flip the
  // Group orientation. We use a media query at 768px (Tailwind md).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Separate default-layout hooks per orientation. Mobile no longer uses
  // resizable panels (preview is a modal), but we keep the desktop hook for
  // the horizontal split.
  const desktopLayout = useDefaultLayout({
    id: "sw_lib_split_desktop",
    storage: safeStorage,
    panelIds: ["table", "preview"],
  });

  // ---- Mobile: table only + preview as bottom-sheet modal -------------------
  if (isMobile) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-auto">{tableContent}</div>
          {pagination ? (
            <div className="shrink-0 border-t border-border bg-card p-3">
              {pagination}
            </div>
          ) : null}
        </div>

        <DetailModal
          isOpen={selectedItem !== null}
          onClose={() => onSelectItem(null)}
          title={selectedItem?.name ?? "Preview"}
          {...(selectedItem
            ? {
                subtitle: `${selectedItem.targetType.toLowerCase()} · ${formatKind(selectedItem.category)}`,
              }
            : {})}
          size="lg"
        >
          <LibraryPreviewPane
            item={selectedItem}
            engagement={engagement}
            currentUserInternalId={currentUserInternalId}
            onClose={() => onSelectItem(null)}
          />
        </DetailModal>
      </>
    );
  }

  // ---- Desktop: side-by-side resizable split -------------------------------
  return (
    <Group
      orientation="horizontal"
      className="h-full"
      defaultLayout={desktopLayout.defaultLayout}
      onLayoutChange={desktopLayout.onLayoutChange}
      onLayoutChanged={desktopLayout.onLayoutChanged}
    >
      <Panel
        id="table"
        defaultSize={60}
        minSize={20}
        maxSize={85}
        className="flex flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-auto">{tableContent}</div>
        {pagination ? (
          <div className="border-t border-border bg-card p-3">{pagination}</div>
        ) : null}
      </Panel>

      <Separator className="group relative w-2 shrink-0 bg-border transition-colors hover:bg-primary data-[separator=active]:bg-primary">
        {/* Wider hit area with a visible "grip" indicator that shows on hover. */}
        <span className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex w-0.5 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="h-8 w-0.5 rounded-full bg-primary-foreground/40" />
        </span>
      </Separator>

      <Panel
        id="preview"
        defaultSize={40}
        minSize={15}
        maxSize={80}
        className="overflow-hidden bg-card"
      >
        <LibraryPreviewPane
          item={selectedItem}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
          {...(selectedItem
            ? { onClose: () => onSelectItem(null) }
            : {})}
        />
      </Panel>
    </Group>
  );
}

// Helper to format the LibraryItem.kind for the modal subtitle.
// Library kinds are usually "primitive", "capability", "race", etc.
function formatKind(kind: string | null | undefined): string {
  if (!kind) return "";
  return kind
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}