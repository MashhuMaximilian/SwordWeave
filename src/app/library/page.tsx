import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { ArrowRight, CircuitBoard, Library, Sparkles } from "lucide-react";
import { db } from "@/db/client";
import {
  capabilities,
  capabilityPrimitives,
  effects,
  primitives,
} from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function LibraryHubPage() {
  const [primitiveRows, capabilityRows, effectRows] = await Promise.all([
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

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Library Hub
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Public records.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Browse, filter, and clone public primitives, effects, and
          capabilities contributed by the SwordWeave community.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link
          className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
          href="/library/primitives"
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
          href="/library/effects"
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
          href="/library/capabilities"
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
      </div>

      {/* Recent capabilities preview */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent Capabilities</h2>
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

      <section className="mt-10 rounded-md border border-dashed border-border bg-card/50 p-6">
        <h3 className="text-base font-semibold">Library Workflow (Tier 3)</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Full browse + filter + clone workflow ships in Tier 3. This hub page
          is the entry point. Per UX-WORKFLOW-SPEC.md:
        </p>
        <ul className="mt-3 ml-5 list-disc text-sm text-muted-foreground">
          <li>Category filter, tag filter, name search, sort by name/date/BU</li>
          <li>"Clone to my account" button on each public record</li>
          <li>Library click opens sandbox in edit mode (reuses Composer)</li>
          <li>Sandbox stays "create only"; Library becomes "browse + edit"</li>
        </ul>
      </section>
    </div>
  );
}