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

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { DetailModal } from "@/components/ui/detail-modal";
import { useFilterSlot } from "@/components/layout/right-filter-panel";
import { useGlobalControls } from "@/components/layout/global-controls";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "@/components/library/library-table";
import type { LibraryToolbarState } from "@/components/library/library-toolbar";
import {
  LibraryMarketRail,
  libraryFamilyLabel,
} from "@/components/library/library-market-rail";
import { ForkMapButton } from "@/components/engagement/fork-map-button";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";

interface Props {
  initialItems: LibraryItem[];
  total: number;
  page: number;
  totalPages: number;
  initialState: LibraryToolbarState;
  primitiveCategories: Array<{ value: string; label: string; count: number }>;
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
  itemTags = [],
  activeTags = [],
  engagement,
  currentUserInternalId,
}: Props) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(
    initialItems[0] ?? null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(270);
  const [rightWidth, setRightWidth] = useState(330);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const state = useMemo<LibraryToolbarState>(() => initialState, [initialState]);
  const isPrimitiveMode =
    state.typeFilter === "PRIMITIVE" || state.typeFilter === "ALL";
  const effectiveCategory = isPrimitiveMode
    ? state.category || selectedItem?.category || ""
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

  return (
    <div className="v12-library-browser flex h-full min-h-0 flex-col" data-library-surface>
      <div className="v12-library-search shrink-0">
        <ColumnSearchBar
          search={state.search}
          onSearchChange={(s: string) =>
            onStateChange({ ...state, search: s })
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
        <main className="v12-library-results min-h-0 overflow-auto">
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
                Browse exact versions, inspect provenance, and carry the chosen
                record into the Atelier without losing its source lineage.
              </p>
            </div>
            {isPrimitiveMode && effectiveCategory ? (
              <a
                href={`/atelier?build=primitive&new=1&category=${encodeURIComponent(effectiveCategory)}`}
                className="v12-metal-button v12-metal-button--primary"
              >
                + Create primitive
              </a>
            ) : null}
          </div>
          {effectiveCategory && isPrimitiveMode ? (
            <div className="v12-tier-ladder" aria-label="Canonical cost tiers">
              {[4, 8, 12, 16].map((bu, index) => (
                <div key={bu}>
                  <span>T{index + 1}</span>
                  <b>{["Concrete / minor", "Systemic / standard", "Abstract / major", "Reality-defining"][index]}</b>
                  <em>{bu} BU</em>
                </div>
              ))}
            </div>
          ) : null}
          {effectiveCategory && isPrimitiveMode ? (
            <aside className="v12-family-note">
              <span aria-hidden="true">⌘</span>
              <div>
                <h3>How this family stays organized</h3>
                <p>
                  Family → canonical tier → normalized key → exact public expression.
                  Names never decide grouping; every fork keeps its pinned source path.
                </p>
              </div>
            </aside>
          ) : null}
          <div className="v12-results-heading">
            <div>
              <p className="v12-kicker">Exact entries</p>
              <h3>Canonical references and community expressions</h3>
            </div>
            <span>{total.toLocaleString()} records</span>
          </div>
          {initialItems.length ? (
            <div className={isPrimitiveMode ? "v12-cluster-list" : "v12-creation-grid"}>
              {initialItems.map((item) => (
                <article
                  key={item.id}
                  data-library-row-id={item.id}
                  className={`v12-entry-row${selectedItem?.id === item.id ? " is-selected" : ""}`}
                  onClick={() => onRowSelect(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowSelect(item);
                    }
                  }}
                >
                  <span className="v12-entry-glyph" aria-hidden="true">◇</span>
                  <div className="v12-entry-copy">
                    <div className="v12-entry-title-line">
                      <h3>{item.name}</h3>
                      <span className={`v12-tag ${item.authorUsername ? "v12-tag--violet" : "v12-tag--teal"}`}>
                        {item.authorUsername ? "Community" : "Canonical"}
                      </span>
                    </div>
                    <p data-readable-rule>{item.description || "No public description."}</p>
                    <div className="v12-entry-lineage">
                      <span>{item.authorDisplayName ?? item.authorUsername ?? "System"}</span>
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
                          authorUsername={item.authorUsername}
                          currentUserId={currentUserInternalId}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                  <span className="v12-tag">{item.buCost ?? 0} BU</span>
                </article>
              ))}
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
                  <span>◇</span>
                </div>
                <div className="v12-inspector-tags">
                  <span className="v12-tag v12-tag--violet">
                    {selectedItem.authorUsername ? "Community" : "Canonical"}
                  </span>
                  <span className="v12-tag">
                    {selectedItem.category?.replaceAll("_", " ") ??
                      selectedItem.targetType.replaceAll("_", " ")}
                  </span>
                  <span className="v12-tag v12-tag--teal">
                    {selectedItem.buCost ?? 0} BU
                  </span>
                </div>
                <div className="v12-rule" data-readable-rule>
                  {selectedItem.description || "No public description."}
                </div>
                <div className="v12-provenance-path">
                  <div><b>Canonical family</b><span>{selectedItem.category?.replaceAll("_", " ") ?? selectedItem.targetType}</span></div>
                  <div><b>Current expression</b><span>{selectedItem.name}</span></div>
                  <div><b>Author</b><span>{selectedItem.authorDisplayName ?? selectedItem.authorUsername ?? "System"}</span></div>
                </div>
                <div className="v12-inspector-actions">
                  <a
                    href={`/atelier?build=${atelierBuildForTarget(selectedItem.targetType)}&edit=${selectedItem.targetId}&intent=load`}
                    className="v12-metal-button v12-metal-button--primary"
                  >
                    Use exact entry
                  </a>
                  <a
                    href={`/library/item/${selectedItem.id}`}
                    className="v12-metal-button"
                  >
                    Source page
                  </a>
                  <ForkMapButton
                    targetType={selectedItem.targetType}
                    targetId={selectedItem.targetId}
                    targetName={selectedItem.name}
                  />
                </div>
                <div className="v12-inspector-engagement">
                  <span>♡ {selectedItem.likesCount}</span>
                  <span>⑂ {selectedItem.forkCount}</span>
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
        size="lg"
      >
        {selectedItem ? (
          // Inline detail preview (was previously an iframe loading
          // /library/item/<id>). The iframe was susceptible to a class
          // of cache/iframe-related rendering issues — and on Vercel
          // + Clerk + iframes, certain request contexts got stuck on
          // a stale DATABASE_URL error even after the server was
          // healthy. Inline rendering eliminates that entire failure
          // mode.
          //
          // The summary shows: name, description, BU, tags, author,
          // engagement counts, and an "Open full page" link for the
          // canonical detail view.
          <div className="space-y-4" data-provenance>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-semibold text-primary">
                {selectedItem.buCost ?? 0} BU
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-wide">
                {selectedItem.targetType.replace(/_/g, " ").toLowerCase()}
              </span>
              {selectedItem.category && (
                <span className="rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-wide">
                  {selectedItem.category.replace(/_/g, " ")}
                </span>
              )}
            </div>
            {selectedItem.description && (
              <div className="text-sm leading-relaxed text-foreground">
                {selectedItem.description}
              </div>
            )}
            {selectedItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {selectedItem.authorUsername && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>by</span>
                <span className="font-semibold">
                  {selectedItem.authorDisplayName ?? selectedItem.authorUsername}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>♥ {selectedItem.likesCount}</span>
              <span>★ {selectedItem.forkCount} forks</span>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <a
                href={`/library/item/${selectedItem.id}`}
                className="v12-metal-button v12-metal-button--primary inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Open full source page →
              </a>
              <ForkMapButton
                targetType={selectedItem.targetType}
                targetId={selectedItem.targetId}
                targetName={selectedItem.name}
              />
            </div>
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
