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
  type SandboxCapabilityRow,
  type SandboxEffectRow,
  type SandboxItemRow,
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxTemplateRow,
} from "@/components/library/library-item-preview";
import { useSandboxEngagement } from "@/components/library/use-sandbox-engagement";
import type { BlueprintBuildMode } from "./blueprint-sandbox-client";
import {
  SLOT_EVENT_NAME,
  type SlotEvent,
} from "@/lib/sandbox/slot-events";

interface BlueprintLibraryProps {
  build: BlueprintBuildMode;
  libraryItems: LibraryItem[];
  templates: SandboxTemplateRow[];
  items: SandboxItemRow[];
  /** Primitives the blueprint library can preview when a sub-link to a
   *  primitive is clicked inside a template/item body. The grammar
   *  library has the same data — passing it here lets the blueprint
   *  sandbox open the full primitive preview (same modal as grammar). */
  primitives?: SandboxPrimitiveRow[];
  /** Capabilities the blueprint library can preview for sub-link
   *  resolution inside item bodies. */
  capabilities?: SandboxCapabilityRow[];
  /** Effects rows for previewing effect-kind LibraryItems in the library. */
  effects?: SandboxEffectRow[];
  editingKey: string | null;
  onSelect: (kind: "template" | "item", id: string) => void;
}

// Build mode no longer gates which type chips are visible in the toolbar.
// The kind filter is a free choice for the user (per the user's spec
// "we should also be able to view/filter primitives, effects, capabilities
// in the templates tab"). The sub-kind filter was redundant with the kind
// filter — it has been removed.
const ALL_AVAILABLE_TYPES: Array<{
  key: LibraryTargetType | "ALL";
  label: string;
}> = [
  { key: "ALL", label: "All" },
  { key: "RACE_TEMPLATE", label: "Races" },
  { key: "BACKGROUND_TEMPLATE", label: "Backgrounds" },
  { key: "ARCHETYPE_TEMPLATE", label: "Archetypes" },
  { key: "ITEM", label: "Items" },
  { key: "PRIMITIVE", label: "Primitives" },
  { key: "EFFECT", label: "Effects" },
  { key: "CAPABILITY", label: "Capabilities" },
];

export function BlueprintLibrary({
  build,
  libraryItems,
  templates,
  items,
  primitives = [],
  capabilities = [],
  effects = [],
  editingKey,
  onSelect,
}: BlueprintLibraryProps) {
  // Default type filter per build mode. The kind filter is exposed in
  // the toolbar; the default is "ALL" so the user always sees every
  // entry in the corpus, regardless of the current build sub-kind.
  // The previous per-sub-kind default (RACE_TEMPLATE for template
  // mode) triggered a confusing "No entries match" empty state when
  // the user was creating a Race but the corpus only had Background
  // or Archetype templates — or no templates at all yet. "ALL" puts
  // the user in control of narrowing via the chip filter.
  const defaultTypeFilter: LibraryTargetType | "ALL" = "ALL";

  const availableTypes = ALL_AVAILABLE_TYPES;

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
  // so the user sees the right subset immediately. (Fix for "filters
  // don't auto-apply when switching tabs".)
  useEffect(() => {
    setToolbarState((prev) => ({
      ...prev,
      typeFilter: defaultTypeFilter,
      category: "",
    }));
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
      if (item.targetType === "PRIMITIVE") {
        const row = primitives.find((p) => String(p.id) === item.targetId);
        return row ? { kind: "primitive", row } : null;
      }
      if (item.targetType === "EFFECT") {
        const row = effects?.find((e) => e.id === item.targetId);
        return row ? { kind: "effect", row } : null;
      }
      if (item.targetType === "CAPABILITY") {
        const row = capabilities.find((c) => c.id === item.targetId);
        return row ? { kind: "capability", row } : null;
      }
      return null;
    };
  }, [templates, items, primitives, capabilities, effects]);

  // Filter items by toolbar search/typeFilter. The build-mode gate is
  // removed — the user can see any kind in the blueprint library per the
  // user's spec.
  const filteredItems = useMemo(() => {
    let items = libraryItems;

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
  }, [build, libraryItems, toolbarState]);

  // Card click → push to modal stack. The "Load into build" action still
  // calls the parent's onSelect; we pop the stack afterwards. Sub-entity
  // clicks inside the preview push a nested entry so navigation stays
  // inside the open modal.
  const stack = useModalStack();
  // Close-on-slot: dispatch fires `sw-sandbox-close-preview` after the
  // slot event so we pop the stack and the user sees the slot land.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (stack.depth > 0) stack.pop();
    };
    window.addEventListener("sw-sandbox-close-preview", handler);
    return () => window.removeEventListener("sw-sandbox-close-preview", handler);
  }, [stack]);
  function pushPreview(item: SandboxPreviewItem) {
    if (!stack.canPush) return;
    const libraryItem = libraryItems.find(
      (li) => li.targetId === String(item.row.id),
    );
    stack.push({
      key: `${item.kind}:${item.row.id}`,
      label: item.row.name,
      category: previewHeadingLabel(item),
      content: (
        <BlueprintPreviewBody
          item={item}
          libraryItem={libraryItem ?? null}
          build={build}
          onLoadIntoBuild={() => {
            if (item.kind === "template") {
              onSelect("template", item.row.id);
            } else {
              onSelect("item", String(item.row.id));
            }
            stack.clear();
          }}
          onSubLinkClick={(link) => {
            // Resolve the sub-entity to its full row and push a real
            // preview onto the modal stack. Same UX as the grammar
            // sandbox's onSubLinkClick — primitives, effects, and
            // capabilities are all previewable here.
            if (link.targetType === "PRIMITIVE") {
              const id = Number(link.targetId);
              const row = primitives.find((p) => p.id === id);
              if (!row) return;
              pushPreview({ kind: "primitive", row });
              return;
            }
            if (link.targetType === "CAPABILITY") {
              const row = capabilities.find((c) => c.id === link.targetId);
              if (!row) return;
              pushPreview({ kind: "capability", row });
              return;
            }
            // Fallback for unhandled types: open the canonical page.
            const url = `/library/item/${link.targetType}:${link.targetId}`;
            stack.push({
              key: `sublink:${link.targetType}:${link.targetId}`,
              label: link.label,
              category: link.targetType,
              content: (
                <div className="space-y-3 p-1">
                  <p className="text-sm text-muted-foreground">
                    Sub-entity preview not yet supported for this kind in
                    the blueprint sandbox. Tap below to open the canonical
                    library page.
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
          showSearch={true}
          showAdvancedFilters={true}
          forceExpandFilters
        />
      </div>
    ),
    [toolbarState, setToolbarState, availableTypes],
  );
  useFilterSlot(filterPanelContent);

  const hasActiveFilters =
    toolbarState.typeFilter !== "ALL" ||
    toolbarState.typeFilter !== defaultTypeFilter ||
    toolbarState.category !== "" ||
    toolbarState.author !== "" ||
    toolbarState.minLikes !== "" ||
    toolbarState.hasForks ||
    toolbarState.sort !== "ENGAGEMENT";

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
  libraryItem,
  build,
  onLoadIntoBuild,
  onSubLinkClick,
}: {
  item: SandboxPreviewItem;
  libraryItem: LibraryItem | null;
  build: BlueprintBuildMode;
  onLoadIntoBuild: () => void;
  onSubLinkClick?: (link: {
    targetType: "PRIMITIVE" | "CAPABILITY";
    targetId: string;
    label: string;
  }) => void;
}) {
  // Per the user's slot spec, every template (template / item / monster)
  // accepts primitives + effects + capabilities. Only kind==="primitive"
  // gets the "Slot into build" affordance in the BlueprintPreviewBody
  // because the Blueprint Library only shows items + templates (effects
  // + capabilities are surfaced from the Grammar Library).
  const slottableKinds: Array<"primitive" | "effect" | "capability"> = [
    "primitive",
    "effect",
    "capability",
  ];
  const canSlot =
    slottableKinds.length > 0 &&
    (slottableKinds as string[]).includes(item.kind);

  const { engagement } = useSandboxEngagement(libraryItem);

  function slotIntoBuild() {
    if (item.kind !== "primitive" && item.kind !== "effect" && item.kind !== "capability") return;
    const event: SlotEvent = {
      kind: item.kind,
      id: item.row.id,
      label: item.row.name,
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<SlotEvent>(SLOT_EVENT_NAME, { detail: event }),
      );
      window.dispatchEvent(new CustomEvent("sw-sandbox-close-preview"));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <LibraryItemPreview
          item={item}
          {...(onSubLinkClick || engagement
            ? {
                callbacks: {
                  ...(onSubLinkClick ? { onSubLinkClick } : {}),
                  ...(engagement ? { engagement } : {}),
                  openSourceHref: `/library/item/${item.kind.toUpperCase()}:${item.row.id}`,
                },
              }
            : {
                callbacks: {
                  openSourceHref: `/library/item/${item.kind.toUpperCase()}:${item.row.id}`,
                },
              })}
        />
        {/* The LibraryItemPreview's PreviewFooter now renders the
            "Open source page" + "Version history" links on the same row
            at the bottom of the scrollable area per the user's spec. */}
      </div>
      <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-3 py-3 shadow-[0_-2px_6px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={onLoadIntoBuild}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          title="Create a fork-draft of this entry in your sandbox"
        >
          Load into build
        </button>
        {canSlot ? (
          <button
            type="button"
            onClick={slotIntoBuild}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary"
            title={`Drop this ${item.kind} into the ${build} you're currently composing`}
          >
            Slot into build
          </button>
        ) : null}
      </div>
    </div>
  );
}