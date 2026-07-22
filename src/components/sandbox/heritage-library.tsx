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
import { useSandboxSaveHandler } from "./use-sandbox-save-handler";
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
import { useCharacterModal, tabLabelForActiveStep, type CharacterTabId } from "@/components/character-modal/character-modal-store";
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
  /**
   * Phase 8 rev 9: the kind currently loaded into the build column (or
   * the draft-kind sentinel when the user just picked + New entity). The
   * "Slot into build" button in previews only shows when the previewed
   * kind can slot into what's loaded. See canSlotFromBuild in
   * grammar-library.tsx for the rules — this library reuses the same
   * helper. Pass `null` when the build column is empty.
   */
  buildFormKind: "primitive" | "effect" | "capability" | "heritage" | "item" | null;
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

/**
 * Phase 8.1 batch 11 (Mashu 2026-07-22): same routing rule as
 * grammar-library. When the user is on identity/backstory/attributes
 * and clicks 'Slot into [step]' on a primitive/capability preview
 * surfaced from the heritage-library, we default to manifest. The
 * three mechanic tabs (lineage/upbringing/manifest) pass through.
 * The items tab is filtered out at the action-bar level so this
 * function never returns 'items' from a slot-into-character path.
 */
function resolveHeritageSlotDestination(
  activeStep: CharacterTabId,
): CharacterTabId {
  if (
    activeStep === "lineage" ||
    activeStep === "upbringing" ||
    activeStep === "manifest"
  ) {
    return activeStep;
  }
  return "manifest";
}

export function HeritageLibrary({
  build,
  buildFormKind,
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

  // Phase 8.1 batch 13.6 follow-up: subscribe to save events
  // ONCE up here (before the optimistic-prepend useMemo uses the
  // state). The hook owns the optimisticItems list + the sw-sandbox-
  // saved event listener. The subscribe() callback lower down
  // adds the UI side effects (filter reset, scroll, flash).
  const { optimisticItems, flushOptimisticIfMatched, subscribe } =
    useSandboxSaveHandler();

  // Phase 8.1 batch 13.6 follow-up: prepend optimistic items to the
  // filter source so the user sees the just-saved row instantly.
  // The optimistic list lives in useSandboxSaveHandler; we drop
  // entries once libraryItems updates with the real row.
  const combinedItems = useMemo<LibraryItem[]>(() => {
    if (optimisticItems.length === 0) return libraryItems;
    const seen = new Set<string>();
    const out: LibraryItem[] = [];
    for (const it of optimisticItems) {
      const id = String(it.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(it);
    }
    for (const it of libraryItems) {
      const id = String(it.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(it);
    }
    return out;
  }, [libraryItems, optimisticItems]);

  // Drop optimistic entries whose id is now in real libraryItems.
  useEffect(() => {
    if (optimisticItems.length === 0) return;
    const realIds = new Set(libraryItems.map((it) => String(it.id)));
    for (const it of optimisticItems) {
      if (realIds.has(String(it.id))) {
        flushOptimisticIfMatched(String(it.id));
      }
    }
  }, [libraryItems, optimisticItems, flushOptimisticIfMatched]);

  // Filter items by toolbar search/typeFilter. The build-mode gate is
  // removed — the user can see any kind in the blueprint library per the
  // user's spec.
  const filteredItems = useMemo(() => {
    let items = combinedItems;

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
  }, [build, combinedItems, toolbarState]);

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

  // Phase 8.1 batch 13.6 follow-up: when a form saves an entity, the
  // atelier fires `sw-sandbox-saved` with { kind, id, row }. We use
  // the shared `useSandboxSaveHandler()` hook (see
  // ./use-sandbox-save-handler.ts) to:
  //   1. Optimistically prepend the saved row to the visible list
  //      so the user sees it INSTANTLY, without waiting for the
  //      router.refresh() round-trip.
  //   2. Reset toolbarState filters so the new entity isn't hidden.
  //   3. Scroll + flash the new row.
  //
  // Mashu 2026-07-22: "Soninfork idk a domain, I save, and I cannot
  // see in list or search and find the new fork unless I refresh
  // page." Optimistic prepend eliminates the wait entirely; the
  // optimistic copy is dropped once libraryItems updates with the
  // real row. (subscribe + optimisticItems come from the hook call
  // at the top of the component — see above.)

  useEffect(() => {
    const unsub = subscribe((detail) => {
      const kind = detail.kind;
      const kindToFilter: Record<typeof kind, string> = {
        primitive: "PRIMITIVE",
        effect: "EFFECT",
        capability: "CAPABILITY",
        heritage: "GROUP_HERITAGES",
        item: "ITEM",
      };
      setToolbarState((prev) => ({
        ...prev,
        search: "",
        typeFilter: kindToFilter[kind] as typeof prev.typeFilter,
        category: "",
        author: "",
        minLikes: "",
        hasForks: false,
      }));
      // Bumped retry window (was 1.5s) because optimistic prepend
      // usually wins; the loop is just a polish for the scroll/flash.
      const id = detail.id;
      const attempts: number[] = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 3500];
      for (const delay of attempts) {
        window.setTimeout(() => {
          const el = document.querySelector<HTMLElement>(
            `[data-library-row-id="${CSS.escape(id)}"]`,
          );
          if (!el) return;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("sw-saved-flash");
          window.setTimeout(() => {
            el.classList.remove("sw-saved-flash");
          }, 2200);
        }, delay);
      }
    });
    return unsub;
  }, [subscribe]);

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
          buildFormKind={buildFormKind}
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
  buildFormKind,
  onLoadIntoBuild,
  onSubLinkClick,
  onFork,
  currentUser,
}: {
  item: SandboxPreviewItem;
  libraryItem: LibraryItem | null;
  build: HeritageBuildMode;
  /**
   * Phase 8 rev 9: the kind currently loaded into the build column. The
   * BlueprintPreviewBody previews heritage/item entities (NOT
   * primitives/effects/capabilities — those come from the Grammar
   * Library). Since you can't slot a heritage/item into anything (they
   * are leaf entities), the slot button is suppressed here regardless
   * of buildFormKind. The prop is accepted for symmetry with the
   * SandboxPreviewBody in grammar-library.tsx but currently has no
   * effect — left wired so future "slot into item" features have a
   * hook to extend cleanly.
   */
  buildFormKind: "primitive" | "effect" | "capability" | "heritage" | "item" | null;
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
  // Phase 8 rev 9: BlueprintPreviewBody previews heritage/item entities
  // (NOT primitives/effects/capabilities — those come from the Grammar
  // Library). Heritage and item are leaf entities — you can't slot one
  // into another. So the slot button is always suppressed here. The
  // buildFormKind prop is accepted for symmetry with grammar-library's
  // SandboxPreviewBody but is intentionally unused. If the user later
  // wants "slot an item into another item" or "nest heritage", this is
  // where the rule would go.
  const canSlot = false;

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

  // Phase 8.1 batch 8 + fix-up: queue heritage / item / mechanic into
  // the character modal. Heritage routes by its own LINEAGE/UPBRINGING/
  // MANIFEST kind. Items go to items. Mechanics (primitives / effects
  // / capabilities shown on this page when filtered) go to the modal's
  // currently-active tab.
  //
  // After queueing we switch the modal's activeStep to the slot's
  // destination tab and open the modal if closed. Without this, the
  // slot landed silently — the user might still be on Identity tab
  // (the reset default) and the slot would never become visible.
  const characterModal = useCharacterModal();

  // Phase 8.1 round 3: heritage label needs the destination tab name,
  // not the modal's activeStep. LINEAGE → "Lineage", UPBRINGING →
  // "Upbringing", MANIFEST → "Manifest". Anything else falls back
  // to "Character" so the button label never says "Slot into undefined".
  function heritageTabLabel(row: { kind: string }): string {
    if (row.kind === "LINEAGE") return "Lineage";
    if (row.kind === "UPBRINGING") return "Upbringing";
    if (row.kind === "MANIFEST") return "Manifest";
    return "Character";
  }

  function slotIntoCharacter() {
    if (item.kind === "heritage") {
      const row = item.row as { id: string; name: string; kind: string };
      const heritageKind = row.kind as "LINEAGE" | "UPBRINGING" | "MANIFEST";
      characterModal.queueSlot({
        kind: "heritage",
        heritageId: row.id,
        heritageKind,
        name: row.name,
      });
      characterModal.setActiveStep(
        heritageKind === "LINEAGE"
          ? "lineage"
          : heritageKind === "UPBRINGING"
            ? "upbringing"
            : "manifest",
      );
      if (!characterModal.isOpen) {
        characterModal.open();
      }
      window.dispatchEvent(new CustomEvent("sw-sandbox-close-preview"));
    } else if (item.kind === "item") {
      const row = item.row as { id: string; name: string };
      characterModal.queueSlot({
        kind: "item",
        itemId: row.id,
        tab: "items",
        name: row.name,
      });
      characterModal.setActiveStep("items");
      if (!characterModal.isOpen) {
        characterModal.open();
      }
      window.dispatchEvent(new CustomEvent("sw-sandbox-close-preview"));
    } else if (
      item.kind === "primitive" ||
      item.kind === "capability"
    ) {
      // Heritage-library also previews primitives / capabilities when
      // the filter on the heritage-library tab is set to those kinds.
      // Per Mashu 2026-07-21: the user can be in the heritages tab
      // filtered by primitives and still slot into character. Effects
      // intentionally do NOT get a slot-into-character button — they
      // slot implicitly via their parent capability, or via the build
      // column for free-standing effects.
      // Phase 8.1 batch 11 (Mashu 2026-07-22): same routing rule as
      // grammar-library — info tabs (identity/backstory/attributes)
      // default to manifest, mechanic tabs pass through, items tab is
      // filtered out by canSlotIntoCharacter at the action-bar level.
      const tab = resolveHeritageSlotDestination(characterModal.activeStep);
      if (item.kind === "primitive") {
        // Phase 8.1 batch 10: capture mirror metadata so the slot
        // receiver can render the mirror toggle without re-fetching.
        const row = item.row;
        characterModal.queueSlot({
          kind: "primitive",
          primitiveId: row.id,
          tab,
          name: row.name,
          isMirrorable: row.isMirrorable,
          mirrorBuCredit: row.mirrorBuCredit,
          buCost: row.buCost,
        });
      } else {
        characterModal.queueSlot({
          kind: "capability",
          capabilityId: item.row.id,
          tab,
          name: item.row.name,
        });
      }
      characterModal.setActiveStep(tab);
      if (!characterModal.isOpen) {
        characterModal.open();
      }
      window.dispatchEvent(new CustomEvent("sw-sandbox-close-preview"));
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
    // Phase 8.1 batch 8 + fix-up + round 3: every entity kind the
    // character modal accepts shows a "Slot into [step]" CTA. The
    // label is always the destination tab:
    //   - heritage LINEAGE → "Lineage"
    //   - heritage UPBRINGING → "Upbringing"
    //   - heritage MANIFEST → "Manifest"
    //   - item → "Items"
    //   - primitive / capability → modal's activeStep tab
    //   - effect → no slot button at all (effects slot via their
    //     parent capability, or via "Slot into build" if the open
    //     build is capability or item)
    ...(item.kind === "heritage"
      ? {
          primaryTertiary: {
            label: `Slot into ${heritageTabLabel(item.row as { kind: string })}`,
            onClick: slotIntoCharacter,
          },
        }
      : item.kind === "item"
        ? {
            primaryTertiary: {
              label: "Slot into Items",
              onClick: slotIntoCharacter,
            },
          }
        : item.kind === "primitive" || item.kind === "capability"
          ? characterModal.activeStep !== "items"
            ? {
                // Phase 8.1 batch 11 (Mashu 2026-07-22): the label
                // shows the resolved destination tab (not the active
                // tab), so when the user is on identity/backstory/
                // attributes the button reads 'Slot into Manifest'.
                // Items tab is hidden entirely here (canSlot is also
                // gated via the canSlotIntoCharacter below).
                primaryTertiary: {
                  label: `Slot into ${tabLabelForActiveStep(resolveHeritageSlotDestination(characterModal.activeStep), characterModal.isOpen)}`,
                  onClick: slotIntoCharacter,
                },
              }
            : {}
          : {}),
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