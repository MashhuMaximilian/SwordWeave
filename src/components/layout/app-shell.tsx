"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
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
  {
    href: "/sandbox",
    label: "Sandbox",
    description: "Primitive, effect, and capability workshops",
    icon: FlaskConical,
  },
  {
    href: "/library",
    label: "Library",
    description: "Shared creations, imports, exports, and clones",
    icon: Library,
  },
  {
    href: "/characters",
    label: "Characters",
    description: "Player ledgers and live sheets",
    icon: UserRound,
  },
  {
    href: "/monsters",
    label: "Monsters",
    description: "DM profiles and encounter weight",
    icon: Shield,
  },
  {
    href: "/items",
    label: "Items",
    description: "Equipment carriers and attached effects",
    icon: Package,
  },
] as const;

const sandboxNav = [
  { href: "/sandbox/primitives", label: "Primitives", icon: Boxes },
  { href: "/sandbox/effects", label: "Effects", icon: Sparkles },
  { href: "/sandbox/capabilities", label: "Capabilities", icon: Swords },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[288px_1fr]">
        <aside className="border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <Link
              className="flex items-center gap-3 border-b border-border px-5 py-5"
              href="/"
            >
              <div className="flex size-10 items-center justify-center rounded-md border border-border bg-background">
                <ScrollText className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  SwordWeave
                </p>
                <p className="font-semibold">Digital Workspace</p>
              </div>
            </Link>

            <nav className="grid gap-1 px-3 py-4" aria-label="Primary">
              {primaryNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    className={cn(
                      "grid grid-cols-[32px_1fr] gap-3 rounded-md border border-transparent px-3 py-3 text-sm transition-colors",
                      active
                        ? "border-border bg-background text-foreground"
                        : "text-muted-foreground hover:bg-background hover:text-foreground",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="mt-0.5 size-4" />
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border px-3 py-4">
              <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
                Workshops
              </p>
              <nav className="mt-3 grid gap-1" aria-label="Sandbox workshops">
                {sandboxNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);

                  return (
                    <Link
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-background hover:text-foreground",
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
              <p className="text-xs leading-5 text-muted-foreground">
                JSON import/export belongs to the Library layer, with the same
                package shape reused by every SwordWeave object.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
