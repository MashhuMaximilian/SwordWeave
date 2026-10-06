"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Shuffle, LockKeyhole, Eye } from "lucide-react";
import { MirrorOptionCard, PrimitiveSelectCard, type PrimitiveOption } from "@/components/characters/new-character-form";
import { CapabilityCardSurface } from "@/components/characters/capability-card-surface";
import { monsterSavedPreviewContext } from "./monster-composition-view";
import type { MonsterSlot } from "@/lib/monsters/resolve";
import { loadMonsterComponentPreview } from "./monster-component-preview";
import type { MonsterComponentPin } from "@/lib/monsters/composition";
import { CompactHierarchyBranch } from "@/components/characters/compact-hierarchy";
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
const EMPTY_COMPONENT_PINS: MonsterComponentPin[] = [];
const EMPTY_SLOTS: MonsterSlot[] = [];

export function MonsterAbilityBuilder({ references, disabled, budget, name, locks, onToggleLock, onToggle, onRemove, onShuffle, pending, spent, itemBu, referenceName, componentPins = EMPTY_COMPONENT_PINS, slots = EMPTY_SLOTS, packageOnly = false, packageTitle, weaknessOnly = false, renderReferenceOptions }: {
  packageOnly?: boolean; packageTitle?: string; weaknessOnly?: boolean;
  renderReferenceOptions?: (reference:MonsterReference,index:number)=>ReactNode;
  componentPins?: MonsterComponentPin[] | undefined; slots?:MonsterSlot[] | undefined;
  references: MonsterReference[]; disabled: boolean; budget: number; name: string; locks: string[];
  onToggleLock: (index: number) => void; onToggle: (item: LibraryItem) => void; onRemove: (index: number) => void;
  onShuffle: (kinds: ("PRIMITIVE" | "CAPABILITY")[], limit: number) => void; pending: boolean;
  spent?: number; itemBu?: number; referenceName: (ref: MonsterReference) => string;
}) {
  const [selectedPreviews, setSelectedPreviews] = useState<Record<string, SandboxPreviewItem>>({});
  const [selectedErrors, setSelectedErrors] = useState<Record<string, string>>({});
  const selectedKey = JSON.stringify(references.map(({kind,id,versionId}) => ({kind,id,versionId})));
  const names = useMemo(() => Object.fromEntries(componentPins.map(pin => [`${pin.kind}:${pin.id}`, pin.name])), [componentPins]);
  useEffect(() => {
    const abort = new AbortController();
    const selectedReferences = JSON.parse(selectedKey) as Array<Pick<MonsterReference,"kind"|"id"|"versionId">>;
    for (const reference of selectedReferences) {
      const key = `${reference.kind}:${reference.id}:${reference.versionId ?? "latest"}`;
      const pin = componentPins.find(pin => pin.kind === reference.kind.toLowerCase() && pin.id === reference.id && pin.versionId === reference.versionId);
      void Promise.resolve().then(() => loadMonsterComponentPreview(reference, abort.signal, names, pin && slots.length ? monsterSavedPreviewContext(pin, componentPins, slots) : undefined)).then(item => {
        if (!abort.signal.aborted) { setSelectedPreviews(current => ({ ...current, [key]: item })); setSelectedErrors(current => ({...current,[key]:""})); }
      }).catch(error => {
        if (!abort.signal.aborted) setSelectedErrors(current => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to load component." }));
      });
    }
    return () => abort.abort();
  }, [selectedKey, names, componentPins, slots]);
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
  const query = new URLSearchParams({ targetType: weaknessOnly ? "PRIMITIVE" : kind, q: search, sort, origin, ...(weaknessOnly ? {mirrorableOnly:"1"} : kind === "PRIMITIVE" && family !== "ALL" ? { category: family } : {}) });
  const results = useInfiniteLibrary(query.toString(), { enabled: !packageOnly });
  const visible = results.items;
  const selected = (item: LibraryItem) => references.some(ref => ref.kind === item.targetType && ref.id === item.targetId && (!weaknessOnly || ref.isMirrored));
  async function preview(type: string, id: string, nested = false) {
    const token = ++generation.current; controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setPreviewOpen(true); setPreviewLoading(true); setPreviewError(""); if (!nested) setPath([]);
    try { const pin = componentPins.find(pin => pin.kind === previewKind(type) && pin.id === id); const result = pin?.versionId ? await loadMonsterComponentPreview({kind:pin.kind.toUpperCase() as MonsterReference["kind"],id,versionId:pin.versionId},abort.signal,names,slots.length ? monsterSavedPreviewContext(pin,componentPins,slots) : undefined) : await loadEntityPreview(previewKind(type), id, abort.signal); if (token === generation.current) setPath(previous => nested ? [...previous, result] : [result]); }
    catch (error) { if (!abort.signal.aborted && token === generation.current) setPreviewError(error instanceof Error ? error.message : "Unable to open preview."); }
    finally { if (token === generation.current) setPreviewLoading(false); }
  }
  const selectedCount = references.filter(reference=>!weaknessOnly || reference.isMirrored).length;
  const limit = shuffleLimit.trim() ? Number(shuffleLimit) : budget;
  const validLimit = Number.isSafeInteger(limit) && limit > 0 && limit <= budget;
  return <div className="monster-ability-builder sw-forge-stack">
    <section className="sw-forge-current-set monster-resulting-package" aria-label="Resulting creature package">
      <div className="sw-forge-current-set__head"><div><span>{packageOnly ? "COMPARE THE COMPLETE SET" : "YOUR RESULTING PACKAGE"}</span><h3>{packageTitle ?? (weaknessOnly ? "Chosen weaknesses" : `${name || "Your creature"}’s set`)}</h3><p>{packageOnly ? "Open each component to inspect its complete rules and included parts." : "Explore the complete components and their nested rules, then lock the parts you want to keep."}</p></div><div><b>{spent === undefined ? `${budget} BU budget` : `${spent} / ${budget} BU`}</b><strong>{selectedCount} selected parts</strong></div></div>
      {selectedCount ? (["PRIMITIVE", "CAPABILITY", "ITEM", "EFFECT", "HERITAGE"] as const).map(type => {
        const entries = references.map((reference, index) => ({reference, index})).filter(entry => entry.reference.kind === type && (!weaknessOnly || entry.reference.isMirrored));
        if (!entries.length) return null;
        return <CompactHierarchyBranch defaultExpanded key={type} label={type === "PRIMITIVE" ? "Primitives" : type === "CAPABILITY" ? "Capabilities" : type === "ITEM" ? "Equipment" : type === "EFFECT" ? "Existing effects" : "Existing heritage"} count={entries.length} tone={type === "PRIMITIVE" ? "teal" : "gold"}>
          {entries.map(({reference,index}) => {
            const key = `${reference.kind}:${reference.id}:${reference.versionId ?? "latest"}`, item = selectedPreviews[key];
            return <article className="monster-package-component" key={`${key}:${index}`}>

              {/* The preview callback runs only when a nested link is clicked. */}
              {/* eslint-disable-next-line react-hooks/refs */}
              {item ? <PackageComponentCard item={item} reference={reference} onOpen={() => {setPreviewChoice(null);setPath([item]);setPreviewError("");setPreviewLoading(false);setPreviewOpen(true);}}/> : <div><strong>{referenceName(reference)}</strong><p role={selectedErrors[key] ? "alert" : "status"}>{selectedErrors[key] || "Loading complete component…"}</p><button onClick={() => {setPreviewChoice(null);void preview(reference.kind,reference.id);}}>Open component preview</button></div>}
              <div className="monster-package-component__actions"><span>×{reference.quantity}{reference.isMirrored ? " · mirrored" : ""}{reference.versionId ? " · pinned version" : ""}</span>{!packageOnly && <><button disabled={disabled} aria-pressed={locks.includes(`reference:${index}`)} onClick={() => onToggleLock(index)}><LockKeyhole size={14}/>{locks.includes(`reference:${index}`) ? "Locked" : "Lock for shuffle"}</button><button disabled={disabled} onClick={() => onRemove(index)}>Remove</button></>}</div>
              {!packageOnly && renderReferenceOptions?.(reference,index)}
            </article>;
          })}
        </CompactHierarchyBranch>;
      }) : <p>{weaknessOnly ? "No weakness chosen. Continue with your current budget, or select a mirrored rule below." : "Choose components from the Library below to build your set here."}</p>}
    </section>
    {!packageOnly && !weaknessOnly && <section className="sw-access-presets monster-set-tools"><header><div><span>Find a combination</span><h3>Shuffle a creature’s set</h3><p>Keep the parts you like with their locks. Review the proposed set before applying it.</p></div></header><div className="monster-shuffle-controls"><fieldset><legend>Include in shuffle</legend>{(["PRIMITIVE", "CAPABILITY"] as const).map(type => <label key={type}><input type="checkbox" checked={shuffleKinds.includes(type)} disabled={disabled || pending} onChange={event => setShuffleKinds(current => event.target.checked ? [...current, type] : current.filter(value => value !== type))}/>{type === "PRIMITIVE" ? "Primitives" : "Capabilities"}</label>)}</fieldset><label>Set budget limit<input type="number" min={1} max={budget} value={shuffleLimit} placeholder={String(budget)} disabled={disabled || pending} onChange={event => setShuffleLimit(event.target.value)}/><small>Total ability BU, including locked parts</small></label><button type="button" className="sw-metal-button sw-metal-button--secondary" disabled={disabled || pending || !shuffleKinds.length || !validLimit} onClick={() => onShuffle(shuffleKinds, limit)}><Shuffle size={17}/>{pending ? "Finding a set…" : "Shuffle set"}</button>{!validLimit && <p role="status">Choose a whole number from 1 to {budget} BU.</p>}</div></section>}
    {!packageOnly && <section className={`sw-access-library monster-custom-set${weaknessOnly ? " monster-weakness-library" : ""}`}>
      {!weaknessOnly && <nav className="sw-access-library__families" aria-label="Creature set libraries">
        <button className={kind === "PRIMITIVE" ? "is-active" : ""} onClick={() => { setKind("PRIMITIVE"); setSearch(""); }}><i aria-hidden>◇</i><span>Primitives</span><small>Build actions from parts</small><em>01</em></button>
        {kind === "PRIMITIVE" && <div className="monster-primitive-families">{families.map(([id,label,hint]) => <button key={id} aria-pressed={family === id} onClick={() => { setFamily(id); setSearch(""); }}><span>{label}</span><small>{hint}</small></button>)}</div>}
        <button className={kind === "CAPABILITY" ? "is-active" : ""} onClick={() => { setKind("CAPABILITY"); setSearch(""); }}><i aria-hidden>◇</i><span>Capabilities</span><small>Complete abilities</small><em>02</em></button>
        <button className={kind === "ITEM" ? "is-active" : ""} onClick={() => { setKind("ITEM"); setSearch(""); }}><i aria-hidden>◇</i><span>Equipment</span><small>Items and carried rules</small><em>03</em></button>
      </nav>}
      <div className="sw-access-library__corpus"><header><div><span>{weaknessOnly ? "Choose a weakness · Library" : "Make your own set · Library"}</span><h3>{weaknessOnly ? "Mirrorable primitives" : kind === "PRIMITIVE" ? families.find(([id]) => id === family)?.[1] : kind === "CAPABILITY" ? "Capabilities" : "Equipment"}</h3></div></header><label className="sw-access-search"><Search aria-hidden/><input type="search" aria-label="Search creature components" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names, stories, and rules…"/></label><div className="monster-library-filters"><label>Sort<select value={sort} onChange={event => setSort(event.target.value)}><option value="BU">BU: low to high</option><option value="ALPHABETICAL">Name</option><option value="RECENT">Recently published</option></select></label><label>Source<select value={origin} onChange={event => setOrigin(event.target.value)}><option value="all">All sources</option><option value="system">System</option><option value="community">Community</option></select></label></div>
      {results.error && <p role="alert">{results.error} <button onClick={results.retry}>Retry</button></p>}{results.loading && !results.items.length && <p role="status">Opening the Library…</p>}
      {weaknessOnly ? <section className="sw-mirror-choices"><header><div><span>Optional weaknesses</span><h3>Choose the consequence</h3><p>The reversed rule below applies to this creature. It grants no extra Build Units.</p></div></header><div className="sw-mirror-choices__grid">{visible.map(item=><MirrorOptionCard key={item.id} item={{...primitiveCard(item),...item.mirrorRules}} active={selected(item)} disabled={disabled || !item.mirrorRules} showCredit={false} onSelect={()=>onToggle(item)}/>)}</div></section> : <div className="sw-access-library__entries">{visible.map(item => <article className="monster-component-pick" key={item.id}><div inert={disabled}><PrimitiveSelectCard item={primitiveCard(item)} selected={selected(item)} onToggle={() => { if (!disabled) onToggle(item); }}/></div><button type="button" className="monster-inspect-part" aria-label={`Preview ${item.name}`} title={`Preview ${item.name}`} onClick={() => {setPreviewChoice(item);void preview(item.targetType,item.targetId);}}><Eye size={16}/></button></article>)}</div> }

      {!results.loading && !visible.length && <p className="sw-access-library__empty">No matching entries. Try another family or search.</p>}{results.hasMore && <button className="sw-metal-button sw-metal-button--secondary" disabled={results.loading} onClick={results.loadMore}>{results.loading ? "Loading…" : "More entries"}</button>}</div><aside className="sw-access-ledger monster-selection-ledger"><header><span>Selected parts</span><strong>{selectedCount}</strong></header>{selectedCount ? <div>{references.map((reference,index)=>{if(weaknessOnly&&!reference.isMirrored)return null;const item=selectedPreviews[`${reference.kind}:${reference.id}:${reference.versionId ?? "latest"}`];return <button type="button" key={`${reference.kind}:${reference.id}:${index}`} disabled={disabled} onClick={()=>onRemove(index)}><span>{item?.row.name ?? referenceName(reference)}</span><small>×{reference.quantity}{reference.isMirrored ? " · weakness" : ""} · remove</small></button>;})}</div> : <p>{weaknessOnly ? "Choose an optional weakness." : "Choose actions, subjects, reach, effect dice, complete abilities, or equipment."}</p>}</aside>
    </section>}
    <DetailModal isOpen={previewOpen} onClose={() => { setPreviewOpen(false); controller.current?.abort(); generation.current++; }} title={path.at(-1)?.row.name ?? "Component preview"} size="xl">{path.length > 1 && <button className="sw-metal-button sw-metal-button--secondary" onClick={() => setPath(previous => previous.slice(0,-1))}>← Back to {path.at(-2)!.row.name}</button>}{previewLoading && <p role="status">Loading complete preview…</p>}{previewError && <p role="alert">{previewError}</p>}{path.at(-1) && <EntityPreview item={path.at(-1)!} callbacks={{preferLocalSubLinks:true,onSubLinkClick:link => void preview(link.targetType,String(link.targetId),true)}}/>}{previewChoice&&path.length===1&&<div className="monster-preview-choice"><button className="sw-metal-button sw-metal-button--primary" disabled={disabled||previewLoading} onClick={()=>{onToggle(previewChoice);setPreviewOpen(false);}}>{selected(previewChoice)?"Remove from creature’s set":"Add to creature’s set"} · {previewChoice.buCost??0} BU</button></div>}</DetailModal>
  </div>;
}

function PackageComponentCard({item,reference,onOpen}:{item:SandboxPreviewItem;reference:MonsterReference;onOpen:()=>void}) {
  if(item.kind === "primitive") {
    const row=item.row;
    const option: PrimitiveOption = { ...row, iconSource: row.iconSource === "GAME_ICONS" || row.iconSource === "UPLOAD" ? row.iconSource : null, hardModifiers: Array.isArray(row.hardModifiers) ? row.hardModifiers : [] };
    return <div className="monster-selected-rule">{reference.isMirrored ? <div className="sw-mirror-choices__grid"><MirrorOptionCard item={option} active showCredit={false} onSelect={onOpen}/></div> : <PrimitiveSelectCard item={option} selected onToggle={onOpen}/>}</div>;
  }
  if(item.kind === "capability") return <CapabilityCardSurface name={item.row.name} type={item.row.type} source={item.row.sourceType} description={item.row.verboseDescription} onOpen={onOpen}><details className="mt-3"><summary>Included rules</summary><EntityPreview item={item} variant="build"/></details></CapabilityCardSurface>;
  return <details><summary>{item.row.name}</summary><EntityPreview item={item} variant="build"/></details>;
}
