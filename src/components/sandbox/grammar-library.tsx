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
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import { useModalStack } from "@/components/ui/modal-stack";
import {
  useCharacterModal,
  tabLabelForActiveStep,
  type CharacterTabId,
} from "@/components/character-modal/character-modal-store";
import {
  previewHeadingLabel,
  libraryCompositeId,
  type SandboxPreviewItem,
  type SandboxPrimitiveRow,
  type SandboxEffectRow,
  type SandboxCapabilityRow,
  type PreviewSubLink,
} from "@/components/library/library-item-preview";
import { EntityPreview, type PreviewActionProps, type EntityPreviewOwner } from "@/components/preview/entity-preview";
import { type Visibility } from "@/components/library/visibility-select";
import { useSandboxEngagement } from "@/components/library/use-sandbox-engagement";
import {
  SLOT_EVENT_NAME,
  type SlotEvent,
} from "@/lib/sandbox/slot-events";
import { cn } from "@/lib/utils";

// The Mechanics tab collapses primitive/effect/capability into one tab.
// The library still distinguishes the concrete kinds for chips + select,
// but the build mode "mechanics" shows all three together by default.
type MechanicsBuildMode = "primitive" | "effect" | "capability" | "mechanics";

// The kinds a preview can be. The library only ever surfaces these three
// from the mechanics tab, but slot rules can also reference heritage/item
// (used by the BlueprintPreviewBody for items+heritages), so this is
// the full five-kind union.
type PreviewKind = "primitive" | "effect" | "capability" | "heritage" | "item";

// Phase 8 rev 9: per the user's slot spec, the slot button visibility
// follows what's currently loaded into the build form, NOT the URL tab.
//   buildKind=primitive  → no slot (you're authoring a primitive from scratch)
//   buildKind=effect     → slot on primitive previews
//   buildKind=capability → slot on primitive + effect previews
//   buildKind=heritage   → slot on primitive + capability previews
//   buildKind=item       → slot on primitive + effect + capability previews
// The heritage/item previews in the Blueprint Library don't show slot
// buttons (they're leaf entities — slotting a heritage/item into another
// form is meaningless), so this helper returning false for those preview
// kinds is intentional. We still type PreviewKind as the full union so
// the same helper can be called from BlueprintPreviewBody if it ever
// needs to (today it does not — it has its own much simpler logic).
export function canSlotFromBuild(
  buildKind: "primitive" | "effect" | "capability" | "heritage" | "item" | null,
  previewKind: PreviewKind,
): boolean {
  if (buildKind === null) return false;
  if (buildKind === "primitive") return false;
  if (buildKind === "effect") return previewKind === "primitive";
  if (buildKind === "capability") return previewKind === "primitive" || previewKind === "effect";
  if (buildKind === "heritage") return previewKind === "primitive" || previewKind === "capability";
  if (buildKind === "item") return previewKind === "primitive" || previewKind === "effect" || previewKind === "capability";
  return false;
}

interface GrammarLibraryProps {
  build: MechanicsBuildMode;
  /**
   * Phase 8 rev 9: the kind currently loaded into the build column (or
   * the draft-kind sentinel when the user just picked + New entity). The
   * "Slot into build" button in previews only shows when canSlotFromBuild
   * says this preview can slot into what's loaded. Pass `null` when the
   * build column is empty.
   */
  buildFormKind: "primitive" | "effect" | "capability" | "heritage" | "item" | null;
  libraryItems: LibraryItem[];
  /**
   * Full typed rows used to render the modal preview. Kept here so the
   * modal can show all fields (mirror data, slots, etc.) — LibraryItem
   * only carries the subset queryLibrary exposes.
   */
  primitives: SandboxPrimitiveRow[];
  effects: SandboxEffectRow[];
  capabilities: SandboxCapabilityRow[];
  /**
   * Primitive category chips for the "Category" filter row. Only shown
   * when the typeFilter is PRIMITIVE or ALL (handled inside
   * LibraryToolbar). Pass [] to hide the row entirely.
   */
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
  /**
   * Pre-fetched engagement snapshot. Same shape as /library/browse.
   * Without this, every card's heart icon starts unfilled even when
   * the viewer has already liked the entry — looks like nothing's
   * working. Keyed by `LibraryItem.id`.
   */
  engagement: { reactions: Record<string, "LIKE" | "DISLIKE" | null>; following: Record<string, boolean> };
  /**
   * Current viewer's internal ID. Used by LikeForkBar to gate fork on
   * own content + show follow buttons. `null` when signed out.
   */
  currentUserInternalId: string | null;
  /** Current user's resolved profile — creator fallback for fork previews. */
  currentUser: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  editingKey: string | null;
  /** Latest published version numbers per entity. Keyed by "primitive:<id>" etc. */
  versionMap: Record<string, number> | undefined;
  onSelect: (
    kind: "primitive" | "effect" | "capability",
    id: string | number,
  ) => void;
  /** Direct fork handler (Atelier). When set, the preview's Fork button
   *  loads the fork-draft into the build form instead of navigating. */
  onFork?: (targetType: string, targetId: string) => void;
}

// Chip set per build mode:
// - Primitive: only Primitives
// - Effect: Primitives + Effects (so the user can see both, and copy a
//   primitive to slot into the effect)
// - Capability: all three (capability can slot primitives + effects)
const AVAILABLE_TYPES_BY_BUILD: Record<
  MechanicsBuildMode,
  Array<{ key: LibraryTargetType | "ALL"; label: string }>
> = {
  // Mechanics (collapsed tab): all three kinds as chips, All shown first
  // so the user browses primitives + effects + capabilities together.
  mechanics: [
    { key: "ALL", label: "All" },
    { key: "PRIMITIVE", label: "Primitives" },
    { key: "EFFECT", label: "Effects" },
    { key: "CAPABILITY", label: "Capabilities" },
  ],
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

// Global type chips for the side Filters panel — every kind, regardless of
// which tab is active. The Atelier page is one unified library; the tab is
// just a quick-filter, so the panel must expose all kinds at once.
const GLOBAL_TYPES: Array<{ key: LibraryTargetType | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PRIMITIVE", label: "Primitives" },
  { key: "EFFECT", label: "Effects" },
  { key: "CAPABILITY", label: "Capabilities" },
  { key: "LINEAGE_TEMPLATE", label: "Lineage" },
  { key: "UPBRINGING_TEMPLATE", label: "Upbringing" },
  { key: "MANIFEST_TEMPLATE", label: "Manifest" },
  { key: "ITEM", label: "Items" },
];

// Group filters: a single chip that matches several concrete types. Used by
// the "All mechanics" / "All heritages" quick-filter chips. The typeFilter
// state can hold a group key; TYPE_GROUPS resolves it to concrete types.
const TYPE_GROUPS: Record<string, LibraryTargetType[]> = {
  GROUP_MECHANICS: ["PRIMITIVE", "EFFECT", "CAPABILITY"],
  GROUP_HERITAGES: ["LINEAGE_TEMPLATE", "UPBRINGING_TEMPLATE", "MANIFEST_TEMPLATE"],
};

/**
 * Phase 8.1 batch 11 (Mashu 2026-07-22): decide which character
 * modal tab a slot should land in based on the tab the user is
 * currently viewing when they click "Slot into [step]".
 *
 *   - lineage / upbringing / manifest pass through (those tabs are
 *     the natural destination for primitives / capabilities / effects)
 *   - identity / backstory / attributes default to manifest — these
 *     tabs are informational, and slotting from them means "I want
 *     this primitive on my character, drop it somewhere reasonable"
 *   - items is filtered out at the canSlotIntoCharacter level so
 *     slotIntoCharacter never runs for the items tab; but defensively
 *     we still resolve to manifest here.
 */
function resolveSlotDestination(activeStep: CharacterTabId): CharacterTabId {
  if (
    activeStep === "lineage" ||
    activeStep === "upbringing" ||
    activeStep === "manifest"
  ) {
    return activeStep;
  }
  return "manifest";
}

export function GrammarLibrary({
  build,
  buildFormKind,
  libraryItems,
  primitives,
  effects,
  capabilities,
  primitiveCategories,
  engagement,
  currentUserInternalId,
  currentUser,
  editingKey,
  versionMap,
  onSelect,
  onFork,
}: GrammarLibraryProps) {
  // Default type filter per build mode. For the collapsed Mechanics tab
  // we default to "ALL" so primitives + effects + capabilities show
  // together (the user picks a specific chip to narrow). The legacy
  // primitive/effect/capability build modes still default to their own
  // kind for backwards-compatible deep links.
  const defaultTypeFilter: LibraryTargetType | "ALL" | "GROUP_MECHANICS" =
    build === "mechanics"
      ? "GROUP_MECHANICS"
      : build === "primitive"
        ? "PRIMITIVE"
        : build === "effect"
          ? "EFFECT"
          : "CAPABILITY";

  const availableTypes = AVAILABLE_TYPES_BY_BUILD[build];

  // Toolbar state — owned here, filtered list is derived.
  // View default: LIST. Same rationale as /library (Phase 8 fix):
  // the 2-column mobile grid is cramped, list view reads better on
  // narrow viewports, and the user can still toggle to GRID via the
  // toolbar (saved to sw_lib_pref cookie so the choice persists
  // across both pages).
  //
  // Mobile-UA override: force LIST when the viewport is < 768px.
  // The cookie can still say GRID for desktop sessions — the
  // override is just a per-render nudge. The same client-side
  // matchMedia listener that ships on /creations lives here.
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

  // Phase 8.1 batch 13.6 follow-up (Mashu 2026-07-22):
  // "Soninfork idk a domain, I save, and I cannot see in list or
  // search and find the new fork unless I refresh page."
  //
  // Two pieces:
  //   1. `useSandboxSaveHandler()` keeps an `optimisticItems` list
  //      that prepends the just-saved row to the visible library.
  //      The user sees the new entity INSTANTLY, without waiting
  //      for router.refresh() to round-trip the SC. The optimistic
  //      row is dropped automatically when libraryItems updates
  //      with the real entity (no duplicate row).
  //   2. The subscribe() callback resets toolbarState filters and
  //      scrolls/flashes the new row. Heritage-library uses the
  //      same hook (see heritage-library.tsx).
  const { optimisticItems, flushOptimisticIfMatched, subscribe } =
    useSandboxSaveHandler();

  useEffect(() => {
    const unsub = subscribe((detail) => {
      // Reset filter so the new entity isn't hidden behind a stale
      // search/category/type. Same kind→filter map as before.
      const kindToFilter: Record<typeof detail.kind, string> = {
        primitive: "PRIMITIVE",
        effect: "EFFECT",
        capability: "CAPABILITY",
        heritage: defaultTypeFilter,
        item: defaultTypeFilter,
      };
      setToolbarState((prev) => ({
        ...prev,
        search: "",
        typeFilter: kindToFilter[detail.kind] as typeof prev.typeFilter,
        category: "",
        author: "",
        minLikes: "",
        minForks: "",
        minBu: "",
        maxBu: "",
        subKinds: [],
        hasForks: false,
      }));
      // Scroll + flash the new row. Even with optimistic prepend,
      // the row's data-library-row-id attribute may not be set
      // until React commits the new list. The retry loop covers
      // the gap; bumped to 3.5s to handle slower dev refreshes.
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
        if (!row) return null;
        const vn = versionMap?.[`primitive:${id}`] ?? 1;
        return { kind: "primitive", row, latestVersionNumber: vn };
      }
      if (item.targetType === "EFFECT") {
        const row = effects.find((e) => e.id === item.targetId);
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
  }, [primitives, effects, capabilities, versionMap]);

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
  // Apply toolbar filters to libraryItems + optimisticItems. The
  // optimistic list prepends just-saved rows so the user sees them
  // instantly, before router.refresh() lands. Once the server-side
  // libraryItems updates (useEffect below), we drop the matching
  // optimistic row.
  const combinedItems = useMemo<LibraryItem[]>(() => {
    if (optimisticItems.length === 0) return libraryItems;
    // Optimistic items come first so they show at the top of the
    // list. Dedupe by id against libraryItems (in case the server
    // data has already arrived but the optimistic copy is still in
    // state).
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

  // Phase 8.1 batch 13.6 follow-up: drop optimistic entries whose
  // id is now present in the real libraryItems. This happens
  // after router.refresh() lands and the SC re-fetches. We dedupe
  // by id (already done in combinedItems) so the user just sees
  // the real row.
  useEffect(() => {
    if (optimisticItems.length === 0) return;
    const realIds = new Set(libraryItems.map((it) => String(it.id)));
    for (const it of optimisticItems) {
      if (realIds.has(String(it.id))) {
        flushOptimisticIfMatched(String(it.id));
      }
    }
  }, [libraryItems, optimisticItems, flushOptimisticIfMatched]);

  const filteredItems = useMemo(() => {
    const filtered = combinedItems.filter((item) => {
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
      // Apply type filter. "ALL" = everything available in this build
      // mode. Group keys (GROUP_MECHANICS / GROUP_HERITAGES) match a set
      // of concrete types. Otherwise it's a single concrete type.
      const tf = toolbarState.typeFilter;
      if (tf !== "ALL") {
        const group = TYPE_GROUPS[tf as keyof typeof TYPE_GROUPS];
        const allowedTf =
          group && group.length ? group : [tf as LibraryTargetType];
        if (!allowedTf.includes(item.targetType as LibraryTargetType)) {
          return false;
        }
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
    return sortLibraryItems(filtered, toolbarState.sort);
  }, [combinedItems, availableTypes, toolbarState]);

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
          availableTypes={GLOBAL_TYPES}
          primitiveCategories={primitiveCategories}
          showSearch={true}
          showAdvancedFilters={true}
          forceExpandFilters
        />
      </div>
    ),
    [toolbarState, setToolbarState, primitiveCategories],
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

  // Phase 7 Q-B UX: when the user clicks a slotted sub-entity in the
  // right-column form preview, the form preview dispatches
  // `sw-sandbox-open-preview`. We translate that to a pushPreview() so
  // the user gets the same modal affordance as clicking from the
  // library list. Lookup goes through the same find path that
  // onSubLinkClick uses, so the targetType values match PreviewSubLink.
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
      // ITEM / TEMPLATE_* are owned by the blueprint sandbox; the
      // blueprint library listens for the same event.
    };
    window.addEventListener("sw-sandbox-open-preview", handler);
    return () =>
      window.removeEventListener("sw-sandbox-open-preview", handler);
  }, [primitives, effects, capabilities]);

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
          buildFormKind={buildFormKind}
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
          currentUser={currentUser}
          onSubLinkClick={(link) => {
            // Look up the full row and push it onto the stack.
            if (link.targetType === "PRIMITIVE") {
              const sub = primitives.find(
                (p) => String(p.id) === link.targetId,
              );
              if (!sub) return;
              pushPreview({ kind: "primitive", row: sub });
              return;
            }
            if (link.targetType === "EFFECT") {
              const sub = effects.find((e) => e.id === link.targetId);
              if (!sub) return;
              pushPreview({ kind: "effect", row: sub });
              return;
            }
            if (link.targetType === "CAPABILITY") {
              const sub = capabilities.find((c) => c.id === link.targetId);
              if (!sub) return;
              pushPreview({ kind: "capability", row: sub });
              return;
            }
          }}
          onFork={onFork}
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
        {/* Collapsed Mechanics tab: quick-filter chips for the concrete
            kinds (mirrors the Heritage tab's chip row). */}
        {build === "mechanics" ? (
          <div className="-mx-1 mt-2 flex flex-nowrap gap-1.5 overflow-x-auto px-1">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "GROUP_MECHANICS", label: "All mechanics" },
                { key: "PRIMITIVE", label: "Primitives" },
                { key: "EFFECT", label: "Effects" },
                { key: "CAPABILITY", label: "Capabilities" },
              ] as Array<{ key: LibraryTargetType | "ALL" | "GROUP_MECHANICS"; label: string }>
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
  buildFormKind,
  onLoadIntoBuild,
  onSubLinkClick,
  onFork,
  currentUser,
}: {
  item: SandboxPreviewItem;
  libraryItem: LibraryItem | null;
  build: MechanicsBuildMode;
  /**
   * Phase 8 rev 9: the kind currently loaded into the build column. Used
   * to derive canSlot via canSlotFromBuild — replaces the old logic that
   * derived slottableKinds from the URL `build` tab.
   */
  buildFormKind: "primitive" | "effect" | "capability" | "heritage" | "item" | null;
  onLoadIntoBuild: () => void;
  onSubLinkClick: (link: PreviewSubLink) => void;
  onFork: ((targetType: string, targetId: string) => void) | undefined;
  currentUser: { username: string; displayName: string | null; avatarUrl: string | null } | null;
}) {
  // Pull openDrawer from the global controls so we can pop the build
  // preview after a slot/load — the user wants to see the build
  // column/drawer open so they can see the slot land or the loaded
  // entity's preview update. (Previously the modal closed and the
  // user had to manually tap the build/preview tab.)
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
  const stack = useModalStack();
  // Phase 8.1 batch 8: character modal integration. Read the activeStep
  // to drive the "Slot into [step]" button label. Heritage library
  // routes the slot via heritage.kind (LINEAGE/UPBRINGING/MANIFEST);
  // primitives/caps slot into the modal's currently-open tab.
  const characterModal = useCharacterModal();
  // Phase 8 rev 9: slot button visibility follows what's loaded in the
  // build column (buildFormKind), NOT the URL tab (build). See
  // canSlotFromBuild for the rules — they match the user's spec exactly.
  const canSlot = canSlotFromBuild(buildFormKind, item.kind);
  // Phase 8.1 batch 8 + round 3: effects no longer slot into the
  // character modal — effects are slotted implicitly when the user
  // slots the capability that contains them (or via the build column
  // for free-standing effects). The character modal's queueSlot()
  // also doesn't have a separate effect-id routing yet (effects
  // would land in the same slot as their parent primitive), so
  // showing the button was confusing Mashu 2026-07-21 — clicking
  // it did nothing visible. Only primitives + capabilities can
  // route through the modal's queue directly.
  // Phase 8.1 batch 11 (Mashu 2026-07-22): slot-into-character is
  // only valid on the three mechanic tabs (lineage, upbringing,
  // manifest) AND on identity/backstory/attributes where it defaults
  // to manifest. It's hidden entirely on the items tab — items have
  // their own slot button ("Slot into character [Items]").
  const canSlotIntoCharacter =
    (item.kind === "primitive" || item.kind === "capability") &&
    characterModal.activeStep !== "items";

  // Engagement snapshot for the LikeForkBar + version-history link. The
  // hook fetches the user's existing reaction (so the bar shows the right
  // active state) on first open. Counts + author info come from the
  // LibraryItem we passed in.
  const router = useRouter();
  const { engagement } = useSandboxEngagement(libraryItem);

  function slotIntoBuild() {
    // Phase 8 rev 9: capabilities can also slot into build (per the
    // user's spec, slot button shows on capability previews when the
    // loaded build is a heritage or item). Previously this guard
    // rejected capabilities, which silently no-op'd the slot.
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

  // Phase 8.1 batch 8 + 8.1 fix-up: queue the slot into the character
  // modal. The store routes heritage by its own kind; primitives/caps/
  // effects go to the activeStep. Also switches the modal to the
  // destination tab (and opens the modal if it was closed) so the
  // user sees the slot land — without this, slotting from a closed
  // modal or the wrong tab left the slot invisible.
  function slotIntoCharacter() {
    if (
      item.kind !== "primitive" &&
      item.kind !== "effect" &&
      item.kind !== "capability"
    )
      return;
    // Phase 8.1 batch 11 (Mashu 2026-07-22): the user can ONLY slot
    // primitives/capabilities/effects into lineage, manifest, and
    // upbringing. When the user is currently on identity / backstory
    // / attributes, the slot button should default to manifest (we
    // treat those tabs as informational only — mechanics live in the
    // other three). On the items tab the slot-into-character button
    // is hidden entirely (see canSlotIntoCharacter below).
    const tab = resolveSlotDestination(characterModal.activeStep);
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
    } else if (item.kind === "capability") {
      characterModal.queueSlot({
        kind: "capability",
        capabilityId: item.row.id,
        tab,
        name: item.row.name,
      });
    } else {
      // effect
      characterModal.queueSlot({
        kind: "effect",
        effectId: item.row.id,
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

  // Ownership + visibility drive the unified action bar. The bar is the
  // SAME component used by My Creations + the library detail page, so the
  // Atelier preview now matches them exactly: a 3-col Edit/Source/Versions
  // grid, a full-width Delete (gated on PRIVATE), and the "Load into build"
  // / "Slot into build" CTAs surfaced as primary buttons above the grid.
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
  // identities. Only fall back to currentUser when the user is
  // actually the owner AND we have positive proof of that, which
  // the isOwner flag below already encodes.
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
    loadIntoBuild: { label: "Load into build", onClick: onLoadIntoBuild },
    ...(canSlot ? { primarySecondary: { label: "Slot into build", onClick: slotIntoBuild } } : {}),
    // Phase 8.1 batch 8 + batch 11: context-aware "Slot into [step]"
    // for the character modal. Label driven by the RESOLVED
    // destination tab (resolveSlotDestination), not the raw active
    // tab, so identity/backstory/attributes correctly read "Slot
    // into Manifest" instead of "Slot into [Info tab name]". Only
    // shown for entity kinds the modal accepts (primitives/caps);
    // items tab is filtered out by canSlotIntoCharacter.
    ...(canSlotIntoCharacter
      ? {
          primaryTertiary: {
            label: `Slot into ${tabLabelForActiveStep(resolveSlotDestination(characterModal.activeStep), characterModal.isOpen)}`,
            onClick: slotIntoCharacter,
          },
        }
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