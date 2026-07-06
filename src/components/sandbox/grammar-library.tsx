"use client";

// Grammar Library column.
//
// Renders the shared <LibraryTable /> with the grammar route's entities.
// The build mode gates which type-filter chips are visible (so when in
// Primitive mode, only the Primitives chip is available — Effects and
// Capabilities can't be selected because they don't make sense as inputs).
//
// All filtering, sorting, and view-mode (grid/list) is owned by the
// LibraryToolbar. This component just wires up the available-types list
// and renders the row-click modal with full entity content.
//
// Pristine mode: clicks swap silently via the parent's onSelect.
// Dirty mode: parent's guardedLibrarySelect opens the unsaved modal.

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
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxEffectRow,
  type SandboxCapabilityRow,
} from "@/components/library/library-item-preview";
import { useSandboxEngagement } from "@/components/library/use-sandbox-engagement";
import type { GrammarBuildMode } from "./grammar-sandbox-client";
import {
  SLOT_EVENT_NAME,
  type SlotEvent,
} from "@/lib/sandbox/slot-events";

interface GrammarLibraryProps {
  build: GrammarBuildMode;
  libraryItems: LibraryItem[];
  /**
   * Full typed rows used to render the modal preview. Kept here so the
   * modal can show all fields (mirror data, slots, etc.) — LibraryItem
   * only carries the subset queryLibrary exposes.
   */
  primitives: SandboxPrimitiveRow[];
  effects: SandboxEffectRow[];
  capabilities: SandboxCapabilityRow[];
  editingKey: string | null;
  onSelect: (
    kind: "primitive" | "effect" | "capability",
    id: string | number,
  ) => void;
}

// Chip set per build mode:
// - Primitive: only Primitives
// - Effect: Primitives + Effects (so the user can see both, and copy a
//   primitive to slot into the effect)
// - Capability: all three (capability can slot primitives + effects)
const AVAILABLE_TYPES_BY_BUILD: Record<
  GrammarBuildMode,
  Array<{ key: LibraryTargetType | "ALL"; label: string }>
> = {
  primitive: [
    { key: "PRIMITIVE", label: "Primitives" },
  ],
  effect: [
    { key: "EFFECT", label: "Effects" },
    { key: "PRIMITIVE", label: "Primitives" },
  ],
  capability: [
    { key: "CAPABILITY", label: "Capabilities" },
    { key: "EFFECT", label: "Effects" },
    { key: "PRIMITIVE", label: "Primitives" },
  ],
};

export function GrammarLibrary({
  build,
  libraryItems,
  primitives,
  effects,
  capabilities,
  editingKey,
  onSelect,
}: GrammarLibraryProps) {
  // Default type filter per build mode.
  const defaultTypeFilter: LibraryTargetType =
    build === "primitive"
      ? "PRIMITIVE"
      : build === "effect"
        ? "EFFECT"
        : "CAPABILITY";

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
  // and clear other filters so the user sees the right subset immediately.
  // (Fix for "filters don't auto-apply when switching tabs".)
  useEffect(() => {
    setToolbarState((prev) => ({
      ...prev,
      typeFilter: defaultTypeFilter,
      category: "",
      subKinds: [],
    }));
  }, [build, defaultTypeFilter]);

  // Find the full typed row for a LibraryItem (used by the modal).
  const lookupRow = useMemo(() => {
    return (item: LibraryItem): SandboxPreviewItem | null => {
      if (item.targetType === "PRIMITIVE") {
        const id = Number(item.targetId);
        const row = primitives.find((p) => p.id === id);
        return row ? { kind: "primitive", row } : null;
      }
      if (item.targetType === "EFFECT") {
        const row = effects.find((e) => e.id === item.targetId);
        return row ? { kind: "effect", row } : null;
      }
      if (item.targetType === "CAPABILITY") {
        const row = capabilities.find((c) => c.id === item.targetId);
        return row ? { kind: "capability", row } : null;
      }
      return null;
    };
  }, [primitives, effects, capabilities]);

  // Apply toolbar filters to libraryItems. Sandbox Library is gated by
  // build-mode (only the typeFilter values listed in `availableTypes`
  // survive), but within that subset the user can still search, sort, etc.
  //
  // The toolbar's state shape supports category/author/minLikes/hasForks
  // advanced filters; the previous version of this component only applied
  // search + typeFilter, so chip state for those advanced filters looked
  // "live" (the chips were clickable) but the result set never updated.
  // We now apply every toolbar state field that the result set can
  // meaningfully filter on.
  const filteredItems = useMemo(() => {
    return libraryItems.filter((item) => {
      // Only show items of the types available in this build mode.
      const allowedKeys = availableTypes.map((t) => t.key);
      if (!allowedKeys.includes(item.targetType) && !allowedKeys.includes("ALL")) {
        return false;
      }
      // Apply toolbar text search.
      if (toolbarState.search) {
        const q = toolbarState.search.toLowerCase();
        if (!item.name.toLowerCase().includes(q)) return false;
      }
      // Apply type filter (ALL = all available).
      if (
        toolbarState.typeFilter !== "ALL" &&
        item.targetType !== toolbarState.typeFilter
      ) {
        return false;
      }
      // Apply category filter (primitives only — LibraryItem.category
      // is only set for primitive rows).
      if (
        toolbarState.category &&
        item.targetType === "PRIMITIVE" &&
        item.category !== toolbarState.category
      ) {
        return false;
      }
      // Author username — LibraryItem exposes authorUsername.
      if (
        toolbarState.author &&
        (!item.authorUsername ||
          !item.authorUsername
            .toLowerCase()
            .includes(toolbarState.author.toLowerCase()))
      ) {
        return false;
      }
      // minLikes / minForks — LibraryItem doesn't carry counts in the
      // browse payload, so these are best-effort: if the field is present
      // (populated by a future query), honour it; otherwise pass through.
      if (toolbarState.minLikes) {
        const min = Number(toolbarState.minLikes);
        if (!Number.isNaN(min) && (item.likesCount ?? 0) < min) return false;
      }
      if (toolbarState.minForks) {
        const min = Number(toolbarState.minForks);
        if (!Number.isNaN(min) && (item.forkCount ?? 0) < min) return false;
      }
      if (toolbarState.minBu) {
        const min = Number(toolbarState.minBu);
        if (!Number.isNaN(min) && (item.buCost ?? 0) < min) return false;
      }
      if (toolbarState.maxBu) {
        const max = Number(toolbarState.maxBu);
        if (!Number.isNaN(max) && (item.buCost ?? 0) > max) return false;
      }
      // hasForks — same caveat as minLikes.
      if (toolbarState.hasForks && (item.forkCount ?? 0) < 1) return false;
      // Tags — comma-separated. Match any.
      if (toolbarState.tags) {
        const wanted = toolbarState.tags
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (wanted.length > 0) {
          const itemTags = (item.tags ?? []).map((t) => t.toLowerCase());
          if (!wanted.some((t) => itemTags.includes(t))) return false;
        }
      }
      return true;
    });
  }, [libraryItems, availableTypes, toolbarState]);

  // Right-side filter panel slot: render the full toolbar inside it.
  // The search bar is duplicated in the column header for quick access.
  // Memoize the slot content — the previous inline-JSX pattern caused the
  // panel slot to re-render on every parent render, producing a noticeable
  // delay between "tap Show filters" and seeing the chips.
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
    toolbarState.category !== "" ||
    toolbarState.author !== "" ||
    toolbarState.minLikes !== "" ||
    toolbarState.hasForks ||
    toolbarState.sort !== "ENGAGEMENT";

  // Card click → push to modal stack. The "Load into build" action still
  // calls the parent's onSelect; we pop the stack afterwards.
  // Sub-entity clicks inside the preview push a nested entry so navigation
  // stays inside the open modal (no full page navigation, no broken
  // breadcrumb state).
  const stack = useModalStack();
  // Close-on-slot: when the user clicks "Slot into build" in the preview
  // body, the preview fires `sw-sandbox-close-preview` so the modal stack
  // pops and the slot is visible in the build column.
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
    // Resolve to the LibraryItem so the modal can show engagement counts
    // and the user's existing reaction (engagement snapshot). The full
    // SandboxPreviewItem (with primitive slot data, etc.) is also kept
    // for the body content.
    const libraryItem = libraryItems.find(
      (li) => li.targetId === String(item.row.id),
    );
    stack.push({
      key: `${item.kind}:${item.row.id}`,
      label: item.row.name,
      category: previewHeadingLabel(item),
      content: (
        <SandboxPreviewBody
          item={item}
          libraryItem={libraryItem ?? null}
          build={build}
          onLoadIntoBuild={() => {
            if (item.kind === "primitive") {
              onSelect("primitive", item.row.id);
            } else if (item.kind === "effect") {
              onSelect("effect", item.row.id);
            } else {
              onSelect("capability", item.row.id);
            }
            stack.clear();
          }}
          onSubLinkClick={(link) => {
            // Look up the full row and push it onto the stack.
            const sub =
              link.targetType === "PRIMITIVE"
                ? primitives.find((p) => String(p.id) === link.targetId)
                : null;
            if (!sub) return;
            pushPreview({ kind: "primitive", row: sub });
          }}
        />
      ),
    });
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
          emptyTitle="No grammar entries yet"
          emptyDescription="Build primitives, effects, and capabilities to see them here."
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SandboxPreviewBody — modal-stack body for grammar library previews. Renders
// the unified <LibraryItemPreview /> and exposes "Load into build" + "Slot into
// build" + "Open source page" actions.
//
// "Load into build" = create a fork-draft for editing in the current build
// mode. The user must save + publish to make it visible to others.
// "Slot into build" = drop the primitive into a template / effect /
// capability the user is already composing. Only available for primitives
// when the build mode is effect or capability (where primitives can be
// nested).
// -----------------------------------------------------------------------------

function SandboxPreviewBody({
  item,
  libraryItem,
  build,
  onLoadIntoBuild,
  onSubLinkClick,
}: {
  item: SandboxPreviewItem;
  libraryItem: LibraryItem | null;
  build: GrammarBuildMode;
  onLoadIntoBuild: () => void;
  onSubLinkClick?: (link: {
    targetType: "PRIMITIVE" | "CAPABILITY";
    targetId: string;
    label: string;
  }) => void;
}) {
  // "Slot into build" is only valid for kinds the current build mode
  // can accept. Per the user's spec:
  //   - Primitive mode:  nothing can be slotted (you're authoring a new
  //     primitive from scratch).
  //   - Effect mode:     accepts primitives only.
  //   - Capability mode: accepts primitives + effects.
  const slottableKinds: Array<"primitive" | "effect"> =
    build === "capability"
      ? ["primitive", "effect"]
      : build === "effect"
        ? ["primitive"]
        : [];

  const canSlot =
    slottableKinds.length > 0 &&
    ((item.kind === "primitive" && slottableKinds.includes("primitive")) ||
      (item.kind === "effect" && slottableKinds.includes("effect")));

  // Engagement snapshot for the LikeForkBar + version-history link. The
  // hook fetches the user's existing reaction (so the bar shows the right
  // active state) on first open. Counts + author info come from the
  // LibraryItem we passed in.
  const { engagement } = useSandboxEngagement(libraryItem);

  function slotIntoBuild() {
    if (item.kind !== "primitive" && item.kind !== "effect") return;
    const event: SlotEvent = {
      kind: item.kind,
      id: item.row.id,
      label: item.row.name,
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<SlotEvent>(SLOT_EVENT_NAME, { detail: event }),
      );
      // Notify the parent to close the preview modal-stack so the user
      // sees the slot land in the build column. The event dispatch
      // already triggered the active form's listener, so the slot
      // exists by the time the modal closes.
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