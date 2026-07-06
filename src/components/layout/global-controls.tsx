"use client";

// =============================================================================
// GlobalControls — single source of truth for app-wide UI state:
//   - Dark mode (writes/reads `dark` class on <html>)
//   - Right-side filter panel (open/close)
//   - Build & Preview drawer (open/close, current tab)
//
// The FAB speed-dial is rendered here, so every page gets consistent nav +
// functions. Pages can also wire their own behaviour via the `useGlobalControls`
// hook (e.g. the sandbox's "Split View" toggle binds to the layout's mode).
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ACCOUNT_LINKS,
  FabSpeedDial,
  NAV_LINKS,
  type FabItem,
} from "./fab-speed-dial";
import { RightFilterPanel } from "./right-filter-panel";
import { BuildPreviewDrawer } from "./build-preview-drawer";
import { usePathname } from "next/navigation";
import { Columns2, Filter, Maximize2, Minimize2, Moon, Sun, Wrench } from "lucide-react";

type DrawerTab = "build" | "preview" | null;

interface GlobalControlsState {
  /** Dark mode on/off. */
  dark: boolean;
  setDark: (v: boolean) => void;
  toggleDark: () => void;
  /** Filter side panel. */
  filterPanelOpen: boolean;
  setFilterPanelOpen: (v: boolean) => void;
  /** Build & Preview drawer. */
  drawerOpen: boolean;
  drawerTab: "build" | "preview";
  openDrawer: (tab?: "build" | "preview") => void;
  closeDrawer: () => void;
  setDrawerTab: (tab: "build" | "preview") => void;
  /** Fullscreen. */
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  /** Sandbox split mode (sandbox layouts call this; ignored elsewhere). */
  sandboxSplit: boolean;
  setSandboxSplit: (v: boolean) => void;
  /** True when the current route is a sandbox route (enables split toggle). */
  isSandboxRoute: boolean;
}

const Ctx = createContext<GlobalControlsState | null>(null);

export function useGlobalControls() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useGlobalControls must be used inside <GlobalControls>");
  }
  return ctx;
}

const STORAGE_KEY_DARK = "sw-dark-mode";
const STORAGE_KEY_SPLIT = "sw-sandbox-mobile-split";

export function GlobalControls({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSandboxRoute = pathname?.startsWith("/sandbox") ?? false;

  // Dark mode: start as null to avoid hydration mismatch; read from
  // localStorage in an effect.
  const [dark, setDarkState] = useState<boolean | null>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY_DARK);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored ? stored === "1" : prefersDark;
    setDarkState(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);
  const setDark = useCallback((v: boolean) => {
    setDarkState(v);
    document.documentElement.classList.toggle("dark", v);
    window.localStorage.setItem(STORAGE_KEY_DARK, v ? "1" : "0");
  }, []);
  const toggleDark = useCallback(() => {
    setDarkState((prev) => {
      const next = !(prev ?? false);
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem(STORAGE_KEY_DARK, next ? "1" : "0");
      return next;
    });
  }, []);

  // Filter side panel.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // Close on route change.
  useEffect(() => {
    setFilterPanelOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  // Build & Preview drawer.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"build" | "preview">("build");
  const openDrawer = useCallback((tab: "build" | "preview" = "build") => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Fullscreen.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => void;
    };
    if (!document.fullscreenElement) {
      const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
      if (req) {
        try {
          const r = req.call(el);
          if (r && typeof (r as Promise<void>).catch === "function") {
            (r as Promise<void>).catch(() => undefined);
          }
        } catch {
          /* denied */
        }
      }
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  // Sandbox split mode (used by MobileSandboxLayout via context).
  const [sandboxSplit, setSandboxSplitState] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY_SPLIT);
    setSandboxSplitState(stored === "1");
  }, []);
  const setSandboxSplit = useCallback((v: boolean) => {
    setSandboxSplitState(v);
    window.localStorage.setItem(STORAGE_KEY_SPLIT, v ? "1" : "0");
  }, []);

  // ---------------------- FAB items ----------------------
  const items = useMemo<FabItem[]>(() => {
    const list: FabItem[] = [
      ...NAV_LINKS,
      {
        kind: "divider",
        key: "div-functions",
        label: "Functions",
      },
      {
        key: "build",
        label: "Build & Preview",
        icon: <Wrench className="size-4" />,
        onClick: () => openDrawer("build"),
      },
    ];
    if (isSandboxRoute) {
      list.push({
        key: "split",
        label: sandboxSplit ? "Exit Split" : "Split View",
        icon: <Columns2 className="size-4" />,
        onClick: () => setSandboxSplit(!sandboxSplit),
        active: sandboxSplit,
      });
    }
    list.push(
      {
        key: "filters",
        label: filterPanelOpen ? "Hide Filters" : "Show Filters",
        icon: <Filter className="size-4" />,
        onClick: () => setFilterPanelOpen((v) => !v),
        active: filterPanelOpen,
      },
      {
        key: "fullscreen",
        label: isFullscreen ? "Exit Fullscreen" : "Fullscreen",
        icon: isFullscreen ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        ),
        onClick: toggleFullscreen,
        active: isFullscreen,
      },
      {
        key: "dark",
        label: (dark ?? false) ? "Light Mode" : "Dark Mode",
        icon: (dark ?? false) ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        ),
        onClick: toggleDark,
        active: dark ?? false,
      },
      ...ACCOUNT_LINKS,
    );
    return list;
  }, [
    isSandboxRoute,
    sandboxSplit,
    setSandboxSplit,
    filterPanelOpen,
    openDrawer,
    isFullscreen,
    toggleFullscreen,
    dark,
    toggleDark,
  ]);

  const ctxValue: GlobalControlsState = {
    dark: dark ?? false,
    setDark,
    toggleDark,
    filterPanelOpen,
    setFilterPanelOpen,
    drawerOpen,
    drawerTab,
    openDrawer,
    closeDrawer,
    setDrawerTab,
    isFullscreen,
    toggleFullscreen,
    sandboxSplit,
    setSandboxSplit,
    isSandboxRoute,
  };

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      <FabSpeedDial items={items} />
      <RightFilterPanel />
      <BuildPreviewDrawer />
    </Ctx.Provider>
  );
}
