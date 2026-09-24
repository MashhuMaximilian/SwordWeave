"use client";
import { useEffect, useState } from "react";
import { Search, Plus, Eye } from "lucide-react";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { EntityKind, EntityKey } from "@/lib/character/workspace/model";
import { previewKind } from "./workspace-entity-preview";

const TYPES: [string, string][] = [["PRIMITIVE", "Rules & traits"], ["CAPABILITY", "Capabilities"], ["EFFECT", "Effects"], ["LINEAGE_TEMPLATE", "Lineages"], ["UPBRINGING_TEMPLATE", "Upbringings"], ["MANIFEST_TEMPLATE", "Manifests"], ["ITEM", "Items"]];
export function BuildLibrary({ kinds, destination, onAdd, onPreview, disabled = false }: {
  kinds: EntityKind[]; destination: string; onAdd: (key: EntityKey, name: string) => void;
  onPreview: (item: LibraryItem) => void; disabled?: boolean;
}) {
  const choices = TYPES.filter(([type]) => kinds.includes(previewKind(type)));
  const [type, setType] = useState("PRIMITIVE");
  const effectiveType = choices.some(([value]) => value === type) ? type : choices[0]?.[0] ?? "PRIMITIVE";
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("all");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState({key:"",offset:0});
  const filterKey = JSON.stringify([query,effectiveType,origin,tier]);
  const offset = page.key === filterKey ? page.offset : 0;
  const [rows, setRows] = useState<LibraryItem[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams({ targetType: effectiveType, q: query, origin, tier, limit: "30", offset: String(offset), sort: "ALPHABETICAL" });
        const response = await fetch(`/api/library?${params}`, { signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Library unavailable.");
        if (controller.signal.aborted) return;
        setRows((previous) => offset ? [...previous, ...value.items] : value.items);
        setMore(value.items.length === 30);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Library unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [effectiveType, query, origin, tier, offset]);
  return <div className="sheet-build-library">
    <label className="sheet-search"><Search size={16} /><input aria-label="Search Library" placeholder="Names, descriptions, rules…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <label className="sheet-field">Find<select value={effectiveType} onChange={(e) => setType(e.target.value)}>{choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="sheet-filter-pair"><label className="sheet-field">Origin<select value={origin} onChange={(e) => setOrigin(e.target.value)}><option value="all">System + Community</option><option value="system">System</option><option value="community">Community</option></select></label>
    <label className="sheet-field">Tier<select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">All tiers</option>{[0,1,2,3,4,5].map((n) => <option value={n} key={n}>Tier {n}</option>)}</select></label></div>
    {error && <p role="alert">{error}</p>}
    <div className="sheet-catalogue" aria-busy={loading}>{rows.map((item) => <article key={item.id} className="sheet-catalogue-row">
      <button type="button" className="sheet-row-title" onClick={() => onPreview(item)}><strong>{item.name}</strong><span>{item.buCost ?? 0} BU</span></button>
      <p className="sheet-rule">{item.mechanicalDescription || item.description}</p>
      <small>{item.authorIsAdmin || !item.authorId ? "System" : "Community"} · {item.familyLabel ?? item.category ?? item.targetType}</small>
      <div className="sheet-row-actions"><button type="button" onClick={() => onPreview(item)}><Eye size={14}/> Preview</button><button type="button" disabled={disabled || loading} onClick={() => onAdd(`${previewKind(item.targetType)}:${item.targetId}`, item.name)} title={`Add to ${destination}`}><Plus size={14}/> Add</button></div>
    </article>)}</div>
    {loading && <p role="status">Finding entries…</p>}{!loading && !rows.length && <p>No matches. Try fewer words or another type.</p>}
    {more && <button type="button" className="sheet-button" disabled={loading} onClick={() => setPage({key:filterKey,offset:offset+30})}>Load more entries</button>}
  </div>;
}
