"use client";

// =============================================================================
// FabSpeedDial — expandable floating action button menu.
//
// The primary FAB sits at the bottom-right of the screen on ALL viewports
// (mobile + desktop) so navigation is consistent.
//
// Tapping the FAB rotates the icon 45° and reveals a vertical stack:
//   - Section: "Navigate" — links to pages (closes dial + navigates)
//   - Divider
//   - Section: "Functions" — toggles (Split View, Fullscreen, Dark Mode)
//              and actions (Build & Preview, Filters)
//
// On mobile the 3 toggle buttons render as a compact horizontal row inside
// the dial. On desktop the toggles stay full-width pills (more room).
//
// All actions are reachable with one tap from anywhere on the page.
// =============================================================================

import {
  BookOpen,
  Building2,
  Columns2,
  Filter,
  FlaskConical,
  Hammer,
  Library as LibraryIcon,
  Maximize2,
  Minimize2,
  Moon,
  Package,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
  Sun,
  User,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Action button: toggles a state, calls onClick. */
export type FabAction = {
  kind?: "action";
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
};

/** Link button: navigates to a page. */
export type FabLink = {
  kind: "link";
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  external?: boolean;
};

/** Section divider: a thin label row. */
export type FabDivider = {
  kind: "divider";
  key: string;
  label: string;
};

export type FabItem = FabAction | FabLink | FabDivider;

interface FabSpeedDialProps {
  items: FabItem[];
  /** Primary button label (used for aria-label when closed). */
  primaryLabel?: string;
  /** Distance from the bottom of the viewport (includes safe-area). */
  bottomOffset?: number;
  /** Whether to render the primary FAB itself (false hides the entire FAB). */
  visible?: boolean;
}

export function FabSpeedDial({
  items,
  primaryLabel = "Open menu",
  bottomOffset = 16,
  visible = true,
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
      {/* Secondary items — render in reverse order so the first item in the
          list sits closest to the primary button. */}
      {open ? (
        <div className="flex max-h-[80vh] flex-col-reverse items-end gap-1.5 overflow-y-auto rounded-2xl border border-border bg-background/95 p-1.5 shadow-2xl backdrop-blur-md">
          {items.map((item, index) => {
            if (item.kind === "divider") {
              return (
                <div
                  key={item.key}
                  className="my-1 w-full border-t border-border/60 px-2 pt-1.5 pb-0.5"
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
                  // Keep dial open for toggles; close for one-shot actions.
                  // Heuristic: if the item has an `active` flag, leave the
                  // dial open so the user can verify the toggle state.
                  if (item.active === undefined) setOpen(false);
                }}
                disabled={item.disabled}
                aria-pressed={item.active}
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

/** Top-level navigation — single-tap destinations. Used on most pages. */
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
    key: "sandbox",
    label: "Sandbox",
    icon: <FlaskConical className="size-4" />,
    href: "/sandbox",
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
    key: "characters",
    label: "Characters",
    icon: <UserRound className="size-4" />,
    href: "/characters",
  },
  {
    kind: "link",
    key: "monsters",
    label: "Monsters",
    icon: <Shield className="size-4" />,
    href: "/monsters",
  },
  {
    kind: "link",
    key: "items",
    label: "Items",
    icon: <Package className="size-4" />,
    href: "/items",
  },
];

/** Account/theme footer — always at the bottom. */
export const ACCOUNT_LINKS: FabItem[] = [
  {
    kind: "divider",
    key: "div-account",
    label: "Account",
  },
  {
    kind: "link",
    key: "account",
    label: "Profile & Settings",
    icon: <User className="size-4" />,
    href: "/settings/profile",
  },
];

// Re-export icons for convenience.
export const FabIcons = {
  BookOpen,
  Building2,
  Columns2,
  Filter,
  FlaskConical,
  Hammer,
  LibraryIcon,
  Maximize2,
  Minimize2,
  Moon,
  Package,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
  Sun,
  User,
  UserRound,
  Wrench,
  X,
};
