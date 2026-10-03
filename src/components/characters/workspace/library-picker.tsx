"use client";
import { useInfiniteLibrary } from "@/lib/hooks/use-infinite-library";
import { InfiniteLibraryResults } from "@/components/library/infinite-library-results";
import { LibraryDiscoveryFilters, EMPTY_DISCOVERY_FILTERS, discoveryFilterParams } from "./library-discovery-filters";
import { useEffect, useRef, useState } from "react";
import { MARKET_FAMILIES } from "@/lib/primitives/canonical-market";
import { EntityPreview } from "@/components/preview/entity-preview";
import { LibraryTable } from "@/components/library/library-table";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import { loadEntityPreview, previewKind } from "./workspace-entity-preview";
import type { EntityKind, EntityKey } from "@/lib/character/workspace/model";

export function WorkspaceLibraryPicker({
  kinds,
  category,
  onSelect,
  destinationLabel = "character",
}: {
  kinds: EntityKind[];
  category: string;
  onSelect: (key: EntityKey, name: string, heritageType?: string) => void;
  destinationLabel?: string;
}) {
  const [previewPath, setPreviewPath] = useState<SandboxPreviewItem[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRequest = useRef(0);
  async function openPreview(type: EntityKind, id: string, nested = false) {
    const token = ++previewRequest.current;
    setPreviewLoading(true);
    try {
      const item = await loadEntityPreview(type, id);
      if (token !== previewRequest.current) return;
      setPreviewPath((previous) => (nested ? [...previous, item] : [item]));
      setError("");
    } catch (e) {
      if (token !== previewRequest.current) return;
      setError(e instanceof Error ? e.message : "Preview unavailable.");
    } finally {
      if (token === previewRequest.current) setPreviewLoading(false);
    }
  }
  const [heritageType, setHeritageType] = useState(
    category === "LINEAGE" || category === "UPBRINGING" ? category : "MANIFEST",
  );
  const [kind, setKind] = useState<EntityKind>(kinds[0] ?? "primitive");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("ALPHABETICAL");
  const [filters, setFilters] = useState(EMPTY_DISCOVERY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [origin, setOrigin] = useState("all");
  const [family, setFamily] = useState("");
  const [tier, setTier] = useState("");
  const filterKey = new URLSearchParams({ targetType: kind === "heritage" ? `${heritageType}_TEMPLATE` : kind.toUpperCase(), q: query, sort, origin, tier, category: kind === "primitive" ? family : "", ...discoveryFilterParams(kind === "primitive" ? filters : { ...filters, definitionKind: "", mirrorableOnly: false, mechanicTarget: "", recipient: "", conditionMode: "", minMagnitude: "", maxMagnitude: "" }) }).toString();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((r) => r + 1);
    window.addEventListener("sw:library-changed", refresh);
    window.addEventListener("sw:library-refresh", refresh);
    return () => {
      window.removeEventListener("sw:library-changed", refresh);
      window.removeEventListener("sw:library-refresh", refresh);
    };
  }, []);
  const [error, setError] = useState("");
  const results = useInfiniteLibrary(filterKey, { revision });
  return (
    <div className="v12-workspace-library space-y-3 rounded-lg border border-border p-4">
      <header className="v12-workspace-library-head">
        <div><span>Shared catalogue</span><h3>Library</h3></div>
        <p>Preview the complete piece, then add the exact version to this character.</p>
      </header>
      <div className="v12-workspace-library-tools flex gap-2">
        <select
          aria-label="Library piece type"
          className="rounded border border-border bg-card p-2"
          value={kind}
          onChange={(e) => setKind(e.target.value as EntityKind)}
        >
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        {kind === "heritage" && (
          <select
            aria-label="Library heritage type"
            className="rounded border border-border bg-card p-2"
            value={heritageType}
            onChange={(e) => setHeritageType(e.target.value)}
          >
            <option value="LINEAGE">Lineages</option>
            <option value="UPBRINGING">Upbringings</option>
            <option value="MANIFEST">Manifests</option>
          </select>
        )}
        <input
          aria-label="Search library pieces"
          className="min-w-0 flex-1 rounded border border-border bg-card p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the Library…"
        />
      </div>
      <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filters & sorting · {results.total} entries</button>
      {filtersOpen && <div className="space-y-3"><LibraryDiscoveryFilters value={filters} onChange={setFilters} primitive={kind === "primitive"} sort={sort} onSortChange={setSort}/>{kind === "primitive" && <label className="sheet-field">Market family<select value={family} onChange={(event) => setFamily(event.target.value)}><option value="">All families</option>{MARKET_FAMILIES.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label>}<label className="sheet-field">Tier<select value={tier} onChange={(event) => setTier(event.target.value)}><option value="">All tiers</option>{[0,1,2,3,4,5].map((value) => <option key={value} value={value}>Tier {value}</option>)}</select></label><label className="sheet-field">Origin<select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="all">All origins</option><option value="system">System / SRD</option><option value="community">Community</option></select></label><button type="button" onClick={() => { setQuery(""); setFilters(EMPTY_DISCOVERY_FILTERS); setSort("ALPHABETICAL"); setOrigin("all"); setFamily(""); setTier(""); }}>Clear filters</button></div>}
      {error && <p role="alert">{error}</p>}
      <div className="v12-character-library-workbench" data-has-preview={previewPath.length > 0}>
        <div className="v12-character-library-corpus">
          {previewLoading && <p className="v12-library-loading" role="status">Loading canonical preview…</p>}
          <InfiniteLibraryResults key={filterKey} items={results.items} hasMore={results.hasMore} loading={results.loading} error={results.error} loadMore={results.loadMore} retry={results.retry} render={(batch) => <LibraryTable
            items={batch}
            view="LIST"
            engagement={{ reactions: {}, following: {} }}
            currentUserInternalId={null}
            selectedKey={selectedLibraryId}
            showClearFilters={false}
            surface="atelier"
            emptyTitle="No compatible Library entries"
            emptyDescription="Change the piece type or broaden the search."
            onSelect={(item) => {
              setSelectedLibraryId(item.id);
              void openPreview(previewKind(item.targetType), String(item.targetId));
            }}
          />}/>
          {!results.loading && !results.error && !results.items.length && <p>No compatible Library entries. Try fewer filters.</p>}
        </div>
        <aside className="v12-character-library-inspector" aria-label="Library preview and placement">
          {previewPath.length > 0 ? (
            <>
              <div className="v12-library-preview-command">
                <div>
                  <span>{previewPath.length > 1 ? "Nested preview" : "Destination ready"}</span>
                  <strong>{previewPath.at(-1)!.row.name}</strong>
                  <small>Add exact saved version to {destinationLabel}</small>
                </div>
                <div className="v12-library-preview-actions">
                  {previewPath.length > 1 ? (
                    <button type="button" onClick={() => setPreviewPath((path) => path.slice(0, -1))}>
                      Back
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => {
                      const candidate = previewPath[0]!;
                      onSelect(
                        `${candidate.kind}:${candidate.row.id}`,
                        candidate.row.name,
                        candidate.kind === "heritage" ? candidate.row.kind : undefined,
                      );
                    }}
                  >
                    Add to {destinationLabel}
                  </button>
                </div>
              </div>
              <div className="v12-character-library-preview-body">
                <EntityPreview
                  item={previewPath.at(-1)!}
                  callbacks={{
                    onSubLinkClick: (link) =>
                      void openPreview(
                        previewKind(link.targetType),
                        String(link.targetId),
                        true,
                      ),
                  }}
                />
              </div>
            </>
          ) : (
            <div className="v12-character-library-empty-preview">
              <span>Character Atelier</span>
              <strong>Select a Library entry</strong>
              <p>Its canonical preview appears here before anything is attached to the character.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
