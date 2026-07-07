// =============================================================================
// /library/browse — unified library browser with sort + filter + search.
// Server component loads data, renders page chrome, then hands the result
// set off to LibraryBrowseClient which owns the toolbar + URL sync.
// =============================================================================

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
  listItemTags,
  listPrimitiveCategories,
  queryLibrary,
  type LibrarySort,
  type LibraryTargetType,
} from "@/lib/publishing/library-query";
import { loadLibraryEngagement } from "@/lib/engagement/library-engagement";
import { resolveUserIdByClerkId } from "@/lib/auth/author-resolver";
import {
  readLibraryPreferences,
  type LibraryView,
} from "@/lib/preferences/library-prefs";
import {
  LibraryBrowseClient,
} from "@/components/library/library-browse-client";
import { parseSort, parseView, parseType } from "@/lib/library-url-params";
import {
  EMPTY_LIBRARY_TOOLBAR_STATE,
  type LibraryToolbarState,
} from "@/components/library/library-toolbar";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    sort?: string;
    view?: string;
    category?: string;
    q?: string;
    author?: string;
    minLikes?: string;
    hasForks?: string;
    page?: string;
    /**
     * Comma-separated tag list. When the active type is ITEM, the server
     * filters items whose `tags` array contains ALL of the given values
     * (AND-match). The public library previously had no tag filter for
     * items (user-reported regression).
     */
    tag?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function LibraryBrowsePage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Load user prefs from cookie, then override with URL params (URL wins).
  const prefs = await readLibraryPreferences();
  const sort = parseSort(params.sort ?? null) ?? prefs.sort;
  const view = parseView(params.view ?? null) ?? prefs.view;
  const targetType = parseType(params.type ?? null);
  const page = Math.max(0, parseInt(params.page ?? "0", 10) || 0);
  const offset = page * PAGE_SIZE;
  const search = params.q ?? "";
  const category = params.category ?? "";
  const authorFilter = params.author ?? "";
  const minLikesFilter = params.minLikes ?? "";
  const hasForksFilter = params.hasForks === "1";
  // Tags filter — comma-separated. The query expects an array. When
  // the active type is ITEM, this maps to "tags && ARRAY[...ALL]" so
  // AND-match (every listed tag must be present on the item).
  const tagFilter = (params.tag ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Load categories + item-tag chips + library result all in parallel. The
  // chip + category lists are only needed for the toolbar's filter UI but
  // loading them up front (alongside queryLibrary) lets the whole page
  // render in a single round-trip's wall-clock time. Each query is a small
  // index scan; the cost of running them concurrently vs. serially is
  // negligible compared to the latency reduction.
  const [
    categories,
    itemTags,
    result,
  ] = await Promise.all([
    listPrimitiveCategories(),
    listItemTags(),
    queryLibrary({
      ...(targetType !== "ALL" ? { targetType } : {}),
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      ...(params.author ? { authorUsername: params.author } : {}),
      ...(params.minLikes ? { minLikes: parseInt(params.minLikes, 10) } : {}),
      hasForks: params.hasForks === "1",
      // Tag filter — only honoured for ITEM target type. Other types
      // (primitive/capability/effect/template) don't have a tag array
      // column so the query would no-op.
      ...(targetType === "ITEM" && tagFilter.length > 0
        ? { tags: tagFilter }
        : {}),
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  // Resolve current user (Clerk auth) and per-item engagement state.
  // Both can run in parallel with the rest of the page load — the
  // engagement map is keyed off the result set we just fetched, so
  // it's not blocked on any earlier await.
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

  const initialState: LibraryToolbarState = {
    ...EMPTY_LIBRARY_TOOLBAR_STATE,
    search,
    sort,
    view,
    typeFilter: targetType,
    category,
    author: authorFilter,
    minLikes: minLikesFilter,
    hasForks: hasForksFilter,
    // Mirror the URL ?tag= value into the toolbar's `tags` field. The
    // sandbox uses the text-input `tags` filter; the public library
    // uses chip-based filter (see LibraryToolbar `itemTags` prop). Both
    // share the same state field, so the URL stays consistent.
    tags: tagFilter.join(","),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Library
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold uppercase leading-tight tracking-wide">
            Browse the corpus.
          </h1>
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

      <div className="mt-8 flex min-h-[calc(100dvh-12rem)] flex-col md:h-[calc(100vh-12rem)] md:min-h-0">
        <LibraryBrowseClient
          initialItems={result.items}
          total={result.total}
          page={page}
          totalPages={totalPages}
          initialState={initialState}
          primitiveCategories={categories}
          itemTags={itemTags}
          activeTags={tagFilter}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
        />
      </div>
    </div>
  );
}