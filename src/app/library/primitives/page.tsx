import { asc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function LibraryPrimitivesPage() {
  const rows = await db.query.primitives.findMany({
    where: (table, { eq, isNull, or }) =>
      or(eq(table.isPublic, true), isNull(table.userId)),
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  // Group by category
  const byCategory = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Library Hub
      </Link>

      <h1 className="mt-4 text-4xl font-semibold">Primitives</h1>
      <p className="mt-2 text-base text-muted-foreground">
        {rows.length} public primitives, grouped by category.
      </p>

      <div className="mt-8 space-y-8">
        {Array.from(byCategory.entries()).map(([category, items]) => (
          <section key={category}>
            <h2 className="text-xl font-semibold">
              {category.replace(/_/g, " ")}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({items.length})
              </span>
            </h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <article
                  key={p.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium">{p.name}</h3>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      {p.buCost} BU
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.costTier}
                  </p>
                  {p.narrativeRule && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {p.narrativeRule}
                    </p>
                  )}
                  {p.isMirrorable && (
                    <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                      Mirrorable ({p.mirrorBuCredit} BU credit)
                    </span>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}