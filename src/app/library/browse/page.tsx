// =============================================================================
// /library/browse — unified library browser with sort + filter + search.
// Server component loads data, renders page chrome, then hands the result
// set off to LibraryBrowseClient which owns the toolbar + URL sync.
// =============================================================================

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import {
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

      <div className="mt-8 flex h-[calc(100vh-12rem)] min-h-[600px] flex-col">
        <LibraryBrowseClient
          initialItems={result.items}
          total={result.total}
          page={page}
          totalPages={totalPages}
          initialState={initialState}
          primitiveCategories={categories}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
        />
      </div>
    </div>
  );
}