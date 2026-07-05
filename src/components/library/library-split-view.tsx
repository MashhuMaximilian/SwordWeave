"use client";

// =============================================================================
// LibrarySplitView — two-pane resizable split for /library/browse.
//
// Layout:
// - Desktop (≥md): horizontal split. Library table on the LEFT, preview pane
//   on the RIGHT.
// - Mobile (<md): vertical split. Library table on TOP, preview pane on
//   BOTTOM. Both panes are drag-resizable.
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

  // Separate default-layout hooks per orientation. Storage keys differ so
  // desktop and mobile layouts don't collide.
  const desktopLayout = useDefaultLayout({
    id: "sw_lib_split_desktop",
    storage: safeStorage,
    panelIds: ["table", "preview"],
  });
  const mobileLayout = useDefaultLayout({
    id: "sw_lib_split_mobile",
    storage: safeStorage,
    panelIds: ["table", "preview"],
  });

  return (
    <Group
      orientation={isMobile ? "vertical" : "horizontal"}
      className="h-full"
      {...(isMobile
        ? {
            defaultLayout: mobileLayout.defaultLayout,
            onLayoutChange: mobileLayout.onLayoutChange,
            onLayoutChanged: mobileLayout.onLayoutChanged,
          }
        : {
            defaultLayout: desktopLayout.defaultLayout,
            onLayoutChange: desktopLayout.onLayoutChange,
            onLayoutChanged: desktopLayout.onLayoutChanged,
          })}
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

      <Separator
        className={
          isMobile
            ? "h-1.5 w-full shrink-0 bg-border transition-colors hover:bg-primary data-[separator=active]:bg-primary"
            : "w-1.5 shrink-0 bg-border transition-colors hover:bg-primary data-[separator=active]:bg-primary"
        }
      />

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