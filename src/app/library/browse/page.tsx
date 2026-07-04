// =============================================================================
// /library/browse — unified library browser with sort + filter + search
// Server component with a collapsible filter sidebar for mobile.
// =============================================================================

import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronUp, Search, User as UserIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
  listPrimitiveCategories,
  queryLibrary,
  type LibrarySort,
  type LibraryTargetType,
} from "@/lib/publishing/library-query";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { Markdown } from "@/components/ui/markdown";
import { loadLibraryEngagement } from "@/lib/engagement/library-engagement";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    sort?: string;
    category?: string;
    q?: string;
    author?: string;
    minLikes?: string;
    hasForks?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function LibraryBrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = (params.sort ?? "LIKES") as LibrarySort;
  const targetType = (params.type ?? "ALL") as LibraryTargetType | "ALL";
  const page = Math.max(0, parseInt(params.page ?? "0", 10) || 0);
  const offset = page * PAGE_SIZE;
  const search = params.q ?? "";
  const category = params.category ?? "";

  // Load categories dynamically for the filter chips
  const categories = await listPrimitiveCategories();

  const result = await queryLibrary({
    ...(targetType !== "ALL" ? { targetType } : {}),
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
    ...(params.author ? { authorUsername: params.author } : {}),
    ...(params.minLikes ? { minLikes: parseInt(params.minLikes, 10) } : {}),
    hasForks: params.hasForks === "1",
    sort,
    limit: PAGE_SIZE,
    offset,
  });

  // Resolve current user (Clerk auth) and per-item engagement state
  const { userId: clerkUserId } = await auth();
  const currentUserInternalId = clerkUserId
    ? await resolveUserIdByClerkId(clerkUserId)
    : null;
  const engagement = await loadLibraryEngagement(
    currentUserInternalId,
    result.items.map((it) => ({
      id: it.id,
      targetType: it.targetType,
      targetId: it.targetId,
      authorId: it.authorId,
    })),
  );

  const totalPages = Math.ceil(result.total / PAGE_SIZE);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      type: targetType,
      sort,
      category,
      q: search,
      author: params.author,
      minLikes: params.minLikes,
      hasForks: params.hasForks,
      page: "0",
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "ALL" && v !== "0" && v !== "") next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/library/browse?${qs}` : "/library/browse";
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Library
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Browse the corpus.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {result.total.toLocaleString()} public entries from the SwordWeave
            corpus. Sort, filter, fork what you like.
          </p>
        </div>
        <Link
          href="/library"
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Library hub
        </Link>
      </div>

      {/* Search bar */}
      <form
        action="/library/browse"
        method="get"
        className="mt-6 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by name…"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {/* Preserve current filters via hidden inputs */}
        {targetType !== "ALL" && (
          <input type="hidden" name="type" value={targetType} />
        )}
        {category && <input type="hidden" name="category" value={category} />}
        {sort !== "LIKES" && <input type="hidden" name="sort" value={sort} />}
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      {/* Filter chips row (mobile-friendly, always visible) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["ALL", "All"],
            ["PRIMITIVE", "Primitives"],
            ["CAPABILITY", "Capabilities"],
            ["EFFECT", "Effects"],
            ["RACE_TEMPLATE", "Races"],
            ["BACKGROUND_TEMPLATE", "Backgrounds"],
            ["ARCHETYPE_TEMPLATE", "Archetypes"],
          ] as const
        ).map(([key, label]) => {
          const active = targetType === key;
          return (
            <Link
              key={key}
              href={buildUrl({ type: key, page: "0" })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Sort + advanced filter row */}
      <details className="mt-4 rounded-md border border-border bg-card/50">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
          <span>Sort & advanced filters</span>
          <ChevronDown className="size-4 md:hidden" />
          <ChevronUp className="hidden size-4 md:block" />
        </summary>
        <div className="grid gap-4 border-t border-border p-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
              Sort by
            </label>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["LIKES", "Most liked"],
                  ["RECENT", "Recent"],
                  ["FORKS", "Most forked"],
                  ["ALPHABETICAL", "A → Z"],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={buildUrl({ sort: key, page: "0" })}
                  className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                    sort === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {targetType === "PRIMITIVE" || targetType === "ALL" ? (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                Category
              </label>
              <div className="flex flex-wrap gap-1">
                <Link
                  href={buildUrl({ category: undefined, page: "0" })}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    !category
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70"
                  }`}
                >
                  All
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.value}
                    href={buildUrl({ category: c.value, page: "0" })}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      category === c.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/70"
                    }`}
                  >
                    {c.label} ({c.count})
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
              Engagement
            </label>
            <div className="space-y-2">
              <Link
                href={buildUrl({
                  hasForks: params.hasForks === "1" ? undefined : "1",
                  page: "0",
                })}
                className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors ${
                  params.hasForks === "1"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/70"
                }`}
              >
                <span>Only forked</span>
                {params.hasForks === "1" ? "✓" : ""}
              </Link>
              <form
                action="/library/browse"
                method="get"
                className="flex items-center gap-2 text-xs"
              >
                {/* Preserve filters */}
                {targetType !== "ALL" && (
                  <input type="hidden" name="type" value={targetType} />
                )}
                {category && (
                  <input type="hidden" name="category" value={category} />
                )}
                {sort !== "LIKES" && (
                  <input type="hidden" name="sort" value={sort} />
                )}
                {search && <input type="hidden" name="q" value={search} />}
                <span className="text-muted-foreground">Min likes:</span>
                <input
                  type="number"
                  name="minLikes"
                  min={0}
                  defaultValue={params.minLikes ?? ""}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-md bg-secondary px-2 py-1 hover:bg-secondary/70"
                >
                  Apply
                </button>
              </form>
            </div>
          </div>
        </div>
      </details>

      {/* Results */}
      <section className="mt-6">
        {result.items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No matches. Try changing the filter or sort.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {result.items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col rounded-md border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{item.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.targetType.replace(/_/g, " ").toLowerCase()}
                      {item.category ? ` · ${item.category.replace(/_/g, " ")}` : ""}
                    </p>
                  </div>
                  {item.buCost !== null && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      {item.buCost} BU
                    </span>
                  )}
                </header>

                {item.description && (
                  <div className="mt-3 line-clamp-3 text-sm text-muted-foreground [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-foreground/80 [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:underline [&_a]:text-primary">
                    <Markdown>{item.description}</Markdown>
                  </div>
                )}

                {item.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

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

                <footer className="mt-auto border-t border-border pt-3">
                  <LikeForkBar
                    targetType={
                      item.targetType as
                        | "PRIMITIVE"
                        | "CAPABILITY"
                        | "CHARACTER"
                        | "ITEM"
                        | "RACE_TEMPLATE"
                        | "BACKGROUND_TEMPLATE"
                        | "ARCHETYPE_TEMPLATE"
                    }
                    targetId={item.targetId}
                    initialLikes={item.likesCount}
                    initialDislikes={item.dislikesCount}
                    initialForks={item.forkCount}
                    initialUserReaction={engagement.reactions[item.id] ?? null}
                    authorId={item.authorId}
                    authorUsername={item.authorUsername}
                    currentUserId={currentUserInternalId}
                    compact
                  />
                  <div className="mt-2 flex items-center justify-end">
                    <Link
                      href={`/library/item/${item.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View details
                      <ArrowRight className="ml-1 inline size-3" />
                    </Link>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-2 text-sm">
            {page > 0 ? (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            {page + 1 < totalPages ? (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="text-muted-foreground hover:text-foreground"
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
  );
}