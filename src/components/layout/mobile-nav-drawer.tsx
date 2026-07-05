"use client";

// =============================================================================
// MobileNavDrawer — slide-out navigation drawer for the mobile header.
//
// Replaces the scrollable horizontal nav with a hamburger-triggered drawer on
// viewports <lg (1024px). Consolidates:
//   - Primary nav (Sandbox / Library / Characters / Monsters / Items)
//   - Sandbox workshops (Primitives / Effects / Capabilities / etc.)
//   - Theme toggle + Sign-in / Sign-up / User menu (when present)
//
// Slide-in animation from the left, backdrop click to close, ESC to close,
// body scroll lock while open. Mobile-first: full-screen on small viewports,
// narrower sheet on tablet.
// =============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import {
  Boxes,
  FlaskConical,
  Library,
  LogIn,
  Menu,
  Package,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const primaryNav = [
  { href: "/sandbox", label: "Sandbox", icon: FlaskConical },
  { href: "/library", label: "Library", icon: Library },
  { href: "/characters", label: "Characters", icon: UserRound },
  { href: "/monsters", label: "Monsters", icon: Shield },
  { href: "/items", label: "Items", icon: Package },
] as const;

const sandboxNav = [
  {
    href: "/sandbox/grammar?build=primitive",
    label: "Primitives",
    icon: Boxes,
  },
  { href: "/sandbox/grammar?build=effect", label: "Effects", icon: Sparkles },
  {
    href: "/sandbox/grammar?build=capability",
    label: "Capabilities",
    icon: Swords,
  },
  { href: "/sandbox/blueprint?build=item", label: "Items", icon: Package },
  {
    href: "/sandbox/blueprint?build=template&kind=race",
    label: "Templates",
    icon: ScrollText,
  },
  { href: "/sandbox/builds", label: "Builds", icon: Swords },
  { href: "/sandbox/characters", label: "Character Wizard", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Auto-close on route change (so the drawer doesn't linger after navigation)
  useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      className="fixed inset-0 z-50 lg:hidden"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer sheet (slides in from left) */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(85vw,360px)] flex-col bg-background shadow-xl",
          "transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 font-display text-xl font-semibold uppercase"
          >
            <ScrollText className="size-5 text-primary" />
            SwordWeave
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <nav
          aria-label="Primary navigation"
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          {/* Primary nav section */}
          <p className="px-3 pb-2 font-display text-sm font-semibold uppercase text-muted-foreground">
            Browse
          </p>
          <div className="grid gap-1">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Sandbox workshops section */}
          <p className="mt-6 px-3 pb-2 font-display text-sm font-semibold uppercase text-muted-foreground">
            Workshops
          </p>
          <div className="grid gap-1">
            {sandboxNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Drawer footer — account controls + theme toggle */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            {isSignedIn ? (
              <UserMenu />
            ) : (
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    aria-label="Sign in"
                    className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground"
                  >
                    <LogIn className="size-4" />
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    aria-label="Sign up"
                    className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
                  >
                    <UserPlus className="size-4" />
                  </button>
                </SignUpButton>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------------
// HamburgerButton — the trigger that opens the drawer. Caller owns the state.
// ----------------------------------------------------------------------------

export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open navigation"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent"
    >
      <Menu className="size-5" />
    </button>
  );
}