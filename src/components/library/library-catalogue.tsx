import { LibraryHeader } from "./library-header";
import { EncounterArchive } from "@/components/encounters/encounter-archive";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
// =============================================================================
// /library/browse — unified library browser with sort + filter + search.
// Server component loads data, renders page chrome, then hands the result
// set off to LibraryBrowseClient which owns the toolbar + URL sync.
// =============================================================================

import {GMOnly} from "@/components/account/account-provider";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { monsterCopies } from "@/db/schema/monsters";
import { desc, eq } from "drizzle-orm";
import {
  listItemTags,
  listPrimitiveCategories,
  listPrimitiveFamilyTiers,
  queryLibrary,
  type LibrarySort,
  type LibraryTargetType,
} from "@/lib/publishing/library-query";
import { canonicalLibraryCategory } from "@/lib/publishing/library-classification";
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

export interface LibraryCatalogueProps {
  monsterCatalogue?: boolean;
  searchParams: Promise<{
    mechanicTarget?: string; recipient?: string; conditionMode?: string; minMagnitude?: string; maxMagnitude?: string;
    minBu?: string; maxBu?: string; minForks?: string; fromDate?: string; toDate?: string; definitionKind?: string; mirrorableOnly?: string;
    origin?: string;
    tier?: string;
    type?: string;
    sort?: string;
    view?: string;
    collectionId?: string;
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

const PAGE_SIZE = 30;

export async function LibraryCatalogue({ searchParams, monsterCatalogue = false }: LibraryCatalogueProps) {
  const supplied = await searchParams;
  const params = monsterCatalogue ? { ...supplied, type: "MONSTER" } : supplied;

  // Load user prefs from cookie, then override with URL params (URL wins).
  const prefs = await readLibraryPreferences();
  const sort = parseSort(params.sort ?? null) ?? prefs.sort;
  const view = parseView(params.view ?? null) ?? prefs.view;
  const targetType = parseType(params.type ?? "PRIMITIVE");
  if(targetType === "ENCOUNTER")return <main className="v12-library-page mx-auto w-full max-w-[1680px] px-5 py-6"><LibraryHeader active="ENCOUNTER"/><EncounterArchive discovery/></main>;
  const page = 0;
  const offset = page * PAGE_SIZE;
  const search = params.q ?? "";
  const category = params.category ? canonicalLibraryCategory(params.category) : "";
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
  //
  // viewerClerkId is passed so the visibility helper can include
  // FOLLOWERS_ONLY rows where the viewer follows the author. Without
  // it, only PUBLIC + system rows show up — which is the right default
  // for anonymous browsers but loses the personalised row set for
  // signed-in viewers.
  const { userId: viewerClerkId } = await auth();
  const playCopies = monsterCatalogue && viewerClerkId
    ? await db.select({ id: monsterCopies.id, name: monsterCopies.name, currentVitality: monsterCopies.currentVitality, templateVersion: monsterCopies.templateVersion }).from(monsterCopies).where(eq(monsterCopies.userId, viewerClerkId)).orderBy(desc(monsterCopies.updatedAt)).limit(50)
    : [];
  const [
    categories,
    itemTags,
    result,
    familyTiers,
    currentUserInternalId,
  ] = await Promise.all([
    listPrimitiveCategories(),
    listItemTags(),
    queryLibrary({
      ...(params.collectionId?{collectionId:params.collectionId}:{}),
      ...(targetType !== "ALL" ? { targetType } : {}),
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      ...(params.author ? { authorUsername: params.author } : {}),
      ...(params.minLikes ? { minLikes: parseInt(params.minLikes, 10) } : {}),
      origin: params.origin === "system" || params.origin === "community" ? params.origin : "all",
      ...(Number(params.tier) > 0 ? { tier: Number(params.tier) } : {}),
      mechanicTarget: params.mechanicTarget, recipient: params.recipient, conditionMode: params.conditionMode === "conditional" ? "conditional" : params.conditionMode === "always" ? "always" : undefined,
      minMagnitude: params.minMagnitude?.trim() && Number.isFinite(Number(params.minMagnitude)) ? Number(params.minMagnitude) : undefined,
      maxMagnitude: params.maxMagnitude?.trim() && Number.isFinite(Number(params.maxMagnitude)) ? Number(params.maxMagnitude) : undefined,
      minBu: params.minBu?.trim() && Number.isFinite(Number(params.minBu)) ? Number(params.minBu) : undefined,
      maxBu: params.maxBu?.trim() && Number.isFinite(Number(params.maxBu)) ? Number(params.maxBu) : undefined,
      minForks: params.minForks?.trim() && Number.isFinite(Number(params.minForks)) ? Number(params.minForks) : undefined,
      fromDate: params.fromDate, toDate: params.toDate,
      definitionKind: params.definitionKind === "TEMPLATE" ? "TEMPLATE" : params.definitionKind === "EXPRESSION" ? "EXPRESSION" : undefined,
      mirrorableOnly: params.mirrorableOnly === "1",
      hasForks: params.hasForks === "1",
      // Tag filter — only honoured for ITEM target type. Other types
      // (primitive/capability/effect/template) don't have a tag array
      // column so the query would no-op.
      ...(targetType === "ITEM" && tagFilter.length > 0
        ? { tags: tagFilter }
        : {}),
      ...(viewerClerkId ? { viewerClerkId } : {}),
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    category ? listPrimitiveFamilyTiers(category) : Promise.resolve([]),
    viewerClerkId ? resolveUserIdByClerkId(viewerClerkId) : Promise.resolve(null),
  ]);

  // Engagement depends on both the resolved viewer and the visible result set.
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
    collectionId:params.collectionId??"",
    origin: params.origin === "system" || params.origin === "community" ? params.origin : "all",
    tier: params.tier ?? "",
    mechanicTarget: params.mechanicTarget ?? "", recipient: ["self", "target", "scene"].includes(params.recipient ?? "") ? params.recipient as "self" | "target" | "scene" : "", conditionMode: params.conditionMode === "conditional" || params.conditionMode === "always" ? params.conditionMode : "", minMagnitude: params.minMagnitude ?? "", maxMagnitude: params.maxMagnitude ?? "",
    minBu: params.minBu ?? "", maxBu: params.maxBu ?? "", minForks: params.minForks ?? "",
    fromDate: params.fromDate ?? "", toDate: params.toDate ?? "",
    definitionKind: params.definitionKind === "TEMPLATE" || params.definitionKind === "EXPRESSION" ? params.definitionKind : "",
    mirrorableOnly: params.mirrorableOnly === "1",
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
    <><div className={`v12-library-page${monsterCatalogue?" monster-catalogue":""} mx-auto w-full max-w-[1680px] px-5 py-6`}>
      <LibraryHeader active={targetType} action={monsterCatalogue ? <GMOnly><Link className="sw-metal-button" href="/monsters/new"><EntityTypeIcon type="CREATE_MONSTER"/>Create monster or NPC</Link></GMOnly> : undefined}/>


      {targetType !== "PRIMITIVE" && targetType !== "ALL" && targetType !== "MONSTER" && targetType !== "CHARACTER" ? (
        <nav className="v12-library-submodes" aria-label="Creation types">
          {[
            ["CAPABILITY", "Capabilities"],
            ["EFFECT", "Effects"],
            ["LINEAGE_TEMPLATE", "Lineages"],
            ["UPBRINGING_TEMPLATE", "Upbringings"],
            ["MANIFEST_TEMPLATE", "Manifests"],
            ["ITEM", "Items"],
          ].map(([type, label]) => (
            <Link
              key={type}
              className={targetType === type ? "is-active" : ""}
              href={`/library/browse?type=${type}`}
            >
              <EntityTypeIcon type={type ?? "ALL"}/><span>{label}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {monsterCatalogue && viewerClerkId && <details className="v12-instrument my-3 p-3">
        <summary className="flex cursor-pointer items-center gap-3 text-sm"><strong>Your private play sheets</strong><span className="v12-badge">{playCopies.length}</span></summary>
        <div className="mt-3 flex flex-wrap gap-2">{playCopies.length ? playCopies.map(copy => <Link key={copy.id} className="sw-metal-button sw-metal-button--secondary" href={`/monsters/play/${copy.id}`}><span>{copy.name}</span><small>{copy.currentVitality} Vitality · v{copy.templateVersion}</small><span aria-hidden>→</span></Link>) : <p className="text-sm text-muted-foreground">Open a creature preview and bring a private copy to your table.</p>}</div>
      </details>}
      <div className="phone-library-stage mt-3 flex min-h-[calc(100dvh-13rem)] flex-col md:h-[calc(100vh-13rem)] md:min-h-0">
        <LibraryBrowseClient
          {...(monsterCatalogue ? { basePath: "/monsters", fixedType: "MONSTER" as const } : {})}
          initialItems={result.items}
          total={result.total}
          page={page}
          totalPages={totalPages}
          initialState={initialState}
          primitiveCategories={categories}
          familyTiers={familyTiers}
          itemTags={itemTags}
          activeTags={tagFilter}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
        />
      </div>
    </div></>
  );
}
