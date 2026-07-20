"use client";

// =============================================================================
// CreationsClient — filterable table of the signed-in user's authored entries.
// Filters: type (all / primitive / effect / capability / template / item / character)
//          status (all / draft = isPublic=false)
//          view  (GRID | LIST — P5R-6 added the LIST toggle)
//
// Renders as a stack of filter chips on mobile, with the result set as a
// LibraryTable. Card click pushes a ModalStack entry showing a
// per-entity-type preview body — no separate "View" / "Add" buttons.
//
// The preview also includes a visibility selector (PRIVATE / FOLLOWERS_ONLY /
// PUBLIC). Changing visibility POSTs to /api/creations/visibility which
// creates / updates a `publications` row. There is no separate publish
// action — visibility IS the publish state, and version history becomes
// accessible to the matching audience as soon as the chip flips to
// PUBLIC or FOLLOWERS_ONLY.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import { LibraryTable } from "@/components/library/library-table";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import { PreviewActions } from "@/components/preview/preview-shared";
import { visibilityLabel, type Visibility } from "@/components/library/visibility-select";
import type { LibraryEngagement } from "@/lib/engagement/library-engagement";
import { cn } from "@/lib/utils";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

type TypeFilter =
  | "all"
  | "primitive"
  | "effect"
  | "capability"
  | "template"
  | "item"
  | "character"
  | "build";
type StatusFilter = "all" | "draft";
// Phase 9 follow-up: fork/creation kind filter. "fork" = rows whose
// sourceOrigin starts with "fork:" (came from someone else's entity);
// "creation" = everything else (authored-from-scratch or re-edit of own
// row).
type KindFilter = "all" | "fork" | "creation";
// Phase 9 follow-up: visibility filter at the canonical level.
// Mirrors the publications.visibility enum so users can slice their
// creations by audience.
type VisibilityFilter = "all" | "public" | "followers" | "private";

interface CreationsClientProps {
  items: LibraryItem[];
  counts: Record<Exclude<TypeFilter, "all">, number>;
  initialType: string;
  initialStatus: string;
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
}

const TYPE_CHIPS: Array<{ key: TypeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "primitive", label: "Primitives" },
  { key: "effect", label: "Effects" },
  { key: "capability", label: "Capabilities" },
  { key: "template", label: "Heritage" },
  { key: "item", label: "Items" },
  { key: "character", label: "Characters" },
  { key: "build", label: "Builds" },
];

// Map LibraryItem.targetType to TypeFilter.
const TARGET_TYPE_MAP: Record<string, TypeFilter> = {
  PRIMITIVE: "primitive",
  EFFECT: "effect",
  CAPABILITY: "capability",
  LINEAGE_TEMPLATE: "template",
  UPBRINGING_TEMPLATE: "template",
  MANIFEST_TEMPLATE: "template",
  ITEM: "item",
  CHARACTER: "character",
  MONSTER: "character",
  BUILD_TEMPLATE: "build",
};

export function CreationsClient({
  items: initialItems,
  counts,
  initialType,
  initialStatus,
  engagement: initialEngagement,
  currentUserInternalId,
}: CreationsClientProps) {
  const [type, setType] = useState<TypeFilter>(
    (TYPE_CHIPS.find((c) => c.key === initialType)?.key ?? "all") as TypeFilter,
  );
  const [status, setStatus] = useState<StatusFilter>(
    initialStatus === "draft" ? "draft" : "all",
  );
  // Phase 9 follow-up: two new orthogonal filter dimensions.
  const [kind, setKind] = useState<KindFilter>("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [search, setSearch] = useState("");
  // P5R-6: LIST view toggle. LibraryTable already supports both modes; the
  // view prop is just plumbed through. Default LIST (the user said list view
  // is the better default — grid icons were too dominant and a 2-column
  // mobile grid was cramped on a 393px viewport). Local state only; the
  // /library/browse page persists its own choice in the sw_lib_pref cookie.
  //
  // Mobile force-list: even if the user previously picked GRID, the
  // server-rendered `view` prop coming from /creations/page.tsx is the
  // server's readLibraryPreferences() result — which itself forces LIST
  // on mobile (see src/lib/preferences/library-prefs.ts). On the client,
  // the page's media-query check below is a belt-and-braces fallback in
  // case the cookie says GRID and the user resizes the window without a
  // server roundtrip.
  const [view, setView] = useState<LibraryView>("LIST");
  // Belt-and-braces: on first effect, if the viewport is mobile-width,
  // pin to LIST regardless of any subsequent GRID toggle. The user can
  // still manually re-toggle to GRID, but on the next reload on a phone
  // it snaps back. The server-side guard in readLibraryPreferences is
  // the authoritative source; this is just a client-side nudge.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setView("LIST");
    };
    if (mql.matches) setView("LIST");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  // Lifted visibility map so optimistic updates from the preview modal
  // re-render the table without a refresh. Keyed by LibraryItem.id.
  // The previous implementation mutated `item.visibility` directly,
  // which didn't trigger a re-render of the table.
  const [visibilityById, setVisibilityById] = useState<
    Record<string, "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC">
  >(() => {
    const map: Record<string, "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC"> = {};
    for (const item of initialItems) {
      map[item.id] = item.visibility ?? "PRIVATE";
    }
    return map;
  });
  const items = useMemo(
    () =>
      initialItems.map((item) => ({
        ...item,
        visibility: visibilityById[item.id] ?? item.visibility ?? "PRIVATE",
      })),
    [initialItems, visibilityById],
  );

  const router = useRouter();
  const stack = useModalStack();
  const { setFilterPanelOpen } = useGlobalControls();

  // The right-side filter panel shows advanced filter chips (type + status).
  // Search is in the column header for quick access.
  // Memoize the slot content so the panel doesn't see a new ref every render.
  const filterSlot = useMemo(
    () => (
      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_CHIPS.map((c) => {
              const active = type === c.key;
              const count = c.key === "all" ? items.length : counts[c.key] ?? 0;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setType(c.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {c.label}
                  {count > 0 ? (
                    <span className="ml-1 opacity-70">({count})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Status
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "all", label: "All" },
                { key: "draft", label: "Drafts only" },
              ] as const
            ).map((c) => {
              const active = status === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setStatus(c.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Phase 9 follow-up: "Kind" filter chips slice the list by
            authorship origin. "Forks only" shows rows whose sourceOrigin
            starts with "fork:" (came from someone else's entity); the
            "Creations only" chip is the inverse. "All" passes both. */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Kind
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "all", label: "All" },
                { key: "fork", label: "Forks only" },
                { key: "creation", label: "Creations only" },
              ] as const
            ).map((c) => {
              const active = kind === c.key;
              const count =
                c.key === "all"
                  ? items.length
                  : c.key === "fork"
                    ? items.filter((it) => it.sourceOrigin?.startsWith("fork:"))
                      .length
                    : items.filter(
                        (it) => !it.sourceOrigin?.startsWith("fork:"),
                      ).length;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setKind(c.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {c.label}
                  {count > 0 ? (
                    <span className="ml-1 opacity-70">({count})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        {/* Phase 9 follow-up: "Visibility" filter chips slice the list by
            the canonical publication audience. The "Drafts only" Status
            chip above covers PRIVATE; this group separates PUBLIC and
            FOLLOWERS_ONLY. */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Visibility
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "all", label: "All" },
                { key: "public", label: "Public" },
                { key: "followers", label: "Followers only" },
                { key: "private", label: "Private only" },
              ] as const
            ).map((c) => {
              const active = visibility === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setVisibility(c.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/80">
          Tip: cards open a preview modal. Click "Open source page" inside to
          visit the full canonical detail page.
        </p>
      </div>
    ),
    [type, status, kind, visibility, items.length, counts],
  );
  useFilterSlot(filterSlot);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const mapped = TARGET_TYPE_MAP[item.targetType] ?? "primitive";
      if (type !== "all" && mapped !== type) return false;
      // "Drafts only" = unpublished (no publishedAt). LibraryItem doesn't
      // carry isPublic; the query layer fills publishedAt only for public rows.
      if (status === "draft" && item.publishedAt !== null) return false;
      // Phase 9 follow-up: Kind filter. "fork" = sourceOrigin starts with
      // "fork:" (came from someone else's entity); "creation" = the rest
      // (authored-from-scratch, re-edit of own row, admin canon-edit).
      if (kind === "fork" && !item.sourceOrigin?.startsWith("fork:")) return false;
      if (kind === "creation" && item.sourceOrigin?.startsWith("fork:")) return false;
      // Phase 9 follow-up: Visibility filter. visibility comes from the
      // publications table joined at page-load time; `visibilityById`
      // overrides it for optimistic UI updates from the preview modal.
      // PRIVATE is the default for unpublished rows (no publications
      // row) — we treat missing/null visibility as PRIVATE here so the
      // "Private only" chip correctly captures both explicit and
      // implicit private states.
      if (visibility !== "all") {
        const itemVis = item.visibility ?? "PRIVATE";
        if (visibility === "public" && itemVis !== "PUBLIC") return false;
        if (visibility === "followers" && itemVis !== "FOLLOWERS_ONLY") return false;
        if (visibility === "private" && itemVis !== "PRIVATE") return false;
      }
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, type, status, kind, visibility, search]);

  const hasActiveFilters =
    type !== "all" ||
    status !== "draft" ||
    kind !== "all" ||
    visibility !== "all";

  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ColumnSearchBar
              search={search}
              onSearchChange={setSearch}
              onOpenFilters={() => setFilterPanelOpen(true)}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
          {/* P5R-6: GRID / LIST toggle. Local state only; resets when
              the user navigates away. Two buttons side-by-side; the active
              one shows the primary colour, the other is muted. */}
          <div
            className="inline-flex shrink-0 overflow-hidden rounded-md border border-border"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setView("GRID")}
              className={cn(
                "inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "GRID"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
              title="Grid view"
              aria-pressed={view === "GRID"}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("LIST")}
              className={cn(
                "inline-flex items-center justify-center border-l border-border px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "LIST"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
              title="List view"
              aria-pressed={view === "LIST"}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-card/30 p-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            You haven't authored anything yet.
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Start by composing a primitive in the sandbox, or fork an existing
            entry from the library. Everything you create will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card/50 p-2">
          <LibraryTable
            items={filteredItems}
            view={view}
            engagement={initialEngagement}
            currentUserInternalId={currentUserInternalId}
            onSelect={(item) => {
              if (!stack.canPush) return;
              const isDraft = item.publishedAt === null;
              stack.push({
                key: `creation:${item.id}`,
                label: item.name,
                category: `${TARGET_TYPE_MAP[item.targetType] ?? "item"}${isDraft ? " · draft" : ""}`,
                content: (
                  <CreationPreview
                    item={item}
                    onDeleted={() => {
                      // After delete: close the modal stack and refresh
                      // the parent server tree so the card disappears.
                      stack.clear();
                      router.refresh();
                    }}
                    onEdit={() => {
                      // Close the preview modal BEFORE navigating, otherwise
                      // the modal stays open over the new sandbox page and
                      // the build drawer (which opens on the new page's
                      // initialEditing effect) appears behind the modal —
                      // the user sees nothing happen.
                      stack.clear();
                      const targetType = item.targetType;
                      if (targetType === "PRIMITIVE")
                        router.push(
                          `/atelier?build=primitive&edit=${item.targetId}&intent=load`,
                        );
                      else if (targetType === "EFFECT")
                        router.push(
                          `/atelier?build=effect&edit=${item.targetId}&intent=load`,
                        );
                      else if (targetType === "CAPABILITY")
                        router.push(
                          `/atelier?build=capability&edit=${item.targetId}&intent=load`,
                        );
                      else if (targetType === "ITEM")
                        router.push(
                          `/atelier?build=item&edit=${item.targetId}&intent=load`,
                        );
                      else if (
                        targetType === "LINEAGE_TEMPLATE" ||
                        targetType === "UPBRINGING_TEMPLATE" ||
                        targetType === "MANIFEST_TEMPLATE"
                      ) {
                        router.push(
                          `/atelier?build=heritage&edit=${item.targetId}&intent=load`,
                        );
                      } else if (targetType === "CHARACTER") {
                        router.push(
                          `/characters/${item.targetId}`,
                        );
                      } else if (targetType === "BUILD_TEMPLATE") {
                        // Builds have their own sandbox route at
                        // /sandbox/builds (not /sandbox/blueprint — that
                        // route is for heritage/items/monsters). Builds
                        // are a separate table (see db/schema/characters.ts)
                        // keyed by uuid; ?edit=<id> makes the page load
                        // the row into the BuildComposer with full
                        // capability-link hydration. Without this branch
                        // the user clicked Edit on a build and got a
                        // silent no-op (the URL was never built).
                        router.push(
                          `/sandbox/builds?edit=${item.targetId}&intent=load`,
                        );
                      }
                    }}
                    onVisibilityChange={async (vis) => {
                      // Capture the previous value BEFORE the optimistic
                      // update so the rollback below can restore it on
                      // failure. The previous implementation read from
                      // `prev[item.id]` inside the rollback, but by then
                      // `prev[item.id]` had already been overwritten with
                      // the new value, so the rollback was a no-op and
                      // failures left the UI showing the new (unsaved)
                      // chip state.
                      const previousVisibility: Visibility =
                        visibilityById[item.id] ??
                        item.visibility ??
                        "PRIVATE";
                      // Optimistic update — the local visibilityById map
                      // drives the re-render so the chip changes colour
                      // immediately. The previous version mutated
                      // `item.visibility` directly which React didn't see.
                      setVisibilityById((prev) => ({
                        ...prev,
                        [item.id]: vis,
                      }));
                      try {
                        const res = await fetch("/api/creations/visibility", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            targetType: item.targetType,
                            targetId: item.targetId,
                            visibility: vis,
                          }),
                        });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          throw new Error(
                            data.error ?? `HTTP ${res.status}`,
                          );
                        }
                        // API success — refresh server data so the next
                        // render reflects any server-side defaults (e.g.
                        // re-fetching publication status). router.refresh
                        // is non-blocking; the optimistic state stays.
                        router.refresh();
                      } catch (e) {
                        // Roll back optimistic update to the captured
                        // previous value (not `prev[item.id]`, which has
                        // already been overwritten).
                        setVisibilityById((prev) => ({
                          ...prev,
                          [item.id]: previousVisibility,
                        }));
                        throw e;
                      }
                    }}
                  />
                ),
              });
            }}
            showClearFilters={false}
            emptyTitle="No creations match"
            emptyDescription="Adjust your type/status filters or search for a different name."
          />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CreationPreview — body for the modal stack entry. Shows the row's key fields
// and offers "Edit in sandbox" / "Open source page" / "View fork history".
// -----------------------------------------------------------------------------

function CreationPreview({
  item,
  onEdit,
  onVisibilityChange,
  onDeleted,
}: {
  item: LibraryItem;
  onEdit: () => void;
  onVisibilityChange?: (vis: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC") => void;
  /**
   * Called after a successful delete so the parent can refresh / close
   * the modal. Without this, the deleted card would still show until
   * a manual reload.
   */
  onDeleted?: () => void;
}) {
  // Visibility IS the publish state. PRIVATE = only me. FOLLOWERS_ONLY = me
  // and my followers (creates a publication row). PUBLIC = everyone (creates
  // a publication row). There is no separate "publish" action — changing
  // visibility in the modal is itself the publish. The visibility API
  // (/api/creations/visibility) creates/updates the publications row
  // synchronously so the version history page sees a publication as soon
  // as the chip flips to PUBLIC or FOLLOWERS_ONLY.
  //
  // `liveVisibility` mirrors the user's most recent chip click so the
  // Delete-button gate updates immediately. Without it, `canDelete` would
  // read the stale `item.visibility` captured when the modal opened and
  // the "Unpublish to delete" placeholder would stay visible until refresh.
  const [liveVisibility, setLiveVisibility] = useState<Visibility>(
    (item.visibility ?? "PRIVATE") as Visibility,
  );
  // Delete is only safe when nothing is published. With our model that
  // means visibility must be PRIVATE — any publication row (PUBLIC or
  // FOLLOWERS_ONLY) blocks deletion since other people may have slotted
  // it into their builds and pinned that version.
  const canDelete = liveVisibility === "PRIVATE";

  async function handleDelete() {
    const res = await fetch("/api/creations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: item.targetType,
        targetId: item.targetId,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    // PreviewActions closes its own confirm dialog on success; fire
    // onDeleted so the parent refreshes + closes its own modal.
    onDeleted?.();
  }

  // Visibility IS the publish action. There is no separate "publish" button
  // in this modal — the visibility chip on the left is the only thing that
  // creates / removes a publication row (see /api/creations/visibility).
  // PRIVATE → no publication row. FOLLOWERS_ONLY / PUBLIC → publication row
  // visible to the right audience.

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {TARGET_TYPE_MAP[item.targetType] ?? item.targetType}
          {item.publishedAt ? " · published" : " · draft"}
        </p>
        <h3 className="font-display text-xl font-semibold">{item.name}</h3>
        {item.description ? (
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {item.description.length > 140
              ? `${item.description.slice(0, 140)}…`
              : item.description}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="uppercase text-muted-foreground">Type</dt>
          <dd>{item.targetType}</dd>
        </div>
        <div>
          <dt className="uppercase text-muted-foreground">Visibility</dt>
          <dd>{visibilityLabel(liveVisibility)}</dd>
        </div>
        {item.authorUsername ? (
          <div>
            <dt className="uppercase text-muted-foreground">Author</dt>
            <dd>{item.authorUsername}</dd>
          </div>
        ) : null}
      </dl>

      {/* Unified action bar — identical to the library / atelier previews.
          Edit · Source · Versions in a 3-col grid, plus a full-width Delete
          (gated on PRIVATE visibility) with its own confirm dialog. */}
      <PreviewActions
        onEdit={onEdit}
        openSourceHref={`/library/item/${item.id}`}
        versionHistoryHref={`/library/item/${item.id}/versions`}
        onDelete={handleDelete}
        deletable={Boolean(onDeleted)}
        canDelete={canDelete}
        visibility={liveVisibility}
        {...(onVisibilityChange
          ? {
              onVisibilityChange: (next: Visibility) => {
                setLiveVisibility(next);
                void Promise.resolve(onVisibilityChange(next)).catch(() => {
                  setLiveVisibility((item.visibility ?? "PRIVATE") as Visibility);
                });
              },
            }
          : {})}
      />
    </div>
  );
}
