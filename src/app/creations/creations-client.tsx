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

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, ExternalLink, History, Pencil, Trash2 } from "lucide-react";
import { useModalStack } from "@/components/ui/modal-stack";
import { LibraryTable } from "@/components/library/library-table";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import { VisibilitySelect, type Visibility, visibilityLabel } from "@/components/library/visibility-select";
import { cn } from "@/lib/utils";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryView } from "@/lib/preferences/library-prefs";

type TypeFilter = "all" | "primitive" | "effect" | "capability" | "template" | "item" | "character";
type StatusFilter = "all" | "draft";

interface CreationsClientProps {
  items: LibraryItem[];
  counts: Record<Exclude<TypeFilter, "all">, number>;
  initialType: string;
  initialStatus: string;
}

const TYPE_CHIPS: Array<{ key: TypeFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "primitive", label: "Primitives" },
  { key: "effect", label: "Effects" },
  { key: "capability", label: "Capabilities" },
  { key: "template", label: "Templates" },
  { key: "item", label: "Items" },
  { key: "character", label: "Characters" },
];

// Map LibraryItem.targetType to TypeFilter.
const TARGET_TYPE_MAP: Record<string, TypeFilter> = {
  PRIMITIVE: "primitive",
  EFFECT: "effect",
  CAPABILITY: "capability",
  RACE_TEMPLATE: "template",
  BACKGROUND_TEMPLATE: "template",
  ARCHETYPE_TEMPLATE: "template",
  ITEM: "item",
  CHARACTER: "character",
  MONSTER: "character",
};

export function CreationsClient({
  items: initialItems,
  counts,
  initialType,
  initialStatus,
}: CreationsClientProps) {
  const [type, setType] = useState<TypeFilter>(
    (TYPE_CHIPS.find((c) => c.key === initialType)?.key ?? "all") as TypeFilter,
  );
  const [status, setStatus] = useState<StatusFilter>(
    initialStatus === "draft" ? "draft" : "all",
  );
  const [search, setSearch] = useState("");
  // P5R-6: LIST view toggle. LibraryTable already supports both modes; the
  // view prop is just plumbed through. Default GRID matches the previous
  // behavior; persisted in local state for this page (no cookie — Creations
  // is per-user, not shared with the public library where the cookie matters).
  const [view, setView] = useState<LibraryView>("GRID");
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
        <p className="text-[10px] text-muted-foreground/80">
          Tip: cards open a preview modal. Click "Open source page" inside to
          visit the full canonical detail page.
        </p>
      </div>
    ),
    [type, status, items.length, counts],
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
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, type, status, search]);

  const hasActiveFilters = type !== "all" || status !== "draft";

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
            engagement={{ reactions: {}, following: {} }}
            currentUserInternalId={null}
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
                      const targetType = item.targetType;
                      if (targetType === "PRIMITIVE")
                        router.push(
                          `/sandbox/grammar?build=primitive&edit=${item.targetId}&intent=load`,
                        );
                      else if (targetType === "EFFECT")
                        router.push(
                          `/sandbox/grammar?build=effect&edit=${item.targetId}&intent=load`,
                        );
                      else if (targetType === "CAPABILITY")
                        router.push(
                          `/sandbox/grammar?build=capability&edit=${item.targetId}&intent=load`,
                        );
                      else if (targetType === "ITEM")
                        router.push(
                          `/sandbox/blueprint?build=item&edit=${item.targetId}&intent=load`,
                        );
                      else if (
                        targetType === "RACE_TEMPLATE" ||
                        targetType === "BACKGROUND_TEMPLATE" ||
                        targetType === "ARCHETYPE_TEMPLATE"
                      ) {
                        router.push(
                          `/sandbox/blueprint?build=template&edit=${item.targetId}&intent=load`,
                        );
                      } else if (targetType === "CHARACTER") {
                        router.push(
                          `/characters/${item.targetId}`,
                        );
                      }
                    }}
                    onVisibilityChange={async (vis) => {
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
                      } catch (e) {
                        // Roll back optimistic update.
                        setVisibilityById((prev) => ({
                          ...prev,
                          [item.id]:
                            prev[item.id] ?? item.visibility ?? "PRIVATE",
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
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
      // Close the confirm modal, fire onDeleted so parent refreshes +
      // closes its own modal, then we're done.
      setConfirmOpen(false);
      onDeleted?.();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
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

      {onVisibilityChange ? (
        <VisibilitySelect
          value={liveVisibility}
          onChange={(next) => {
            // Optimistic local update so the chip flips immediately, then
            // propagate up so the table row + map stay in sync. We can't
            // await onVisibilityChange here (the select's onChange is sync);
            // if it rejects, the parent's catch handler rolls the map back
            // and we mirror by reverting local state too.
            setLiveVisibility(next);
            void Promise.resolve(onVisibilityChange(next)).catch(() => {
              setLiveVisibility((item.visibility ?? "PRIVATE") as Visibility);
            });
          }}
        />
      ) : null}

      {/* Action buttons. Mashu 2026-07-09: 1×3 grid of the three primary
          actions (Edit in sandbox / Source page / Version history).
          Fork history removed — the source page already renders the
          ForksList at #forks, so a separate button was redundant.
          Delete stays full-width below the row since it has its own
          canDelete gate + confirm dialog. 1×3 = equal visual weight,
          predictable tap targets on mobile. */}
      <div className="grid grid-cols-3 gap-1.5 border-t border-border pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Pencil className="size-3.5" />
          Edit
        </button>
        <a
          href={`/library/item/${item.id}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ExternalLink className="size-3.5" />
          <span>Source</span>
        </a>
        <a
          href={`/library/item/${item.id}/versions`}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <History className="size-3.5" />
          <span>Versions</span>
        </a>
      </div>

      {onDeleted ? (
        canDelete ? (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setConfirmOpen(true);
            }}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-500/50 px-3 py-2 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        ) : (
          <p
            className="mt-2 rounded-md border border-dashed border-border bg-card/30 px-3 py-2 text-center text-[10px] text-muted-foreground"
            title="Set visibility to PRIVATE to enable deletion. This unpublishes the row so version history becomes private-only."
          >
            Set visibility to <span className="font-semibold">Private</span> to enable deletion
          </p>
        )
      ) : null}

      {deleteError ? (
        <p className="text-xs text-rose-400" role="alert">
          {deleteError}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setConfirmOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <header className="border-b border-border px-4 py-3">
              <h4 className="text-sm font-semibold">Delete this creation?</h4>
            </header>
            <div className="space-y-3 p-4 text-sm">
              <p>
                <span className="font-semibold">{item.name}</span> will be
                permanently deleted along with any composition links
                (capabilities, effects, primitives it slots into).
              </p>
              <p className="text-xs text-muted-foreground">
                This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={deleting}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
