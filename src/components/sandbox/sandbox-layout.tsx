"use client";

import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
  type Layout,
} from "react-resizable-panels";
import { ChevronLeft, ChevronRight, Eye, Library as LibraryIcon, Wrench } from "lucide-react";
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
  mobileTab: ColumnKey;
  setMobileTab: (tab: ColumnKey) => void;
  hiddenColumns: Set<ColumnKey>;
  toggleHidden: (column: ColumnKey) => void;
  toggleCollapsed: (column: ColumnKey) => void;
  /** Tablet only: whether the preview column is shown (false = library + builder only). */
  previewVisible: boolean;
  togglePreview: () => void;
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
  library: 24,
  builder: 52,
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
  className,
}: SandboxLayoutProps) {
  const groupId = useId();
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [mobileTab, setMobileTab] = useState<ColumnKey>("builder");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [previewVisible, setPreviewVisible] = useState(true);
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
      mobileTab,
      setMobileTab,
      hiddenColumns,
      toggleHidden,
      toggleCollapsed,
      previewVisible,
      togglePreview,
    }),
    [
      mobileTab,
      hiddenColumns,
      toggleHidden,
      toggleCollapsed,
      previewVisible,
      togglePreview,
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

        {/* Floating restore buttons — desktop only. */}
        {viewport === "desktop" && hiddenColumns.has("library") ? (
          <RestoreColumnButton columnKey="library" />
        ) : null}
        {viewport === "desktop" && hiddenColumns.has("builder") ? (
          <RestoreColumnButton columnKey="builder" />
        ) : null}
        {viewport === "desktop" && hiddenColumns.has("preview") ? (
          <RestoreColumnButton columnKey="preview" />
        ) : null}

        {viewport === "mobile" ? (
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
          minSize={15}
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
        <Separator className="w-1 shrink-0 bg-border transition-colors hover:bg-primary/40 data-[separator=drag]:bg-primary/60" />
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
        <Separator className="w-1 shrink-0 bg-border transition-colors hover:bg-primary/40 data-[separator=drag]:bg-primary/60" />
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
// Mobile layout (tabs)
// ----------------------------------------------------------------------------

type MobileProps = {
  library: ReactNode;
  builder: ReactNode;
  preview: ReactNode;
};

function MobileSandboxLayout({ library, builder, preview }: MobileProps) {
  const { mobileTab } = useSandboxLayout();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={cn("h-full overflow-auto", mobileTab === "library" ? "block" : "hidden")}>
          {library}
        </div>
        <div className={cn("h-full overflow-auto", mobileTab === "builder" ? "block" : "hidden")}>
          {builder}
        </div>
        <div className={cn("h-full overflow-auto", mobileTab === "preview" ? "block" : "hidden")}>
          {preview}
        </div>
      </div>
      <MobileTabBar />
    </div>
  );
}

function MobileTabBar() {
  const { mobileTab, setMobileTab } = useSandboxLayout();
  const tabs: Array<{ key: ColumnKey; label: string; icon: ReactNode }> = [
    { key: "library", label: "Library", icon: <LibraryIcon className="size-4" /> },
    { key: "builder", label: "Build", icon: <Wrench className="size-4" /> },
    { key: "preview", label: "Preview", icon: <Eye className="size-4" /> },
  ];
  return (
    <div
      role="tablist"
      aria-label="Sandbox mode"
      className="grid shrink-0 grid-cols-3 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      {tabs.map((tab) => {
        const active = mobileTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => setMobileTab(tab.key)}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
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