"use client";

// Blueprint Library column.
//
// Hosts the left column for the /sandbox/blueprint route. Mirrors the
// GrammarLibrary structure: <LibraryToolbar /> + <LibraryTable /> +
// <SandboxPreviewModal /> for row-click full-content preview.
//
// Build mode gating (per the user's spec):
// - Template mode: Templates chip → expands into RACE/BACKGROUND/ARCHETYPE
//   sub-chips when Templates is the active type filter.
// - Item mode: only the Items chip is available.
// - Monster mode: Monster composer doesn't exist yet, so the left column
//   shows an empty state with guidance.
//
// All filtering, sorting, and view-mode is owned by the LibraryToolbar.

import { useEffect, useMemo, useState } from "react";
import { LibraryToolbar, type LibraryToolbarState } from "@/components/library/library-toolbar";
import { LibraryTable } from "@/components/library/library-table";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import type { LibraryItem, LibraryTargetType } from "@/lib/publishing/library-query";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import { useModalStack } from "@/components/ui/modal-stack";
import type {
  SandboxItemRow,
  SandboxPreviewItem,
  SandboxTemplateRow,
} from "@/components/sandbox/sandbox-preview-modal";
import type { BlueprintBuildMode } from "./blueprint-sandbox-client";

interface BlueprintLibraryProps {
  build: BlueprintBuildMode;
  libraryItems: LibraryItem[];
  templates: SandboxTemplateRow[];
  items: SandboxItemRow[];
  editingKey: string | null;
  onSelect: (kind: "template" | "item", id: string) => void;
}

// Chip set per build mode (per the user's gating rules).
// Templates chip expands into RACE/BACKGROUND/ARCHETYPE sub-chips.
const AVAILABLE_TYPES_BY_BUILD: Record<
  BlueprintBuildMode,
  Array<{ key: LibraryTargetType | "ALL"; label: string }>
> = {
  template: [
    { key: "RACE_TEMPLATE", label: "Races" },
    { key: "BACKGROUND_TEMPLATE", label: "Backgrounds" },
    { key: "ARCHETYPE_TEMPLATE", label: "Archetypes" },
  ],
  item: [{ key: "ITEM", label: "Items" }],
  monster: [], // No composer yet — left column renders empty state.
};

const SUB_KIND_CHIPS: Array<{ key: string; label: string }> = [
  { key: "RACE", label: "Race" },
  { key: "BACKGROUND", label: "Background" },
  { key: "ARCHETYPE", label: "Archetype" },
];

export function BlueprintLibrary({
  build,
  libraryItems,
  templates,
  items,
  editingKey,
  onSelect,
}: BlueprintLibraryProps) {
  const [activeSubKinds, setActiveSubKinds] = useState<string[]>([
    "RACE",
    "BACKGROUND",
    "ARCHETYPE",
  ]);

  // Default type filter per build mode.
  const defaultTypeFilter: LibraryTargetType | "ALL" =
    build === "template"
      ? "RACE_TEMPLATE"
      : build === "item"
        ? "ITEM"
        : "ALL"; // Monster — fallback

  const availableTypes = AVAILABLE_TYPES_BY_BUILD[build];

  // Toolbar state — owned here, filtered list is derived.
  const [toolbarState, setToolbarState] = useState<LibraryToolbarState>(() => ({
    search: "",
    sort: "ENGAGEMENT",
    view: "GRID",
    typeFilter: defaultTypeFilter,
    category: "",
    author: "",
    minLikes: "",
    hasForks: false,
  }));

  // When the build mode changes, reset the type filter to the new default
  // and clear the sub-kind selection so the user sees the right subset
  // immediately. (Fix for "filters don't auto-apply when switching tabs".)
  useEffect(() => {
    setToolbarState((prev) => ({
      ...prev,
      typeFilter: defaultTypeFilter,
      category: "",
    }));
    setActiveSubKinds(["RACE", "BACKGROUND", "ARCHETYPE"]);
  }, [build, defaultTypeFilter]);

  // Find the full typed row for a LibraryItem (used by the modal).
  const lookupRow = useMemo(() => {
    return (item: LibraryItem): SandboxPreviewItem | null => {
      if (
        item.targetType === "RACE_TEMPLATE" ||
        item.targetType === "BACKGROUND_TEMPLATE" ||
        item.targetType === "ARCHETYPE_TEMPLATE"
      ) {
        const row = templates.find((t) => t.id === item.targetId);
        return row ? { kind: "template", row } : null;
      }
      if (item.targetType === "ITEM") {
        const row = items.find((i) => i.id === item.targetId);
        return row ? { kind: "item", row } : null;
      }
      return null;
    };
  }, [templates, items]);

  // Filter items by toolbar search/typeFilter + active sub-kinds when in
  // template mode. The toolbar's own filters run in addition to the
  // build-mode gate so the user can narrow the visible subset further.
  const filteredItems = useMemo(() => {
    let items = libraryItems;

    // Build-mode gate: in template mode, only templates pass.
    if (build === "template") {
      if (activeSubKinds.length === 0) return [];
      items = items.filter((item) => {
        if (
          item.targetType === "RACE_TEMPLATE" ||
          item.targetType === "BACKGROUND_TEMPLATE" ||
          item.targetType === "ARCHETYPE_TEMPLATE"
        ) {
          const kind = item.category;
          return kind !== null && activeSubKinds.includes(kind);
        }
        return false;
      });
    } else if (build === "item") {
      items = items.filter((item) => item.targetType === "ITEM");
    }

    // Toolbar text search.
    if (toolbarState.search) {
      const q = toolbarState.search.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }

    // Toolbar type filter.
    if (
      toolbarState.typeFilter !== "ALL" &&
      items.length > 0
    ) {
      items = items.filter((item) => item.targetType === toolbarState.typeFilter);
    }

    return items;
  }, [build, libraryItems, activeSubKinds, toolbarState]);

  // Card click → push to modal stack. The "Load into build" action still
  // calls the parent's onSelect; we pop the stack afterwards.
  const stack = useModalStack();
  function pushPreview(item: SandboxPreviewItem) {
    if (!stack.canPush) return;
    const label = item.kind === "template" ? item.row.name : item.row.name;
    stack.push({
      key: `${item.kind}:${item.row.id}`,
      label,
      category: item.kind,
      content: (
        <BlueprintPreviewBody
          item={item}
          onLoadIntoBuild={() => {
            if (item.kind === "template") {
              onSelect("template", item.row.id);
            } else {
              onSelect("item", String(item.row.id));
            }
            stack.clear();
          }}
        />
      ),
    });
  }

  // Right-side filter panel slot: render the full toolbar inside it.
  // The search bar is duplicated in the column header for quick access.
  // Hooks must be called unconditionally — keep this above the monster return.
  const { setFilterPanelOpen } = useGlobalControls();
  useFilterSlot(
    <div className="space-y-3">
      <LibraryToolbar
        state={toolbarState}
        onStateChange={setToolbarState}
        availableTypes={availableTypes}
        subKindParent="RACE_TEMPLATE"
        subKinds={SUB_KIND_CHIPS}
        activeSubKinds={activeSubKinds}
        onSubKindsChange={setActiveSubKinds}
        showSearch={true}
        showAdvancedFilters={true}
      />
    </div>,
  );

  const hasActiveFilters =
    toolbarState.typeFilter !== "ALL" ||
    toolbarState.category !== "" ||
    toolbarState.author !== "" ||
    toolbarState.minLikes !== "" ||
    toolbarState.hasForks ||
    toolbarState.sort !== "ENGAGEMENT" ||
    activeSubKinds.length !== SUB_KIND_CHIPS.length;

  // Monster mode: render an empty state — no composer yet.
  if (build === "monster") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border p-3">
          <ColumnSearchBar search="" onSearchChange={() => {}} />
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-xs space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Monster authoring is queued.
            </p>
            <p className="text-xs text-muted-foreground">
              The Monster schema is in place; the composer will be migrated
              from the Blueprint route once it stabilizes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <ColumnSearchBar
          search={toolbarState.search}
          onSearchChange={(s: string) =>
            setToolbarState((prev) => ({ ...prev, search: s }))
          }
          onOpenFilters={() => setFilterPanelOpen(true)}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <LibraryTable
          items={filteredItems}
          view="GRID"
          engagement={{ reactions: {}, following: {} }}
          currentUserInternalId={null}
          onSelect={(item) => {
            const full = lookupRow(item);
            if (full) pushPreview(full);
          }}
          {...(editingKey !== null ? { selectedKey: editingKey } : {})}
          showClearFilters={false}
          emptyTitle="No entries match"
          emptyDescription="Adjust your sub-kind selection or switch to another build mode."
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// BlueprintPreviewBody — body for the modal stack entry created by BlueprintLibrary.
// Renders template or item fields with a "Load into build" / "Open source" footer.
// -----------------------------------------------------------------------------

function BlueprintPreviewBody({
  item,
  onLoadIntoBuild,
}: {
  item: SandboxPreviewItem;
  onLoadIntoBuild: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {item.kind}
        </p>
        <h3 className="font-display text-xl font-semibold">
          {item.row.name}
        </h3>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <BlueprintPreviewFields item={item} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onLoadIntoBuild}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Load into build
        </button>
        <a
          href={`/library/${item.kind}/${item.row.id}`}
          className="text-xs text-primary hover:underline"
        >
          Open source page →
        </a>
      </div>
    </div>
  );
}

function BlueprintPreviewFields({ item }: { item: SandboxPreviewItem }) {
  if (item.kind === "primitive" || item.kind === "effect" || item.kind === "capability") {
    return (
      <p className="text-sm text-muted-foreground">
        Grammar entries render in the Grammar library modal.
      </p>
    );
  }
  if (item.kind === "template") {
    const r = item.row;
    return (
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Sub-kind</dt>
          <dd>{r.kind}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Public</dt>
          <dd>{r.isPublic ? "Yes" : "No"}</dd>
        </div>
        {r.description ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-wrap">{r.description}</dd>
          </div>
        ) : null}
        {r.suggestedTraits ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">Suggested traits</dt>
            <dd className="whitespace-pre-wrap">{r.suggestedTraits}</dd>
          </div>
        ) : null}
        {r.primitiveLinks.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">
              Primitive Links
            </dt>
            <dd>
              <ul className="space-y-1">
                {r.primitiveLinks.map((pl) => (
                  <li key={pl.primitiveId} className="text-xs">
                    {pl.primitive.name} ({pl.primitive.buCost} BU)
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    );
  }
  // item
  const r = item.row;
  return (
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs uppercase text-muted-foreground">Rarity</dt>
        <dd>{r.rarity ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase text-muted-foreground">BU Cost</dt>
        <dd>{r.buCost ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase text-muted-foreground">Public</dt>
        <dd>{r.isPublic ? "Yes" : "No"}</dd>
      </div>
      {r.description ? (
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Description</dt>
          <dd className="whitespace-pre-wrap">{r.description}</dd>
        </div>
      ) : null}
    </dl>
  );
}