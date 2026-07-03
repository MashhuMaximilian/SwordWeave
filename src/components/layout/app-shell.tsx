"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  FlaskConical,
  Library,
  Package,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/sandbox", label: "Sandbox", icon: FlaskConical },
  { href: "/library", label: "Library", icon: Library },
  { href: "/characters", label: "Characters", icon: UserRound },
  { href: "/monsters", label: "Monsters", icon: Shield },
  { href: "/items", label: "Items", icon: Package },
] as const;

const sandboxNav = [
  { href: "/sandbox/primitives", label: "Primitives", icon: Boxes },
  { href: "/sandbox/effects", label: "Effects", icon: Sparkles },
  { href: "/sandbox/capabilities", label: "Capabilities", icon: Swords },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandMark() {
  return (
    <Link className="group flex items-center gap-3" href="/">
      <div className="flex size-10 items-center justify-center rounded-md border border-border bg-background text-primary transition-colors group-hover:border-primary">
        <ScrollText className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-2xl font-semibold uppercase leading-none">
          SwordWeave
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Digital Workspace
        </p>
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-shell/95 backdrop-blur lg:hidden">
        <div className="px-4 py-3">
          <BrandMark />
        </div>
        <nav
          aria-label="Primary"
          className="flex gap-2 overflow-x-auto px-4 pb-3"
        >
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <Link
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
                href={item.href}
                key={item.href}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[248px_1fr]">
        <aside className="hidden border-r border-border bg-shell lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="border-b border-border px-5 py-5">
            <BrandMark />
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

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
