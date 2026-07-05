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

import { useMemo, useState } from "react";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { LibraryTable } from "@/components/library/library-table";
import type { LibraryItem, LibraryTargetType } from "@/lib/publishing/library-query";
import {
  SandboxPreviewModal,
  type SandboxItemRow,
  type SandboxPreviewItem,
  type SandboxTemplateRow,
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
  const [selectedItem, setSelectedItem] = useState<SandboxPreviewItem | null>(
    null,
  );
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

  // Filter items by active sub-kinds when in template mode.
  const filteredItems = useMemo(() => {
    if (build !== "template") return libraryItems;
    if (activeSubKinds.length === 0) return [];
    return libraryItems.filter((item) => {
      if (
        item.targetType === "RACE_TEMPLATE" ||
        item.targetType === "BACKGROUND_TEMPLATE" ||
        item.targetType === "ARCHETYPE_TEMPLATE"
      ) {
        const kind = item.category; // category is set to the template kind
        return kind !== null && activeSubKinds.includes(kind);
      }
      return false; // Only show templates in template mode
    });
  }, [build, libraryItems, activeSubKinds]);

  function handleRowSelect(item: LibraryItem) {
    const full = lookupRow(item);
    if (full) setSelectedItem(full);
  }

  function handleLoadIntoBuild() {
    if (!selectedItem) return;
    if (selectedItem.kind === "template") {
      onSelect("template", selectedItem.row.id);
    } else {
      onSelect("item", String(selectedItem.row.id));
    }
    setSelectedItem(null);
  }

  // Monster mode: render an empty state — no composer yet.
  if (build === "monster") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border p-3">
          <LibraryToolbar
            state={{
              search: "",
              sort: "ENGAGEMENT",
              view: "GRID",
              typeFilter: "ALL",
              category: "",
              author: "",
              minLikes: "",
              hasForks: false,
            }}
            onStateChange={() => {}}
            availableTypes={[]}
            showSearch={false}
            showAdvancedFilters={false}
          />
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
      <div className="border-b border-border p-3">
        <LibraryToolbar
          state={{
            search: "",
            sort: "ENGAGEMENT",
            view: "GRID",
            typeFilter: defaultTypeFilter,
            category: "",
            author: "",
            minLikes: "",
            hasForks: false,
          }}
          onStateChange={() => {
            // Visual-only in the sandbox left column.
          }}
          availableTypes={availableTypes}
          subKindParent="RACE_TEMPLATE"
          subKinds={SUB_KIND_CHIPS}
          activeSubKinds={activeSubKinds}
          onSubKindsChange={setActiveSubKinds}
          showSearch={false}
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
          emptyTitle="No entries match"
          emptyDescription="Adjust your sub-kind selection or switch to another build mode."
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