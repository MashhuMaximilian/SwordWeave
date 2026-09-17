"use client";

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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { FetchedEntityPreview } from "@/components/preview/entity-preview";
import { DetailModal } from "@/components/ui/detail-modal";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import type {
  LibraryCompositionPath,
  LibraryItem,
  PrimitiveFamilyTier,
} from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "@/components/library/library-table";
import type { LibraryToolbarState } from "@/components/library/library-toolbar";
import {
  LibraryMarketRail,
  libraryFamilyLabel,
} from "@/components/library/library-market-rail";
import { LibraryProvenance } from "./library-provenance";
import { ForkMapButton } from "@/components/engagement/fork-map-button";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { PreviewFlagSummary } from "@/components/engagement/flags-section";
import { IconDisplay } from "@/components/icons/icon-display";
import { buildSandboxUrl } from "@/lib/publishing/fork-target";
import { Markdown } from "@/components/ui/markdown";

const ENTITY_ICONS: Record<string, string> = {
  PRIMITIVE: "delapouite/cube",
  EFFECT: "lorc/cubes",
  CAPABILITY: "lorc/cubeforce",
  LINEAGE_TEMPLATE: "lorc/dna2",
  UPBRINGING_TEMPLATE: "delapouite/plant-roots",
  MANIFEST_TEMPLATE: "caro-asercion/tarot-11-justice",
  ITEM: "lorc/battle-gear",
};

function LibraryEntityIcon({ item, size = 24 }: { item: LibraryItem; size?: number }) {
  return <IconDisplay
    iconSource={item.iconSource ?? "GAME_ICONS"}
    iconKey={item.iconSource ? item.iconKey : ENTITY_ICONS[item.targetType] ?? "delapouite/cube"}
    iconUrl={item.iconUrl}
    iconColor={item.iconSource ? item.iconColor : "#64c7c1"}
    size={size}
    alt=""
  />;
}

function CompositionMechanics({
  paths,
  compact = false,
  onPrimitive,
  onContainer,
}: {
  paths: LibraryCompositionPath[];
  compact?: boolean;
  onPrimitive?: (path: LibraryCompositionPath) => void;
  onContainer?: (container: LibraryCompositionPath["containers"][number]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? paths : paths.slice(0, compact ? 3 : paths.length);
  const containersFor = (path: LibraryCompositionPath) => path.path.slice(2, -2);
  const nestingLabel = (path: LibraryCompositionPath) => containersFor(path).length ? "Nested" : "Direct";
  const groupLabel = (path: LibraryCompositionPath) => path.containers.length
    ? `Inside ${path.containers.map(container=>`${container.targetType === "CAPABILITY" ? "Capability" : "Effect"} · ${container.name}`).join(" → ")}`
    : "Direct primitives";
  const groups = visible.reduce<Array<{label:string;containers:LibraryCompositionPath["containers"];items:Array<{path:LibraryCompositionPath;index:number}>}>>((all,path,index) => {
    const label=groupLabel(path); const found=all.find(group=>group.label===label);
    if(found) found.items.push({path,index}); else all.push({label,containers:path.containers,items:[{path,index}]}); return all;
  },[]);
  return (
    <div className={compact ? "v12-composition-list is-compact" : "v12-composition-list"}>
      {groups.map((group) => <section className="v12-composition-group" key={group.label}>
        {!compact ? <h4>{group.containers.length ? <>{"Inside "}{group.containers.map((container,index)=><span key={`${container.targetType}:${container.targetId}`}><button type="button" className="v12-composition-container-link" onClick={(event)=>{event.stopPropagation();onContainer?.(container);}}>{container.targetType === "CAPABILITY" ? "Capability" : "Effect"} · {container.name}</button>{index < group.containers.length-1 ? " → " : ""}</span>)}</> : group.label}</h4> : null}
        {group.items.map(({path,index}) => <button
          type="button"
          key={`${path.primitiveId}:${path.path.join(":")}:${index}`}
          onClick={(event) => { event.stopPropagation(); onPrimitive?.(path); }}
          className="v12-composition-mechanic"
          aria-label={`Inspect ${path.primitiveName}`}
        >
          {compact ? <span className="v12-composition-path">{nestingLabel(path)}</span> : null}
          {!compact ? <strong>{path.primitiveName}</strong> : null}
          <Markdown className="v12-composition-copy">{path.mechanicalDescription}</Markdown>
        </button>)}
      </section>)}
      {compact && paths.length > 3 ? (
        <button type="button" className="v12-show-mechanics" onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}>
          {expanded ? "Show less" : `Show all ${paths.length} mechanics`}
        </button>
      ) : null}
    </div>
  );
}

function primitiveStatus(item: LibraryItem) {
  if (item.definitionKind === "TEMPLATE") return "Template";
  return libraryOrigin(item) === "system" ? "Canonical" : "Community";
}

interface Props {
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
  const router = useRouter();
  const [selection, setSelectedItem] = useState<LibraryItem | null>(
    initialItems[0] ?? null,
  );
  const selectedItem = initialItems.find(item => item.id === selection?.id) ?? initialItems[0] ?? null;
  const selectedForkTarget = selectedItem
    ? buildSandboxUrl(selectedItem.targetType, selectedItem.targetId, "fork")
    : null;
  const [detailOpen, setDetailOpen] = useState(false);
  const [nestedPreview, setNestedPreview] = useState<{targetType:string;targetId:string;name:string} | null>(null);
  const [familyExpanded, setFamilyExpanded] = useState(true);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(270);
  const [rightWidth, setRightWidth] = useState(330);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const state = useMemo<LibraryToolbarState>(() => initialState, [initialState]);
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
      if (next.typeFilter !== "ALL") params.set("type", next.typeFilter);
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
      const nextPage = overridePage ?? 0;
      if (nextPage > 0) params.set("page", String(nextPage));
      const qs = params.toString();
      router.push(qs ? `/library/browse?${qs}` : "/library/browse");
    },
    [router],
  );

  const onStateChange = useCallback(
    (next: LibraryToolbarState) => {
      pushUrl(next, 0);
    },
    [pushUrl],
  );

  const onPageChange = useCallback(
    (newPage: number) => {
      pushUrl(state, newPage);
    },
    [pushUrl, state],
  );

  // When the user clicks a row, open the iframe detail modal.
  const onRowSelect = useCallback((item: LibraryItem) => {
    setSelectedItem(item);
    if (typeof window !== "undefined" && window.innerWidth < 1050) {
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
          forceExpandFilters
        />
      </div>
    ),
    [state, onStateChange, primitiveCategories, itemTags, activeTags],
  );
  useFilterSlot(filterPanelContent);

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
      const move = (pointer: PointerEvent) => {
        if (side === "left") {
          setLeftCollapsed(false);
          setLeftWidth(Math.max(190, Math.min(430, pointer.clientX - frame.left)));
        } else {
          setRightCollapsed(false);
          setRightWidth(Math.max(240, Math.min(480, frame.right - pointer.clientX)));
        }
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop, { once: true });
    },
    [],
  );

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
        {isPrimitiveMode ? <div className="v12-library-resizer" role="separator" aria-label="Resize category column" onPointerDown={(event) => startResize("left", event)} /> : null}
        <main className="v12-library-results min-h-0">
          <section className={`v12-family-panel${familyExpanded ? " is-expanded" : " is-collapsed"}`} aria-label="Selected market family">
          <div className="v12-market-hero">
            <div>
              <p className="v12-kicker">Lexicon category · canonical family</p>
              <h2>
                {effectiveCategoryLabel ||
                  (state.typeFilter === "ALL"
                    ? "The complete SwordWeave corpus"
                    : state.typeFilter.replaceAll("_", " ").toLowerCase())}
              </h2>
              <p>
                {isPrimitiveMode && effectiveCategory ? "The rows define canonical tiers. Creating here opens the general primitive author with this family prefilled." : "Browse exact versions, inspect provenance, and carry the chosen record into the Atelier without losing its source lineage."}
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
          {familyExpanded && effectiveCategory && isPrimitiveMode && familyTiers.length ? (
            <div className="v12-tier-ladder" aria-label="Canonical cost tiers">
              {familyTiers.map((tier) => (
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
            <div>
              <p className="v12-kicker">Exact entries</p>
              <h3>Canonical references and community expressions</h3>
            </div>
            <span>{total.toLocaleString()} records</span>
          </div>
          <div className="v12-browse-controls">
            {isPrimitiveMode ? <div className="v12-tier-tabs" aria-label="Exact entry tiers">{["", "1", "2", "3", "4", "5"].map(tier => <button key={tier} type="button" aria-pressed={(state.tier ?? "") === tier} onClick={() => onStateChange({ ...state, tier })}>{tier ? `Tier ${["", "I", "II", "III", "IV", "V"][Number(tier)]}` : "All tiers"}</button>)}</div> : null}
            <div className="v12-origin-tabs" aria-label="Entry origin">{(["all", "system", "community"] as const).map(origin => <button type="button" key={origin} aria-pressed={(state.origin ?? "all") === origin} onClick={() => onStateChange({ ...state, origin })}>{origin === "all" ? "All origins" : origin === "system" ? "System" : "Community"}</button>)}</div>
          </div>
          {initialItems.length ? (
            <div className={isPrimitiveMode ? "v12-cluster-list" : "v12-creation-grid"}>
              {[{ id: isPrimitiveMode ? "primitives" : "creations", entries: initialItems }].map(({ id, entries }) => <section className={`v12-entry-cluster${isPrimitiveMode ? " is-flat" : ""}`} key={id}>{entries.map((item) => (
                <article
                  key={item.id}
                  data-library-row-id={item.id}
                  className={`v12-entry-row${selectedItem?.id === item.id ? " is-selected" : ""}`}
                  onClick={() => onRowSelect(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowSelect(item);
                    }
                  }}
                >
                  <span className="v12-entry-glyph" aria-hidden="true"><LibraryEntityIcon item={item} /></span>
                  <div className="v12-entry-copy">
                    <div className="v12-entry-title-line">
                      <h3>{item.name}</h3>
                      <span className={`v12-tag ${libraryOrigin(item) === "community" ? "v12-tag--violet" : "v12-tag--teal"}`}>
                        {primitiveStatus(item)}
                      </span>
                    </div>
                    {item.compositionPaths?.length ? (
                      <CompositionMechanics paths={item.compositionPaths} compact onPrimitive={(path)=>setNestedPreview({targetType:"PRIMITIVE",targetId:String(path.primitiveId),name:path.primitiveName})} />
                    ) : <>
                      {item.mechanicalDescription ? <Markdown className="v12-entry-mechanical" data-readable-rule>{item.mechanicalDescription}</Markdown> : null}
                      {item.description ? <Markdown className="v12-entry-summary">{item.description}</Markdown> : null}
                    </>}
                    <div className="v12-entry-lineage">
                      <span>{libraryAuthorLabel(item)}{item.versionNumber ? ` · v${item.versionNumber}` : ""}{item.descendantCount ? ` · ${item.descendantCount} descendants` : ""}</span>
                      <div onClick={(event) => event.stopPropagation()}>
                        <LikeForkBar
                          targetType={item.targetType}
                          targetId={item.targetId}
                          initialLikes={item.likesCount}
                          initialDislikes={item.dislikesCount}
                          initialForks={item.forkCount}
                          initialUserReaction={engagement.reactions[item.id] ?? null}
                          initialFollowing={engagement.following[item.id] ?? false}
                          authorId={item.authorId}
                          authorUsername={libraryOrigin(item) === "system" ? null : item.authorUsername}
                          currentUserId={currentUserInternalId}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                  <span className="v12-tag">{item.buCost ?? 0} BU</span>
                </article>
              ))}</section>)}
            </div>
          ) : (
            <div className="v12-empty-state"><h3>No entries match</h3><p>Try a different filter, broader search, or another sort.</p></div>
          )}
          {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} /> : null}
        </main>
        <div className="v12-library-resizer" role="separator" aria-label="Resize preview column" onPointerDown={(event) => startResize("right", event)} />
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
                {selectedItem.compositionPaths?.length ? (
                  <section className="v12-inspector-section">
                    <h3>Complete composition</h3>
                    <CompositionMechanics paths={selectedItem.compositionPaths} onPrimitive={(path)=>setNestedPreview({targetType:"PRIMITIVE",targetId:String(path.primitiveId),name:path.primitiveName})} onContainer={(container)=>setNestedPreview({targetType:container.targetType,targetId:container.targetId,name:container.name})} />
                  </section>
                ) : null}
                {selectedItem.verboseDescription && selectedItem.verboseDescription !== selectedItem.mechanicalDescription ? (
                  <section className="v12-inspector-section"><h3>Design meaning</h3><Markdown>{selectedItem.verboseDescription}</Markdown></section>
                ) : null}
                {selectedItem.tags.length ? <section className="v12-inspector-section"><h3>Tags</h3><div className="v12-inspector-tags">{selectedItem.tags.map((tag) => <span className="v12-tag" key={tag}>{tag}</span>)}</div></section> : null}
                <LibraryProvenance targetType={selectedItem.targetType} targetId={selectedItem.targetId} name={selectedItem.name} author={libraryAuthorLabel(selectedItem)} />
                <div className="v12-inspector-actions">
                  <a
                    href={selectedItem.definitionKind === "TEMPLATE"
                      ? `/atelier?build=primitive&new=1&specialize=${selectedItem.targetId}`
                      : `/atelier?build=${atelierBuildForTarget(selectedItem.targetType)}&edit=${selectedItem.targetId}&intent=load`}
                    className="v12-metal-button v12-metal-button--primary"
                  >
                    {selectedItem.definitionKind === "TEMPLATE" ? "Specialize" : "Use exact entry"}
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
                <div className="v12-inspector-engagement space-y-3 pb-4">
                  <LikeForkBar
                    targetType={selectedItem.targetType}
                    targetId={selectedItem.targetId}
                    initialLikes={selectedItem.likesCount}
                    initialDislikes={selectedItem.dislikesCount}
                    initialForks={selectedItem.forkCount}
                    initialUserReaction={engagement.reactions[selectedItem.id] ?? null}
                    initialFollowing={engagement.following[selectedItem.id] ?? false}
                    authorId={selectedItem.authorId}
                    authorUsername={libraryOrigin(selectedItem) === "system" ? null : selectedItem.authorUsername}
                    currentUserId={currentUserInternalId}
                  />
                  <PreviewFlagSummary targetType={selectedItem.targetType} targetId={selectedItem.targetId} />
                </div>
                <div className="v12-inspector-actions border-t border-border pt-3">
                  <a href={`/library/item/${selectedItem.id}`} className="v12-metal-button">Source</a>
                  <ForkMapButton key={selectedItem.id}
                    targetType={selectedItem.targetType}
                    targetId={selectedItem.targetId}
                    targetName={selectedItem.name}
                  />
                  <a className="v12-metal-button" href={`/library/item/${selectedItem.id}/versions`}>Versions</a>
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
          <div className="v12-library-modal-layout"><FetchedEntityPreview key={selectedItem.id} targetType={selectedItem.targetType} targetId={selectedItem.targetId} owner={{ authorId:selectedItem.authorId, authorUsername:libraryOrigin(selectedItem) === "system" ? null : selectedItem.authorUsername, authorDisplayName:libraryOrigin(selectedItem) === "system" ? null : selectedItem.authorDisplayName, isOwner:selectedItem.authorId === currentUserInternalId, sourceOrigin:libraryOrigin(selectedItem) === "system" ? "system" : selectedItem.sourceOrigin }} /></div>
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

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      {page > 0 ? (
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Previous
        </button>
      ) : (
        <span />
      )}
      <span className="text-xs text-muted-foreground">
        Page {page + 1} of {totalPages} ({total.toLocaleString()} total)
      </span>
      {page + 1 < totalPages ? (
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          className="text-muted-foreground hover:text-foreground"
        >
          Next →
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
