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
import type { LibraryItem, LibraryTargetType } from "@/lib/publishing/library-query";
import {
  SandboxPreviewModal,
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxEffectRow,
  type SandboxCapabilityRow,
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
  const [selectedItem, setSelectedItem] = useState<SandboxPreviewItem | null>(
    null,
  );

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

  function handleRowSelect(item: LibraryItem) {
    const full = lookupRow(item);
    if (full) setSelectedItem(full);
  }

  function handleLoadIntoBuild() {
    if (!selectedItem) return;
    if (selectedItem.kind === "primitive") {
      onSelect("primitive", selectedItem.row.id);
    } else if (selectedItem.kind === "effect") {
      onSelect("effect", selectedItem.row.id);
    } else {
      onSelect("capability", selectedItem.row.id);
    }
    setSelectedItem(null);
  }

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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <LibraryToolbar
          state={toolbarState}
          onStateChange={setToolbarState}
          availableTypes={availableTypes}
          showSearch={true}
          showAdvancedFilters={false}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <LibraryTable
          items={filteredItems}
          view="GRID"
          engagement={{ reactions: {}, following: {} }}
          currentUserInternalId={null}
          onSelect={handleRowSelect}
          {...(editingKey !== null ? { selectedKey: editingKey } : {})}
          showClearFilters={false}
          emptyTitle="No grammar entries yet"
          emptyDescription="Build primitives, effects, and capabilities to see them here."
        />
      </div>

      <SandboxPreviewModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onPrimaryAction={handleLoadIntoBuild}
      />
    </div>
  );
}