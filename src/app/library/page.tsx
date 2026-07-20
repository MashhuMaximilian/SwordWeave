import { asc, desc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import {
  ArrowRight,
  CircuitBoard,
  Crown,
  Library,
  ScrollText,
  Shield,
  Sparkles,
  Wand2,
} from "lucide-react";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  effects,
  primitives,
  heritage,
} from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function LibraryHubPage() {
  const [primitiveRows, capabilityRows, effectRows, templateRows] =
    await Promise.all([
      db.query.primitives.findMany({
        where: (table, { eq, isNull, or }) =>
          or(eq(table.isPublic, true), isNull(table.userId)),
        orderBy: [asc(primitives.category), asc(primitives.name)],
      }),
      db.query.capabilities.findMany({
        where: (table, { eq }) => eq(table.isPublic, true),
        orderBy: [desc(capabilities.createdAt), asc(capabilities.name)],
        with: {
          primitiveLinks: {
            orderBy: [asc(capabilityPrimitives.sortOrder)],
          },
        },
      }),
      db.query.effects.findMany({
        where: (table, { eq }) => eq(table.isPublic, true),
        orderBy: [desc(effects.createdAt), asc(effects.name)],
      }),
      db.query.heritage.findMany({
        where: (table, { eq }) => eq(table.isPublic, true),
        orderBy: [asc(heritage.kind), asc(heritage.name)],
      }),
    ]);

  // BU total helper for capabilities
  const capabilityBuMap = new Map<string, number>();
  for (const cap of capabilityRows) {
    let total = 0;
    for (const link of cap.primitiveLinks) {
      const prim = primitiveRows.find((p) => p.id === link.primitiveId);
      if (prim) {
        total += prim.buCost * link.quantity;
      }
    }
    capabilityBuMap.set(cap.id, total);
  }

  // Category breakdown for primitives
  const categoryCount = new Map<string, number>();
  for (const p of primitiveRows) {
    categoryCount.set(p.category, (categoryCount.get(p.category) ?? 0) + 1);
  }

  // Template kind breakdown
  const templateCount = new Map<string, number>();
  for (const t of templateRows) {
    templateCount.set(t.kind, (templateCount.get(t.kind) ?? 0) + 1);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Library Hub
        </p>
        <h1 className="font-display mt-3 text-4xl font-semibold uppercase leading-tight tracking-wide">Public records.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Browse, filter, and clone public primitives, effects, capabilities,
          races, backgrounds, and archetypes contributed by the SwordWeave
          community.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/browse?type=PRIMITIVE"
        >
          <CircuitBoard className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Primitives</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {primitiveRows.length} public primitives across {categoryCount.size}{" "}
            categories
          </p>
          <div className="mt-4 flex flex-wrap gap-1">
            {Array.from(categoryCount.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([cat, count]) => (
                <span
                  key={cat}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                >
                  {cat.replace(/_/g, " ")} ({count})
                </span>
              ))}
          </div>
          <span className="mt-4 flex items-center gap-2 pt-3 text-sm font-medium text-primary">
            Browse primitives
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/browse?type=EFFECT"
        >
          <Sparkles className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Effects</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {effectRows.length} public effects (conditions, statuses, modifiers)
          </p>
          <span className="mt-4 flex items-center gap-2 pt-3 text-sm font-medium text-primary">
            Browse effects
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/browse?type=CAPABILITY"
        >
          <Library className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Capabilities</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {capabilityRows.length} public capabilities compiled from primitives
          </p>
          <span className="mt-4 flex items-center gap-2 pt-3 text-sm font-medium text-primary">
            Browse capabilities
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/browse?type=LINEAGE_TEMPLATE"
        >
          <Shield className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Races</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {templateCount.get("LINEAGE") ?? 0} public races
          </p>
          <span className="mt-4 flex items-center gap-2 pt-3 text-sm font-medium text-primary">
            Browse races
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/browse?type=UPBRINGING_TEMPLATE"
        >
          <ScrollText className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Backgrounds</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {templateCount.get("UPBRINGING") ?? 0} public backgrounds
          </p>
          <span className="mt-4 flex items-center gap-2 pt-3 text-sm font-medium text-primary">
            Browse backgrounds
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/browse?type=MANIFEST_TEMPLATE"
        >
          <Wand2 className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Archetypes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {templateCount.get("MANIFEST") ?? 0} public archetypes
          </p>
          <span className="mt-4 flex items-center gap-2 pt-3 text-sm font-medium text-primary">
            Browse archetypes
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* Mashu 2026-07-09: public builds card. Until today, builds were
            only visible on the owner's Creations page. This card links
            to the same /library/browse browser the other entity cards
            use, filtered by type=BUILD_TEMPLATE. */}
        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/browse?type=BUILD_TEMPLATE"
        >
          <Crown className="size-5 text-primary" />
          <h2 className="mt-5 text-lg font-semibold">Builds</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Public character builds + archetype heritage from the community.
          </p>
          <span className="mt-4 flex items-center gap-2 pt-3 text-sm font-medium text-primary">
            Browse builds
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <div className="mt-8 rounded-md border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Crown className="size-5 text-primary" />
              Browse the corpus.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Full sort + filter view across all public entries. Find by name,
              category, or engagement.
            </p>
          </div>
          <Link
            href="/library/browse"
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open browser
            <ArrowRight className="ml-2 inline size-4" />
          </Link>
        </div>
      </div>

      {/* Recent capabilities preview */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Capabilities</h2>
          <Link
            href="/library/browse?type=CAPABILITY"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {capabilityRows.slice(0, 12).map((cap) => {
            const bu = capabilityBuMap.get(cap.id) ?? 0;
            return (
              <article
                key={cap.id}
                className="rounded-md border border-border bg-card p-4"
              >
                <header className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{cap.name}</h3>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary">
                    {bu} BU
                  </span>
                </header>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cap.type} - {cap.sourceType}
                </p>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {cap.verboseDescription}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {cap.primitiveLinks.length} primitives
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}