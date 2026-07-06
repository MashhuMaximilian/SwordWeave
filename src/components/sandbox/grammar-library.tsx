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
import type {
  SandboxPreviewItem,
  SandboxPrimitiveRow,
  SandboxEffectRow,
  SandboxCapabilityRow,
} from "@/components/sandbox/sandbox-preview-modal";
import type { GrammarBuildMode } from "./grammar-sandbox-client";

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
      return true;
    });
  }, [libraryItems, availableTypes, toolbarState]);

  // Right-side filter panel slot: render the full toolbar inside it.
  // The search bar is duplicated in the column header for quick access.
  const { setFilterPanelOpen } = useGlobalControls();
  useFilterSlot(
    <div className="space-y-3">
      <LibraryToolbar
        state={toolbarState}
        onStateChange={setToolbarState}
        availableTypes={availableTypes}
        showSearch={true}
        showAdvancedFilters={true}
        forceExpandFilters
      />
    </div>,
  );

  const hasActiveFilters =
    toolbarState.typeFilter !== "ALL" ||
    toolbarState.category !== "" ||
    toolbarState.author !== "" ||
    toolbarState.minLikes !== "" ||
    toolbarState.hasForks ||
    toolbarState.sort !== "ENGAGEMENT";

  // Card click → push to modal stack. The "Load into build" action still
  // calls the parent's onSelect; we pop the stack afterwards.
  const stack = useModalStack();
  function pushPreview(item: SandboxPreviewItem) {
    if (!stack.canPush) return;
    const kindLabel = item.kind;
    stack.push({
      key: `${item.kind}:${item.kind === "primitive" ? item.row.id : item.row.id}`,
      label: item.kind === "primitive" ? item.row.name : item.row.name,
      category: kindLabel,
      content: (
        <SandboxPreviewBody
          item={item}
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
// SandboxPreviewBody — wrapper around SandboxPreviewModal content that adapts
// the imperative onClose to the modal stack's pop() and renders inside the
// stack rather than a standalone modal.
// -----------------------------------------------------------------------------

function SandboxPreviewBody({
  item,
  onLoadIntoBuild,
}: {
  item: SandboxPreviewItem;
  onLoadIntoBuild: () => void;
}) {
  // We reuse the visual layout of SandboxPreviewModal but as a body-only
  // fragment. The modal chrome (header, close, breadcrumbs) is provided by
  // the ModalStackRenderer.
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
        <PreviewItemFields item={item} />
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
          href={`/library/${item.kind === "primitive" ? "primitive" : item.kind}/${item.kind === "primitive" ? item.row.id : item.row.id}`}
          className="text-xs text-primary hover:underline"
        >
          Open source page →
        </a>
      </div>
    </div>
  );
}

function PreviewItemFields({ item }: { item: SandboxPreviewItem }) {
  if (item.kind === "template" || item.kind === "item") {
    return (
      <p className="text-sm text-muted-foreground">
        Template / item previews render in the Blueprint library modal.
      </p>
    );
  }
  if (item.kind === "primitive") {
    const r = item.row;
    return (
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Category</dt>
          <dd>{r.category}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">BU Cost</dt>
          <dd>{r.buCost}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Cost Tier</dt>
          <dd>{r.costTier}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Public</dt>
          <dd>{r.isPublic ? "Yes" : "No"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Mechanical Output</dt>
          <dd className="whitespace-pre-wrap">{r.mechanicalOutputText}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Narrative Rule</dt>
          <dd className="whitespace-pre-wrap">{r.narrativeRule}</dd>
        </div>
        {r.isMirrorable ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">Mirror</dt>
            <dd>
              {r.mirrorVector} ({r.mirrorBuCredit} BU)
              {r.mirrorEligibilityNotes ? ` — ${r.mirrorEligibilityNotes}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
    );
  }
  if (item.kind === "effect") {
    const r = item.row;
    return (
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Narrative</dt>
          <dd className="whitespace-pre-wrap">{r.narrativeDescription}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Public</dt>
          <dd>{r.isPublic ? "Yes" : "No"}</dd>
        </div>
        {r.sourceOrigin ? (
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Source</dt>
            <dd>{r.sourceOrigin}</dd>
          </div>
        ) : null}
        {r.tags.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              {r.tags.map((t: string) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium"
                >
                  {t}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">
            Primitive Links
          </dt>
          <dd>
            <ul className="space-y-1">
              {r.primitiveLinks.map((pl) => (
                <li key={pl.primitiveId} className="text-xs">
                  ×{pl.quantity} {pl.primitive.name} ({pl.primitive.buCost} BU)
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    );
  }
  // capability
  if (item.kind === "capability") {
    const r = item.row;
    return (
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Type</dt>
          <dd>{r.type}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Public</dt>
          <dd>{r.isPublic ? "Yes" : "No"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">Description</dt>
          <dd className="whitespace-pre-wrap">{r.verboseDescription}</dd>
        </div>
        {r.tags.length > 0 ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-muted-foreground">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              {r.tags.map((t: string) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium"
                >
                  {t}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase text-muted-foreground">
            Primitive Links
          </dt>
          <dd>
            <ul className="space-y-1">
              {r.primitiveLinks.map((pl) => (
                <li key={pl.primitiveId} className="text-xs">
                  {pl.role} ×{pl.quantity} {pl.primitive.name} ({pl.primitive.buCost} BU)
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    );
  }
  return null;
}