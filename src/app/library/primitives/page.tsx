import { asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { primitives } from "@/db/schema";
import { LibraryPrimitivesView } from "@/components/library/library-primitives-view";

export const dynamic = "force-dynamic";

export default async function LibraryPrimitivesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; mirror?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const categoryFilter = params.category ?? "ALL";
  const mirrorFilter = params.mirror ?? "ALL";

  const conditions = [or(eq(primitives.isPublic, true), isNull(primitives.userId))!];

  if (query) {
    conditions.push(
      or(
        ilike(primitives.name, `%${query}%`),
        ilike(primitives.narrativeRule, `%${query}%`),
      )!,
    );
  }

  if (mirrorFilter === "yes") {
    conditions.push(eq(primitives.isMirrorable, true));
  } else if (mirrorFilter === "no") {
    conditions.push(eq(primitives.isMirrorable, false));
  }

  const rows = await db.query.primitives.findMany({
    where: sql.join(conditions, sql` AND `),
    orderBy: [asc(primitives.category), asc(primitives.name)],
  });

  // Group by category
  const byCategory = new Map<string, typeof rows>();
  for (const row of rows) {
    if (categoryFilter !== "ALL" && row.category !== categoryFilter) continue;
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  // All categories for the filter
  const allCategories = Array.from(
    new Set(rows.map((r) => r.category)),
  ).sort();

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
        {rows.length} public primitives
      </p>

      <LibraryPrimitivesView
        rows={rows.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          costTier: p.costTier,
          buCost: p.buCost,
          narrativeRule: p.narrativeRule,
          isMirrorable: p.isMirrorable,
          mirrorBuCredit: p.mirrorBuCredit,
        }))}
        currentFilters={{ q: query, category: categoryFilter, mirror: mirrorFilter }}
        allCategories={allCategories}
      />
    </div>
  );
}