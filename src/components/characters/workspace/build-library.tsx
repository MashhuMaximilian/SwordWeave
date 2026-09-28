"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { FabThemeIcon } from "@/components/layout/fab-theme-icon";
import { useGlobalControls } from "@/components/layout/global-controls";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { LibraryTable } from "@/components/library/library-table";
import { libraryFamilyGlyph } from "@/components/library/library-market-rail";
import { MARKET_FAMILIES } from "@/lib/primitives/canonical-market";
import type { LibraryItem, LibraryTargetType } from "@/lib/publishing/library-query";
import type { EntityKind, EntityKey } from "@/lib/character/workspace/model";
import { matchesDiscoveryDestination, type DiscoveryHeritageCategory } from "@/lib/character/workspace/discovery/compatibility";
import { previewKind } from "./workspace-entity-preview";

const TYPES: [LibraryTargetType, string][] = [["PRIMITIVE", "Primitives"], ["CAPABILITY", "Capabilities"], ["EFFECT", "Effects"], ["LINEAGE_TEMPLATE", "Lineages"], ["UPBRINGING_TEMPLATE", "Upbringings"], ["MANIFEST_TEMPLATE", "Manifests"], ["ITEM", "Items"]];
const EMPTY_ENGAGEMENT = { reactions: {}, following: {} };
const TIERS = ["", "0", "1", "2", "3", "4", "5"];
const ROMAN_TIERS = ["0", "I", "II", "III", "IV", "V"];

export function BuildLibrary({ kinds, destination, heritageCategory, onAdd, onAddFocused, onPreview, disabled = false }: {
  kinds: EntityKind[];
  destination: string;
  heritageCategory?: DiscoveryHeritageCategory;
  onAdd: (key: EntityKey, name: string) => void;
  /** Same add operation, then focus the shared Build & Preview surface. */
  onAddFocused?: (key: EntityKey, name: string) => void;
  onPreview: (item: LibraryItem) => void;
  disabled?: boolean;
}) {
  const { dark } = useGlobalControls();
  const choices = TYPES.filter(([type]) => kinds.includes(previewKind(type)) && matchesDiscoveryDestination(previewKind(type), type.replace("_TEMPLATE", ""), heritageCategory));
  const [type, setType] = useState<LibraryTargetType>("PRIMITIVE");
  const effectiveType = choices.some(([value]) => value === type) ? type : choices[0]?.[0] ?? "PRIMITIVE";
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("all");
  const [tier, setTier] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("ALPHABETICAL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [familiesOpen, setFamiliesOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [page, setPage] = useState({ key: "", offset: 0 });
  const effectiveCategory = effectiveType === "PRIMITIVE" ? category : "";
  const filterKey = JSON.stringify([query, effectiveType, origin, tier, effectiveCategory, sort, heritageCategory]);
  const offset = page.key === filterKey ? page.offset : 0;
  const [result, setResult] = useState<{ key: string; rows: LibraryItem[]; total: number }>({ key: "", rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rows = result.key === filterKey ? result.rows.filter(item => matchesDiscoveryDestination(previewKind(item.targetType), item.targetType.replace("_TEMPLATE", ""), heritageCategory)) : [];
  const pending = loading || result.key !== filterKey;
  const currentFamily = MARKET_FAMILIES.find((family) => family.key === category);
  const activeFilters = Boolean(query || origin !== "all" || tier || effectiveCategory || sort !== "ALPHABETICAL");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams({ targetType: effectiveType, q: query, origin, tier, category: effectiveCategory, limit: "30", offset: String(offset), sort });
        const response = await fetch(`/api/library?${params}`, { signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Library unavailable.");
        if (controller.signal.aborted) return;
        setResult((previous) => {
          const nextRows = offset && previous.key === filterKey ? [...previous.rows, ...value.items] : value.items;
          return { key: filterKey, rows: [...new Map<string, LibraryItem>(nextRows.map((item: LibraryItem) => [item.id, item])).values()], total: value.total ?? nextRows.length };
        });
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Library unavailable.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [effectiveType, query, origin, tier, effectiveCategory, sort, offset, filterKey]);

  function resetFilters() {
    setQuery(""); setOrigin("all"); setTier(""); setCategory(""); setSort("ALPHABETICAL");
  }

  return <div className="sheet-build-library v12-source-browser">
    <div className="v12-source-search">
      <ColumnSearchBar search={query} onSearchChange={setQuery} onOpenFilters={() => setFiltersOpen((open) => !open)} hasActiveFilters={activeFilters} placeholder="Search names, descriptions, rules…" />
      <div className="v12-source-tabs sheet-library-types" aria-label="Library entry types">
        {choices.map(([value, label]) => <button type="button" key={value} aria-pressed={effectiveType === value} onClick={() => { setType(value); setTier(""); }}>{label}</button>)}
      </div>
    </div>
    {heritageCategory && kinds.includes("heritage") && <p className="sheet-library-status">Choose another root above to explore its heritage bundles.</p>}
    {filtersOpen && <div className="sheet-library-filters">
      <label className="sheet-field">Sort entries<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="ALPHABETICAL">Name</option><option value="RECENT">Newest</option><option value="LIKES">Most liked</option><option value="FORKS">Most adapted</option></select></label>
      <button type="button" className="v12-metal-button" disabled={!activeFilters} onClick={resetFilters}>Clear filters</button>
    </div>}
    {effectiveType === "PRIMITIVE" && <section className="v12-source-families sheet-library-families">
      <header className="v12-source-pane-head"><p className="v12-kicker">{currentFamily?.label ?? "Lexicon categories · market families"}</p><button type="button" aria-label={familiesOpen ? "Hide market families" : "Show market families"} aria-expanded={familiesOpen} onClick={() => setFamiliesOpen((open) => !open)}><ChevronDown size={14} style={{ transform: familiesOpen ? "rotate(180deg)" : undefined }}/></button></header>
      {familiesOpen && <div className="v12-source-pane-scroll v12-source-family-list">
        <button type="button" className={`v12-source-family ${!category ? "is-active" : ""}`} aria-pressed={!category} onClick={() => setCategory("")}><span aria-hidden="true">◇</span><span>All families</span></button>
        {MARKET_FAMILIES.map((family) => <button type="button" key={family.key} className={`v12-source-family ${category === family.key ? "is-active" : ""}`} aria-pressed={category === family.key} onClick={() => setCategory(category === family.key ? "" : family.key)}><span aria-hidden="true">{libraryFamilyGlyph(family.key)}</span><span>{family.label}</span></button>)}
      </div>}
    </section>}
    <section className="v12-source-entries" aria-label="Library entries">
      <div className="v12-tier-tabs" aria-label="Source tiers">{TIERS.map((value) => <button type="button" key={value} aria-pressed={tier === value} onClick={() => setTier(value)}>{value ? `Tier ${ROMAN_TIERS[Number(value)]}` : "All tiers"}</button>)}</div>
      <div className="v12-origin-tabs" aria-label="Source origin">{["all", "system", "community"].map((value) => <button type="button" key={value} aria-pressed={origin === value} onClick={() => setOrigin(value)}>{value === "all" ? "All origins" : value === "system" ? "System" : "Community"}</button>)}</div>
      <div className="v12-source-results-head"><p className="v12-kicker">Exact entries</p><span>{result.key === filterKey ? result.total : "…"}</span></div>
      {error && <p role="alert">{error}</p>}
      <div aria-busy={pending}>
        {rows.length > 0 && <LibraryTable surface="atelier" items={rows} view="LIST" engagement={EMPTY_ENGAGEMENT} currentUserInternalId={null} selectedKey={selectedKey} onSelect={(item) => { setSelectedKey(item.id); onPreview(item); }} renderActions={(item) => <>
          <button type="button" className="v12-metal-button" disabled={disabled || pending} onClick={() => onAdd(`${previewKind(item.targetType)}:${item.targetId}`, item.name)} title={`Add to ${destination}`} aria-label={`Add ${item.name} to ${destination}`}><Plus size={14}/> Add</button>
          {onAddFocused && <button type="button" className="v12-metal-button" disabled={disabled || pending} onClick={() => onAddFocused(`${previewKind(item.targetType)}:${item.targetId}`, item.name)} title="Add and open Build & Preview" aria-label={`Add ${item.name} in Build & Preview`}><FabThemeIcon iconKey="lorc/anvil-impact" dark={dark}/> Add in Build & Preview</button>}
        </>} />}
      </div>
      {pending && !error && <p role="status" className="sheet-library-status">Finding entries…</p>}
      {!pending && !rows.length && !error && <div className="sheet-library-empty"><strong>No matching entries</strong><p>Try a broader description, another family, or fewer filters.</p><button type="button" className="v12-metal-button" onClick={resetFilters}>Clear filters</button></div>}
      {rows.length > 0 && rows.length < result.total && <button type="button" className="sheet-button sheet-library-more" disabled={pending} onClick={() => setPage({ key: filterKey, offset: offset + 30 })}>Load more entries</button>}
    </section>
  </div>;
}
