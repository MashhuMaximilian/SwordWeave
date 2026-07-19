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
import { sortLibraryItems } from "@/lib/publishing/sort-library-items";
import { cn } from "@/lib/utils";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import { useModalStack } from "@/components/ui/modal-stack";
import {
  previewHeadingLabel,
  type SandboxCapabilityRow,
  libraryCompositeId,
  type SandboxEffectRow,
  type SandboxItemRow,
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxTemplateRow,
} from "@/components/library/library-item-preview";
import { EntityPreview } from "@/components/preview/entity-preview";
import { useSandboxEngagement } from "@/components/library/use-sandbox-engagement";
import {
  SLOT_EVENT_NAME,
  type SlotEvent,
} from "@/lib/sandbox/slot-events";

// Build modes this library column serves. (Relocated from the now-deleted
// blueprint-sandbox-client — Atelier owns the build surface; the library
// column only needs the mode union for its prop types.)
export type BlueprintBuildMode = "template" | "item" | "monster";

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
  /**
   * Primitive category chips for the "Category" filter row. Only shown
   * when the typeFilter is PRIMITIVE or ALL (handled inside
   * LibraryToolbar). Pass [] to hide the row entirely.
   */
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
  /**
   * Pre-fetched engagement snapshot (same shape as /library/browse).
   * Without it, every card's heart icon starts unfilled and every
   * fork action looks broken. Keyed by `LibraryItem.id`.
   */
  engagement: { reactions: Record<string, "LIKE" | "DISLIKE" | null>; following: Record<string, boolean> };
  /**
   * Current viewer's internal ID. `null` when signed out.
   */
  currentUserInternalId: string | null;
  editingKey: string | null;
  onSelect: (kind: "template" | "item", id: string) => void;
  /** Direct fork handler (Atelier). When set, the preview's Fork button
   *  loads the fork-draft into the build form instead of navigating. */
  onFork?: (targetType: string, targetId: string) => void;
  /** Map of "type:id" → latest published version number. Used to show
   *  version chips in the preview modal header. */
  versionMap?: Record<string, number> | undefined;
}

// Build mode no longer gates which type chips are visible in the toolbar.
// The kind filter is a free choice for the user (per the user's spec
// "we should also be able to view/filter primitives, effects, capabilities
// in the templates tab"). The sub-kind filter was redundant with the kind
// filter — it has been removed.
// Group chips: "All heritages" resolves to every template sub-kind.
const TYPE_GROUPS: Record<string, LibraryTargetType[]> = {
  GROUP_HERITAGES: ["RACE_TEMPLATE", "BACKGROUND_TEMPLATE", "ARCHETYPE_TEMPLATE"],
};

const ALL_AVAILABLE_TYPES: Array<{
  key: LibraryTargetType | "ALL";
  label: string;
}> = [
  { key: "ALL", label: "All" },
  { key: "RACE_TEMPLATE", label: "Lineage" },
  { key: "BACKGROUND_TEMPLATE", label: "Upbringing" },
  { key: "ARCHETYPE_TEMPLATE", label: "Manifest" },
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
  primitiveCategories,
  engagement,
  currentUserInternalId,
  editingKey,
  onSelect,
  onFork,
  versionMap,
}: BlueprintLibraryProps) {
  // Default type filter per build mode. The kind filter is exposed in
  // the toolbar. We pick a sensible default that matches the active
  // build's primary entity type:
  //   - template → "ALL" (shows all template sub-kinds: RACE,
  //     BACKGROUND, ARCHETYPE) so the user sees the full template
  //     corpus and narrows via the chip filter.
  //   - item → "ITEM" (items are the only thing being built here).
  //   - monster → "ALL" (no dedicated MONSTER target type in the
  //     type union yet, so default to all).
  // The user can broaden or narrow via the chip filter.
  const defaultTypeFilter: LibraryTargetType | "ALL" | "GROUP_HERITAGES" =
    build === "template"
      ? "GROUP_HERITAGES"
      : build === "item"
        ? "ITEM"
        : "ALL"; // Monster — fallback

  const availableTypes = ALL_AVAILABLE_TYPES;

  // Toolbar state — owned here, filtered list is derived.
  // View default: LIST. Same rationale as /library — the user said
  // list view is the better default because the 2-column mobile
  // grid is cramped and a list of the corpus reads better on
  // narrow viewports. Desktop users can still toggle to GRID via
  // the toolbar (saved to the same sw_lib_pref cookie as the main
  // /library page, so the choice persists across both pages).
  //
  // Mobile-UA override: if the user is on a phone/tablet, force
  // LIST on first mount and on every window-resize across the
  // breakpoint. The cookie can still say GRID for the desktop
  // session — the override only applies to the active render.
  const [toolbarState, setToolbarState] = useState<LibraryToolbarState>(() => ({
    search: "",
    sort: "ENGAGEMENT",
    view: "LIST",
    typeFilter: defaultTypeFilter,
    category: "",
    author: "",
    minLikes: "",
    hasForks: false,
  }));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const apply = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setToolbarState((s) => (s.view === "GRID" ? { ...s, view: "LIST" } : s));
      }
    };
    apply(mql);
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

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
        if (!row) return null;
        const vn = versionMap?.[`${item.targetType}:${item.targetId}`] ?? 1;
        return {
          kind: "template",
          row: {
            ...row,
            primitiveLinks: row.primitiveLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`primitive:${l.primitiveId}`] ?? 1,
            })),
            capabilityLinks: row.capabilityLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`capability:${l.capabilityId}`] ?? 1,
            })),
          },
          latestVersionNumber: vn,
        };
      }
      if (item.targetType === "ITEM") {
        const row = items.find((i) => i.id === item.targetId);
        if (!row) return null;
        const vn = versionMap?.[`item:${item.targetId}`] ?? 1;
        return {
          kind: "item",
          row: {
            ...row,
            primitiveLinks: row.primitiveLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`primitive:${l.primitiveId}`] ?? 1,
            })),
            effectLinks: row.effectLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`effect:${l.effectId}`] ?? 1,
            })),
            capabilityLinks: row.capabilityLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`capability:${l.capabilityId}`] ?? 1,
            })),
          },
          latestVersionNumber: vn,
        };
      }
      if (item.targetType === "PRIMITIVE") {
        const row = primitives.find((p) => String(p.id) === item.targetId);
        if (!row) return null;
        const vn = versionMap?.[`primitive:${item.targetId}`] ?? 1;
        return { kind: "primitive", row, latestVersionNumber: vn };
      }
      if (item.targetType === "EFFECT") {
        const row = effects?.find((e) => e.id === item.targetId);
        if (!row) return null;
        const vn = versionMap?.[`effect:${item.targetId}`] ?? 1;
        return {
          kind: "effect",
          row: {
            ...row,
            primitiveLinks: row.primitiveLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`primitive:${l.primitiveId}`] ?? 1,
            })),
          },
          latestVersionNumber: vn,
        };
      }
      if (item.targetType === "CAPABILITY") {
        const row = capabilities.find((c) => c.id === item.targetId);
        if (!row) return null;
        const vn = versionMap?.[`capability:${item.targetId}`] ?? 1;
        return {
          kind: "capability",
          row: {
            ...row,
            primitiveLinks: row.primitiveLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`primitive:${l.primitiveId}`] ?? 1,
            })),
            effectLinks: row.effectLinks.map((l) => ({
              ...l,
              versionNumber: versionMap?.[`effect:${l.effectId}`] ?? 1,
            })),
          },
          latestVersionNumber: vn,
        };
      }
      return null;
    };
  }, [templates, items, primitives, capabilities, effects, versionMap]);

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

    // Toolbar type filter. "ALL" = everything. Group keys
    // (GROUP_HERITAGES) match a set of concrete types; otherwise it's a
    // single concrete type.
    if (toolbarState.typeFilter !== "ALL" && items.length > 0) {
      const tf = toolbarState.typeFilter;
      const group = TYPE_GROUPS[tf as keyof typeof TYPE_GROUPS];
      const allowedTf =
        group && group.length ? group : [tf as LibraryTargetType];
      items = items.filter((item) =>
        allowedTf.includes(item.targetType as LibraryTargetType),
      );
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

    return sortLibraryItems(items, toolbarState.sort);
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

  // Phase 7 Q-B UX: form-preview clicks on slotted sub-entities
  // dispatch `sw-sandbox-open-preview`. Translate to pushPreview() so
  // the user gets the same modal affordance as clicking from the
  // library list. Blueprint library owns ITEM and TEMPLATE_* kinds;
  // PRIMITIVE / EFFECT / CAPABILITY also handled here for the
  // blueprint-mode templates that include them.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const e = event as CustomEvent<{
        targetType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM" | "TEMPLATE_RACE" | "TEMPLATE_CLASS" | "TEMPLATE_MONSTER" | "TEMPLATE_ITEM";
        targetId: string;
        label: string;
      }>;
      const detail = e.detail;
      if (!detail) return;
      if (detail.targetType === "PRIMITIVE") {
        const sub = primitives.find((p) => String(p.id) === detail.targetId);
        if (sub) pushPreview({ kind: "primitive", row: sub });
        return;
      }
      if (detail.targetType === "EFFECT") {
        const sub = effects.find((eff) => eff.id === detail.targetId);
        if (sub) pushPreview({ kind: "effect", row: sub });
        return;
      }
      if (detail.targetType === "CAPABILITY") {
        const sub = capabilities.find((c) => c.id === detail.targetId);
        if (sub) pushPreview({ kind: "capability", row: sub });
        return;
      }
      if (detail.targetType === "ITEM") {
        const sub = items.find((it) => it.id === detail.targetId);
        if (sub) pushPreview({ kind: "item", row: sub });
        return;
      }
      // TEMPLATE_RACE / TEMPLATE_CLASS / TEMPLATE_MONSTER / TEMPLATE_ITEM
      // share the kind "template" here. We don't currently dispatch
      // those from form previews — handled by the grammar sandbox path
      // for now (TEMPLATE_<kind> items live there).
    };
    window.addEventListener("sw-sandbox-open-preview", handler);
    return () =>
      window.removeEventListener("sw-sandbox-open-preview", handler);
  }, [primitives, effects, capabilities, items]);

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
          onFork={onFork}
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
            if (link.targetType === "EFFECT") {
              const row = effects.find((e) => e.id === link.targetId);
              if (!row) return;
              pushPreview({ kind: "effect", row });
              return;
            }
            if (link.targetType === "ITEM") {
              const row = items.find((i) => i.id === link.targetId);
              if (!row) return;
              pushPreview({ kind: "item", row });
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
          primitiveCategories={primitiveCategories}
          showSearch={true}
          showAdvancedFilters={true}
          forceExpandFilters
        />
      </div>
    ),
    [toolbarState, setToolbarState, availableTypes, primitiveCategories],
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
        {/* PHASE-8 quick-filter: when in the template tab, surface a
            dedicated Races / Backgrounds / Archetypes chip row directly
            under the search bar. The full type-filter chips already
            exist in the slide-out Filters panel, but the user wanted a
            faster, always-visible inline filter scoped to just the
            template sub-kinds (mirrors the side-panel behaviour, only
            quicker, and only in this tab). */}
        {build === "template" ? (
          <div className="-mx-1 mt-2 flex flex-nowrap gap-1.5 overflow-x-auto px-1">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "GROUP_HERITAGES", label: "All heritages" },
                { key: "RACE_TEMPLATE", label: "Lineage" },
                { key: "BACKGROUND_TEMPLATE", label: "Upbringing" },
                { key: "ARCHETYPE_TEMPLATE", label: "Manifest" },
              ] as Array<{ key: LibraryTargetType | "ALL" | "GROUP_HERITAGES"; label: string }>
            ).map((chip) => {
              const active = toolbarState.typeFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() =>
                    setToolbarState((prev) => ({
                      ...prev,
                      typeFilter: active ? "ALL" : chip.key,
                    }))
                  }
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <LibraryTable
          items={filteredItems}
          view={toolbarState.view}
          engagement={engagement}
          currentUserInternalId={currentUserInternalId}
          onSelect={(item) => {
            const full = lookupRow(item);
            if (full) pushPreview(full);
          }}
          {...(editingKey !== null ? { selectedKey: editingKey } : {})}
          showClearFilters={false}
          emptyTitle="No entries match"
          emptyDescription="The corpus doesn't have anything for this combination. Try a different kind, or check Filters to widen the search."
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
  onFork,
}: {
  item: SandboxPreviewItem;
  libraryItem: LibraryItem | null;
  build: BlueprintBuildMode;
  onLoadIntoBuild: () => void;
  onFork?: ((targetType: string, targetId: string) => void) | undefined;
  onSubLinkClick?: (link: {
    targetType: "PRIMITIVE" | "CAPABILITY" | "EFFECT" | "ITEM";
    targetId: string;
    label: string;
  }) => void;
}) {
  // Pull openDrawer so slot/load actions can pop the build preview
  // drawer after they fire — the user wants to see the result of
  // the action, not have to manually tap the build/preview tab.
  //
  // Split-mode contract: in split mode the build + preview are already
  // rendered inline in the bottom panel. We MUST NOT pop the drawer
  // there (would overlay the inline content). Instead we switch the
  // bottom tab so the user sees the result of the slot/load inline.
  const {
    openDrawer,
    sandboxSplit,
    setSandboxBottomTab,
  } = useGlobalControls();
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
      // 1. Dispatch the slot event so the active form picks it up
      //    (via the `sw-sandbox-slot` window listener).
      // 2. Close the modal-stack entry that holds the preview.
      // 3. Open the BUILD drawer tab (not preview) so the user can
      //    watch the slot land in the form they were composing. The
      //    preview tab is populated by the form as a side-effect of
      //    the slot, so it'll be live the moment they switch tabs.
      //    (Previous behaviour opened `preview` — which is the
      //    entity preview, not the form preview — and the user
      //    saw an empty panel and assumed nothing happened.)
      window.dispatchEvent(
        new CustomEvent<SlotEvent>(SLOT_EVENT_NAME, { detail: event }),
      );
      window.dispatchEvent(new CustomEvent("sw-sandbox-close-preview"));
      // Open the BUILD drawer tab — not preview — so the user can
      //    watch the slot land in the form they were composing. The
      //    preview tab is populated by the form as a side-effect of
      //    the slot, so it'll be live the moment they switch tabs.
      //    (Previous behaviour opened `preview` — which is the
      //    entity preview, not the form preview — and the user
      //    saw an empty panel and assumed nothing happened.)
      //
      // Split-mode contract: in split mode the build tab is already
      // rendered inline in the bottom panel — do NOT pop the drawer
      // (it would overlay the inline content). Just switch the bottom
      // tab to "build" so the user sees the slot landing.
      if (sandboxSplit) {
        setSandboxBottomTab("build");
      } else {
        openDrawer("build");
      }
    }
  }

  function loadAndPreview() {
    // The parent's onLoadIntoBuild() (a) closes the modal-stack and
    // (b) switches the sandbox to the loaded entity's mode via
    // applyPendingAction. The build form is then mounted in the
    // drawer's `build` tab. Opening `preview` would show the
    // entity-preview panel (which is populated by the form's live
    // snapshot, not by a fresh fetch) — when the form is in the
    // drawer and the drawer hasn't fully settled, that panel
    // renders empty for one frame. Opening `build` instead lands
    // the user directly on the form they just loaded, which is
    // always populated. The preview tab is still one tap away.
    //
    // Split-mode contract: switch the bottom tab to "preview" so
    // the user immediately sees the loaded entity's live preview
    // (populated by the form on load). The drawer is NOT opened.
    onLoadIntoBuild();
    if (sandboxSplit) {
      setSandboxBottomTab("preview");
    } else {
      openDrawer("build");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <EntityPreview
          item={item}
          variant="read"
          {...(onSubLinkClick || engagement
            ? {
                callbacks: {
                  ...(onSubLinkClick ? { onSubLinkClick } : {}),
                  ...(engagement ? { engagement } : {}),
                  // Bug fix: previously `item.kind.toUpperCase()` produced
                  // `TEMPLATE` for template rows, but the library route
                  // expects the full enum (`RACE_TEMPLATE` etc.). Use the
                  // shared helper so this can't drift again.
                  openSourceHref: `/library/item/${libraryCompositeId(item)}`,
                  sandboxPath: "/atelier",
                  onFork,
                },
              }
            : {
                callbacks: {
                  openSourceHref: `/library/item/${libraryCompositeId(item)}`,
                  sandboxPath: "/atelier",
                  onFork,
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
          onClick={loadAndPreview}
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