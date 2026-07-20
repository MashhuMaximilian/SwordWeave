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
import { useRouter } from "next/navigation";
import { LibraryToolbar, type LibraryToolbarState } from "@/components/library/library-toolbar";
import { LibraryTable } from "@/components/library/library-table";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import {
  authorDisplayName,
  authorDisplayUsername,
} from "@/lib/publishing/author-display";
import type { LibraryItem, LibraryTargetType } from "@/lib/publishing/library-query";
import { sortLibraryItems } from "@/lib/publishing/sort-library-items";
import { cn } from "@/lib/utils";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import { useModalStack } from "@/components/ui/modal-stack";
import {
  previewHeadingLabel,
  libraryCompositeId,
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxEffectRow,
  type SandboxCapabilityRow,
  type SandboxTemplateRow,
  type SandboxItemRow,
  type PreviewSubLink,
} from "@/components/library/library-item-preview";
import { EntityPreview, type PreviewActionProps, type EntityPreviewOwner } from "@/components/preview/entity-preview";
import { type Visibility } from "@/components/library/visibility-select";
import { useSandboxEngagement } from "@/components/library/use-sandbox-engagement";
import {
  SLOT_EVENT_NAME,
  type SlotEvent,
} from "@/lib/sandbox/slot-events";

// Build modes this library column serves. (Relocated from the now-deleted
// blueprint-sandbox-client — Atelier owns the build surface; the library
// column only needs the mode union for its prop types.)
export type HeritageBuildMode = "heritage" | "item" | "monster";

interface HeritageLibraryProps {
  build: HeritageBuildMode;
  libraryItems: LibraryItem[];
  heritage: SandboxTemplateRow[];
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
  /** Current user's resolved profile — creator fallback for fork previews. */
  currentUser: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  editingKey: string | null;
  onSelect: (kind: "heritage" | "item", id: string) => void;
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
// in the heritage tab"). The sub-kind filter was redundant with the kind
// filter — it has been removed.
// Group chips: "All heritages" resolves to every template sub-kind.
const TYPE_GROUPS: Record<string, LibraryTargetType[]> = {
  GROUP_HERITAGES: ["LINEAGE_TEMPLATE", "UPBRINGING_TEMPLATE", "MANIFEST_TEMPLATE"],
};

const ALL_AVAILABLE_TYPES: Array<{
  key: LibraryTargetType | "ALL";
  label: string;
}> = [
  { key: "ALL", label: "All" },
  { key: "LINEAGE_TEMPLATE", label: "Lineage" },
  { key: "UPBRINGING_TEMPLATE", label: "Upbringing" },
  { key: "MANIFEST_TEMPLATE", label: "Manifest" },
  { key: "ITEM", label: "Items" },
  { key: "PRIMITIVE", label: "Primitives" },
  { key: "EFFECT", label: "Effects" },
  { key: "CAPABILITY", label: "Capabilities" },
];

export function HeritageLibrary({
  build,
  libraryItems,
  heritage,
  items,
  primitives = [],
  capabilities = [],
  effects = [],
  primitiveCategories,
  engagement,
  currentUserInternalId,
  currentUser,
  editingKey,
  onSelect,
  onFork,
  versionMap,
}: HeritageLibraryProps) {
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
    build === "heritage"
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
        item.targetType === "LINEAGE_TEMPLATE" ||
        item.targetType === "UPBRINGING_TEMPLATE" ||
        item.targetType === "MANIFEST_TEMPLATE"
      ) {
        const row = heritage.find((t) => t.id === item.targetId);
        if (!row) return null;
        const vn = versionMap?.[`${item.targetType}:${item.targetId}`] ?? 1;
        return {
          kind: "heritage",
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
  }, [heritage, items, primitives, capabilities, effects, versionMap]);

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
  // blueprint-mode heritage that include them.
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
      // share the kind "heritage" here. We don't currently dispatch
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
            if (item.kind === "heritage") {
              onSelect("heritage", item.row.id);
            } else {
              onSelect("item", String(item.row.id));
            }
            stack.clear();
          }}
          currentUser={currentUser}
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
        {build === "heritage" ? (
          <div className="-mx-1 mt-2 flex flex-nowrap gap-1.5 overflow-x-auto px-1">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "GROUP_HERITAGES", label: "All heritages" },
                { key: "LINEAGE_TEMPLATE", label: "Lineage" },
                { key: "UPBRINGING_TEMPLATE", label: "Upbringing" },
                { key: "MANIFEST_TEMPLATE", label: "Manifest" },
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
  currentUser,
}: {
  item: SandboxPreviewItem;
  libraryItem: LibraryItem | null;
  build: HeritageBuildMode;
  onLoadIntoBuild: () => void;
  onSubLinkClick: (link: PreviewSubLink) => void;
  onFork: ((targetType: string, targetId: string) => void) | undefined;
  currentUser: { username: string; displayName: string | null; avatarUrl: string | null } | null;
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
  // because the Blueprint Library only shows items + heritage (effects
  // + capabilities are surfaced from the Grammar Library).
  const slottableKinds: Array<"primitive" | "effect" | "capability"> = [
    "primitive",
    "effect",
    "capability",
  ];
  const canSlot =
    slottableKinds.length > 0 &&
    (slottableKinds as string[]).includes(item.kind);

  const router = useRouter();
  const stack = useModalStack();
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
      if (sandboxSplit) {
        setSandboxBottomTab("build");
      } else {
        openDrawer("build");
      }
    }
  }

  function loadAndPreview() {
    onLoadIntoBuild();
    if (sandboxSplit) {
      setSandboxBottomTab("preview");
    } else {
      openDrawer("build");
    }
  }

  // Ownership + visibility drive the unified action bar (same component as
  // My Creations + the library detail page + the grammar-library preview).
  const isOwner =
    !!engagement &&
    !!engagement.authorId &&
    engagement.authorId === engagement.currentUserInternalId;
  const visibility = (libraryItem?.visibility ?? "PRIVATE") as Visibility;
  const canDelete = visibility === "PRIVATE";
  const compositeId = libraryCompositeId(item);
  // Phase 9 round 5: mask admin authors + legacy system rows via
  // the unified helper. The helper now also fires on sourceOrigin
  // === "system" (legacy stock corpus with dirty user_ids).
  //
  // CRITICAL: do NOT fall back to `currentUser?.username` here.
  // That fallback was overriding the admin/system mask — for a
  // legacy stock row with no resolved author, the helper returns
  // null (correctly), but then the caller would re-fill it with
  // the logged-in user's handle, so the preview rendered "by
  // @mashu" instead of "by System". The logged-in user is the
  // EDITOR, not necessarily the AUTHOR — those are different
  // identities.
  const ownerUsername = authorDisplayUsername({
    authorUsername:
      libraryItem?.authorUsername ??
      engagement?.authorUsername ??
      null,
    authorIsAdmin: libraryItem?.authorIsAdmin ?? engagement?.authorIsAdmin ?? null,
    sourceOrigin: libraryItem?.sourceOrigin ?? null,
  });
  const ownerDisplayName = authorDisplayName({
    authorUsername:
      libraryItem?.authorUsername ??
      engagement?.authorUsername ??
      null,
    authorDisplayName: libraryItem?.authorDisplayName ?? null,
    authorIsAdmin: libraryItem?.authorIsAdmin ?? engagement?.authorIsAdmin ?? null,
    sourceOrigin: libraryItem?.sourceOrigin ?? null,
  });
  const owner: EntityPreviewOwner | undefined = ownerUsername
    ? {
        authorId: engagement?.authorId ?? libraryItem?.authorId ?? null,
        authorUsername: ownerUsername,
        authorDisplayName: ownerDisplayName ?? ownerUsername,
        authorAvatarUrl: libraryItem?.authorAvatarUrl ?? currentUser?.avatarUrl ?? null,
        isOwner,
        profileHref: `/u/${ownerUsername}`,
      }
    : undefined;

  async function handleDelete() {
    const res = await fetch("/api/creations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: item.kind.toUpperCase(),
        targetId: compositeId,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    stack.clear();
  }

  const actionBar: PreviewActionProps = {
    loadIntoBuild: { label: "Load into build", onClick: loadAndPreview },
    ...(canSlot ? { primarySecondary: { label: "Slot into build", onClick: slotIntoBuild } } : {}),
    ...(isOwner
      ? {
          onEdit: () =>
            router.push(`/atelier?build=${item.kind}&edit=${item.row.id}`),
          onDelete: handleDelete,
          deletable: true,
          canDelete,
          visibility,
          onVisibilityChange: (next: Visibility) => {
            void fetch("/api/creations/visibility", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                targetType: item.kind.toUpperCase(),
                targetId: compositeId,
                visibility: next,
              }),
            });
          },
        }
      : {}),
    openSourceHref: `/library/item/${compositeId}`,
    versionHistoryHref: `/library/item/${compositeId}/versions`,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EntityPreview
        item={item}
        variant="read"
        owner={owner}
        {...(engagement
          ? {
              callbacks: {
                onSubLinkClick,
                engagement,
                openSourceHref: `/library/item/${compositeId}`,
                sandboxPath: "/atelier",
                onFork,
              },
            }
          : {
              callbacks: {
                onSubLinkClick,
                openSourceHref: `/library/item/${compositeId}`,
                sandboxPath: "/atelier",
                onFork,
              },
            })}
        actionBar={actionBar}
      />
    </div>
  );
}