"use client";

import { useEffect, useRef, useState } from "react";
import { DetailModal } from "@/components/ui/detail-modal";
import { EntityPreview } from "@/components/preview/entity-preview";
import { LibraryTable } from "@/components/library/library-table";
import { InfiniteLibraryResults } from "@/components/library/infinite-library-results";
import { useInfiniteLibrary } from "@/lib/hooks/use-infinite-library";
import { loadEntityPreview, previewKind } from "./workspace/workspace-entity-preview";
import { LibraryDiscoveryFilters, EMPTY_DISCOVERY_FILTERS, discoveryFilterParams } from "./workspace/library-discovery-filters";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { EntityKind } from "@/lib/character/workspace/model";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import "./quickbuild-library-picker.css";

export interface QuickbuildLibraryPickerProps {
  kind: "heritage" | "item";
  heritageKind?: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  selectedId?: string | number | null;
  budget?: number;
  onChoose: (id: string | number, entry?: SandboxPreviewItem) => void;
  onClose: () => void;
}

/** Local desktop and phone focus containment for the two quickbuild dialogs. */
function useQuickbuildDialogFocus(preferSearch = false) {
  const content = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(typeof document === "undefined" ? null : document.activeElement);
  useEffect(() => {
    const dialog = content.current?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const previous = previousFocus.current;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0 && !element.closest('[inert],[aria-hidden="true"]'));
    const frame = requestAnimationFrame(() => {
      const target = preferSearch && !window.matchMedia("(max-width:767px)").matches ? content.current?.querySelector<HTMLElement>('input[type="search"]') : null;
      (target ?? focusable()[0] ?? dialog).focus({ preventScroll: true });
    });
    function containTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialog) return;
      const active = document.activeElement;
      // A nested preview/version dialog manages its own keyboard focus.
      if (active instanceof Element && active.closest('[role="dialog"]') && active.closest('[role="dialog"]') !== dialog) return;
      const controls = focusable();
      const first = controls[0]; const last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey ? active === first || !dialog.contains(active) : active === last || !dialog.contains(active)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", containTab);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", containTab);
      if (previous instanceof HTMLElement && previous.isConnected && (dialog.contains(document.activeElement) || document.activeElement === document.body)) previous.focus({ preventScroll: true });
    };
  }, [preferSearch]);
  return content;
}

function useCanonicalPreview() {
  const [path, setPath] = useState<SandboxPreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const request = useRef(0);
  const lastRequested = useRef<{ kind: EntityKind; id: string; nested: boolean } | null>(null);
  useEffect(() => () => { request.current++; controller.current?.abort(); }, []);
  async function open(kind: EntityKind, id: string, nested = false) {
    lastRequested.current = { kind, id, nested };
    const token = ++request.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true); setError("");
    if (!nested) setPath([]);
    try {
      const item = await loadEntityPreview(kind, id, nextController.signal);
      if (request.current !== token || nextController.signal.aborted) return;
      setPath(previous => nested ? [...previous, item] : [item]);
    } catch (reason) {
      if (request.current === token && !nextController.signal.aborted) setError(reason instanceof Error ? reason.message : "Preview unavailable.");
    } finally { if (request.current === token) setLoading(false); }
  }
  return { path, loading, error, open, retry: () => { const last = lastRequested.current; if (last) void open(last.kind, last.id, last.nested); }, clear: () => { request.current++; controller.current?.abort(); setLoading(false); setError(""); setPath([]); }, back: () => { request.current++; controller.current?.abort(); setLoading(false); setError(""); setPath(previous => previous.slice(0, -1)); } };
}

function CanonicalInspector({ preview }: { preview: ReturnType<typeof useCanonicalPreview> }) {
  const item = preview.path.at(-1);
  return <>
    {preview.loading && <p role="status" className="sw-quickpick-status">Loading complete preview…</p>}
    {preview.error && <p role="alert" className="sw-quickpick-status">{preview.error} <button type="button" onClick={preview.retry}>Retry preview</button></p>}
    {preview.path.length > 1 && <button className="sw-quickpick-back" type="button" onClick={preview.back}>← Back to {preview.path.at(-2)!.row.name}</button>}
    {item ? <EntityPreview item={item} callbacks={{ preferLocalSubLinks: true, onSubLinkClick: link => void preview.open(previewKind(link.targetType), String(link.targetId), true) }} /> : !preview.loading && !preview.error ? <div className="sw-quickpick-empty"><strong>Choose an entry to preview</strong><p>Read its description and complete composition, then confirm your choice.</p></div> : null}
  </>;
}

/** Public library browsing with an explicit choice after inspecting the authoritative entity. */
export function QuickbuildLibraryPicker({ kind, heritageKind = "LINEAGE", selectedId, budget, onChoose, onClose }: QuickbuildLibraryPickerProps) {
  const dialogContent = useQuickbuildDialogFocus(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("BU");
  const [view, setView] = useState<LibraryView>("LIST");
  const [origin, setOrigin] = useState("all");
  const [filters, setFilters] = useState(EMPTY_DISCOVERY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(selectedId == null ? null : `${kind === "heritage" ? `${heritageKind}_TEMPLATE` : "ITEM"}:${selectedId}`);
  const [mobilePreview, setMobilePreview] = useState(false);
  const preview = useCanonicalPreview();
  const label = kind === "item" ? "item" : heritageKind.toLowerCase();
  const filterKey = new URLSearchParams({ targetType: kind === "heritage" ? `${heritageKind}_TEMPLATE` : "ITEM", publicOnly: "1", q: search, sort, origin, ...discoveryFilterParams(filters) }).toString();
  const results = useInfiniteLibrary(filterKey);
  useEffect(() => {
    if (selectedId != null) void preview.open(kind, String(selectedId));
    else preview.clear();
    // The identity props select the initial saved preview; search never changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, heritageKind, selectedId]);
  const candidate = preview.path[0];
  const visibleKind = candidate?.kind === kind && (kind !== "heritage" || (candidate.kind === "heritage" && candidate.row.kind === heritageKind));
  return <DetailModal isOpen onClose={onClose} title={`Choose ${label === "upbringing" || label === "item" ? "an" : "a"} ${label}`} subtitle="Public Library · preview first, then choose" size="xl">
    <div ref={dialogContent} className="sw-quickpick" data-mobile-preview={mobilePreview}>
      <section className="sw-quickpick-catalogue" aria-label={`${label} library`}>
        <div className="sw-quickpick-tools">
          <input type="search" aria-label={`Search ${label} library`} value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${label}s…`} />
          <div className="sw-quickpick-tool-row">
            <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filters & sorting</button>
            <div role="group" aria-label="Library layout"><button type="button" aria-pressed={view === "LIST"} onClick={() => setView("LIST")}>List</button><button type="button" aria-pressed={view === "GRID"} onClick={() => setView("GRID")}>Grid</button></div>
          </div>
          {filtersOpen && <div className="sw-quickpick-filters"><LibraryDiscoveryFilters value={filters} onChange={setFilters} primitive={false} sort={sort} onSortChange={setSort} /><label className="sw-discovery-field"><span>Source</span><select value={origin} onChange={event => setOrigin(event.target.value)}><option value="all">All public sources</option><option value="system">System / SRD</option><option value="community">Community</option></select></label>{budget !== undefined && Number.isFinite(budget) && budget >= 0 && <button type="button" onClick={() => setFilters(previous => ({ ...previous, maxBu: String(budget) }))}>Within {budget} BU</button>}<button type="button" onClick={() => { setSearch(""); setFilters(EMPTY_DISCOVERY_FILTERS); setOrigin("all"); setSort("BU"); }}>Clear filters</button></div>}
          <p className="sw-quickpick-count" aria-live="polite">{results.loading && !results.items.length ? "Finding entries…" : `${results.total} matching entries`}</p>
        </div>
        <div className="sw-quickpick-results v12-source-browser" data-library-view={view}>
          <InfiniteLibraryResults key={filterKey} items={results.items.filter(item => (item.visibility ?? "PUBLIC") === "PUBLIC")} hasMore={results.hasMore} loading={results.loading} error={results.error} loadMore={results.loadMore} retry={results.retry} render={items => <LibraryTable items={items} view={view} engagement={{ reactions: {}, following: {} }} currentUserInternalId={null} selectedKey={selectedLibraryId} surface="atelier" compact={false} onSelect={item => { setSelectedLibraryId(item.id); setMobilePreview(true); requestAnimationFrame(() => { if (window.matchMedia("(max-width:767px)").matches) dialogContent.current?.querySelector<HTMLElement>(".sw-quickpick-mobile-back")?.focus(); }); void preview.open(kind, String(item.targetId)); }} /> } />
          {!results.loading && !results.error && !results.items.length && <p className="sw-quickpick-status">No matches. Try a wider budget or fewer filters.</p>}
        </div>
      </section>
      <aside className="sw-quickpick-inspector" aria-label="Complete library preview">
        <div className="sw-quickpick-command"><button className="sw-quickpick-mobile-back" type="button" onClick={() => { setMobilePreview(false); requestAnimationFrame(() => dialogContent.current?.querySelector<HTMLElement>('input[type="search"]')?.focus()); }}>← Library</button><strong>{candidate?.row.name ?? `Preview ${label}`}</strong><button type="button" className="sw-quickpick-choose" disabled={!candidate || preview.loading || !!preview.error || !visibleKind} onClick={() => { if (candidate && visibleKind) onChoose(candidate.row.id, candidate); }}>Choose {label}</button></div>
        <div className="sw-quickpick-preview"><CanonicalInspector preview={preview} /></div>
      </aside>
    </div>
  </DetailModal>;
}

/** Read-only full preview for an already chosen heritage/item card. */
export function QuickbuildEntityPreviewDialog({ kind, id, onClose }: { kind: "heritage" | "item"; id: string | number; onClose: () => void }) {
  const dialogContent = useQuickbuildDialogFocus();
  const preview = useCanonicalPreview();
  useEffect(() => { void preview.open(kind, String(id)); }, [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <DetailModal isOpen onClose={onClose} title={preview.path[0]?.row.name ?? "Library preview"} size="lg"><div ref={dialogContent} className="sw-quickpick-read-preview"><CanonicalInspector preview={preview} /></div></DetailModal>;
}
