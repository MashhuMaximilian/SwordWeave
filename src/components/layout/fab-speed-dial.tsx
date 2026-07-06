"use client";

// =============================================================================
// FabSpeedDial — expandable floating action button menu.
//
// The primary FAB sits at the bottom-right of the screen. Tapping it rotates
// the icon 45° and reveals a vertical stack of secondary action buttons:
//   - Split toggle: enable Library | Build + Preview split on mobile
//   - Fullscreen toggle: request Fullscreen API
//   - Filters toggle: open/close the toolbar's filter panel
//   - Reset: form-only reset (for sandbox forms)
//
// Each child action is a circular pill with icon + short label. Children slide
// up from below the primary button when the menu opens, with a staggered
// delay so they appear to cascade.
//
// All actions are reachable with one tap from anywhere on the page. The
// primary button itself remains accessible as a "close" gesture.
// =============================================================================

import {
  Columns2,
  Filter,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type FabAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  hidden?: boolean;
};

interface FabSpeedDialProps {
  actions: FabAction[];
  /** Primary button label (used for aria-label when closed). */
  primaryLabel?: string;
  /** Distance from the bottom of the viewport (includes safe-area). */
  bottomOffset?: number;
}

export function FabSpeedDial({
  actions,
  primaryLabel = "Open actions",
  bottomOffset = 16,
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

  // Filter out hidden actions.
  const visibleActions = actions.filter((a) => !a.hidden);

  return (
    <div
      ref={containerRef}
      className="fixed right-4 z-30 flex flex-col items-end gap-2 lg:hidden"
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Secondary actions — render in reverse order so visually the first
          action in the list sits closest to the primary button. */}
      {open ? (
        <div className="flex flex-col-reverse items-end gap-2">
          {visibleActions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              disabled={action.disabled}
              aria-pressed={action.active}
              style={{
                animation: `sw-fab-action-in 180ms ease-out both`,
                animationDelay: `${index * 35}ms`,
              }}
              className={cn(
                "group flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-md backdrop-blur transition-all hover:scale-105 active:scale-95",
                action.active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground",
                action.disabled && "opacity-40 pointer-events-none",
              )}
            >
              <span className="flex size-7 items-center justify-center">
                {action.icon}
              </span>
              <span className="max-w-[120px] truncate pr-1">{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Primary FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close actions" : primaryLabel}
        aria-expanded={open}
        className={cn(
          "relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-2 ring-primary/30 transition-all duration-200 hover:scale-105 active:scale-95",
          open && "rotate-45 bg-foreground text-background ring-foreground/30",
        )}
      >
        <Plus className="size-6 transition-transform" />
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full",
            !open && "animate-ping bg-primary/30 [animation-duration:2.5s]",
          )}
        />
      </button>

      <style jsx>{`
        @keyframes sw-fab-action-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.92);
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

// Convenience icon helpers (re-export so consumers don't need lucide).
export const FabIcons = {
  Columns2,
  Filter,
  Maximize2,
  Minimize2,
  RotateCcw,
};