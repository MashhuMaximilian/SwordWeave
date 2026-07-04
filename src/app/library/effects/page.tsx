import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { effects } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function LibraryEffectsPage() {
  const rows = await db.query.effects.findMany({
    where: (table, { eq }) => eq(table.isPublic, true),
    orderBy: [desc(effects.createdAt), asc(effects.name)],
  });

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
        {rows.length} public effects.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((effect) => (
          <article
            key={effect.id}
            className="rounded-md border border-border bg-card p-4"
          >
            <h3 className="font-semibold">{effect.name}</h3>
            {effect.sourceOrigin && (
              <p className="mt-1 text-xs text-muted-foreground">
                Source: {effect.sourceOrigin}
              </p>
            )}
            {effect.narrativeDescription && (
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {effect.narrativeDescription}
              </p>
            )}
            {effect.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {effect.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}