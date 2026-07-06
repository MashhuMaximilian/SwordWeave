"use client";

// =============================================================================
// FabSpeedDial — expandable floating action button menu.
//
// The primary FAB sits at the bottom-right of the screen on ALL viewports
// (mobile + desktop) so navigation is consistent.
//
// Tapping the FAB rotates the icon 45° and reveals a stack of:
//   1. Section: "Navigate" — links to pages
//   2. Section: "Functions" — top row: 3 icon-only toggles
//                          (Split / Fullscreen / Dark mode)
//                          bottom row: 2 icon-only actions
//                          (Build & Preview / Filters)
//   3. Section: "Account"  — Profile button that opens the user menu
//                          (avatar + view profile / edit / sign out)
//
// On mobile, the toggle row is rendered as 3 icon-only buttons in a single
// row; the action row is 2 icon-only buttons. On desktop the same layout
// is used — the user asked for no labels regardless of viewport, just
// tight icon grids that fit in a small FAB card.
// =============================================================================

import {
  BookOpen,
  Columns2,
  Filter,
  Hammer,
  Library as LibraryIcon,
  Maximize2,
  Minimize2,
  Moon,
  Package,
  Plus,
  Sun,
  Swords,
  User,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Action button: toggles a state, calls onClick. */
export type FabAction = {
  kind?: "action";
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
};

/** Link button: navigates to a page. */
export type FabLink = {
  kind: "link";
  key: string;
  label: string;
  icon: ReactNode;
  href: string;
  external?: boolean;
};

/** Section divider: a thin label row. */
export type FabDivider = {
  kind: "divider";
  key: string;
  label: string;
};

/** User-menu opener: when tapped, opens the user menu modal. */
export type FabUserMenu = {
  kind: "userMenu";
  key: string;
};

export type FabItem = FabAction | FabLink | FabDivider | FabUserMenu;

interface FabSpeedDialProps {
  items: FabItem[];
  /** Primary button label (used for aria-label when closed). */
  primaryLabel?: string;
  /** Distance from the bottom of the viewport (includes safe-area). */
  bottomOffset?: number;
  /** Whether to render the primary FAB itself (false hides the entire FAB). */
  visible?: boolean;
  /** Render the user menu (only the FAB itself knows about the user's profile). */
  onUserMenu?: () => void;
  /** Currently signed-in user (for the user menu button in the FAB). */
  currentUser?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export function FabSpeedDial({
  items,
  primaryLabel = "Open menu",
  bottomOffset = 16,
  visible = true,
  onUserMenu,
  currentUser,
}: FabSpeedDialProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed right-4 z-40 flex flex-col items-end gap-2"
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {open ? (
        <div className="flex max-h-[80vh] flex-col items-stretch gap-1.5 overflow-y-auto rounded-2xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-md">
          {items.map((item, index) => {
            // The "Functions" section in the dial is replaced by a
            // compact icon-grid card (rendered below). Hide the inline
            // divider and the per-action entries that the card duplicates.
            if (item.kind === "divider" && item.key === "div-functions") {
              return null;
            }
            if (
              item.kind === "action" &&
              (item.key === "split" ||
                item.key === "fullscreen" ||
                item.key === "dark" ||
                item.key === "build" ||
                item.key === "filters")
            ) {
              return null;
            }
            if (item.kind === "divider") {
              return (
                <div
                  key={item.key}
                  className="mt-1 border-t border-border/60 px-2 pt-1.5"
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </span>
                </div>
              );
            }
            if (item.kind === "userMenu") {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onUserMenu?.();
                    setOpen(false);
                  }}
                  style={{
                    animation: `sw-fab-item-in 180ms ease-out both`,
                    animationDelay: `${index * 25}ms`,
                  }}
                  className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] hover:border-border hover:bg-accent"
                >
                  {currentUser?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName ?? currentUser.username}
                      className="size-6 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-[10px] font-bold text-primary">
                      {(currentUser?.displayName ?? currentUser?.username ?? "U")[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="truncate">
                    {currentUser?.displayName ??
                      currentUser?.username ??
                      "Profile"}
                  </span>
                </button>
              );
            }
            if (item.kind === "link") {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    animation: `sw-fab-item-in 180ms ease-out both`,
                    animationDelay: `${index * 25}ms`,
                  }}
                  className="group flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-foreground transition-all hover:scale-[1.02] active:scale-[0.98] hover:border-border hover:bg-accent"
                >
                  <span className="flex size-6 items-center justify-center text-muted-foreground group-hover:text-primary">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            }
            // FabAction — action button (with optional active state).
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onClick();
                  // Heuristic: toggles (with `active` flag) keep the dial
                  // open so the user can verify the state.
                  if (item.active === undefined) setOpen(false);
                }}
                disabled={item.disabled}
                aria-pressed={item.active}
                aria-label={item.label}
                title={item.label}
                style={{
                  animation: `sw-fab-item-in 180ms ease-out both`,
                  animationDelay: `${index * 25}ms`,
                }}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]",
                  item.active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : "border-transparent text-foreground hover:border-border hover:bg-accent",
                  item.disabled && "opacity-40 pointer-events-none",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center",
                    item.active
                      ? "text-primary-foreground"
                      : "text-muted-foreground group-hover:text-primary",
                  )}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {item.active ? (
                  <span className="ml-auto size-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </button>
            );
          })}

          {/* The "icon grid" card for the Functions section. We detect it
              by the divider that immediately precedes it; simpler: just
              render an extra card when the items list has both 3 toggles
              and 2 actions. We piggyback on the divider key. */}
          {items.some((i) => i.kind === "divider" && i.key === "div-functions") ? (
            <div
              className="mt-1 rounded-xl border border-border bg-card/60 p-1.5"
              style={{
                animation: `sw-fab-item-in 180ms ease-out both`,
                animationDelay: `${items.length * 25}ms`,
              }}
            >
              <p className="mb-1 px-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Quick toggles
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {items
                  .filter(
                    (i) =>
                      i.kind !== "divider" &&
                      i.kind !== "link" &&
                      i.kind !== "userMenu" &&
                      (i.key === "split" ||
                        i.key === "fullscreen" ||
                        i.key === "dark"),
                  )
                  .map((i) => {
                    if (i.kind === "divider" || i.kind === "link" || i.kind === "userMenu")
                      return null;
                    return (
                      <button
                        key={i.key}
                        type="button"
                        onClick={() => {
                          i.onClick();
                        }}
                        disabled={i.disabled}
                        aria-pressed={i.active}
                        aria-label={i.label}
                        title={i.label}
                        className={cn(
                          "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-[9px] font-medium transition-all active:scale-95",
                          i.active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                        )}
                      >
                        <span className="flex size-5 items-center justify-center">
                          {i.icon}
                        </span>
                      </button>
                    );
                  })}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {items
                  .filter(
                    (i) =>
                      i.kind !== "divider" &&
                      i.kind !== "link" &&
                      i.kind !== "userMenu" &&
                      (i.key === "build" || i.key === "filters"),
                  )
                  .map((i) => {
                    if (i.kind === "divider" || i.kind === "link" || i.kind === "userMenu")
                      return null;
                    return (
                      <button
                        key={i.key}
                        type="button"
                        onClick={() => {
                          i.onClick();
                          if (i.active === undefined) setOpen(false);
                        }}
                        disabled={i.disabled}
                        aria-pressed={i.active}
                        aria-label={i.label}
                        title={i.label}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-medium transition-all active:scale-95",
                          i.active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                        )}
                      >
                        <span className="flex size-4 items-center justify-center">
                          {i.icon}
                        </span>
                        <span className="truncate">{i.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Primary FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : primaryLabel}
        aria-expanded={open}
        className={cn(
          "relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl ring-4 ring-primary/20 transition-all duration-200 hover:scale-105 active:scale-95",
          open && "rotate-45 bg-foreground text-background ring-foreground/20",
        )}
      >
        {open ? <X className="size-6" /> : <Plus className="size-7" />}
        {!open ? (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-primary/30 [animation-duration:3s]" />
        ) : null}
      </button>

      <style jsx>{`
        @keyframes sw-fab-item-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Pre-built item sets for each route family. Consumers can compose these or
// pass their own.
// -----------------------------------------------------------------------------

/**
 * Top-level navigation — slim 5-item set per the user's spec.
 * Library / My Creations / Grammar / Templates / Builds.
 */
export const NAV_LINKS: FabItem[] = [
  {
    kind: "divider",
    key: "div-nav",
    label: "Navigate",
  },
  {
    kind: "link",
    key: "library",
    label: "Library",
    icon: <BookOpen className="size-4" />,
    href: "/library/browse",
  },
  {
    kind: "link",
    key: "creations",
    label: "My Creations",
    icon: <Hammer className="size-4" />,
    href: "/creations",
  },
  {
    kind: "link",
    key: "sandbox-grammar",
    label: "Grammar",
    icon: <LibraryIcon className="size-4" />,
    href: "/sandbox/grammar?build=primitive",
  },
  {
    kind: "link",
    key: "sandbox-templates",
    label: "Templates",
    icon: <UserRound className="size-4" />,
    href: "/sandbox/blueprint?build=template",
  },
  {
    kind: "link",
    key: "sandbox-builds",
    label: "Builds",
    icon: <Swords className="size-4" />,
    href: "/sandbox/characters",
  },
];

/** Profile row at the bottom — opens the user menu modal, not a settings link. */
export const ACCOUNT_LINKS: FabItem[] = [
  {
    kind: "divider",
    key: "div-account",
    label: "Account",
  },
  {
    kind: "userMenu",
    key: "user-menu",
  },
];

// Re-export icons for convenience.
export const FabIcons = {
  BookOpen,
  Columns2,
  Filter,
  Hammer,
  LibraryIcon,
  Maximize2,
  Minimize2,
  Moon,
  Package,
  Plus,
  Sun,
  Swords,
  User,
  UserRound,
  Wrench,
  X,
};
