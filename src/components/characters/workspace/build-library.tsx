"use client";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useInfiniteLibrary } from "@/lib/hooks/use-infinite-library";
import { InfiniteLibraryResults } from "@/components/library/infinite-library-results";
import { LibraryDiscoveryFilters, EMPTY_DISCOVERY_FILTERS, discoveryFilterParams } from "./library-discovery-filters";

import { useState } from "react";
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
  const phone = useIsMobile();
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
  const [extraFilters, setExtraFilters] = useState(EMPTY_DISCOVERY_FILTERS);
  const effectiveCategory = effectiveType === "PRIMITIVE" ? category : "";
  const effectiveExtras = effectiveType === "PRIMITIVE" ? extraFilters : { ...extraFilters, definitionKind: "", mirrorableOnly: false, mechanicTarget: "", recipient: "", conditionMode: "", minMagnitude: "", maxMagnitude: "" };
  const filterKey = new URLSearchParams({ targetType: effectiveType, q: query, origin, tier, category: effectiveCategory, sort, ...discoveryFilterParams(effectiveExtras) }).toString();
  const result = useInfiniteLibrary(filterKey);
  const rows = result.items.filter(item => matchesDiscoveryDestination(previewKind(item.targetType), item.targetType.replace("_TEMPLATE", ""), heritageCategory));
  const pending = result.loading;
  const error = result.error;
  const currentFamily = MARKET_FAMILIES.find((family) => family.key === category);
  const activeFilters = Boolean(query || origin !== "all" || tier || effectiveCategory || sort !== "ALPHABETICAL" || Object.keys(discoveryFilterParams(effectiveExtras)).length);

  function resetFilters() {
    setQuery(""); setOrigin("all"); setTier(""); setCategory(""); setSort("ALPHABETICAL"); setExtraFilters(EMPTY_DISCOVERY_FILTERS);
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
      <LibraryDiscoveryFilters value={extraFilters} onChange={setExtraFilters} primitive={effectiveType === "PRIMITIVE"} sort={sort} onSortChange={setSort}/>
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
      {(!phone || filtersOpen) && <div className="v12-tier-tabs" aria-label="Source tiers">{TIERS.map((value) => <button type="button" key={value} aria-pressed={tier === value} onClick={() => setTier(value)}>{value ? `Tier ${ROMAN_TIERS[Number(value)]}` : "All tiers"}</button>)}</div>}
      {(!phone || filtersOpen) && <div className="v12-origin-tabs" aria-label="Source origin">{["all", "system", "community"].map((value) => <button type="button" key={value} aria-pressed={origin === value} onClick={() => setOrigin(value)}>{value === "all" ? "All origins" : value === "system" ? "System" : "Community"}</button>)}</div>}
      <div className="v12-source-results-head"><p className="v12-kicker">Exact entries</p><span>{pending && !rows.length ? "…" : result.total}</span></div>
      <InfiniteLibraryResults key={filterKey} items={rows} hasMore={result.hasMore} loading={pending} error={error} loadMore={result.loadMore} retry={result.retry} render={(batch) => <LibraryTable compact surface="atelier" items={batch} view="LIST" engagement={EMPTY_ENGAGEMENT} currentUserInternalId={null} selectedKey={selectedKey} onSelect={(item) => { setSelectedKey(item.id); onPreview(item); }} renderActions={(item) => <>
          <button type="button" className="v12-metal-button" disabled={disabled} onClick={() => onAdd(`${previewKind(item.targetType)}:${item.targetId}`, item.name)} title={`Add to ${destination}`} aria-label={`Add ${item.name} to ${destination}`}><Plus size={14}/> Add</button>
          {onAddFocused && <button type="button" className="v12-metal-button" disabled={disabled} onClick={() => onAddFocused(`${previewKind(item.targetType)}:${item.targetId}`, item.name)} title="Add and open Build & Preview" aria-label={`Add ${item.name} in Build & Preview`}><FabThemeIcon iconKey="lorc/anvil-impact" dark={dark}/> Add in Build & Preview</button>}
        </>} />}/>
      {!pending && !rows.length && !error && <div className="sheet-library-empty"><strong>No matching entries</strong><p>Try a broader description, another family, or fewer filters.</p><button type="button" className="v12-metal-button" onClick={resetFilters}>Clear filters</button></div>}

    </section>
  </div>;
}
