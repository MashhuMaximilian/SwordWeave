"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, PawPrint } from "lucide-react";
import { IconDisplay } from "@/components/icons/icon-display";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { LibraryCatalogueSurface } from "@/components/library/library-catalogue-card";
import { Markdown } from "@/components/ui/markdown";
import type { CharacterCompanionPickerEntry, CharacterCompanionPickerPage } from "@/lib/character/companion-types";
import { CHARACTER_SIZES } from "@/lib/heritage/lineage-size";
import { readJsonResponse } from "@/lib/http/read-json-response";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import "./companion-bestiary-picker.css";

const EMPTY_FILTERS = { size: "", origin: "", maxBudget: "", sort: "name" };
type SearchResult = {
  criteria: string;
  request: string;
  items: CharacterCompanionPickerEntry[];
  nextOffset: number | null;
  error: string;
};

function MonsterCard({ monster, selected, view, onChoose }: {
  monster: CharacterCompanionPickerEntry;
  selected: boolean;
  view: LibraryView;
  onChoose: () => void;
}) {
  const compact = view === "LIST";
  const details = [
    monster.size?.toLowerCase(),
    monster.habitat,
    monster.role,
    `${monster.vitality} Vitality`,
    `v${monster.version}`,
  ].filter(Boolean).join(" · ");
  const originLabel = monster.origin === "system" ? "Canonical" : "Community";
  return (
    <LibraryCatalogueSurface
      className={compact ? "sw-catalogue-row" : "sw-catalogue-grid-card sw-companion-picker-card"}
      rowId={`MONSTER:${monster.id}`}
      selected={selected}
      onSelect={onChoose}
      title={monster.name}
      actionLabel={`Choose ${monster.name}`}
      glyph={monster.imageUrl
        ? <IconDisplay portraitUrl={monster.imageUrl} size={compact ? 34 : 48} alt="" />
        : <PawPrint size={compact ? 20 : 26} />}
      status={compact ? null : <span className={`v12-tag ${monster.origin === "system" ? "v12-tag--teal" : "v12-tag--violet"}`}>{originLabel}</span>}
      badge={compact
        ? <span className="sw-catalogue-row-end"><b>{monster.budget} BU</b><ArrowUpRight size={14} aria-hidden="true" /></span>
        : <span className="v12-tag">{monster.budget} BU</span>}
    >
      {monster.description && <Markdown inline className={compact ? "sw-catalogue-row-summary" : "v12-entry-summary"}>{monster.description}</Markdown>}
      <p className={compact ? "sw-catalogue-row-meta" : "v12-entry-lineage"}><span>{compact && `${originLabel} · `}{details}</span></p>
    </LibraryCatalogueSurface>
  );
}

export function CompanionBestiaryPicker({ endpoint, canAdd, onAdd, renderBestiaryLink }: {
  endpoint: string;
  canAdd: boolean;
  onAdd: (selected: CharacterCompanionPickerEntry, name: string) => Promise<boolean>;
  renderBestiaryLink: (monster: CharacterCompanionPickerEntry) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<LibraryView>("GRID");
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<SearchResult>();
  const [selected, setSelected] = useState<CharacterCompanionPickerEntry | null>(null);
  const [name, setName] = useState("");
  const placement = useRef<HTMLFormElement>(null);
  const filterId = useId();
  const criteria = new URLSearchParams({
    picker: "1", q: query.trim(), size: filters.size, origin: filters.origin,
    maxBudget: filters.maxBudget, sort: filters.sort,
  }).toString();
  const request = `${criteria}&offset=${offset}`;
  const current = results?.criteria === criteria ? results : undefined;
  const loading = current?.request !== `${request}:${attempt}`;
  const hasFilters = filters.size !== "" || filters.origin !== "" || filters.maxBudget !== "" || filters.sort !== "name";

  useEffect(() => {
    const controller = new AbortController();
    async function loadPage() {
      const key = `${request}:${attempt}`;
      try {
        const response = await fetch(`${endpoint}?${request}`, { signal: controller.signal, cache: "no-store" });
        const data = await readJsonResponse<Partial<CharacterCompanionPickerPage> & { error?: string }>(response);
        if (!response.ok || !Array.isArray(data.candidates)) throw new Error(data.error || "Unable to load the Bestiary.");
        const incoming = data.candidates;
        const nextOffset = typeof data.nextOffset === "number" && Number.isSafeInteger(data.nextOffset) && data.nextOffset > offset ? data.nextOffset : null;
        if (controller.signal.aborted) return;
        setResults(previous => {
          const preceding = offset > 0 && previous?.criteria === criteria ? previous.items : [];
          const merged = new Map([...preceding, ...incoming].map(item => [item.id, item]));
          return { criteria, request: key, items: [...merged.values()], nextOffset, error: "" };
        });
      } catch (cause) {
        if (!controller.signal.aborted) setResults(previous => ({
          criteria, request: key, items: offset > 0 && previous?.criteria === criteria ? previous.items : [], nextOffset: null,
          error: cause instanceof Error ? cause.message : "Unable to load the Bestiary.",
        }));
      }
    }
    void loadPage();
    return () => controller.abort();
  }, [endpoint, criteria, offset, request, attempt]);

  const search = useCallback((value: string) => { setQuery(value); setOffset(0); }, []);

  function updateFilter(field: keyof typeof EMPTY_FILTERS, value: string) {
    setFilters(previous => ({ ...previous, [field]: value }));
    setOffset(0);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setOffset(0);
  }

  function choose(monster: CharacterCompanionPickerEntry) {
    if (selected?.id !== monster.id || selected.version !== monster.version) setName("");
    setSelected(monster);
    window.requestAnimationFrame(() => placement.current?.focus({ preventScroll: false }));
  }

  return (
    <section className="sheet-build-library v12-source-browser sw-companion-picker space-y-3" aria-label="Bestiary picker">
      <div className="v12-source-search">
        <ColumnSearchBar search={query} onSearchChange={search} placeholder="Search by monster, role, or habitat…" label="Search Bestiary" maxLength={120}
          view={view} onViewChange={setView} onOpenFilters={() => setFiltersOpen(value => !value)}
          hasActiveFilters={hasFilters} filtersExpanded={filtersOpen} filtersControls={filterId} />
      </div>
      <div id={filterId} className="sw-companion-picker-filters" hidden={!filtersOpen} role="group" aria-label="Bestiary filters">
        <label>Size<select value={filters.size} onChange={event => updateFilter("size", event.target.value)}>
          <option value="">All sizes</option>
          {CHARACTER_SIZES.map(size => <option key={size} value={size}>{size[0] + size.slice(1).toLowerCase()}</option>)}
        </select></label>
        <label>Source<select value={filters.origin} onChange={event => updateFilter("origin", event.target.value)}>
          <option value="">All sources</option><option value="system">System / SRD</option><option value="community">Community</option>
        </select></label>
        <label>Maximum BU<input type="number" min="0" step="1" max={Number.MAX_SAFE_INTEGER} placeholder="Any budget"
          value={filters.maxBudget} onChange={event => updateFilter("maxBudget", event.target.value)} /></label>
        <label>Sort by<select value={filters.sort} onChange={event => updateFilter("sort", event.target.value)}>
          <option value="name">Name A–Z</option><option value="budget">BU low to high</option>
        </select></label>
        {hasFilters && <button type="button" className="sheet-button" onClick={clearFilters}>Clear filters</button>}
      </div>
      {selected && (
        <form ref={placement} tabIndex={-1} className="sw-companion-picker-selection"
          aria-label={`Add ${selected.name} as a companion`} onSubmit={event => {
            event.preventDefault();
            if (!canAdd) return;
            void onAdd(selected, name.trim() || selected.name).then(added => {
              if (added) { setName(""); setSelected(null); }
            });
          }}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div><h3>{selected.name}</h3><p>{selected.vitality} Vitality · {selected.budget} BU · v{selected.version}</p></div>
            {renderBestiaryLink(selected)}
          </div>
          <label>Companion name (optional)<input maxLength={120} value={name}
            placeholder={selected.name} onChange={event => setName(event.target.value)} /></label>
          <button type="submit" className="sheet-button is-gold justify-self-start" disabled={!canAdd}>Add to draft</button>
        </form>
      )}
      <div className="min-w-0" aria-busy={loading}>
        <div className={view === "GRID" ? "v12-creation-grid sw-companion-picker-grid" : "sw-catalogue-list"}>
          {current?.items.map(monster => <MonsterCard key={monster.id} monster={monster} view={view}
            selected={selected?.id === monster.id} onChoose={() => choose(monster)} />)}
        </div>
        <div className="sheet-library-status">
          {loading ? <p role="status">{offset ? "Loading more monsters…" : "Searching Bestiary…"}</p>
            : current?.error ? <div role="alert">{current.error} <button type="button" className="sheet-button" onClick={() => setAttempt(count => count + 1)}>Retry</button></div>
            : current?.nextOffset != null ? <button type="button" className="sheet-button" onClick={() => setOffset(current.nextOffset!)}>Show more monsters</button>
            : !current?.items.length ? <div className="sheet-library-empty">
              <strong>No matching monsters</strong>
              {query.trim() && <button type="button" className="sheet-button ml-2" onClick={() => search("")}>Clear search</button>}
              {hasFilters && <button type="button" className="sheet-button ml-2" onClick={clearFilters}>Clear filters</button>}
            </div>
            : null}
        </div>
      </div>
    </section>
  );
}
