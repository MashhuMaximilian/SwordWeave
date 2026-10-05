"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Shuffle, LockKeyhole, Plus } from "lucide-react";
import { PrimitiveSelectCard, type PrimitiveOption } from "@/components/characters/new-character-form";
import { LibraryTable } from "@/components/library/library-table";
import { EntityPreview } from "@/components/preview/entity-preview";
import { DetailModal } from "@/components/ui/detail-modal";
import { loadEntityPreview, previewKind } from "@/components/characters/workspace/workspace-entity-preview";
import { useInfiniteLibrary } from "@/lib/hooks/use-infinite-library";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { MonsterReference } from "@/lib/monsters/model";
import "./monster-creator.css";

type PickKind = "PRIMITIVE" | "CAPABILITY" | "ITEM";
const families = [
  ["VERB_TIER", "Actions", "What they can do"],
  ["DOMAIN", "Subjects", "What they act upon"],
  ["RANGE", "Reach", "How far actions travel"],
  ["INTENSITY_DICE", "Effect dice", "Damage and healing"],
  ["ALL", "All primitives", "Bonuses, resistances, resources"],
] as const;
function primitiveCard(item: LibraryItem): PrimitiveOption {
  return { id: Number(item.targetId), name: item.name, category: item.category ?? "PRIMITIVE", buCost: item.buCost ?? 0,
    mechanicalOutputText: item.mechanicalDescription ?? item.compositionSummary ?? "", narrativeRule: item.description ?? "",
    ...(item.costTier?{costTier:item.costTier}:{}), iconSource: item.iconSource, iconKey: item.iconKey, iconUrl: item.iconUrl,
    iconColor: item.iconColor, sourceOrigin: item.authorId && !item.authorIsAdmin ? "community" : "system", ...(item.versionNumber?{version:item.versionNumber}:{}) };
}
export function MonsterAbilityBuilder({ references, disabled, budget, name, locks, onToggleLock, onToggle, onRemove, onShuffle, pending, spent, itemBu, referenceName }: {
  references: MonsterReference[]; disabled: boolean; budget: number; name: string; locks: string[];
  onToggleLock: (index: number) => void; onToggle: (item: LibraryItem) => void; onRemove: (index: number) => void;
  onShuffle: (kinds: ("PRIMITIVE" | "CAPABILITY")[], limit: number) => void; pending: boolean;
  spent?: number; itemBu?: number; referenceName: (ref: MonsterReference) => string;
}) {
  const [kind, setKind] = useState<PickKind>("PRIMITIVE");
  const [family, setFamily] = useState("VERB_TIER");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("BU");
  const [origin, setOrigin] = useState("all");
  const [shuffleKinds, setShuffleKinds] = useState<("PRIMITIVE" | "CAPABILITY")[]>(["PRIMITIVE", "CAPABILITY"]);
  const [shuffleLimit, setShuffleLimit] = useState("");
  const [path, setPath] = useState<SandboxPreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewChoice,setPreviewChoice]=useState<LibraryItem|null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { controller.current?.abort(); generation.current++; }, []);
  const query = new URLSearchParams({ targetType: kind, q: search, sort, origin, ...(kind === "PRIMITIVE" && family !== "ALL" ? { category: family } : {}) });
  const results = useInfiniteLibrary(query.toString());
  const visible = results.items;
  const selected = (item: LibraryItem) => references.some(ref => ref.kind === item.targetType && ref.id === item.targetId);
  async function preview(type: string, id: string, nested = false) {
    const token = ++generation.current; controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setPreviewOpen(true); setPreviewLoading(true); setPreviewError(""); if (!nested) setPath([]);
    try { const result = await loadEntityPreview(previewKind(type), id, abort.signal); if (token === generation.current) setPath(previous => nested ? [...previous, result] : [result]); }
    catch (error) { if (!abort.signal.aborted && token === generation.current) setPreviewError(error instanceof Error ? error.message : "Unable to open preview."); }
    finally { if (token === generation.current) setPreviewLoading(false); }
  }
  const limit = shuffleLimit.trim() ? Number(shuffleLimit) : budget;
  const validLimit = Number.isSafeInteger(limit) && limit > 0 && limit <= budget;
  return <div className="monster-ability-builder sw-forge-stack">
    <section className="sw-forge-current-set" aria-live="polite">
      <div className="sw-forge-current-set__head"><div><span>YOUR CREATURE’S SET</span><h3>{name || "Your creature"}</h3><p>Primitives give them a vocabulary of actions. Capabilities combine rules into abilities; equipment carries its own item budget.</p></div><div><b>{spent === undefined ? `${budget} BU` : `${spent} / ${budget} BU`}</b><small>{spent === undefined ? "Resolve to see total spending" : `${budget - spent} BU remaining`}</small><strong>{references.length} selected parts{itemBu !== undefined ? ` · ${itemBu} item BU` : ""}</strong></div></div>
    </section>
    <section className="sw-access-presets monster-set-tools"><header><div><span>Find a combination</span><h3>Shuffle a creature’s set</h3><p>Keep the parts you like with their locks. Review the proposed set before applying it.</p></div></header><div className="monster-shuffle-controls"><fieldset><legend>Include in shuffle</legend>{(["PRIMITIVE", "CAPABILITY"] as const).map(type => <label key={type}><input type="checkbox" checked={shuffleKinds.includes(type)} disabled={disabled || pending} onChange={event => setShuffleKinds(current => event.target.checked ? [...current, type] : current.filter(value => value !== type))}/>{type === "PRIMITIVE" ? "Primitives" : "Capabilities"}</label>)}</fieldset><label>Set budget limit<input type="number" min={1} max={budget} value={shuffleLimit} placeholder={String(budget)} disabled={disabled || pending} onChange={event => setShuffleLimit(event.target.value)}/><small>Total ability BU, including locked parts</small></label><button type="button" className="sw-metal-button sw-metal-button--secondary" disabled={disabled || pending || !shuffleKinds.length || !validLimit} onClick={() => onShuffle(shuffleKinds, limit)}><Shuffle size={17}/>{pending ? "Finding a set…" : "Shuffle set"}</button>{!validLimit && <p role="status">Choose a whole number from 1 to {budget} BU.</p>}</div></section>
    <section className="sw-access-library monster-custom-set">
      <nav className="sw-access-library__families" aria-label="Creature set libraries">
        <button className={kind === "PRIMITIVE" ? "is-active" : ""} onClick={() => { setKind("PRIMITIVE"); setSearch(""); }}><i aria-hidden>◇</i><span>Primitives</span><small>Build actions from parts</small><em>01</em></button>
        {kind === "PRIMITIVE" && <div className="monster-primitive-families">{families.map(([id,label,hint]) => <button key={id} aria-pressed={family === id} onClick={() => { setFamily(id); setSearch(""); }}><span>{label}</span><small>{hint}</small></button>)}</div>}
        <button className={kind === "CAPABILITY" ? "is-active" : ""} onClick={() => { setKind("CAPABILITY"); setSearch(""); }}><i aria-hidden>◇</i><span>Capabilities</span><small>Complete abilities</small><em>02</em></button>
        <button className={kind === "ITEM" ? "is-active" : ""} onClick={() => { setKind("ITEM"); setSearch(""); }}><i aria-hidden>◇</i><span>Equipment</span><small>Items and carried rules</small><em>03</em></button>
      </nav>
      <div className="sw-access-library__corpus"><header><div><span>Make your own set · Library</span><h3>{kind === "PRIMITIVE" ? families.find(([id]) => id === family)?.[1] : kind === "CAPABILITY" ? "Capabilities" : "Equipment"}</h3></div></header><label className="sw-access-search"><Search aria-hidden/><input type="search" aria-label="Search creature components" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names, stories, and rules…"/></label><div className="monster-library-filters"><label>Sort<select value={sort} onChange={event => setSort(event.target.value)}><option value="BU">BU: low to high</option><option value="ALPHABETICAL">Name</option><option value="RECENT">Recently published</option></select></label><label>Source<select value={origin} onChange={event => setOrigin(event.target.value)}><option value="all">All sources</option><option value="system">System</option><option value="community">Community</option></select></label></div>
      {results.error && <p role="alert">{results.error} <button onClick={results.retry}>Retry</button></p>}{results.loading && !results.items.length && <p role="status">Opening the Library…</p>}
      {kind === "PRIMITIVE" ? <div className="sw-access-library__entries">{visible.map(item => <div className="monster-primitive-pick" key={item.id}><div inert={disabled}><PrimitiveSelectCard item={primitiveCard(item)} selected={selected(item)} onToggle={() => { if (!disabled) onToggle(item); }}/></div><button className="monster-inspect-part" onClick={() => {setPreviewChoice(item);void preview(item.targetType,item.targetId);}}>Preview complete rule</button></div>)}</div> : <LibraryTable items={visible} view="GRID" engagement={{reactions:{},following:{}}} currentUserInternalId={null} onSelect={item => {setPreviewChoice(item);void preview(item.targetType,item.targetId);}} showClearFilters={false} pagination={null} renderActions={item => <button className="sw-metal-button sw-metal-button--secondary" disabled={disabled} aria-pressed={selected(item)} onClick={() => onToggle(item)}>{selected(item) ? "Remove from set" : <><Plus size={14}/>Add to set</>}</button>}/>}
      {!results.loading && !visible.length && <p className="sw-access-library__empty">No matching entries. Try another family or search.</p>}{results.hasMore && <button className="sw-metal-button sw-metal-button--secondary" disabled={results.loading} onClick={results.loadMore}>{results.loading ? "Loading…" : "More entries"}</button>}</div>
      <aside className="sw-access-ledger"><header><span>Selected parts</span><strong>{references.length}</strong></header>{references.length ? <div>{references.map((ref,index) => <article key={`${ref.kind}:${ref.id}:${index}`}><button className="monster-ledger-preview" onClick={() => {setPreviewChoice(null);void preview(ref.kind,ref.id);}}><span>{referenceName(ref)}</span><small>{ref.kind.toLowerCase()} · ×{ref.quantity}{ref.isMirrored ? " · mirrored" : ""}</small></button><div className="monster-ledger-actions"><button disabled={disabled} aria-pressed={locks.includes(`reference:${index}`)} aria-label={`${locks.includes(`reference:${index}`) ? "Unlock" : "Lock"} ${referenceName(ref)} for shuffle`} onClick={() => onToggleLock(index)}><LockKeyhole size={14}/>{locks.includes(`reference:${index}`) ? "Locked" : "Lock"}</button><button disabled={disabled} onClick={() => onRemove(index)}>Remove</button></div></article>)}</div> : <p>Choose parts from the Library. Preview the rule, then add it to this creature’s set.</p>}</aside>
    </section>
    <DetailModal isOpen={previewOpen} onClose={() => { setPreviewOpen(false); controller.current?.abort(); generation.current++; }} title={path.at(-1)?.row.name ?? "Component preview"} size="xl">{path.length > 1 && <button className="sw-metal-button sw-metal-button--secondary" onClick={() => setPath(previous => previous.slice(0,-1))}>← Back to {path.at(-2)!.row.name}</button>}{previewLoading && <p role="status">Loading complete preview…</p>}{previewError && <p role="alert">{previewError}</p>}{path.at(-1) && <EntityPreview item={path.at(-1)!} callbacks={{preferLocalSubLinks:true,onSubLinkClick:link => void preview(link.targetType,String(link.targetId),true)}}/>}{previewChoice&&path.length===1&&<div className="monster-preview-choice"><button className="sw-metal-button sw-metal-button--primary" disabled={disabled||previewLoading} onClick={()=>{onToggle(previewChoice);setPreviewOpen(false);}}>{selected(previewChoice)?"Remove from creature’s set":"Add to creature’s set"} · {previewChoice.buCost??0} BU</button></div>}</DetailModal>
  </div>;
}
