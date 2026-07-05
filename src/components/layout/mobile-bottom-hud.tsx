"use client";

// =============================================================================
// MobileBottomHud — pinned bottom navigation bar for <lg viewports.
//
// Replaces the old top header. Layout:
//   [Hamburger FAB] · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · [Tab Segmented]
//
// - Hamburger FAB on the LEFT opens the slide-out navigation drawer.
// - Right side shows segmented tabs when on a sandbox route:
//     /sandbox         → Overview | Grammar | Blueprint | Build
//     /sandbox/grammar → Primitive | Effect | Capability
//     /sandbox/blueprint → Template | Item | Monster
//   On other routes (Library, Characters, Monsters, etc.) the right side is
//   blank — the hamburger is the only navigation affordance.
//
// - Background uses backdrop-filter blur for the iOS translucent-bar look.
// - env(safe-area-inset-bottom) keeps the bar above the iPhone home indicator.
// =============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

// Route → tabs mapping for the right side of the HUD.
const SANDBOX_TABS: Array<{
  prefix: string;
  tabs: Array<{ key: string; label: string; href: string }>;
}> = [
  {
    prefix: "/sandbox/grammar",
    tabs: [
      {
        key: "primitive",
        label: "Primitive",
        href: "/sandbox/grammar?build=primitive",
      },
      { key: "effect", label: "Effect", href: "/sandbox/grammar?build=effect" },
      {
        key: "capability",
        label: "Capability",
        href: "/sandbox/grammar?build=capability",
      },
    ],
  },
  {
    prefix: "/sandbox/blueprint",
    tabs: [
      {
        key: "template",
        label: "Template",
        href: "/sandbox/blueprint?build=template&kind=race",
      },
      { key: "item", label: "Item", href: "/sandbox/blueprint?build=item" },
      {
        key: "monster",
        label: "Monster",
        href: "/sandbox/blueprint?build=monster",
      },
    ],
  },
  {
    prefix: "/sandbox",
    tabs: [
      { key: "overview", label: "Overview", href: "/sandbox" },
      { key: "grammar", label: "Grammar", href: "/sandbox/grammar?build=primitive" },
      {
        key: "blueprint",
        label: "Blueprint",
        href: "/sandbox/blueprint?build=template&kind=race",
      },
      { key: "build", label: "Build", href: "/sandbox/builds" },
    ],
  },
];

interface MobileBottomHudProps {
  onOpenNav: () => void;
}

export function MobileBottomHud({ onOpenNav }: MobileBottomHudProps) {
  const pathname = usePathname();

  // Find matching tab group for the current route.
  let activeTabs: Array<{ key: string; label: string; href: string }> = [];
  let activeKey: string | null = null;
  for (const group of SANDBOX_TABS) {
    if (pathname?.startsWith(group.prefix)) {
      activeTabs = group.tabs;
      // Pick the active tab — the one whose href most closely matches the
      // current pathname + query.
      const exact = group.tabs.find((t) => {
        if (!pathname) return false;
        const [basePath] = t.href.split("?");
        return pathname === basePath || pathname.startsWith(`${basePath}/`);
      });
      activeKey = exact?.key ?? null;
      break;
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-shell/85 backdrop-blur-md lg:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="navigation"
      aria-label="Mobile"
    >
      <div className="flex h-12 items-stretch gap-2 px-2">
        {/* Hamburger FAB — high-contrast, sits at the left edge. */}
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="flex shrink-0 items-center justify-center rounded-md bg-primary px-3 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Menu className="size-5" />
        </button>

        {/* Tab segmented group on the right (or spacer if no tabs). */}
        {activeTabs.length > 0 ? (
          <div
            role="tablist"
            className="flex min-w-0 flex-1 items-stretch overflow-x-auto rounded-md border border-border bg-card p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {activeTabs.map((tab) => {
              const active = activeKey === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "flex min-w-0 shrink-0 items-center justify-center whitespace-nowrap rounded px-2 text-[11px] font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}