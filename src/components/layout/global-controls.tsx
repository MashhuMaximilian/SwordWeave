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
//
// The FAB exposes 5 nav destinations (Library, My Creations, Grammar,
// Templates, Builds) + a Functions card (3 icon-only toggles + 2 icon-only
// actions) + a Profile row that opens the user menu modal.
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
import { usePathname, useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Columns2,
  Filter,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Settings,
  Sun,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import { cn } from "@/lib/utils";

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
  /** True when the active sandbox form has unsaved changes. The FAB shows a
   *  notification dot on the Build & Preview button when this is true, and
   *  tab-switch handlers consult it before letting the user change modes. */
  sandboxFormDirty: boolean;
  setSandboxFormDirty: (v: boolean) => void;
  /** Active tab in the bottom-half of the mobile split sandbox. In split
   *  mode the form & preview are both rendered inline in the bottom panel;
   *  this controls which one is visible. Persisted across navigations. */
  sandboxBottomTab: "build" | "preview";
  setSandboxBottomTab: (tab: "build" | "preview") => void;
}

const Ctx = createContext<GlobalControlsState | null>(null);

// No-op fallback so callsites outside the GlobalControls tree (e.g. a
// modal body that renders outside the provider for any reason) don't
// crash the page. The previous behaviour threw an error, which
// propagated up to Next.js's error boundary and produced the
// "page could not load" overlay for the entire /sandbox/* page on
// row click. The no-op silently degrades instead.
const NOOP_GLOBAL_CONTROLS: GlobalControlsState = {
  dark: false,
  setDark: () => {},
  toggleDark: () => {},
  filterPanelOpen: false,
  setFilterPanelOpen: () => {},
  drawerOpen: false,
  drawerTab: "build",
  openDrawer: () => {},
  closeDrawer: () => {},
  setDrawerTab: () => {},
  isFullscreen: false,
  toggleFullscreen: () => {},
  sandboxSplit: false,
  setSandboxSplit: () => {},
  isSandboxRoute: false,
  sandboxFormDirty: false,
  setSandboxFormDirty: () => {},
  sandboxBottomTab: "build",
  setSandboxBottomTab: () => {},
};

export function useGlobalControls(): GlobalControlsState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Defensive: no provider in the tree. Return a no-op so callsites
    // (especially modal bodies that may render outside the GlobalControls
    // tree in some edge cases) don't crash the entire page. This
    // previously threw, which took down the whole sandbox on row click
    // when the modal-stack renderer wasn't wrapped in GlobalControls.
    if (typeof console !== "undefined") {
      console.warn(
        "useGlobalControls called outside <GlobalControls> — returning no-op. " +
          "Make sure AppShell wraps the page in <GlobalControls>.",
      );
    }
    return NOOP_GLOBAL_CONTROLS;
  }
  return ctx;
}

const STORAGE_KEY_DARK = "sw-dark-mode";
const STORAGE_KEY_SPLIT = "sw-sandbox-mobile-split";

export function GlobalControls({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isSandboxRoute = pathname?.startsWith("/sandbox") ?? false;
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const stack = useModalStack();

  // Profile data from Clerk — used by the FAB's user-menu button to show
  // the avatar + display name. The full user menu body is rendered as a
  // ModalStack entry when the user taps the profile row in the FAB.
  const currentUser = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return null;
    const username =
      user.username ??
      user.primaryEmailAddress?.emailAddress?.split("@")[0] ??
      "user";
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      username;
    return {
      username,
      displayName,
      avatarUrl: user.imageUrl,
    };
  }, [isLoaded, isSignedIn, user]);

  function openUserMenu() {
    if (!stack.canPush) return;
    stack.push({
      key: "user-menu",
      label: currentUser?.displayName ?? currentUser?.username ?? "Profile",
      category: "Account",
      content: (
        <UserMenuBody
          currentUser={currentUser}
          onViewProfile={() => {
            if (currentUser) router.push(`/u/${currentUser.username}`);
            stack.clear();
          }}
          onEditProfile={() => {
            router.push("/settings/profile");
            stack.clear();
          }}
          onManageAccount={() => {
            openUserProfile();
            stack.clear();
          }}
          onSignOut={() => {
            signOut(() => router.push("/"));
          }}
        />
      ),
    });
  }

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

  // Sandbox form dirty state — lifted here so the FAB can render a
  // notification dot on the Build & Preview button and the tab-switch
  // guard can consult it without prop-drilling. Sandbox pages call
  // setSandboxFormDirty(true/false) from their form onStateChange.
  const [sandboxFormDirty, setSandboxFormDirty] = useState(false);
  // Reset to false on route change so a dirty primitive form doesn't bleed
  // into the build (item) tab.
  useEffect(() => {
    setSandboxFormDirty(false);
  }, [pathname]);

  // Sandbox bottom-half tab (split mode only). Controls which content
  // (build form vs preview) is rendered in the bottom panel.
  const [sandboxBottomTab, setSandboxBottomTabState] = useState<"build" | "preview">(
    "build",
  );

  const setSandboxBottomTab = useCallback((tab: "build" | "preview") => {
    setSandboxBottomTabState(tab);
  }, []);

  // Split-screen is only meaningful on the grammar and templates
  // sandbox routes (where the form is the primary surface). The
  // characters / builds sandbox has its own layout that doesn't
  // benefit from a split, so the FAB button is hidden there.
  const isSplitableSandboxRoute =
    pathname?.startsWith("/sandbox/grammar") ||
    pathname?.startsWith("/sandbox/blueprint");

  // ---------------------- FAB items ----------------------
  // Note: per the user's spec, the in-list "Functions" row is hidden in
  // the dial — the 3 toggles + 2 actions are instead rendered as a compact
  // icon grid card at the bottom of the dial. The dial still passes the
  // items so they're available, but we filter out the ones that duplicate
  // the icon grid (split/fullscreen/dark/build/filters) from the list view.
  const items = useMemo<FabItem[]>(() => {
    const list: FabItem[] = [
      ...NAV_LINKS,
      {
        kind: "divider",
        key: "div-functions",
        label: "Functions",
      },
    ];
    if (isSplitableSandboxRoute) {
      list.push({
        kind: "action",
        key: "split",
        label: sandboxSplit ? "Exit Split" : "Split View",
        icon: <Columns2 className="size-4" />,
        onClick: () => setSandboxSplit(!sandboxSplit),
        active: sandboxSplit,
      });
    }
    list.push(
      {
        kind: "action",
        key: "build",
        // In split mode the build form is already inline in the bottom
        // panel and the drawer has no build-tab content (we register
        // `build: null` to useDrawerSlot when sandboxSplit is true).
        // The FAB "Build & Preview" button therefore opens the drawer's
        // PREVIEW tab in split mode — which IS populated — and the
        // build tab otherwise.
        label: "Build & Preview",
        icon: <Wrench className="size-4" />,
        onClick: () => openDrawer(sandboxSplit ? "preview" : "build"),
      },
      // Filters only appear on routes that actually use the filter
      // panel: the library browse view and the sandbox. Home and
      // source pages have no filters so the button is hidden there.
      ...(pathname?.startsWith("/library") || isSandboxRoute
        ? [
            {
              kind: "action" as const,
              key: "filters",
              label: filterPanelOpen ? "Hide Filters" : "Show Filters",
              icon: <Filter className="size-4" />,
              onClick: () => setFilterPanelOpen((v) => !v),
              active: filterPanelOpen,
            },
          ]
        : []),
      {
        kind: "action",
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
        kind: "action",
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
    isSplitableSandboxRoute,
    sandboxSplit,
    setSandboxSplit,
    filterPanelOpen,
    openDrawer,
    isFullscreen,
    toggleFullscreen,
    dark,
    toggleDark,
    pathname,
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
    sandboxFormDirty,
    setSandboxFormDirty,
    sandboxBottomTab,
    setSandboxBottomTab,
  };

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      <FabSpeedDial
        items={items}
        onUserMenu={openUserMenu}
        currentUser={currentUser}
        buildStashCount={sandboxFormDirty ? 1 : 0}
        // On sandbox routes a bottom tab bar (~50px tall + safe-area)
        // is fixed to the viewport bottom. The default FAB bottom
        // offset (16px) puts the FAB ON TOP of the tab bar's
        // labels — the "Capability" tab is unreadable. Lift the FAB
        // above the tab bar so the two don't collide. 64px = 16px
        // (default gap) + 48px (tab bar visible height).
        bottomOffset={isSandboxRoute ? 64 : 16}
      />
      <RightFilterPanel />
      <BuildPreviewDrawer />
    </Ctx.Provider>
  );
}

// -----------------------------------------------------------------------------
// UserMenuBody — body for the user menu modal. Renders the same profile
// block + action list as the existing UserMenu component, but as a modal
// stack entry so it can be opened from the FAB on mobile.
// -----------------------------------------------------------------------------

function UserMenuBody({
  currentUser,
  onViewProfile,
  onEditProfile,
  onManageAccount,
  onSignOut,
}: {
  currentUser: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  onViewProfile: () => void;
  onEditProfile: () => void;
  onManageAccount: () => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  if (!currentUser) {
    // Signed out — previously this just showed a "Sign in to manage your
    // profile" notice and gave the user no way to actually sign in. The
    // user reported they had to know the magic URL (/sign-in) to get back
    // in. Add explicit Sign in / Sign up buttons so the path is obvious.
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          Sign in to manage your profile, fork library entries to your
          sandbox, and publish your own creations.
        </div>
        <button
          type="button"
          onClick={() => {
            router.push("/sign-in");
            // Don't close the modal — let the page navigation handle
            // it. Closing here would flash an empty FAB before the
            // /sign-in page renders.
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            router.push("/sign-up");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Create an account
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
        {currentUser.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.displayName ?? currentUser.username}
            className="size-10 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-bold text-primary">
            {(currentUser.displayName ?? currentUser.username)[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {currentUser.displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            @{currentUser.username}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onViewProfile}
        className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm hover:border-border hover:bg-accent"
      >
        <UserIcon className="size-4" /> View profile
      </button>
      <button
        type="button"
        onClick={onEditProfile}
        className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm hover:border-border hover:bg-accent"
      >
        <Settings className="size-4" /> Edit profile
      </button>
      <button
        type="button"
        onClick={onManageAccount}
        className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm hover:border-border hover:bg-accent"
      >
        <Settings className="size-4" /> Manage account
      </button>
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        onClick={onSignOut}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm",
          "text-destructive hover:bg-destructive/10",
        )}
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}
