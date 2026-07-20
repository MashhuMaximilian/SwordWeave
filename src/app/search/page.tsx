// =============================================================================
// /search — global search across primitives, capabilities, effects, items,
// characters, and heritage.
//
// URL: /search?q=<query>&type=<LibraryTargetType>
// =============================================================================

import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import {
  searchLibrary,
  findMatchRanges,
  type SearchHit,
} from "@/lib/search/search-service";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

const VALID_TYPES = new Set([
  "PRIMITIVE",
  "CAPABILITY",
  "EFFECT",
  "CHARACTER",
  "ITEM",
  "LINEAGE_TEMPLATE",
  "UPBRINGING_TEMPLATE",
  "MANIFEST_TEMPLATE",
]);

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const typeFilter =
    params.type && VALID_TYPES.has(params.type) ? params.type : undefined;

  const result = query
    ? await searchLibrary({ query, ...(typeFilter ? { targetType: typeFilter as never } : {}) })
    : { hits: [], total: 0, query: "" };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Search
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold uppercase leading-tight tracking-wide">
          Find anything.
        </h1>
      </header>

      <form action="/search" method="GET" className="mb-6">
        <label htmlFor="search-q" className="sr-only">
          Search the corpus
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search primitives, capabilities, effects, characters…"
            className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary"
            autoFocus
          />
        </div>
        {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
      </form>

      {!query ? (
        <EmptyState
          icon={Search}
          title="What are you looking for?"
          description="Search across all public content in the SwordWeave corpus. Try a name, a category, or a phrase."
        />
      ) : result.hits.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`No matches for "${query}"`}
          description="Try a different keyword, fewer words, or check the spelling."
          primaryAction={{ label: "Browse the library", href: "/library/browse" }}
          secondaryAction={{ label: "Clear search", href: "/search" }}
        />
      ) : (
        <section data-testid="search-results">
          <p className="mb-4 text-sm text-muted-foreground">
            {result.hits.length} {result.hits.length === 1 ? "result" : "results"} for{" "}
            <span className="font-semibold text-foreground">&quot;{query}&quot;</span>
          </p>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {result.hits.map((hit) => (
              <SearchHitRow key={`${hit.targetType}:${hit.id}`} hit={hit} query={query} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SearchHitRow({ hit, query }: { hit: SearchHit; query: string }) {
  const nameRanges = findMatchRanges(hit.name, query);
  const descRanges = hit.description
    ? findMatchRanges(hit.description, query)
    : [];

  return (
    <li>
      <Link
        href={`/library/item/${hit.targetType}:${hit.id}`}
        className="flex gap-3 p-4 transition-colors hover:bg-accent/40"
      >
        {hit.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hit.imageUrl}
            alt=""
            className="size-14 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {hit.targetType.replace(/_/g, " ")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold text-foreground">
              <HighlightedText text={hit.name} ranges={nameRanges} />
            </p>
            <span className="shrink-0 text-xs uppercase text-muted-foreground">
              {hit.targetType.replace(/_/g, " ")}
            </span>
          </div>
          {hit.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              <HighlightedText text={hit.description} ranges={descRanges} />
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

function HighlightedText({
  text,
  ranges,
}: {
  text: string;
  ranges: Array<{ start: number; end: number }>;
}) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!r) continue;
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark key={i} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}