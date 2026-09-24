"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, Check, Eye, Shuffle, X } from "lucide-react";
import { DISCOVERY_INTENTS, drawDiscoverySuggestions, incrementalDiscoveryCost, discoverySetCost, type DiscoveryIntent, type DiscoverySuggestion } from "@/lib/character/workspace/discovery/matching";
import { supplyPaths, type EntityKey, type EntityKind, type WorkspaceGraph } from "@/lib/character/workspace/model";

interface WorkspaceSuggestionsProps {
  characterId: string;
  destinationLabel: string;
  kinds?: EntityKind[];
  /** Current draft allowance, not the character's original total budget. */
  budget: number;
  debtAvailable?: number;
  excludedKeys?: EntityKey[];
  graph?: WorkspaceGraph;
  destinationIsItem?: boolean;
  replaceTarget?: { key: EntityKey; name: string; availableBudget?: number };
  onReplace?: (candidate: DiscoverySuggestion, replaceKey: EntityKey) => void | Promise<void>;
  onAddSet?: (candidates: DiscoverySuggestion[]) => void | Promise<void>;
  onAdd: (candidate: DiscoverySuggestion) => void | Promise<void>;
  onPreview?: (key: EntityKey) => void;
  onBuildOwn?: () => void;
}

export function WorkspaceSuggestions({ characterId, destinationLabel, kinds = ["primitive"], budget, debtAvailable = 0, excludedKeys = [], graph, destinationIsItem = false, replaceTarget, onReplace, onAddSet, onAdd, onPreview, onBuildOwn }: WorkspaceSuggestionsProps) {
  const [query, setQuery] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [setKeys, setSetKeys] = useState<EntityKey[]>([]);
  const [intent, setIntent] = useState<DiscoveryIntent>("surprise");
  const [allowance, setAllowance] = useState("");
  const [pool, setPool] = useState<DiscoverySuggestion[]>([]);
  const [suggestions, setSuggestions] = useState<DiscoverySuggestion[]>([]);
  const [kept, setKept] = useState<DiscoverySuggestion[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAdded, setPendingAdded] = useState<EntityKey[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [retry, setRetry] = useState(0);
  const [catalogCount, setCatalogCount] = useState(0);
  const [loadedRequest, setLoadedRequest] = useState("");
  const keptRef = useRef(kept);
  useEffect(() => { keptRef.current = kept; }, [kept]);
  const replacing = replaceMode && !!replaceTarget && !!onReplace;
  const currentBudget = replacing ? replaceTarget.availableBudget ?? budget : budget;
  const cap = intent === "weakness" ? Math.max(0, debtAvailable) : Math.max(0, currentBudget);
  const allowanceNumber = allowance === "" ? cap : Number(allowance);
  const validAllowance = Number.isFinite(allowanceNumber) && allowanceNumber >= 0;
  const limit = validAllowance ? Math.min(cap, allowanceNumber) : 0;
  const kindsKey = replacing ? replaceTarget.key.split(":")[0]! : [...kinds].sort().join(",");
  const excludedKey = [...excludedKeys].sort().join(",");
  const suppliedKeys = useMemo(() => graph?.nodes.filter((node) => node.kind === "primitive" && supplyPaths(graph, node.key).some((path) => !path.item && !path.edges.some((edge) => edge.isMirrored) && (!replacing || !path.nodes.includes(replaceTarget!.key)))).map((node) => node.key) ?? [], [graph, replacing, replaceTarget]);
  const suppliedKey = [...suppliedKeys].sort().join(",");
  const suppliedSet = new Set(suppliedKeys);
  const excludedSet = new Set([...excludedKeys, ...pendingAdded]);
  const visibleSuggestions = suggestions.filter((item) => !excludedSet.has(item.key));
  const selectedSet = kept.filter((item) => setKeys.includes(item.key) && !excludedSet.has(item.key) && kinds.includes(item.kind));
  const setCost = discoverySetCost(selectedSet, suppliedKeys, destinationIsItem);
  const setFits = setCost.credit <= Math.max(0, debtAvailable) && setCost.cost <= Math.max(0, budget) + setCost.credit;
  useEffect(() => {
    const acknowledged = pendingAdded.filter((key) => excludedKeys.includes(key));
    if (!acknowledged.length) return;
    const timer = setTimeout(() => setPendingAdded((keys) => keys.filter((key) => !acknowledged.includes(key))), 0);
    return () => clearTimeout(timer);
  }, [pendingAdded, excludedKey, excludedKeys]);

  const requestKey = JSON.stringify([characterId, query, intent, budget, currentBudget, debtAvailable, limit, kindsKey, excludedKey, suppliedKey, destinationIsItem, retry]);
  const isLoading = loading || loadedRequest !== requestKey;
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      setSuggestions([]);
      if (!kindsKey) { setPool([]); setCatalogCount(0); setLoading(false); setLoadedRequest(requestKey); return; }
      void fetch(`/api/characters/${characterId}/workspace/suggestions`, {
        method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, intent, budget: intent === "weakness" ? Math.max(0, currentBudget) : limit, debtAvailable: intent === "weakness" ? limit : debtAvailable, kinds: kindsKey.split(","), excludedKeys: excludedKey ? excludedKey.split(",") : [], suppliedPrimitiveKeys: suppliedKey ? suppliedKey.split(",") : [], destinationIsItem }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load suggestions.");
        if (abort.signal.aborted) return;
        const nextPool = result.suggestions as DiscoverySuggestion[];
        const next = drawDiscoverySuggestions(nextPool, keptRef.current.map((item) => item.key), [], []);
        setPool(nextPool); setSuggestions(next); setSeen(next.map((item) => item.key)); setCatalogCount(result.catalogCount);
        setAnnouncement(`${nextPool.length} matching options. ${next.length} suggestions shown.`);
      }).catch((cause) => {
        if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : "Could not load suggestions."); setPool([]); }
      }).finally(() => { if (!abort.signal.aborted) { setLoading(false); setLoadedRequest(requestKey); } });
    }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [characterId, query, intent, budget, currentBudget, debtAvailable, limit, kindsKey, excludedKey, suppliedKey, destinationIsItem, retry, requestKey]);

  function shuffle() {
    const next = drawDiscoverySuggestions(pool, [...kept.map((item) => item.key), ...excludedSet], seen, suggestions.map((item) => item.key));
    setSuggestions(next);
    setSeen((current) => [...new Set([...current, ...next.map((item) => item.key)])]);
    setAnnouncement(`${next.length} suggestions shown. Kept choices remain below.`);
  }
  function keep(item: DiscoverySuggestion) {
    if (kept.some((candidate) => candidate.key === item.key)) return;
    if (kept.length >= 4) { setAnnouncement("Four choices kept. Remove one before keeping another."); return; }
    const nextKept = [...kept, item];
    setKept(nextKept);
    // Fill only the vacated slot, leaving the other two choices in place.
    const replacement = drawDiscoverySuggestions(pool, [...nextKept.map((candidate) => candidate.key), ...excludedSet, ...suggestions.filter((candidate) => candidate.key !== item.key).map((candidate) => candidate.key)], seen, suggestions.map((candidate) => candidate.key), Math.random, 1)[0];
    setSuggestions((current) => current.flatMap((candidate) => candidate.key !== item.key ? [candidate] : replacement ? [replacement] : []));
    if (replacement) setSeen((current) => [...new Set([...current, replacement.key])]);
    setAnnouncement(`${item.name} kept for comparison. Nothing added to the character.`);
  }
  async function add(item: DiscoverySuggestion) {
    setAdding(item.key); setError("");
    try {
      const priced = incrementalDiscoveryCost(item, suppliedSet, destinationIsItem) as DiscoverySuggestion;
      if (excludedSet.has(item.key)) return;
      if (replacing) await onReplace!(priced, replaceTarget!.key);
      else await onAdd(priced);
      setPendingAdded((keys) => [...new Set([...keys, item.key])]);
      setSuggestions((current) => current.filter((candidate) => candidate.key !== item.key));
      setAnnouncement(replacing ? `${item.name} replaces ${replaceTarget!.name} in the draft.` : `${item.name} added to the draft for ${destinationLabel}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add to draft."); }
    finally { setAdding(null); }
  }
  async function addSet() {
    if (!onAddSet || replacing || selectedSet.length < 2 || !setFits) return;
    setAdding("set"); setError("");
    try {
      await onAddSet(selectedSet);
      setPendingAdded((keys) => [...new Set([...keys, ...selectedSet.map((item) => item.key)])]);
      setSetKeys([]);
      setSuggestions((current) => current.filter((item) => !selectedSet.some((selected) => selected.key === item.key)));
      setAnnouncement(`${selectedSet.length} choices added together to the draft.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add this set. Nothing was added."); }
    finally { setAdding(null); }
  }
  function card(original: DiscoverySuggestion, retained: boolean) {
    const item = incrementalDiscoveryCost(original, suppliedSet, destinationIsItem) as DiscoverySuggestion;
    const alreadyAdded = excludedSet.has(item.key);
    const compatible = replacing ? item.kind === replaceTarget!.key.split(":")[0] : kinds.includes(item.kind);
    const affordable = item.mirrored ? (item.mirrorCredit ?? Infinity) <= Math.max(0, debtAvailable) : item.cost <= Math.max(0, currentBudget);
    return <article key={item.key} data-added={alreadyAdded} data-kept={retained} className="v12-workspace-suggestion-card rounded-lg border border-amber-200/40 bg-gradient-to-br from-slate-800/60 via-slate-950/80 to-black p-3 shadow-[inset_0_1px_rgba(255,239,186,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{retained && onAddSet && !replacing && <label className="discovery-set-choice"><input type="checkbox" disabled={!compatible || alreadyAdded || adding !== null} checked={setKeys.includes(item.key) && !alreadyAdded} onChange={(event) => setSetKeys((keys) => event.target.checked ? [...keys, item.key] : keys.filter((key) => key !== item.key))} /> Include in set</label>}<p data-copy="metadata" className="text-xs text-muted-foreground">{item.origin === "system" ? "System" : "Community"} · {item.kind}{item.versionNumber ? ` · v${item.versionNumber}` : ""}</p><h4 className="font-semibold">{item.name}</h4></div>
        <span className="discovery-cost shrink-0 text-sm text-amber-200">{item.mirrored ? `+${item.mirrorCredit} credit` : `${item.cost} BU`}</span>
      </div>
      <p data-copy="mechanical" className="mt-2 text-sm text-orange-200">{item.mirrored ? item.mirrorDescription : item.mechanicalDescription || "No mechanical summary. Preview this entry before choosing."}</p>
      {item.mirrored && <p data-copy="mechanical" className="mt-2 text-xs text-muted-foreground">Original rule: {item.mechanicalDescription}</p>}
      {item.description && <p data-copy="narrative" className="mt-2 text-sm text-muted-foreground">{item.description}</p>}
      <p data-copy="reason" className="mt-2 text-xs text-amber-100/80">{item.reason}</p>
      {!item.mirrored && item.libraryCost !== undefined && item.cost !== item.libraryCost && <p data-copy="metadata">{destinationIsItem ? "Item rules do not spend character BU." : `Estimated extra cost; ${item.libraryCost} BU in the Library. Already supplied rules are accounted for.`}</p>}
      {!compatible && <p className="discovery-replacement-note">Choose a compatible destination to use this piece.</p>}
      {!affordable && <p className="mt-2 text-sm text-orange-200">This exceeds your current {item.mirrored ? "drawback allowance" : "remaining budget"}. It stays here for comparison.</p>}
      <div className="discovery-card-actions mt-3 flex flex-wrap items-center gap-2">
        {onPreview && <button type="button" className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs" onClick={() => onPreview(item.key)}><Eye size={14} />Preview</button>}
        {retained ? <button type="button" className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs" aria-label={`Remove ${item.name} from considered choices`} onClick={() => { setKept((current) => current.filter((candidate) => candidate.key !== item.key)); setSetKeys((keys) => keys.filter((key) => key !== item.key)); setAnnouncement(`${item.name} removed from considered choices.`); }}><X size={14} />Remove</button>
          : <button type="button" disabled={kept.length >= 4} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs disabled:opacity-50" onClick={() => keep(item)}><BookmarkPlus size={14} />Keep</button>}
        <button type="button" disabled={!compatible || !affordable || alreadyAdded || adding !== null} className="inline-flex items-center gap-1 rounded border border-amber-200/60 bg-amber-200/10 px-2 py-1 text-xs text-amber-100 disabled:opacity-50" onClick={() => void add(item)}>{alreadyAdded ? <><Check size={14} />In draft</> : adding === item.key ? "Adding…" : replacing ? `Replace ${replaceTarget!.name}` : "Add to draft"}</button>
      </div>
    </article>;
  }
  return <section className="v12-workspace-suggestions space-y-3" aria-label="Purposeful character suggestions">
    <header><h3 className="font-semibold text-amber-100">What would you like to explore?</h3><p className="text-sm text-muted-foreground">Find ideas for {destinationLabel}. Keep options to compare, then add the ones you want to your draft.</p></header>
    {replaceTarget && onReplace && <div className="discovery-mode" aria-label="Suggestion operation"><button type="button" aria-pressed={!replacing} onClick={() => setReplaceMode(false)}>Add something</button><button type="button" aria-pressed={replacing} onClick={() => { setReplaceMode(true); setIntent("surprise"); }}>Replace {replaceTarget.name}</button></div>}
    {replacing && <p className="discovery-replacement-note">Find an alternative to this occurrence of {replaceTarget!.name}. The complete replacement is checked together before it enters the draft.</p>}
    <div className="discovery-intents flex flex-wrap gap-2">{DISCOVERY_INTENTS.map((item) => <button type="button" key={item.id} aria-pressed={intent === item.id} className={`rounded border px-2 py-1 text-xs ${intent === item.id ? "border-amber-200 bg-amber-200/15 text-amber-100" : "border-border text-muted-foreground"}`} onClick={() => setIntent(item.id)}>{item.label}</button>)}</div>
    <label className="block text-sm">Describe the idea<input className="mt-1 w-full rounded border border-border bg-background p-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example: hard to hurt with spells" maxLength={500} /></label>
    {/anti[ -]?magic/i.test(query) && <div className="flex flex-wrap gap-2 text-xs"><span>What should it do?</span>{["Resist magic", "Interrupt spells", "Detect magic", "Dispel magic"].map((choice) => <button type="button" key={choice} className="rounded border border-amber-200/40 px-2 py-1" onClick={() => setQuery(choice)}>{choice}</button>)}</div>}
    <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs">{intent === "weakness" ? "Maximum drawback credit" : "Spend up to"}<div className="mt-1 flex items-center gap-2"><input type="text" inputMode="decimal" aria-label="Suggestion BU allowance" className="w-24 rounded border border-border bg-background p-2 text-sm" placeholder={String(cap)} value={allowance} onChange={(event) => setAllowance(event.target.value)} /><span>BU · {cap} available</span></div></label><button type="button" disabled={isLoading || !pool.length || !validAllowance} onClick={shuffle} className="discovery-shuffle inline-flex items-center gap-2 rounded border border-amber-200/60 bg-gradient-to-br from-amber-200/20 to-amber-950/30 px-3 py-2 text-sm text-amber-100 disabled:opacity-50"><Shuffle size={16} />Shuffle ideas</button></div>
    {!validAllowance && <p role="alert" className="text-sm text-red-300">Enter zero or a positive number.</p>}
    {allowanceNumber > cap && <p className="text-xs text-muted-foreground">Using your available allowance of {cap} BU.</p>}
    <p className="text-xs text-muted-foreground">Matches names, descriptions, tags, families, and mechanical rules using related wording. Tiers are not locked by level. BU shows an estimate of extra character cost when your draft is available; review checks the complete result before applying.</p>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    {error && <div role="alert" className="text-sm text-red-300">{error} <button type="button" className="underline" onClick={() => setRetry((current) => current + 1)}>Retry</button></div>}
    {isLoading ? <p role="status" className="text-sm">Searching the complete compatible Library…</p> : <>
      <p className="text-xs text-muted-foreground">{pool.length} matching options · {catalogCount} Library entries checked</p>
      <div className="grid gap-3">{visibleSuggestions.map((item) => card(item, false))}</div>
      {!visibleSuggestions.length && <div className="rounded border border-border p-3 text-sm"><p>{pool.length ? "All matching choices are kept below. Remove one to explore it again, or change your search." : "No matching option fits this allowance. Try a broader idea, adjust the allowance, or build your own."}</p>{onBuildOwn && <button type="button" className="mt-2 text-amber-100 underline" onClick={onBuildOwn}>Build my own</button>}</div>}
      {visibleSuggestions.length > 0 && visibleSuggestions.length < 3 && <p className="text-xs text-muted-foreground">Only {visibleSuggestions.length} unkept matching {visibleSuggestions.length === 1 ? "option remains" : "options remain"}. Kept choices are never repeated here.</p>}
    </>}
    {!!kept.length && <section className="space-y-2 border-t border-amber-200/30 pt-3" aria-label="Considered suggestions"><h4 className="text-sm font-semibold text-amber-100">Kept for comparison · {kept.length}/4</h4><p className="text-xs text-muted-foreground">Keeping a choice does not spend BU or change your character.</p><div className="grid gap-3">{kept.map((item) => card(item, true))}</div>{onAddSet && !replacing && selectedSet.length > 0 && <div className="discovery-set-summary"><span>{selectedSet.length} selected · estimated {setCost.cost} BU{setCost.credit > 0 ? ` · +${setCost.credit} drawback credit` : ""}</span>{!setFits && <p>This set exceeds your remaining budget or drawback allowance.</p>}<button type="button" disabled={selectedSet.length < 2 || !setFits || adding !== null} onClick={() => void addSet()}>{adding === "set" ? "Checking set…" : "Add selected together"}</button><small>Reviewed as one change. Shared rules are counted in the estimate; the full draft validates cost and compatibility.</small></div>}</section>}
  </section>;
}
