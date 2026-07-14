import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Boxes,
  Download,
  FlaskConical,
  Library,
  LogIn,
  Upload,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { HomepageAuth } from "@/components/layout/homepage-auth";

const workspaces = [
  {
    href: "/sandbox/grammar?build=primitive",
    title: "Primitive Sandbox",
    status: "Live",
    description: "Atomic BU records, mirror vectors, and generated modifiers.",
    icon: Boxes,
  },
  {
    href: "/sandbox/grammar?build=effect",
    title: "Effect Builder",
    status: "Next",
    description: "Reusable states assembled from primitive groups.",
    icon: FlaskConical,
  },
  {
    href: "/sandbox/grammar?build=capability",
    title: "Capability Compiler",
    status: "Queued",
    description: "Action cards compiled from verbs, domains, and effects.",
    icon: ArrowRight,
  },
  {
    href: "/library",
    title: "Library Exchange",
    status: "Queued",
    description: "Imports, exports, saved records, and shared packages.",
    icon: Library,
  },
] as const;

export default async function HomePage() {
  const { userId } = await auth();
  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <section className="grid gap-5 border-b border-border pb-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-md border border-border bg-card p-5 sm:p-6">
          {/* SwordWeave brand mark — placed here 2026-07-14 at the
              hero's visual anchor. Theme-aware: /logo-light.png is the
              teal-on-transparent version (visible against light
              backgrounds), /logo-dark.png is the white-on-transparent
              version (visible against dark backgrounds). The flip is
              CSS-only via `dark:` so no React state is needed and the
              mark stays above the LCP element. Decorative (alt="") so
              screen readers fall through to the headline. next/image
              with priority because the hero is the LCP element. */}
          <Image
            src="/logo-light.png"
            alt=""
            width={96}
            height={96}
            className="mb-4 size-16 sm:size-24 block dark:hidden"
            priority
          />
          <Image
            src="/logo-dark.png"
            alt=""
            width={96}
            height={96}
            className="mb-4 size-16 sm:size-24 hidden dark:block"
            priority
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-bold uppercase text-secondary-foreground">
              Engine Workspace
            </span>
            <span className="rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground">
              Primitive-first build
            </span>
          </div>

          <h1 className="font-display mt-5 max-w-3xl text-5xl font-semibold uppercase leading-none sm:text-6xl lg:text-7xl">
            SwordWeave Command Deck
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Build the shared engine from atomic primitives upward, then reuse
            the same records across effects, capabilities, sheets, monsters,
            items, templates, and JSON packages.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground"
              href="/sandbox/grammar?build=primitive"
            >
              Open Primitive Sandbox
              <ArrowRight className="size-4" />
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-bold text-foreground"
              href="/library"
            >
              Review Package Format
            </Link>
            <HomepageAuth signedIn={!!userId} />
          </div>
        </div>

        <aside className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-semibold uppercase">
                Exchange V1
              </p>
              <p className="text-xs text-muted-foreground">
                Import/export foundation
              </p>
            </div>
            <div className="flex gap-2 text-primary">
              <Upload className="size-4" />
              <Download className="size-4" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Start with primitive packages, then apply the same versioned envelope
            to every SwordWeave object.
          </p>
          <code className="mt-4 block rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            swordweave.package.v1
          </code>
        </aside>
      </section>

      <section className="py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl font-semibold uppercase">
            Workbench
          </h2>
          <span className="text-xs text-muted-foreground">
            Build order follows engine dependencies
          </span>
        </div>

        <div className="grid gap-3">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;

            return (
              <Link
                className="group grid gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary sm:grid-cols-[40px_1fr_auto] sm:items-center"
                href={workspace.href}
                key={workspace.href}
              >
                <div className="flex size-10 items-center justify-center rounded-md border border-border bg-background text-primary">
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-2xl font-semibold uppercase leading-none">
                      {workspace.title}
                    </h3>
                    <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">
                      {workspace.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {workspace.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-primary sm:justify-self-end">
                  Open
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
// Updated Tue Jul  7 03:16:10 PM EEST 2026
