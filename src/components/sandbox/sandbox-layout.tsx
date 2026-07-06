"use client";

import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
  type Layout,
  useDefaultLayout as useMobileDefaultLayout,
} from "react-resizable-panels";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Eye,
  Filter,
  Library as LibraryIcon,
  Maximize2,
  Minimize2,
  RotateCcw,
  Wrench,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/**
 * SandboxLayout — three-column resizable shell used by every /sandbox/* page.
 *
 * Columns:
 *   - library  (corpus browser — search/filter the available primitives/templates/etc.)
 *   - builder  (the entity composer itself — wraps each <XxxComposer>)
 *   - preview  (live read-only render of the entity being edited)
 *
 * Behaviour:
 *   - Free-drag resize between columns.
 *   - Header chevron collapses a column to a 40px icon strip (single-click toggle).
 *   - Header hide button collapses a column to 0px (drag handle to bring back).
 *   - Column widths + collapsed state persist to localStorage per storageKey.
 *   - On viewports <1024px the panels collapse into three mode tabs (Library | Build | Preview).
 *   - Panel state is dumb chrome — it does not own the entity being edited. Composers do.
 */

const COLLAPSED_STRIP_PX = 4; // % of group width — 4% is roughly 40-50px on desktop.
const HIDDEN_PX = 0;
const STORAGE_PREFIX = "sandbox:layout:";
const MOBILE_BREAKPOINT_PX = 768; // <768 = mobile (tabs)
const TABLET_BREAKPOINT_PX = 1024; // 768-1023 = tablet (2 cols + toggle preview)

type ColumnKey = "library" | "builder" | "preview";

type SandboxLayoutContextValue = {
  hiddenColumns: Set<ColumnKey>;
  toggleHidden: (column: ColumnKey) => void;
  toggleCollapsed: (column: ColumnKey) => void;
  /** Tablet only: whether the preview column is shown (false = library + builder only). */
  previewVisible: boolean;
  togglePreview: () => void;
  /** Mobile only: whether the preview overlay modal is open. */
  previewOverlayOpen: boolean;
  setPreviewOverlayOpen: (open: boolean) => void;
};

const SandboxLayoutContext = createContext<SandboxLayoutContextValue | null>(null);

export function useSandboxLayout(): SandboxLayoutContextValue {
  const ctx = useContext(SandboxLayoutContext);
  if (!ctx) {
    throw new Error("useSandboxLayout must be used inside <SandboxLayout>");
  }
  return ctx;
}

type SandboxLayoutProps = {
  /** Stable identifier for localStorage namespacing. Should be unique per sandbox page. */
  storageKey: string;
  /** Composer element — placed in the builder column. */
  builder: ReactNode;
  /** Library column content — corpus browser for the relevant entity type. */
  library: ReactNode;
  /** Preview column content — live read-only render. */
  preview: ReactNode;
  /** Optional: header bar above the columns (shows entity name, save button, etc.). */
  topBar?: ReactNode;
  /** Optional: bottom bar below the columns. Rendered inside the sandbox
   *  container, just above the FAB safe area. Use for build-mode tabs,
   *  action toolbars, etc. */
  bottomBar?: ReactNode;
  /** Optional: extra Tailwind classes for the outer container. */
  className?: string;
};

type StoredLayout = {
  widths: Partial<Record<ColumnKey, number>>;
  hidden: ColumnKey[];
  previewVisible?: boolean;
};

function readStorage(key: string): StoredLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLayout;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(key: string, layout: StoredLayout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(layout));
  } catch {
    // localStorage may be full or disabled — silently ignore.
  }
}

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  library: 32,
  builder: 44,
  preview: 24,
};

function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WIDTHS.builder;
  return Math.max(0, Math.min(95, value));
}

export function SandboxLayout({
  storageKey,
  builder,
  library,
  preview,
  topBar,
  bottomBar,
  className,
}: SandboxLayoutProps) {
  const groupId = useId();
  // IMPORTANT: default to "mobile" so SSR + first client render emit the same
  // tree. The desktop/tablet layouts mount `<Panel>` from react-resizable-panels
  // which would otherwise leave orphaned data-panel divs at body level when the
  // viewport transitions. We only switch to desktop/tablet after `viewportReady`.
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [viewportReady, setViewportReady] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewOverlayOpen, setPreviewOverlayOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storedWidths, setStoredWidths] = useState<Partial<Record<ColumnKey, number>>>({});

  // Hydrate from localStorage after first render so SSR + client agree.
  useEffect(() => {
    const stored = readStorage(storageKey);
    if (stored) {
      setHiddenColumns(new Set(stored.hidden));
      if (typeof stored.previewVisible === "boolean") {
        setPreviewVisible(stored.previewVisible);
      }
      if (stored.widths) setStoredWidths(stored.widths);
    }
    // Cleanup: drop the orphaned "sw_sandbox_mobile_inner" layout that the
    // 3-panel mobile layout (Library | Build | Preview) used to persist.
    // The new 2-panel layout (Library | Build) doesn't need this key.
    try {
      window.localStorage.removeItem("sw_sandbox_mobile_inner");
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [storageKey]);

  // Persist hidden state + previewVisible when they change (only after hydration).
  useEffect(() => {
    if (!hydrated) return;
    const stored = readStorage(storageKey) ?? {
      widths: {},
      hidden: [],
      previewVisible: true,
    };
    writeStorage(storageKey, {
      ...stored,
      hidden: Array.from(hiddenColumns),
      previewVisible,
    });
  }, [hiddenColumns, previewVisible, storageKey, hydrated]);

  // Track viewport size for mobile/tablet/desktop switch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const computeViewport = () => {
      const w = window.innerWidth;
      if (w < MOBILE_BREAKPOINT_PX) setViewport("mobile");
      else if (w < TABLET_BREAKPOINT_PX) setViewport("tablet");
      else setViewport("desktop");
    };
    computeViewport();
    setViewportReady(true);
    window.addEventListener("resize", computeViewport);
    return () => window.removeEventListener("resize", computeViewport);
  }, []);

  // Imperative handles for collapse/expand buttons.
  const libraryRef = useRef<PanelImperativeHandle>(null);
  const builderRef = useRef<PanelImperativeHandle>(null);
  const previewRef = useRef<PanelImperativeHandle>(null);

  const refMap = useMemo<Record<ColumnKey, React.RefObject<PanelImperativeHandle | null>>>(
    () => ({ library: libraryRef, builder: builderRef, preview: previewRef }),
    [],
  );

  const toggleHidden = useCallback((column: ColumnKey) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) {
        next.delete(column);
      } else {
        next.add(column);
      }
      return next;
    });
  }, []);

  const toggleCollapsed = useCallback((column: ColumnKey) => {
    const handle = refMap[column].current;
    if (!handle) return;
    if (handle.isCollapsed()) {
      handle.expand();
    } else {
      handle.collapse();
    }
  }, [refMap]);

  const togglePreview = useCallback(() => {
    setPreviewVisible((prev) => !prev);
  }, []);

  const onLayoutChanged = useCallback(
    (layout: Layout) => {
      if (!hydrated) return;
      const widths: Partial<Record<ColumnKey, number>> = {};
      const library = layout["library"];
      const builder = layout["builder"];
      const preview = layout["preview"];
      if (typeof library === "number") widths.library = clampWidth(library);
      if (typeof builder === "number") widths.builder = clampWidth(builder);
      if (typeof preview === "number") widths.preview = clampWidth(preview);
      setStoredWidths(widths);
      const stored = readStorage(storageKey) ?? {
        widths: {},
        hidden: [],
        previewVisible: true,
      };
      writeStorage(storageKey, { ...stored, widths });
    },
    [hydrated, storageKey],
  );

  const ctx = useMemo<SandboxLayoutContextValue>(
      () => ({
        hiddenColumns,
        toggleHidden,
        toggleCollapsed,
        previewVisible,
        togglePreview,
        previewOverlayOpen,
        setPreviewOverlayOpen,
      }),
      [
        hiddenColumns,
        toggleHidden,
        toggleCollapsed,
        previewVisible,
        togglePreview,
        previewOverlayOpen,
      ],
    );
  return (
    <SandboxLayoutContext.Provider value={ctx}>
      <div
        className={cn(
          "relative flex h-[calc(100dvh-4rem)] w-full flex-col bg-background",
          className,
        )}
        data-sandbox-layout
      >
        {topBar ? <div className="shrink-0 border-b">{topBar}</div> : null}

        {/* Bottom bar — sits inside the sandbox container, above the FAB
            safe area. Currently used for the build-mode type tabs. */}
        {bottomBar ? (
          <div className="shrink-0 border-t bg-background">{bottomBar}</div>
        ) : null}

        {/* Floating restore buttons — desktop only, and only after viewport is ready. */}
        {viewportReady && viewport === "desktop" && hiddenColumns.has("library") ? (
          <RestoreColumnButton columnKey="library" />
        ) : null}
        {viewportReady && viewport === "desktop" && hiddenColumns.has("builder") ? (
          <RestoreColumnButton columnKey="builder" />
        ) : null}
        {viewportReady && viewport === "desktop" && hiddenColumns.has("preview") ? (
          <RestoreColumnButton columnKey="preview" />
        ) : null}

        {/* Render order: mobile is the safe default (matches SSR).
            Tablet/Desktop only mount after `viewportReady` is true so we never
            have SSR emit a desktop tree and then unmount it on the client. */}
        {!viewportReady || viewport === "mobile" ? (
          <MobileSandboxLayout
            library={library}
            builder={builder}
            preview={preview}
          />
        ) : viewport === "tablet" ? (
          <TabletSandboxLayout
            library={library}
            builder={builder}
            preview={preview}
            previewVisible={previewVisible}
            onPreviewToggle={togglePreview}
          />
        ) : (
          <DesktopSandboxLayout
            groupId={groupId}
            library={library}
            builder={builder}
            preview={preview}
            hiddenColumns={hiddenColumns}
            onLayoutChanged={onLayoutChanged}
            panelRefs={refMap}
            storedWidths={storedWidths}
            hydrated={hydrated}
          />
        )}
      </div>
    </SandboxLayoutContext.Provider>
  );
}

// ----------------------------------------------------------------------------
// Desktop layout
// ----------------------------------------------------------------------------

type DesktopProps = {
  groupId: string;
  library: ReactNode;
  builder: ReactNode;
  preview: ReactNode;
  hiddenColumns: Set<ColumnKey>;
  onLayoutChanged: (layout: Layout) => void;
  panelRefs: Record<ColumnKey, React.RefObject<PanelImperativeHandle | null>>;
  storedWidths: Partial<Record<ColumnKey, number>>;
  hydrated: boolean;
};

function DesktopSandboxLayout({
  groupId,
  library,
  builder,
  preview,
  hiddenColumns,
  onLayoutChanged,
  panelRefs,
  storedWidths,
  hydrated,
}: DesktopProps) {
  const libraryHidden = hiddenColumns.has("library");
  const previewHidden = hiddenColumns.has("preview");

  return (
    <Group
      id={groupId}
      orientation="horizontal"
      onLayoutChanged={onLayoutChanged}
      className="flex h-full min-h-0"
    >
      {/* LIBRARY PANEL — fully unmounted when hidden so the group rebalances. */}
      {libraryHidden ? null : (
        <Panel
          id="library"
          panelRef={panelRefs.library}
          collapsible
          collapsedSize={COLLAPSED_STRIP_PX}
          minSize={22}
          defaultSize={storedWidths.library ?? DEFAULT_WIDTHS.library}
          className="flex h-full min-h-0 flex-col"
        >
          <ColumnChrome
            columnKey="library"
            title="Library"
            icon={<LibraryIcon className="size-4" />}
            isHidden={false}
            isFirst
            hydrated={hydrated}
          />
          <div className="flex-1 min-h-0 overflow-auto">{library}</div>
        </Panel>
      )}

      {/* Separator between library and builder — only renders when both panels exist. */}
      {libraryHidden ? null : (
        <Separator className="group relative w-2 shrink-0 bg-border transition-colors hover:bg-primary/60 data-[separator=drag]:bg-primary">
          <span className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex w-0.5 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="h-8 w-0.5 rounded-full bg-primary-foreground/60" />
          </span>
        </Separator>
      )}

      {/* BUILDER PANEL — always present (the editor must always be visible). */}
      <Panel
        id="builder"
        panelRef={panelRefs.builder}
        collapsible
        collapsedSize={COLLAPSED_STRIP_PX}
        minSize={25}
        defaultSize={storedWidths.builder ?? DEFAULT_WIDTHS.builder}
        className="flex h-full min-h-0 flex-col"
      >
        <ColumnChrome
          columnKey="builder"
          title="Build"
          icon={<Wrench className="size-4" />}
          isHidden={false}
          hydrated={hydrated}
        />
        <div className="flex-1 min-h-0 overflow-auto">{builder}</div>
      </Panel>

      {/* Separator between builder and preview. */}
      {previewHidden ? null : (
        <Separator className="group relative w-2 shrink-0 bg-border transition-colors hover:bg-primary/60 data-[separator=drag]:bg-primary">
          <span className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex w-0.5 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="h-8 w-0.5 rounded-full bg-primary-foreground/60" />
          </span>
        </Separator>
      )}

      {/* PREVIEW PANEL — fully unmounted when hidden. */}
      {previewHidden ? null : (
        <Panel
          id="preview"
          panelRef={panelRefs.preview}
          collapsible
          collapsedSize={COLLAPSED_STRIP_PX}
          minSize={15}
          defaultSize={storedWidths.preview ?? DEFAULT_WIDTHS.preview}
          className="flex h-full min-h-0 flex-col"
        >
          <ColumnChrome
            columnKey="preview"
            title="Preview"
            icon={<Eye className="size-4" />}
            isHidden={false}
            isLast
            hydrated={hydrated}
          />
          <div className="flex-1 min-h-0 overflow-auto">{preview}</div>
        </Panel>
      )}
    </Group>
  );
}

// ----------------------------------------------------------------------------
// Tablet layout (768-1023px) — Library + Builder side-by-side, Preview toggleable.
// ----------------------------------------------------------------------------

type TabletProps = {
  library: ReactNode;
  builder: ReactNode;
  preview: ReactNode;
  previewVisible: boolean;
  onPreviewToggle: () => void;
};

function TabletSandboxLayout({
  library,
  builder,
  preview,
  previewVisible,
  onPreviewToggle,
}: TabletProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top action bar — preview toggle lives here on tablet. */}
      <div className="flex h-10 shrink-0 items-center justify-end gap-2 border-b bg-muted/30 px-3">
        <button
          type="button"
          onClick={onPreviewToggle}
          aria-pressed={previewVisible}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            previewVisible
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Eye className="size-3.5" />
          {previewVisible ? "Hide Preview" : "Show Preview"}
        </button>
      </div>

      {/* Body — Library + Builder (always), Preview (conditional). */}
      <div className="flex flex-1 min-h-0">
        <div className="flex h-full min-h-0 w-[36%] max-w-[360px] min-w-[240px] flex-col border-r">
          <TabletColumnChrome title="Library" icon={<LibraryIcon className="size-4" />} />
          <div className="flex-1 min-h-0 overflow-auto">{library}</div>
        </div>
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <TabletColumnChrome title="Build" icon={<Wrench className="size-4" />} />
          <div className="flex-1 min-h-0 overflow-auto">{builder}</div>
        </div>
        {previewVisible ? (
          <div className="flex h-full min-h-0 w-[36%] max-w-[360px] min-w-[240px] flex-col border-l">
            <TabletColumnChrome title="Preview" icon={<Eye className="size-4" />} />
            <div className="flex-1 min-h-0 overflow-auto">{preview}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabletColumnChrome({
  title,
  icon,
}: {
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-muted/30 px-3 text-sm font-medium">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{title}</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Mobile layout (Library-only with FAB speed-dial OR split via toggle)
// ----------------------------------------------------------------------------

import { DetailModal } from "@/components/ui/detail-modal";
import { useGlobalControls } from "@/components/layout/global-controls";
import { useDrawerSlot } from "@/components/layout/build-preview-drawer";

type MobileProps = {
  library: ReactNode;
  builder: ReactNode;
  preview: ReactNode;
};

function MobileSandboxLayout({ library, builder, preview }: MobileProps) {
  // Layout mode comes from GlobalControls so the FAB (mounted globally) can
  // toggle it. Local state for the drawer/filter/fullscreen is gone — the
  // GlobalControls mounts a single global drawer/filter for every page.
  const { sandboxSplit, setSandboxSplit, openDrawer } = useGlobalControls();

  // Hydration guard — wait for first client render so SSR HTML matches the
  // client. While un-hydrated, render the library-only branch (no Group,
  // no data-panel divs) so the DOM doesn't leak panels from the desktop
  // render.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // The sandbox's Build/Preview content is pushed into the global drawer
  // via the per-tab slot system. We register each tab's content separately
  // so the drawer's tab toggle works (previously both tabs rendered the
  // same wrapper which ignored the global drawer state). The drawer's
  // footer/save-reset chrome only shows on the build tab.
  useDrawerSlot(
    useMemo(
      () => ({
        build: builder,
        preview: preview,
      }),
      [builder, preview],
    ),
  );

  // Split-mode layout: Library | Build (with Preview overlay triggered by
  // a dedicated button — also accessible via FAB). Vertical drag-resize
  // between Library and Build.
  const splitLayout = useMobileDefaultLayout({
    id: "sw_sandbox_mobile_split",
    storage: {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
    panelIds: ["library", "builder"],
  });

  function dispatchReset() {
    window.dispatchEvent(new CustomEvent("sw-sandbox-reset"));
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {!hydrated || !sandboxSplit ? (
        // Default mode: Library fills the viewport, Build is a drawer.
        <div className="flex h-full min-h-0 flex-col">
          <MobileColumnChrome title="Library" icon={<LibraryIcon className="size-4" />} />
          <div className="flex-1 min-h-0 overflow-hidden">{library}</div>
        </div>
      ) : (
        // Split mode: Library top + Build bottom (vertical drag-resize).
        <Group
          id="sw_sandbox_mobile_split"
          orientation="vertical"
          defaultLayout={splitLayout.defaultLayout}
          onLayoutChange={splitLayout.onLayoutChange}
          onLayoutChanged={splitLayout.onLayoutChanged}
          className="flex h-full min-h-0"
        >
          <Panel
            id="library"
            defaultSize={50}
            minSize={20}
            maxSize={75}
            className="flex h-full min-h-0 flex-col"
          >
            <MobileColumnChrome title="Library" icon={<LibraryIcon className="size-4" />} />
            <div className="flex-1 min-h-0 overflow-hidden">{library}</div>
          </Panel>
          {/* Drag handle: 12px tall (h-3) with a 32px visible grab bar
              so it's easy to grab on touch devices. Previous handle was
              only 6px which couldn't reliably catch taps. */}
          <Separator className="group relative h-3 shrink-0 cursor-row-resize bg-border/80 transition-colors hover:bg-primary/60 data-[separator=drag]:bg-primary">
            <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex h-2 items-center justify-center">
              <span className="h-1 w-12 rounded-full bg-foreground/40 group-hover:bg-primary-foreground" />
            </span>
          </Separator>
          <Panel
            id="builder"
            defaultSize={50}
            minSize={25}
            maxSize={85}
            className="flex h-full min-h-0 flex-col"
          >
            <MobileColumnChrome
              title="Build"
              icon={<Wrench className="size-4" />}
              action={
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openDrawer("preview")}
                    className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary hover:bg-primary/20"
                    aria-label="Preview"
                  >
                    <Eye className="size-3" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={dispatchReset}
                    className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground hover:bg-secondary/70"
                    aria-label="Reset"
                  >
                    <RotateCcw className="size-3" />
                    Reset
                  </button>
                </div>
              }
            />
            <div className="flex-1 min-h-0 overflow-auto">{builder}</div>
          </Panel>
        </Group>
      )}
    </div>
  );
}

// Module-level proxy intentionally removed — useDrawerSlot (from
// build-preview-drawer) handles the slot.
function MobileColumnChrome({
  title,
  icon,
  action,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/30 px-3 text-sm font-medium">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{title}</span>
      {action}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Floating restore button — appears when a column has been hidden on desktop.
// ----------------------------------------------------------------------------

function RestoreColumnButton({ columnKey }: { columnKey: ColumnKey }) {
  const { toggleHidden } = useSandboxLayout();
  const config: Record<ColumnKey, { icon: ReactNode; label: string; edge: string }> = {
    library: {
      icon: <LibraryIcon className="size-4" />,
      label: "Show Library",
      edge: "left-0",
    },
    builder: {
      icon: <Wrench className="size-4" />,
      label: "Show Build",
      edge: "left-1/2 -translate-x-1/2",
    },
    preview: {
      icon: <Eye className="size-4" />,
      label: "Show Preview",
      edge: "right-0",
    },
  };
  const c = config[columnKey];
  return (
    <button
      type="button"
      onClick={() => toggleHidden(columnKey)}
      title={c.label}
      aria-label={c.label}
      className={cn(
        "absolute top-12 z-10 flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium shadow-sm transition-all hover:bg-accent",
        c.edge,
      )}
    >
      {c.icon}
      <span className="sr-only">{c.label}</span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Column header chrome (collapse / hide buttons)
// ----------------------------------------------------------------------------

type ColumnChromeProps = {
  columnKey: ColumnKey;
  title: string;
  icon: ReactNode;
  isHidden: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  hydrated: boolean;
};

function ColumnChrome({
  columnKey,
  title,
  icon,
  isHidden,
  isFirst,
  isLast,
  hydrated,
}: ColumnChromeProps) {
  const { toggleHidden, toggleCollapsed } = useSandboxLayout();

  const CollapseIcon = isFirst
    ? ChevronLeft
    : isLast
      ? ChevronRight
      : null;

  return (
    <div
      data-column-chrome={columnKey}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 border-b bg-muted/30 px-3",
        "text-sm font-medium",
        isHidden && "justify-center px-2",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      {!isHidden && <span className="truncate">{title}</span>}
      {!isHidden && CollapseIcon && hydrated ? (
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => toggleCollapsed(columnKey)}
            title="Collapse to strip"
            aria-label={`Collapse ${title} column`}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <CollapseIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleHidden(columnKey)}
            title="Hide column"
            aria-label={`Hide ${title} column`}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Eye className="size-3.5 opacity-40 line-through" />
          </button>
        </div>
      ) : null}
      {isHidden && hydrated ? (
        <button
          type="button"
          onClick={() => toggleHidden(columnKey)}
          title={`Show ${title} column`}
          aria-label={`Show ${title} column`}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {icon}
        </button>
      ) : null}
    </div>
  );
}