import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { effects } from "@/db/schema";
import { LibraryEffectsView } from "@/components/library/library-effects-view";

export const dynamic = "force-dynamic";

export default async function LibraryEffectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const tagFilter = params.tag ?? "ALL";

  const conditions = [eq(effects.isPublic, true)];

  if (query) {
    conditions.push(
      or(
        ilike(effects.name, `%${query}%`),
        ilike(effects.narrativeDescription, `%${query}%`),
      )!,
    );
  }

  const rows = await db.query.effects.findMany({
    where: sql.join(conditions, sql` AND `),
    orderBy: [desc(effects.createdAt), asc(effects.name)],
  });

  // Get all tags for filter
  const allTags = Array.from(
    new Set(rows.flatMap((e) => e.tags).filter(Boolean)),
  ).sort();

  // Apply tag filter (client-side since tags are array)
  const filtered = tagFilter === "ALL"
    ? rows
    : rows.filter((e) => e.tags.includes(tagFilter));

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Library Hub
      </Link>

      <h1 className="mt-4 text-4xl font-semibold">Effects</h1>
      <p className="mt-2 text-base text-muted-foreground">
        {filtered.length} of {rows.length} public effects
      </p>

      <LibraryEffectsView
        effects={filtered.map((e) => ({
          id: e.id,
          name: e.name,
          sourceOrigin: e.sourceOrigin,
          narrativeDescription: e.narrativeDescription,
          tags: e.tags,
        }))}
        currentFilters={{ q: query, tag: tagFilter }}
        allTags={allTags}
      />
    </div>
  );
}