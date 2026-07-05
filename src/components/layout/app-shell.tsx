"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import {
  Boxes,
  FlaskConical,
  Library,
  LogIn,
  Package,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  UserPlus,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { MobileBottomHud } from "./mobile-bottom-hud";

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

function BrandMark() {
  return (
    <Link className="group flex min-w-0 items-center gap-3" href="/">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary transition-colors group-hover:border-primary">
        <ScrollText className="size-5" />
      </div>
      <div className="hidden min-w-0 sm:block">
        <p className="truncate font-display text-2xl font-semibold uppercase leading-none">
          SwordWeave
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Digital Workspace
        </p>
      </div>
      <div className="block sm:hidden">
        <p className="font-display text-lg font-semibold uppercase leading-none">
          SW
        </p>
      </div>
    </Link>
  );
}

function AccountControls() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <UserMenu />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* Desktop: full label buttons */}
      <SignInButton mode="modal">
        <button
          className="hidden h-9 shrink-0 whitespace-nowrap rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground sm:inline-flex sm:items-center sm:justify-center"
          type="button"
        >
          Sign In
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button
          className="hidden h-9 shrink-0 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground sm:inline-flex sm:items-center sm:justify-center"
          type="button"
        >
          Sign Up
        </button>
      </SignUpButton>
      {/* Mobile (<640px): icon-only buttons */}
      <SignInButton mode="modal">
        <button
          aria-label="Sign in"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground sm:hidden"
          type="button"
        >
          <LogIn className="size-4" />
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button
          aria-label="Sign up"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground sm:hidden"
          type="button"
        >
          <UserPlus className="size-4" />
        </button>
      </SignUpButton>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile: no top header. Content flows from the absolute top.
          The bottom HUD handles all navigation. */}
      <MobileBottomHud onOpenNav={() => setNavOpen(true)} />

      <MobileNavDrawer isOpen={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[248px_1fr]">
        <aside className="hidden border-r border-border bg-shell lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="border-b border-border px-5 py-5">
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <BrandMark />
                <ThemeToggle />
              </div>
              <AccountControls />
            </div>
          </div>

          <nav className="grid gap-1 px-3 py-4" aria-label="Primary">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <Link
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-panel hover:text-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="size-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border px-3 py-4">
            <p className="px-3 font-display text-lg font-semibold uppercase text-muted-foreground">
              Workshops
            </p>
            <nav className="mt-2 grid gap-1" aria-label="Sandbox workshops">
              {sandboxNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-panel hover:text-foreground",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-border px-5 py-4">
            <div className="rounded-md border border-border bg-panel p-3">
              <p className="font-display text-lg font-semibold uppercase">
                Package V1
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Import and export live in Library, then spread to every object
                type through one JSON envelope.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 pb-14 lg:pb-0" style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}>{children}</main>
      </div>
    </div>
  );
}