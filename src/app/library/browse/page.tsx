// =============================================================================
// /library/browse — unified library browser with sort + filter
// Server component: queries /api/library internally via the service function
// so we get full SSR with proper sort/filter.
// =============================================================================

import Link from "next/link";
import {
  ArrowRight,
  Filter,
  GitFork,
  Heart,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
  queryLibrary,
  type LibrarySort,
  type LibraryTargetType,
} from "@/lib/publishing/library-query";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    sort?: string;
    category?: string;
    author?: string;
    minLikes?: string;
    hasForks?: string;
    visibility?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function LibraryBrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = (params.sort ?? "LIKES") as LibrarySort;
  const targetType = (params.type ?? "ALL") as
    | LibraryTargetType
    | "ALL";
  const page = Math.max(0, parseInt(params.page ?? "0", 10) || 0);
  const offset = page * PAGE_SIZE;

  const { userId: clerkUserId } = await auth();
  let viewerId: string | undefined;
  if (clerkUserId) {
    const user = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.clerkUserId, clerkUserId),
      columns: { id: true },
    });
    viewerId = user?.id;
  }

  const result = await queryLibrary({
    ...(targetType !== "ALL" ? { targetType } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.author ? { authorUsername: params.author } : {}),
    visibility:
      (params.visibility as "PUBLIC" | "FOLLOWERS_ONLY") ?? "PUBLIC",
    ...(params.minLikes
      ? { minLikes: parseInt(params.minLikes, 10) }
      : {}),
    hasForks: params.hasForks === "1",
    sort,
    limit: PAGE_SIZE,
    offset,
    ...(viewerId ? { viewerId } : {}),
  });

  const totalPages = Math.ceil(result.total / PAGE_SIZE);

  // Build URL helper for filter changes
  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      type: targetType,
      sort,
      category: params.category,
      author: params.author,
      minLikes: params.minLikes,
      hasForks: params.hasForks,
      visibility: params.visibility,
      page: "0",
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "ALL" && v !== "0") next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/library/browse?${qs}` : "/library/browse";
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Library
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Browse the corpus.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {result.total} published entries from {viewerId ? "creators you " : ""}the SwordWeave community. Sort, filter, fork what you like.
          </p>
        </div>
        <Link
          href="/library"
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Library hub
        </Link>
      </div>

      {/* Sort + Filter bar */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5">
          <div>
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <Filter className="size-3.5" /> Sort
            </label>
            <div className="flex flex-col gap-1">
              {(
                [
                  ["LIKES", "Most liked"],
                  ["RECENT", "Recently published"],
                  ["FORKS", "Most forked"],
                  ["ALPHABETICAL", "A → Z"],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={buildUrl({ sort: key })}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    sort === key
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
              Type
            </label>
            <div className="flex flex-col gap-1">
              {(
                [
                  ["ALL", "All types"],
                  ["PRIMITIVE", "Primitives"],
                  ["CAPABILITY", "Capabilities"],
                  ["RACE_TEMPLATE", "Races"],
                  ["BACKGROUND_TEMPLATE", "Backgrounds"],
                  ["ARCHETYPE_TEMPLATE", "Archetypes"],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={buildUrl({ type: key })}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    targetType === key
                      ? "bg-secondary font-semibold"
                      : "hover:bg-secondary"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
              Engagement
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={params.hasForks === "1"}
                  className="size-4 rounded"
                />
                <span>Only forked</span>
              </label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Min likes:</span>
                <input
                  type="number"
                  min={0}
                  defaultValue={params.minLikes ?? ""}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
            Library sort uses Server-Side rendering — pages update instantly as you
            click filters. Bookmarkable URLs preserve your view.
          </div>
        </aside>

        <section>
          {result.items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card/50 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No matches. Try changing the filter or sort.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {result.items.map((item) => (
                <article
                  key={item.publicationId}
                  className="rounded-md border border-border bg-card p-4 transition-colors hover:border-primary"
                >
                  <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{item.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.targetType.replace(/_/g, " ")} · v
                        {item.versionNumber}
                      </p>
                    </div>
                    {item.visibility !== "PUBLIC" && (
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                        {item.visibility === "FOLLOWERS_ONLY"
                          ? "Followers"
                          : "Private"}
                      </span>
                    )}
                  </header>

                  {item.authorUsername && (
                    <Link
                      href={`/u/${item.authorUsername}`}
                      className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {item.authorAvatarUrl ? (
                        <img
                          src={item.authorAvatarUrl}
                          alt=""
                          className="size-4 rounded-full"
                        />
                      ) : (
                        <UserIcon className="size-3.5" />
                      )}
                      <span>
                        by{" "}
                        <span className="font-semibold">
                          {item.authorDisplayName ?? item.authorUsername}
                        </span>
                      </span>
                    </Link>
                  )}

                  <footer className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="size-3.5" />
                      <span className="font-mono">{item.likesCount}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="size-3.5" />
                      <span className="font-mono">{item.forkCount}</span>
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      {item.netReactions >= 0 ? "+" : ""}
                      {item.netReactions} net
                    </span>
                  </footer>

                  <div className="mt-3 flex items-center justify-between">
                    <Link
                      href={`/library/item/${item.publicationId}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View details
                      <ArrowRight className="ml-1 inline size-3" />
                    </Link>
                    {viewerId && viewerId !== item.authorDisplayName && (
                      <form action="/api/fork" method="post">
                        <input
                          type="hidden"
                          name="publicationId"
                          value={item.publicationId}
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-border bg-secondary px-3 py-1 text-xs font-medium hover:bg-secondary/70"
                        >
                          Fork
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              {page > 0 ? (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} ({result.total} total)
              </span>
              {page + 1 < totalPages ? (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}