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
import {
  LibraryItemPreview,
  previewHeadingLabel,
  type SandboxItemRow,
  type SandboxPreviewItem,
  type SandboxTemplateRow,
} from "@/components/library/library-item-preview";
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
  //
  // The toolbar's state shape supports category/author/minLikes/hasForks
  // advanced filters; the previous version of this component only applied
  // search + typeFilter, so chip state for those advanced filters looked
  // "live" (the chips were clickable) but the result set never updated.
  // We now apply every toolbar state field that the result set can
  // meaningfully filter on.
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
    if (toolbarState.typeFilter !== "ALL" && items.length > 0) {
      items = items.filter((item) => item.targetType === toolbarState.typeFilter);
    }

    // Category (items only carry category in template rows).
    if (toolbarState.category) {
      items = items.filter((item) => item.category === toolbarState.category);
    }

    // Author.
    if (toolbarState.author) {
      const q = toolbarState.author.toLowerCase();
      items = items.filter(
        (item) =>
          item.authorUsername !== null &&
          item.authorUsername.toLowerCase().includes(q),
      );
    }

    // Likes / forks / BU cost — best-effort (LibraryItem may not carry
    // counts in the browse payload, so we treat absent as 0).
    if (toolbarState.minLikes) {
      const min = Number(toolbarState.minLikes);
      if (!Number.isNaN(min)) {
        items = items.filter((item) => (item.likesCount ?? 0) >= min);
      }
    }
    if (toolbarState.minForks) {
      const min = Number(toolbarState.minForks);
      if (!Number.isNaN(min)) {
        items = items.filter((item) => (item.forkCount ?? 0) >= min);
      }
    }
    if (toolbarState.hasForks) {
      items = items.filter((item) => (item.forkCount ?? 0) >= 1);
    }
    if (toolbarState.minBu) {
      const min = Number(toolbarState.minBu);
      if (!Number.isNaN(min)) {
        items = items.filter((item) => (item.buCost ?? 0) >= min);
      }
    }
    if (toolbarState.maxBu) {
      const max = Number(toolbarState.maxBu);
      if (!Number.isNaN(max)) {
        items = items.filter((item) => (item.buCost ?? 0) <= max);
      }
    }

    // Tags.
    if (toolbarState.tags) {
      const wanted = toolbarState.tags
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (wanted.length > 0) {
        items = items.filter((item) => {
          const itemTags = (item.tags ?? []).map((t) => t.toLowerCase());
          return wanted.some((t) => itemTags.includes(t));
        });
      }
    }

    return items;
  }, [build, libraryItems, activeSubKinds, toolbarState]);

  // Card click → push to modal stack. The "Load into build" action still
  // calls the parent's onSelect; we pop the stack afterwards. Sub-entity
  // clicks inside the preview push a nested entry so navigation stays
  // inside the open modal.
  const stack = useModalStack();
  function pushPreview(item: SandboxPreviewItem) {
    if (!stack.canPush) return;
    stack.push({
      key: `${item.kind}:${item.row.id}`,
      label: item.row.name,
      category: previewHeadingLabel(item),
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
          onSubLinkClick={(link) => {
            // For now, we only resolve primitives — capability sub-entities
            // aren't in scope from the blueprint sandbox.
            if (link.targetType !== "PRIMITIVE") return;
            const sub = items.find((i) => {
              // Item primitive links are not in scope here; we resolve from
              // the templates collection instead. Items reference primitives
              // too, but the blueprint sandbox has its own primitive registry.
              return false;
            });
            // Fallback: open a link to the canonical page.
            const url = `/library/item/${link.targetType}:${link.targetId}`;
            stack.push({
              key: `sublink:${link.targetType}:${link.targetId}`,
              label: link.label,
              category: link.targetType,
              content: (
                <div className="space-y-3 p-1">
                  <p className="text-sm text-muted-foreground">
                    Sub-entity preview not yet supported in the blueprint
                    sandbox. Tap below to open the canonical library page.
                  </p>
                  <a
                    href={url}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Open in library
                  </a>
                </div>
              ),
            });
          }}
        />
      ),
    });
  }

  // Right-side filter panel slot: render the full toolbar inside it.
  // The search bar is duplicated in the column header for quick access.
  // Hooks must be called unconditionally — keep this above the monster return.
  // Memoize the slot content to avoid the re-render loop that previously
  // produced a noticeable delay between "tap Show filters" and seeing chips.
  const { setFilterPanelOpen } = useGlobalControls();
  const filterPanelContent = useMemo(
    () => (
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
          forceExpandFilters
        />
      </div>
    ),
    [
      toolbarState,
      setToolbarState,
      availableTypes,
      activeSubKinds,
      setActiveSubKinds,
    ],
  );
  useFilterSlot(filterPanelContent);

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
// BlueprintPreviewBody — modal-stack body for blueprint library previews.
// Renders the unified <LibraryItemPreview /> and exposes "Load into build"
// + "Slot into build" + "Open source page" actions.
//
// Slot-into-build is shown for primitives embedded in items (the user can
// drop a primitive they're previewing into the item they're composing).
// -----------------------------------------------------------------------------

function BlueprintPreviewBody({
  item,
  onLoadIntoBuild,
  onSubLinkClick,
}: {
  item: SandboxPreviewItem;
  onLoadIntoBuild: () => void;
  onSubLinkClick?: (link: {
    targetType: "PRIMITIVE" | "CAPABILITY";
    targetId: string;
    label: string;
  }) => void;
}) {
  const showSlotIntoBuild = item.kind === "primitive";

  return (
    <div className="space-y-4">
      <LibraryItemPreview
        item={item}
        {...(onSubLinkClick ? { callbacks: { onSubLinkClick } } : {})}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onLoadIntoBuild}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          title="Create a fork-draft of this entry in your sandbox"
        >
          Load into build
        </button>
        {showSlotIntoBuild ? (
          <button
            type="button"
            onClick={onLoadIntoBuild}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary"
            title="Drop this primitive into the build you're currently composing"
          >
            Slot into build
          </button>
        ) : null}
        <a
          href={`/library/item/${item.kind.toUpperCase()}:${item.row.id}`}
          className="text-xs text-primary hover:underline"
        >
          Open source page →
        </a>
      </div>
    </div>
  );
}