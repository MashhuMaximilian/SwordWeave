// =============================================================================
// /codex — the public Codex. Renders the same sort + filter + search browser
// as /library/browse but is the FAB's primary destination (named after the
// in-fiction concept of a "codex" rather than the dev/UI name "library").
//
// Architecture: this page imports the LibraryBrowsePage component and
// re-exports it with the same searchParams. The body chrome (header, etc.)
// is rendered here so /codex has its own branding distinct from the
// /library hub page.
//
// Why not a redirect: /codex and /library/browse are conceptually
// different entry points even though they share the underlying browser.
// /codex is the corpus deep-dive (FAB entry); /library is the hub with
// category breakdowns and "Browse races / backgrounds / ..." cards.
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
import { LibraryBrowseClient } from "@/components/library/library-browse-client";
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
    tag?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function CodexPage({ searchParams }: PageProps) {
  const params = await searchParams;

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
  const tagFilter = (params.tag ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Phase 9 follow-up: viewerClerkId is passed to queryLibrary so the
  // visibility helper can include FOLLOWERS_ONLY rows where the viewer
  // follows the author. Without it, only PUBLIC + system rows show.
  const { userId: viewerClerkId } = await auth();
  const [categories, itemTags, result] = await Promise.all([
    listPrimitiveCategories(),
    listItemTags(),
    queryLibrary({
      ...(targetType !== "ALL" ? { targetType } : {}),
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      ...(params.author ? { authorUsername: params.author } : {}),
      ...(params.minLikes ? { minLikes: parseInt(params.minLikes, 10) } : {}),
      hasForks: params.hasForks === "1",
      ...(targetType === "ITEM" && tagFilter.length > 0
        ? { tags: tagFilter }
        : {}),
      ...(viewerClerkId ? { viewerClerkId } : {}),
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  const clerkUserId = viewerClerkId;
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
    tags: tagFilter.join(","),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Codex
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold uppercase leading-tight tracking-wide">
            The public codex.
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
