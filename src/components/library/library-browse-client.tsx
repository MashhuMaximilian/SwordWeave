"use client";
import { CompositionMechanics } from "./composition-mechanics";
import { LibraryCatalogueCard, LibraryEntityIcon, libraryCatalogueStatus as primitiveStatus } from "./library-catalogue-card";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { PhoneTypeChoices, PHONE_RECORD_TYPES } from "./phone-type-choices";
import { useInfiniteLibrary } from "@/lib/hooks/use-infinite-library";
import { InfiniteLibraryResults } from "./infinite-library-results";

// =============================================================================
// LibraryBrowseClient — client wrapper that owns the toolbar state and pushes
// URL changes via Next router.
//
// Layout: <LibraryToolbar /> + <LibraryTable /> + an iframe detail modal.
//
// When the user taps a row, we open a full-size DetailModal that loads the
// canonical detail page (/library/item/[id]) in an iframe. The user gets the
// real source page rendered inline (not a stripped-down card preview) while
// keeping the browse list visible behind. ESC / backdrop click closes it.
// =============================================================================

import {
  libraryAuthorLabel,
  libraryOrigin,
} from "@/lib/publishing/library-classification";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { FetchedEntityPreview } from "@/components/preview/entity-preview";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import { DetailModal } from "@/components/ui/detail-modal";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import type {
  LibraryCompositionPath,
  LibraryItem,
  PrimitiveFamilyTier,
} from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "@/components/library/library-table";
import { EMPTY_LIBRARY_TOOLBAR_STATE, type LibraryToolbarState } from "@/components/library/library-toolbar";
import {
  LibraryMarketRail,
  libraryFamilyLabel,
} from "@/components/library/library-market-rail";
import { LibraryProvenance } from "./library-provenance";
import { ForkMapButton } from "@/components/engagement/fork-map-button";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { PreviewFlagSummary } from "@/components/engagement/flags-section";
import { buildSandboxUrl } from "@/lib/publishing/fork-target";
import { Markdown } from "@/components/ui/markdown";
import { ExternalLink, History } from "lucide-react";


interface Props {
  basePath?: string;
  fixedType?: LibraryItem["targetType"];
  initialItems: LibraryItem[];
  total: number;
  page: number;
  totalPages: number;
  initialState: LibraryToolbarState;
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
  familyTiers: PrimitiveFamilyTier[];
  /**
   * Distinct item tags (with counts) for the chip-based tag filter
   * in the toolbar. Server-loaded so the chips render in a single
   * round-trip; the client just toggles the active set and pushes
   * the new tag list to the URL.
   */
  itemTags?: Array<{ value: string; label: string; count: number }>;
  /**
   * Currently-active tag filter values, mirrored from the URL ?tag=
   * param. Passed so the chips can render their active state on the
   * initial render (the toolbar derives the active set from
   * `state.tags`, but we also need it to highlight chips on first
   * paint before the toolbar mounts its effect).
   */
  activeTags?: string[];
  engagement: LibraryEngagement;
  currentUserInternalId: string | null;
}

function atelierBuildForTarget(targetType: LibraryItem["targetType"]): string {
  if (targetType.endsWith("_TEMPLATE")) return "heritage";
  return targetType.toLowerCase();
}

export function LibraryBrowseClient({
  basePath = "/library/browse",
  fixedType,
  initialItems,
  total,
  page,
  totalPages,
  initialState,
  primitiveCategories,
  familyTiers,
  itemTags = [],
  activeTags = [],
  engagement,
  currentUserInternalId,
}: Props) {
  const phone = useIsMobile();
  const [selection, setSelectedItem] = useState<LibraryItem | null>(
    initialItems[0] ?? null,
  );
  const [state, setState] = useState<LibraryToolbarState>(initialState);
  useEffect(() => setState(initialState), [initialState]);
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (state.typeFilter !== "ALL" && !state.typeFilter.startsWith("GROUP_")) params.set("targetType", state.typeFilter);
    for (const key of ["collectionId", "category", "origin", "tier", "sort", "minBu", "maxBu", "minForks", "fromDate", "toDate", "definitionKind", "minLikes", "mechanicTarget", "recipient", "conditionMode", "minMagnitude", "maxMagnitude"] as const) if (state[key]) params.set(key, String(state[key]));
    if (state.search) params.set("q", state.search);
    if (state.author) params.set("authorUsername", state.author);
    if (state.tags) params.set("tags", state.tags);
    if (state.hasForks) params.set("hasForks", "1");
    if (state.mirrorableOnly) params.set("mirrorableOnly", "1");
    return params.toString();
  }, [state]);
  const discovery = useInfiniteLibrary(queryString, { pageSize: 30, initialItems, initialTotal: total });
  const items = discovery.items;
  const selectedItem = items.find(item => item.id === selection?.id) ?? items[0] ?? null;
  const selectedForkTarget = selectedItem
    ? buildSandboxUrl(selectedItem.targetType, selectedItem.targetId, "fork")
    : null;
  const [detailOpen, setDetailOpen] = useState(false);
  const [nestedPreview, setNestedPreview] = useState<{targetType:string;targetId:string;name:string} | null>(null);
  const [familyExpanded, setFamilyExpanded] = useState(true);
  const [visibleFamilyTiers, setVisibleFamilyTiers] = useState(familyTiers);
  useEffect(() => {
    if (state.category === initialState.category) { setVisibleFamilyTiers(familyTiers); return; }
    setVisibleFamilyTiers([]);
    if (!state.category) return;
    const controller = new AbortController();
    fetch(`/api/library/family-tiers?category=${encodeURIComponent(state.category)}`, {signal: controller.signal})
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (!controller.signal.aborted) setVisibleFamilyTiers(result?.tiers ?? []); })
      .catch(() => {});
    return () => controller.abort();
  }, [state.category, initialState.category, familyTiers]);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(270);
  const [rightWidth, setRightWidth] = useState(330);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const isPrimitiveMode =
    state.typeFilter === "PRIMITIVE";
  const effectiveCategory = isPrimitiveMode
    ? state.category || ""
    : "";
  const effectiveCategoryRecord = primitiveCategories.find(
    (category) => category.value === effectiveCategory,
  );
  const effectiveCategoryLabel = effectiveCategoryRecord
    ? libraryFamilyLabel(effectiveCategoryRecord)
    : effectiveCategory.replaceAll("_", " ").toLowerCase();

  const pushUrl = useCallback(
    (next: LibraryToolbarState, overridePage?: number) => {
      const params = new URLSearchParams();
      if (next.origin && next.origin !== "all") params.set("origin", next.origin);
      if (next.tier) params.set("tier", next.tier);
      if (next.typeFilter !== "ALL" || phone) params.set("type", next.typeFilter);
      if (next.collectionId) params.set("collectionId",next.collectionId);
      if (next.category) params.set("category", next.category);
      if (next.search) params.set("q", next.search);
      if (next.author) params.set("author", next.author);
      if (next.minLikes) params.set("minLikes", next.minLikes);
      if (next.hasForks) params.set("hasForks", "1");
      if (next.sort !== "ENGAGEMENT") params.set("sort", next.sort);
      if (next.view !== "GRID") params.set("view", next.view);
      // Tag filter — comma-separated. Only emit the param when the
      // active type is ITEM (other types ignore the tag filter
      // server-side, and emitting it for those would be confusing).
      if (
        next.typeFilter === "ITEM" &&
        next.tags &&
        next.tags.trim().length > 0
      ) {
        params.set("tag", next.tags);
      }
      for (const key of ["minBu", "maxBu", "minForks", "fromDate", "toDate", "definitionKind", "mechanicTarget", "recipient", "conditionMode", "minMagnitude", "maxMagnitude"] as const) if (next[key]) params.set(key, String(next[key]));
      if (next.mirrorableOnly) params.set("mirrorableOnly", "1");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${basePath}?${qs}` : basePath);
    },
    [phone, basePath],
  );

  const onStateChange = useCallback(
    (next: LibraryToolbarState) => {
      const bounded = fixedType ? { ...next, typeFilter: fixedType } : next;
      setState(bounded);
      pushUrl(bounded, 0);
    },
    [pushUrl, fixedType],
  );

  // When the user clicks a row, open the iframe detail modal.
  const onRowSelect = useCallback((item: LibraryItem) => {
    setSelectedItem(item);
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setDetailOpen(true);
    }
  }, []);

  // Right-side filter panel slot: full toolbar lives inside the panel.
  // The column header has a search bar + filter-open button.
  // Memoize the slot content to avoid the re-render loop that previously
  // produced a noticeable delay between "tap Show filters" and seeing chips.
  const { setFilterPanelOpen } = useGlobalControls();
  const filterPanelContent = useMemo(
    () => (
      <div className="space-y-3">
        <LibraryToolbar
          state={state}
          {...(fixedType ? { availableTypes: [{ key: fixedType, label: "Monsters & NPCs" }] } : {})}
          onStateChange={onStateChange}
          primitiveCategories={primitiveCategories}
          // Tag chips for items — only shown by the toolbar when the
          // active type filter is ITEM. The activeTags array mirrors
          // the URL ?tag= param so chips render in their active state
          // on first paint (the toolbar also derives the active set
          // from `state.tags`, but `activeTags` is the source of
          // truth for the initial highlight).
          itemTags={itemTags}
          activeTags={activeTags}
          showSearch={true}
          showAdvancedFilters={true}
          showVisibilityFilter={false}
          forceExpandFilters
        />
      </div>
    ),
    [phone, state, onStateChange, primitiveCategories, itemTags, activeTags, fixedType],
  );
  useFilterSlot(filterPanelContent);

  const [phoneQuickFiltersOpen, setPhoneQuickFiltersOpen] = useState(false);
  const hasActiveFilters =
    state.typeFilter !== "ALL" ||
    state.category !== "" ||
    state.author !== "" ||
    state.minLikes !== "" ||
    state.hasForks ||
    state.sort !== "ENGAGEMENT";

  const startResize = useCallback(
    (side: "left" | "right", event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const frame = workbenchRef.current?.getBoundingClientRect();
      if (!frame) return;
      const opposite = side === "left" ? (window.innerWidth < 1280 ? 0 : rightCollapsed ? 44 : rightWidth) : isPrimitiveMode ? (leftCollapsed ? 44 : leftWidth) : 0;
      const maximum = Math.max(side === "left" ? 190 : 240, frame.width - opposite - 300 - (isPrimitiveMode ? 18 : 9));
      const move = (pointer: PointerEvent) => {
        if (side === "left") {
          setLeftCollapsed(false);
          setLeftWidth(Math.max(190, Math.min(Math.min(520, maximum), pointer.clientX - frame.left)));
        } else {
          setRightCollapsed(false);
          setRightWidth(Math.max(240, Math.min(Math.min(640, maximum), frame.right - pointer.clientX)));
        }
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, { once: true });
      window.addEventListener("pointercancel", stop, { once: true });
    },
    [isPrimitiveMode, leftCollapsed, leftWidth, rightCollapsed, rightWidth],
  );

  const resizeWithKeyboard = (side: "left" | "right", event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const frame = workbenchRef.current?.getBoundingClientRect();
    if (!frame) return;
    const minimum = side === "left" ? 190 : 240;
    const opposite = side === "left" ? (window.innerWidth < 1280 ? 0 : rightCollapsed ? 44 : rightWidth) : isPrimitiveMode ? (leftCollapsed ? 44 : leftWidth) : 0;
    const maximum = Math.max(minimum, Math.min(side === "left" ? 520 : 640, frame.width - opposite - 300 - (isPrimitiveMode ? 18 : 9)));
    const width = side === "left" ? leftWidth : rightWidth;
    const delta = (event.key === "ArrowRight" ? 1 : -1) * (side === "left" ? 1 : -1) * 24;
    const value = event.key === "Home" ? minimum : event.key === "End" ? maximum : Math.max(minimum, Math.min(maximum, width + delta));
    if (side === "left") { setLeftCollapsed(false); setLeftWidth(value); }
    else { setRightCollapsed(false); setRightWidth(value); }
  };

  useEffect(() => {
    let frameRequest = 0;
    const updateAvailableHeight = () => {
      const frame = workbenchRef.current;
      if (!frame) return;
      const top = Math.max(8, frame.getBoundingClientRect().top);
      frame.style.setProperty("--v12-library-available", `${Math.max(240, window.innerHeight - top - 8)}px`);
    };
    const scheduleAvailableHeight = () => {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = window.requestAnimationFrame(updateAvailableHeight);
    };
    updateAvailableHeight();
    window.addEventListener("resize", scheduleAvailableHeight, { passive:true });
    window.addEventListener("scroll", scheduleAvailableHeight, { passive:true });
    return () => {
      window.cancelAnimationFrame(frameRequest);
      window.removeEventListener("resize", scheduleAvailableHeight);
      window.removeEventListener("scroll", scheduleAvailableHeight);
    };
  }, [initialState.typeFilter]);

  return (
    <div className="v12-library-browser flex h-full min-h-0 flex-col" data-library-surface>
      <div className="v12-library-search shrink-0">
        <ColumnSearchBar
          search={state.search}
          onSearchChange={(s: string) =>
            onStateChange({
              ...state,
              search: s,
              ...(s.trim() ? { category: "", tier: "", origin: "all" as const } : {}),
            })
          }
          onOpenFilters={() => setFilterPanelOpen(true)}
          hasActiveFilters={hasActiveFilters}
        />
      </div>
      <div
        ref={workbenchRef}
        className={`v12-library-workbench min-h-0 flex-1${isPrimitiveMode ? "" : " is-creations"}${leftCollapsed ? " is-left-collapsed" : ""}${rightCollapsed ? " is-right-collapsed" : ""}`}
        style={{ "--v12-library-left": `${leftWidth}px`, "--v12-library-right": `${rightWidth}px` } as CSSProperties}
      >
        {isPrimitiveMode ? (
          <div className="v12-library-column v12-library-rail-column">
            <button type="button" className="v12-column-toggle" onClick={() => setLeftCollapsed((value) => !value)} aria-label={leftCollapsed ? "Expand category column" : "Collapse category column"}>{leftCollapsed ? "›" : "‹"}</button>
            <LibraryMarketRail
              categories={primitiveCategories}
              selected={effectiveCategory}
              onSelect={(category) =>
                onStateChange({
                  ...state,
                  typeFilter: category ? "PRIMITIVE" : state.typeFilter,
                  category,
                })
              }
            />
          </div>
        ) : null}
        {isPrimitiveMode ? <div className="v12-library-resizer" role="separator" aria-label="Resize category column" aria-orientation="vertical" tabIndex={0} aria-valuemin={190} aria-valuemax={520} aria-valuenow={leftWidth} onKeyDown={event => resizeWithKeyboard("left", event)} onPointerDown={(event) => startResize("left", event)} /> : null}
        <main className="v12-library-results min-h-0">
          <section className={`v12-family-panel${familyExpanded ? " is-expanded" : " is-collapsed"}`} aria-label={state.typeFilter === "MONSTER" ? "Creature catalogue" : "Selected market family"}>
          <div className="v12-market-hero">
            <div>
              <p className="v12-kicker">{state.typeFilter === "MONSTER" ? "Bestiary · creatures for your story" : "Lexicon category · canonical family"}</p>
              <h2>
                {state.typeFilter === "MONSTER" ? "Monsters & NPCs" : effectiveCategoryLabel ||
                  (state.typeFilter === "ALL"
                    ? "The complete SwordWeave corpus"
                    : state.typeFilter.replaceAll("_", " ").toLowerCase())}
              </h2>
              <p>
                {state.typeFilter === "MONSTER" ? "Explore creatures, inspect their practices and abilities, then bring an independent copy to your table." : isPrimitiveMode && effectiveCategory ? "The rows define canonical tiers. Creating here opens the general primitive author with this family prefilled." : "Browse exact versions, inspect provenance, and carry the chosen record into the Atelier without losing its source lineage."}
              </p>
            </div>
            {isPrimitiveMode && effectiveCategory ? (
              <div className="v12-family-actions">
                <a
                  href={`/atelier?build=primitive&new=1&category=${encodeURIComponent(effectiveCategory)}`}
                  className="v12-metal-button v12-metal-button--primary"
                >
                  + Create primitive
                </a>
                <button type="button" className="v12-family-collapse" aria-expanded={familyExpanded} onClick={()=>setFamilyExpanded(value=>!value)}><span>{familyExpanded ? "Collapse" : "Expand"}</span><b aria-hidden="true">{familyExpanded ? "−" : "+"}</b></button>
              </div>
            ) : null}
          </div>
          {familyExpanded && effectiveCategory && isPrimitiveMode && visibleFamilyTiers.length ? (
            <div className="v12-tier-ladder" aria-label="Canonical cost tiers">
              {visibleFamilyTiers.map((tier) => (
                <div key={`${tier.tier}:${tier.buCost}`}>
                  <span>{tier.tier ? `T${tier.tier}` : "—"}</span>
                  <div className="v12-tier-copy">
                    <b>{tier.name}</b>
                    {tier.description ? <p>{tier.description}</p> : null}
                  </div>
                  <em>{tier.buCost} BU</em>
                  <div className="v12-tier-actions">
                    <a href={`/atelier?build=primitive&new=1&sourceType=PRIMITIVE&sourceId=${tier.id}`} className="v12-tier-specialize">Specialize</a>
                    <ForkMapButton targetType="PRIMITIVE" targetId={String(tier.id)} targetName={tier.name} className="v12-tier-map" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          </section>
          <div className="v12-results-heading">
            {phone ? <PhoneTypeChoices label="Record type" value={state.typeFilter} options={fixedType ? PHONE_RECORD_TYPES.filter(option => option.value === fixedType) : PHONE_RECORD_TYPES.filter(option => option.value !== "MONSTER")} onChange={value=>onStateChange({...state,typeFilter:value as LibraryToolbarState["typeFilter"],category:"",tier:""})}/> : <div>
              <p className="v12-kicker">Exact entries</p>
              <h3>{state.typeFilter === "MONSTER" ? "Creatures of the weave" : "Canonical references and community expressions"}</h3>
            </div>}
            <span>{discovery.total.toLocaleString()} records</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-2" aria-label="Active filters">
            {([
              ["search", "Search"], ["category", "Family"], ["tier", "Tier"], ["author", "Author"],
              ["minBu", "Minimum BU"], ["maxBu", "Maximum BU"], ["mechanicTarget", "Result"],
              ["recipient", "Recipient"], ["conditionMode", "Condition"], ["definitionKind", "Definition"],
              ["minMagnitude", "Minimum value"], ["maxMagnitude", "Maximum value"], ["tags", "Tags"],
              ["fromDate", "From"], ["toDate", "Until"], ["minLikes", "Minimum likes"], ["minForks", "Minimum forks"],
            ] as const).filter(([key]) => Boolean(state[key])).map(([key, label]) => <button key={key} type="button" className="rounded-full border border-border px-2 py-1 text-xs hover:border-primary" onClick={() => onStateChange({...state,[key]: ""})} aria-label={`Remove ${label.toLowerCase()} filter`}>{label}: {String(state[key])} <span aria-hidden="true">×</span></button>)}
            {state.origin && state.origin !== "all" ? <button type="button" className="rounded-full border border-border px-2 py-1 text-xs" onClick={() => onStateChange({...state,origin:"all"})}>Source: {state.origin} ×</button> : null}
            {state.mirrorableOnly ? <button type="button" className="rounded-full border border-border px-2 py-1 text-xs" onClick={() => onStateChange({...state,mirrorableOnly:false})}>Mirrorable ×</button> : null}
            {state.hasForks ? <button type="button" className="rounded-full border border-border px-2 py-1 text-xs" onClick={() => onStateChange({...state,hasForks:false})}>Has forks ×</button> : null}
            <button type="button" className="rounded border border-border px-2 py-1 text-xs hover:border-primary" onClick={() => onStateChange({...EMPTY_LIBRARY_TOOLBAR_STATE,typeFilter:state.typeFilter,view:state.view,sort:state.sort})}>Clear filters</button>
          </div>
          <button type="button" className="phone-library-quick-filter" aria-expanded={phoneQuickFiltersOpen} onClick={()=>setPhoneQuickFiltersOpen(value=>!value)}>Tier & origin{state.tier ? ` · Tier ${state.tier}` : ""}{state.origin && state.origin !== "all" ? ` · ${state.origin}` : ""} <span aria-hidden="true">{phoneQuickFiltersOpen ? "−" : "+"}</span></button>
          <div className={`v12-browse-controls${phoneQuickFiltersOpen ? " phone-filters-open" : ""}`}>
            {isPrimitiveMode ? <div className="v12-tier-tabs" aria-label="Exact entry tiers">{["", "1", "2", "3", "4", "5"].map(tier => <button key={tier} type="button" aria-pressed={(state.tier ?? "") === tier} onClick={() => onStateChange({ ...state, tier })}>{tier ? `Tier ${["", "I", "II", "III", "IV", "V"][Number(tier)]}` : "All tiers"}</button>)}</div> : null}
            <div className="v12-origin-tabs" aria-label="Entry origin">{(["all", "system", "community"] as const).map(origin => <button type="button" key={origin} aria-pressed={(state.origin ?? "all") === origin} onClick={() => onStateChange({ ...state, origin })}>{origin === "all" ? "All origins" : origin === "system" ? "System" : "Community"}</button>)}</div>
          </div>
          <InfiniteLibraryResults key={queryString} {...discovery} render={(visibleItems) => <>
          {visibleItems.length ? (
            <div className={isPrimitiveMode ? "v12-cluster-list" : "v12-creation-grid"}>
              {[{ id: isPrimitiveMode ? "primitives" : "creations", entries: visibleItems }].map(({ id, entries }) => <section className={`v12-entry-cluster${isPrimitiveMode ? " is-flat" : ""}`} key={id}>{entries.map((item) => (
                <LibraryCatalogueCard key={item.id} item={item} selected={selectedItem?.id === item.id} onSelect={onRowSelect} engagement={engagement} currentUserInternalId={currentUserInternalId}>
                  {item.compositionPaths?.length ? <CompositionMechanics paths={item.compositionPaths} compact onPrimitive={(path)=>setNestedPreview({targetType:"PRIMITIVE",targetId:String(path.primitiveId),name:path.primitiveName})} /> : undefined}
                </LibraryCatalogueCard>
              ))}</section>)}
            </div>
          ) : (
            <div className="v12-empty-state"><h3>No entries match</h3><p>Try a different filter, broader search, or another sort.</p></div>
          )}
          </>} />
        </main>
        <div className="v12-library-resizer" role="separator" aria-label="Resize preview column" aria-orientation="vertical" tabIndex={0} aria-valuemin={240} aria-valuemax={640} aria-valuenow={rightWidth} onKeyDown={event => resizeWithKeyboard("right", event)} onPointerDown={(event) => startResize("right", event)} />
        <aside className="v12-library-inspector">
          <button type="button" className="v12-column-toggle v12-column-toggle--right" onClick={() => setRightCollapsed((value) => !value)} aria-label={rightCollapsed ? "Expand preview column" : "Collapse preview column"}>{rightCollapsed ? "‹" : "›"}</button>
          <div className="v12-section-head">
            <div>
              <p className="v12-kicker">Exact entry preview</p>
              <h2>{selectedItem?.name ?? "Select an entry"}</h2>
            </div>
            {selectedItem ? (
              <button
                type="button"
                className="v12-metal-button"
                onClick={() => setDetailOpen(true)}
                aria-label="Open full preview"
              >
                ↗
              </button>
            ) : null}
          </div>
          <div className="v12-inspector-body">
            {selectedItem ? (
              <>
                <div className="v12-inspect-orbit" aria-hidden="true">
                  <span><LibraryEntityIcon item={selectedItem} size={40} /></span>
                </div>
                <div className="v12-inspector-tags">
                  <span className={`v12-tag ${libraryOrigin(selectedItem) === "community" ? "v12-tag--violet" : "v12-tag--teal"}`}>
                    {primitiveStatus(selectedItem)}
                  </span>
                  <span className="v12-tag">
                    {selectedItem.category?.replaceAll("_", " ") ??
                      selectedItem.targetType.replaceAll("_", " ")}
                  </span>
                  <span className="v12-tag v12-tag--teal">
                    {selectedItem.buCost ?? 0} BU
                  </span>
                </div>
                {selectedItem.targetType === "MONSTER" ? <MonsterTemplatePreview key={selectedItem.id} id={selectedItem.targetId} compact /> : null}
                {selectedItem.mechanicalDescription ? <div className="v12-rule" data-readable-rule>
                  <Markdown>{selectedItem.mechanicalDescription}</Markdown>
                </div> : null}
                <dl className="v12-inspector-facts">
                  <div><dt>Source</dt><dd>{libraryOrigin(selectedItem) === "system" ? "SYSTEM" : selectedItem.authorUsername ?? "Community"}</dd></div>
                  {selectedItem.versionNumber ? <div><dt>Version</dt><dd>v{selectedItem.versionNumber}</dd></div> : null}
                  {selectedItem.familyLabel ? <div><dt>Family</dt><dd>{selectedItem.familyLabel}</dd></div> : null}
                  {selectedItem.groupKey ? <div><dt>Expression</dt><dd>{selectedItem.groupKey}</dd></div> : null}
                  {selectedItem.directForkCount !== undefined ? <div><dt>Lineage</dt><dd>{selectedItem.directForkCount} direct · {selectedItem.descendantCount ?? 0} descendants</dd></div> : null}
                </dl>
                {["ITEM", "CAPABILITY", "EFFECT", "LINEAGE_TEMPLATE", "UPBRINGING_TEMPLATE", "MANIFEST_TEMPLATE"].includes(selectedItem.targetType) ? (
                  <FetchedEntityPreview inspector key={selectedItem.id} targetType={selectedItem.targetType} targetId={selectedItem.targetId} onSubLinkClick={link => setNestedPreview({ targetType: link.targetType, targetId: link.targetId, name: link.label })} />
                ) : null}
                {selectedItem.targetType === "PRIMITIVE" && selectedItem.verboseDescription && selectedItem.verboseDescription !== selectedItem.mechanicalDescription ? (
                  <section className="v12-inspector-section"><h3>Design meaning</h3><Markdown>{selectedItem.verboseDescription}</Markdown></section>
                ) : null}
                {selectedItem.targetType === "PRIMITIVE" && selectedItem.tags.length ? <section className="v12-inspector-section"><h3>Tags</h3><div className="v12-inspector-tags">{selectedItem.tags.map((tag) => <span className="v12-tag" key={tag}>{tag}</span>)}</div></section> : null}
                {selectedItem.targetType!=="MONSTER"&&<LibraryProvenance targetType={selectedItem.targetType} targetId={selectedItem.targetId} name={selectedItem.name} author={libraryAuthorLabel(selectedItem)} />}
                <div className="v12-inspector-actions pt-3">
                  <a
                    href={selectedItem.targetType==="MONSTER"?`/monsters/${selectedItem.targetId}`:selectedItem.definitionKind === "TEMPLATE"
                      ? `/atelier?build=primitive&new=1&specialize=${selectedItem.targetId}`
                      : `/atelier?build=${atelierBuildForTarget(selectedItem.targetType)}&edit=${selectedItem.targetId}&intent=load`}
                    className="v12-metal-button v12-metal-button--primary"
                  >
                    {selectedItem.targetType === "MONSTER" ? "Open creature sheet" : selectedItem.definitionKind === "TEMPLATE" ? "Specialize" : "Use exact entry"}
                  </a>
                  {selectedForkTarget ? (
                    <a
                      href={`${selectedForkTarget.sandboxPath}${selectedForkTarget.search}`}
                      className="v12-metal-button"
                    >
                      {selectedItem.definitionKind === "TEMPLATE" ? "Specialize this version" : "Fork this entry"}
                    </a>
                  ) : null}
                </div>
                <div className="v12-inspector-engagement space-y-3 py-3">
                  <LikeForkBar
                    targetType={selectedItem.targetType}
                    targetId={selectedItem.targetId}
                    initialLikes={selectedItem.likesCount}
                    initialDislikes={selectedItem.dislikesCount}
                    initialForks={selectedItem.forkCount}
                    initialUserReaction={selectedItem.viewerReaction !== undefined ? selectedItem.viewerReaction : engagement.reactions[selectedItem.id] ?? null}
                    initialFollowing={selectedItem.viewerFollowing ?? (selectedItem.authorId ? engagement.following[selectedItem.authorId] : false) ?? false}
                    authorId={selectedItem.authorId}
                    authorUsername={libraryOrigin(selectedItem) === "system" ? null : selectedItem.authorUsername}
                    currentUserId={currentUserInternalId}
                  />
                  <PreviewFlagSummary targetType={selectedItem.targetType} targetId={selectedItem.targetId} />
                </div>
                <div className="v12-inspector-actions v12-inspector-reference-actions border-t border-border pt-3">
                  <a href={selectedItem.targetType==="MONSTER"?`/monsters/${selectedItem.targetId}`:`/library/item/${selectedItem.id}`} className="v12-metal-button gap-1.5 text-[11px]"><ExternalLink className="size-3.5 shrink-0" />Source</a>
                  {selectedItem.targetType!=="MONSTER"&&<ForkMapButton key={selectedItem.id}
                    targetType={selectedItem.targetType}
                    targetId={selectedItem.targetId}
                    targetName={selectedItem.name}
                  />}
                  <a className="v12-metal-button gap-1.5 text-[11px]" href={selectedItem.targetType==="MONSTER"?`/monsters/${selectedItem.targetId}`:`/library/item/${selectedItem.id}/versions`}><History className="size-3.5 shrink-0" />Versions</a>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                Choose a row to inspect its exact rule, author, cost, and fork
                lineage here.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Iframe detail modal — renders the full canonical detail page when
          the user taps a row. ESC / backdrop / close button dismiss. */}
      <DetailModal
        isOpen={detailOpen && selectedItem !== null}
        onClose={() => setDetailOpen(false)}
        title={selectedItem?.name ?? ""}
        size="xl"
      >
        {selectedItem ? (
          <div className="v12-library-modal-layout">{selectedItem.targetType==="MONSTER"?<MonsterTemplatePreview key={selectedItem.id} id={selectedItem.targetId}/>:<FetchedEntityPreview key={selectedItem.id} targetType={selectedItem.targetType} targetId={selectedItem.targetId} owner={{ authorId:selectedItem.authorId, authorUsername:libraryOrigin(selectedItem) === "system" ? null : selectedItem.authorUsername, authorDisplayName:libraryOrigin(selectedItem) === "system" ? null : selectedItem.authorDisplayName, isOwner:selectedItem.authorId === currentUserInternalId, sourceOrigin:libraryOrigin(selectedItem) === "system" ? "SRD" : selectedItem.sourceOrigin }} />}</div>
        ) : null}
      </DetailModal>
      <DetailModal
        isOpen={nestedPreview !== null}
        onClose={() => setNestedPreview(null)}
        title={nestedPreview?.name ?? "Entry"}
        size="xl"
      >
        {nestedPreview ? (
          <div className="v12-nested-preview">
            <FetchedEntityPreview targetType={nestedPreview.targetType} targetId={nestedPreview.targetId} />
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}
