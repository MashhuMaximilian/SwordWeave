"use client";

// =============================================================================
// CreationsClient — filterable table of the signed-in user's authored entries.
// Filters: type (all / primitive / effect / capability / template / item / character)
//          status (all / draft = isPublic=false)
//
// Renders as a stack of filter chips on mobile, with the result set as a
// LibraryTable grid. Card click pushes a ModalStack entry showing a
// per-entity-type preview body — no separate "View" / "Add" buttons.
//
// The preview also includes a visibility selector (PRIVATE / FOLLOWERS_ONLY /
// PUBLIC). Changing visibility POSTs to /api/creations/visibility which
// creates / updates a `publications` row, allowing the author to control
// the per-item version history visible to followers vs everyone.
// =============================================================================

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalStack } from "@/components/ui/modal-stack";
import { LibraryTable } from "@/components/library/library-table";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import { VisibilitySelect, type Visibility, visibilityLabel } from "@/components/library/visibility-select";
import { cn } from "@/lib/utils";
import type { LibraryItem } from "@/lib/publishing/library-query";

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
        <ColumnSearchBar
          search={search}
          onSearchChange={setSearch}
          onOpenFilters={() => setFilterPanelOpen(true)}
          hasActiveFilters={hasActiveFilters}
        />
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
            view="GRID"
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
                    onEdit={() => {
                      const targetType = item.targetType;
                      if (targetType === "PRIMITIVE")
                        router.push(
                          `/sandbox/grammar?build=primitive&edit=${item.targetId}`,
                        );
                      else if (targetType === "EFFECT")
                        router.push(
                          `/sandbox/grammar?build=effect&edit=${item.targetId}`,
                        );
                      else if (targetType === "CAPABILITY")
                        router.push(
                          `/sandbox/grammar?build=capability&edit=${item.targetId}`,
                        );
                      else if (targetType === "ITEM")
                        router.push(
                          `/sandbox/blueprint?build=item&edit=${item.targetId}`,
                        );
                      else if (
                        targetType === "RACE_TEMPLATE" ||
                        targetType === "BACKGROUND_TEMPLATE" ||
                        targetType === "ARCHETYPE_TEMPLATE"
                      ) {
                        router.push(
                          `/sandbox/blueprint?build=template&edit=${item.targetId}`,
                        );
                      }
                      stack.clear();
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
}: {
  item: LibraryItem;
  onEdit: () => void;
  onVisibilityChange?: (vis: "PRIVATE" | "FOLLOWERS_ONLY" | "PUBLIC") => void;
}) {
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
          <dd>{visibilityLabel(item.visibility)}</dd>
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
          value={(item.visibility ?? "PRIVATE") as Visibility}
          onChange={onVisibilityChange}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Edit in sandbox
        </button>
        <a
          href={`/library/item/${item.id}`}
          className="text-xs text-primary hover:underline"
        >
          Open source page →
        </a>
        <a
          href={`/library/item/${item.id}#forks`}
          className="text-xs text-primary hover:underline"
        >
          View fork history
        </a>
      </div>
    </div>
  );
}
