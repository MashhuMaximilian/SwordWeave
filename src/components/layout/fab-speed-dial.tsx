"use client";

// =============================================================================
// FabSpeedDial — expandable floating action button menu.
//
// The primary FAB sits at the bottom-right of the screen on ALL viewports
// (mobile + desktop). The FAB replaces the desktop left sidebar entirely
// (see app-shell.tsx — sidebar removed).
//
// Tapping the FAB reveals a stack of:
//   1. Section: "Navigate" — Home + page links (Library, My Creations, Grammar, Templates, Builds)
//   2. Section: "Quick toggles" — small icon-only grid of state toggles
//                                (Split / Fullscreen / Dark mode)
//   3. Section: "Actions" — Build & Preview, Show Filters
//   4. Section: "Account"  — Profile row that opens the user menu modal
//                            (avatar + view profile / edit / sign out)
//
// The primary button is a hamburger icon (Menu/X), not a +.
//
// On the library page, all entries are shown as full text buttons in a
// compact list (not icon-only) so users can see what they're tapping. The
// toggle grid is below the nav list.
// =============================================================================

import {
  BookOpen,
  Columns2,
  Filter,
  Hammer,
  Library as LibraryIcon,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  Swords,
  Sun,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
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
  /**
   * Number to show as a small notification dot on the Build & Preview
   * button in the bottom 2x3 grid. > 0 = show the dot. The build stash
   * is the in-progress sandbox form; a dot means "you have unsaved
   * changes — open the sheet to continue."
   */
  buildStashCount?: number;
}

export function FabSpeedDial({
  items,
  primaryLabel = "Open menu",
  bottomOffset = 16,
  visible = true,
  onUserMenu,
  currentUser,
  buildStashCount = 0,
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
      className="fixed right-3 z-40 flex flex-col items-end gap-2 sm:right-4"
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {open ? (
        <div
          className="flex max-h-[80vh] w-[min(280px,calc(100vw-1.5rem))] flex-col items-stretch gap-0.5 overflow-y-auto rounded-xl border border-border bg-background/95 p-1.5 shadow-2xl backdrop-blur-md"
          // Stop the close-on-outside-pointer from racing the click when the
          // user taps inside the dial. pointerdown bubbles up; without this
          // guard the dial closes before the click handler can fire (which
          // is why the user-menu "Account" row never opened).
          onPointerDown={(e) => e.stopPropagation()}
        >
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
            // The Account row is also rendered in the icon grid below.
            if (item.kind === "divider" && item.key === "div-account") {
              return null;
            }
            if (item.kind === "userMenu") {
              return null;
            }
            if (item.kind === "divider") {
              return (
                <div
                  key={item.key}
                  className="mt-1.5 border-t border-border/60 px-1.5 pb-0.5 pt-1.5 first:mt-0 first:border-t-0 first:pt-0"
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </span>
                </div>
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
                    animationDelay: `${index * 20}ms`,
                  }}
                  className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-xs font-medium text-foreground transition-all hover:bg-accent"
                >
                  <span className="flex size-6 items-center justify-center text-muted-foreground group-hover:text-primary">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            }
            // FabAction — action button (with optional active state).
            // Used for Build & Preview and Show Filters in the action row.
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onClick();
                  if (item.active === undefined) setOpen(false);
                }}
                disabled={item.disabled}
                aria-pressed={item.active}
                aria-label={item.label}
                title={item.label}
                style={{
                  animation: `sw-fab-item-in 180ms ease-out both`,
                  animationDelay: `${index * 20}ms`,
                }}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all",
                  item.active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-foreground hover:bg-accent",
                  item.disabled && "opacity-40 pointer-events-none",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center",
                    item.active
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-primary",
                  )}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {item.active ? (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" />
                ) : null}
              </button>
            );
          })}

          {/* Compact icon grid — 2x3 of small icon-only buttons, fill width.
              Row 1: split, dark, fullscreen toggles.
              Row 2: account (opens user menu), build&preview, show filters. */}
          <div
            className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-card/40 p-1"
            style={{
              animation: `sw-fab-item-in 180ms ease-out both`,
              animationDelay: `${items.length * 20}ms`,
            }}
          >
            {(
              [
                ...items.filter(
                  (i): i is FabAction =>
                    i.kind === "action" &&
                    (i.key === "split" ||
                      i.key === "fullscreen" ||
                      i.key === "dark"),
                ),
                {
                  kind: "action" as const,
                  key: "account",
                  label: "Account",
                  icon: <UserRound className="size-4" />,
                  // Push the user-menu modal FIRST, then close the FAB. The
                  // old `setTimeout(0)` deferred the push to the next tick,
                  // which raced against React's flush and sometimes dropped
                  // the push entirely — the user reported "the Account
                  // button just closes the FAB." Synchronous push + same-
                  // tick close is React-batched into a single render, so
                  // the FAB unmounts only after the modal is queued.
                  onClick: () => {
                    onUserMenu?.();
                    setOpen(false);
                  },
                },
                ...items.filter(
                  (i): i is FabAction =>
                    i.kind === "action" &&
                    (i.key === "build" || i.key === "filters"),
                ),
              ] as FabAction[]
            ).map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => action.onClick()}
                disabled={action.disabled}
                aria-pressed={action.active}
                aria-label={action.label}
                title={action.label}
                className={cn(
                  "relative flex h-9 w-full items-center justify-center rounded-md border text-[10px] font-medium transition-all active:scale-95",
                  action.active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
                )}
              >
                {action.icon}
                {action.key === "build" && buildStashCount > 0 ? (
                  <span
                    className="pointer-events-none absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-background"
                    aria-label={`${buildStashCount} unsaved build change${buildStashCount === 1 ? "" : "s"}`}
                  >
                    {buildStashCount > 9 ? "9+" : buildStashCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Primary FAB — hamburger icon (Menu ↔ X) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : primaryLabel}
        aria-expanded={open}
        className={cn(
          "relative flex size-12 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-xl ring-1 ring-border/30 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95",
          open && "bg-foreground text-background ring-foreground/30",
        )}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
        {!open ? (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:3s]" />
        ) : null}
      </button>

      <style jsx>{`
        @keyframes sw-fab-item-in {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.95);
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
// Pre-built item sets — consumers compose these or pass their own.
// -----------------------------------------------------------------------------

/**
 * Top-level navigation — slim 6-item set per the user's spec.
 * Home / Library / My Creations / Grammar / Templates / Builds.
 */
export const NAV_LINKS: FabItem[] = [
  {
    kind: "divider",
    key: "div-nav",
    label: "Navigate",
  },
  {
    kind: "link",
    key: "home",
    // Logo placed here 2026-07-14 — replaces the lucide Home icon
    // for branded entry point into the app. Theme-aware via two
    // stacked <Image>s with `dark:` CSS swap: /logo-light.png is
    // teal-on-transparent (visible against the FAB's light-mode
    // button face), /logo-dark.png is white-on-transparent (visible
    // against the dark-mode button face). Sized at 32px (size-8)
    // to give the hex composition room against the 16px lucide
    // siblings. `priority` on both because the FAB sits in the
    // initial viewport on every route.
    label: "Home",
    icon: (
      <>
        <Image
          src="/logo-light.png"
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-sm block dark:hidden"
          priority
        />
        <Image
          src="/logo-dark.png"
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-sm hidden dark:block"
          priority
        />
      </>
    ),
    href: "/",
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
    key: "builds",
    label: "Builds",
    icon: <Swords className="size-4" />,
    href: "/characters",
  },
];

/** Profile row at the bottom — opens the user menu modal. */
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
  Menu,
  Minimize2,
  Moon,
  Sun,
  Swords,
  UserRound,
  Wrench,
  X,
};
