"use client";

import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Dna, Eye, Hammer, Library, Plus, Redo2, Shield, Sparkles, Swords, Undo2, X } from "lucide-react";
import { useCharacterDraft } from "./use-character-draft";
import { CharacterFoundationEditor, type CharacterFoundationValues } from "./character-foundation-editor";
import { BuildLibrary } from "./build-library";
import { WorkspaceSuggestions } from "./workspace-suggestions";
import { EntityComposer } from "./entity-composer";
import { WorkspaceEntityPreview, loadEntityPreview, previewKind } from "./workspace-entity-preview";
import { EntityPreview } from "@/components/preview/entity-preview";
import { WorkspaceSurface } from "./workspace-surface";
import { useDrawerSlot } from "@/components/layout/build-preview-drawer";
import { useGlobalControls } from "@/components/layout/global-controls";
import { DraftCollaborationPanel, DraftChangeReview } from "./draft-collaboration-panel";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type { DraftOperation } from "@/lib/character/workspace/draft-types";
import { bundleBu, canContain, supplyPaths, type EntityKind, type EntityKey, type WorkspaceGraph, type WorkspaceNode, type WorkspaceCategory, type WorkspaceEdge } from "@/lib/character/workspace/model";
import { computeProgressionPool } from "@/lib/engine/bu-balance";
import { getVolatilityCeiling } from "@/lib/engine/bu";
import { mirrorConsequence } from "@/lib/character/mirror-suggestions";
import type { DiscoverySuggestion } from "@/lib/character/workspace/discovery/matching";
import { characterFormRecoveryKey } from "@/lib/sandbox/character-form-recovery";
import { Markdown } from "@/components/ui/markdown";

const roots = [
  { key: "ALL", name: "Overview", subtitle: "Your character's foundation", icon: Sparkles },
  { key: "LINEAGE", name: "Lineage", subtitle: "What comes from their nature", icon: Dna },
  { key: "UPBRINGING", name: "Upbringing", subtitle: "What life and training taught them", icon: Shield },
  { key: "MANIFEST", name: "Manifest", subtitle: "Who they are becoming", icon: Swords },
  { key: "ITEM", name: "Items", subtitle: "What they carry and wield", icon: Hammer },
] as const;
const names: Record<EntityKind, string> = { primitive: "Rule or trait", capability: "Capability", effect: "Reusable effect", heritage: "Heritage bundle", item: "Item" };
type Permission = "OWNER" | "EDITOR" | "SUGGESTER" | "VIEWER";
interface CharacterInfo extends CharacterFoundationValues { name: string; level: number; startingBu: number; dmBonusBu: number; buSpent: number; notes: string | null; backstory?: unknown }
const hash = (node: WorkspaceNode | undefined) => typeof node?.data["contentHash"] === "string" ? node.data["contentHash"] : null;

export function CharacterBuildWorkspace({ characterId, initialRoot = "ALL", permission, onPlay, initialIntent }: {
  characterId: string; initialRoot?: WorkspaceCategory; permission: Permission; onPlay: () => void; initialIntent?: "concept" | "foundation" | "backstory" | "items" | "overview";
}) {
  const router = useRouter();
  const controller = useCharacterDraft(characterId);
  const [base, setBase] = useState<WorkspaceGraph | null>(null);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [root, setRoot] = useState<WorkspaceCategory>(initialRoot);
  const [path, setPath] = useState<string[]>([]);
  const [source, setSource] = useState<"library" | "owned" | "suggestions">("library");
  const [mobile, setMobile] = useState<"find" | "build" | "preview">("build");
  const [composer, setComposer] = useState<{ kind: EntityKind; node?: WorkspaceNode; selection?: EntityKey[];selectionEdges?:WorkspaceEdge[] } | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [livePreview, setLivePreview] = useState<ReactNode>(null);
  const [incomingPiece, setIncomingPiece] = useState<{key: EntityKey;label:string;sequence:number;isMirrored?:boolean}|null>(null);
  const [leaveEditor, setLeaveEditor] = useState<{run:()=>void}|null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [foundationDirty, setFoundationDirty] = useState(false);
  const [foundation, setFoundation] = useState<"concept"|"foundation"|"backstory"|null>(null);
  const previewSequence = useRef(0);
  const [inspecting, setInspecting] = useState(false);
  const [inspect, setInspect] = useState<EntityKey | null>(null);
  const [external, setExternal] = useState<SandboxPreviewItem | null>(null);
  const [review, setReview] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [move, setMove] = useState<{ edge: WorkspaceEdge; path: string[]; reuse: boolean } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(true);
  const { openDrawer, closeDrawer } = useGlobalControls();
  const refresh = useCallback(async () => {
    const [graphResponse, characterResponse] = await Promise.all([fetch(`/api/characters/${characterId}/workspace`), fetch(`/api/characters/${characterId}`)]);
    const graph = await graphResponse.json(), info = await characterResponse.json();
    if (!graphResponse.ok || !characterResponse.ok) throw new Error(graph.error ?? info.error ?? "Unable to open character.");
    setBase(graph); setCharacter(info.character);
  }, [characterId]);
  // Initial fetch hydrates external character data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh().catch((cause) => setError(cause.message)); }, [refresh]);
  // Restore this character’s saved guidance preference.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHelp(localStorage.getItem(`sw:build-help:${characterId}`) !== "hidden"); }, [characterId]);
  const graph = controller.preview?.graph ?? base;
  const draftCharacter = useMemo(() => (controller.draft?.operations ?? []).reduce<CharacterFoundationValues>((value,operation) => operation.type === "character" ? {...value,...operation.payload} : value,character ?? {}),[character,controller.draft]);
  // Resume the exact authoring destination only after its server draft has resolved.
  useEffect(() => {
    if (contextReady || !graph || !controller.ready) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`sw:workshop-context:${characterId}`) ?? "null");
      if (saved && !initialIntent) {
        // Browser recovery is hydrated once after server data becomes available.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (roots.some(entry => entry.key === saved.root)) setRoot(saved.root);
        const validPath = Array.isArray(saved.path) && saved.path.every((id: unknown) => typeof id === "string" && graph.edges.some(edge => edge.id === id));
        if (validPath) setPath(saved.path);
        if (["library","owned","suggestions"].includes(saved.source)) setSource(saved.source);
        if (saved.composer && validPath && Object.hasOwn(names,saved.composer.kind)) {
          const node = graph.nodes.find(entry => entry.key === saved.composer.nodeKey);
          if (!saved.composer.nodeKey || node) setComposer({kind:saved.composer.kind,...(node ? {node} : {}),selection:saved.composer.selection,selectionEdges:saved.composer.selectionEdges});
        }
      }
    } catch { /* Recovery is optional if browser storage is unavailable. */ }
    setContextReady(true);
    // Hydration intentionally sets state once, after the graph and saved draft arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph,controller.ready,contextReady]);
  useEffect(() => {
    if (!contextReady) return;
    try { localStorage.setItem(`sw:workshop-context:${characterId}`, JSON.stringify({root,path,source,composer:composer ? {kind:composer.kind,nodeKey:composer.node?.key,selection:composer.selection,selectionEdges:composer.selectionEdges} : null})); }
    catch { /* Server-backed draft remains available. */ }
  },[characterId,contextReady,root,path,source,composer]);
  function discardUnfinished() {
    if (composer) {
      const session = `${composer.kind}:${composer.node?.key ?? "new"}:${path.join("/")}`;
      try { localStorage.removeItem(characterFormRecoveryKey(`character:${characterId}:${session}`,composer.kind)); } catch { /* Optional local recovery. */ }
    }
    try {
      if (foundation) localStorage.removeItem(characterFormRecoveryKey(`character:${characterId}:foundation`,"foundation"));
      localStorage.setItem(`sw:workshop-context:${characterId}`,JSON.stringify({root,path,source,composer:null}));
    } catch { /* Optional local recovery. */ }
    setComposer(null); setFoundationDirty(false); setIncomingPiece(null); setLivePreview(null);
  }
  const currentEdge = graph?.edges.find((edge) => edge.id === path.at(-1));
  const selected = graph?.nodes.find((node) => node.key === currentEdge?.child);
  const rootLabel = roots.find((entry) => entry.key === root)?.name ?? "Overview";
  const destination = composer ? composer.node?.name ?? `new ${composer.kind}` : selected?.name ?? rootLabel;
  const category: Exclude<WorkspaceCategory, "ALL"> = root === "ALL" ? "MANIFEST" : root;
  const destinationChosen = root !== "ALL";
  const kinds = useMemo<EntityKind[]>(() => composer
    ? (["primitive", "capability", "effect", "heritage", "item"] as EntityKind[]).filter((kind) => canContain(composer.kind, kind))
    : selected
    ? (["primitive", "capability", "effect", "heritage", "item"] as EntityKind[]).filter((kind) => canContain(selected.kind, kind))
    : root === "ITEM" ? ["item"] : ["primitive", "capability", "effect", "heritage"], [selected, root, composer]);
  const operations = controller.draft?.operations ?? [];
  const sheet = controller.preview?.sheet ?? controller.baseSheet;
  const pool = sheet?.buBalance.progressionPool ?? (character ? computeProgressionPool(character.startingBu, character.level, character.dmBonusBu) : 0);
  const spent = sheet?.buLedger.positiveSpent ?? character?.buSpent ?? 0;
  const credit = sheet?.volatility.rating ?? 0;
  const debtMax = sheet?.volatility.ceiling ?? getVolatilityCeiling(character?.level ?? 1).maxNegativeBu;
  const remaining = sheet ? pool - sheet.buLedger.netSpent : pool - spent;
  const busy = controller.busy;
  const compositionBlocked = busy || !!controller.error;
  function attempt(action: () => Promise<unknown>) { setError(""); void action().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to make this change.")); }
  function navigate(run:()=>void) { if (composer || foundationDirty) setLeaveEditor({run}); else run(); }
  useEffect(() => {
    if (!composer && !foundationDirty) return;
    function preventLoss(event: BeforeUnloadEvent) { event.preventDefault(); }
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [composer,foundationDirty]);
  useEffect(() => {
    // A scoped editor event can change the requested surface while mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialIntent === "items") setRoot("ITEM");
    else if (initialIntent && initialIntent !== "overview") setFoundation(initialIntent);
  }, [initialIntent]);
  function changeRoot(value: WorkspaceCategory) { navigate(() => { setRoot(value); setPath([]); setComposer(null); setInspect(null); setExternal(null); setSelectedRows([]); setShowCreate(false); setMobile("build"); }); }
  function openPiece(edge: WorkspaceEdge, parentPath = path) {
    navigate(() => { setPath([...parentPath, edge.id]); setComposer(null); setInspect(edge.child); setExternal(null); setSelectedRows([]); setShowCreate(false); setMobile("build"); });
  }
  async function stage(operation: DraftOperation) {
    if (!base) throw new Error("Character is still loading.");
    if (controller.error) throw new Error("Undo the last change or discard this draft before making more changes.");
    const result = await controller.stage(operation, base.revision);
    setNotice("Saved to draft. Your live character is unchanged.");
    return result;
  }
  async function add(key: EntityKey, name: string, mirrored = false) {
    if (!destinationChosen) { setNotice("Choose Lineage, Upbringing, Manifest, or Items before adding a piece."); setMobile("build"); return; }
    if (composer) { setInspecting(false); setIncomingPiece({key,label:name,sequence:Date.now(),isMirrored:mirrored}); setNotice(`Added ${name} to the open ${composer.kind}. Finish it to save to your draft.`); return; }
    const [kind, id] = key.split(":") as [EntityKind, string];
    const operation: DraftOperation = { id: crypto.randomUUID(), type: "create", label: `Add ${name} to ${destination}`, payload: {
      kind, category, existingId: id, draft: {}, mirrored,
      ...(selected ? { target: selected.key, path, expectedHash: hash(selected) } : {}),
    } };
    await stage(operation);
  }

  async function showPreview(key: EntityKey) {
    const request = ++previewSequence.current;
    setInspecting(true); setInspect(key); setExternal(null); setMobile("preview");
    if (!graph?.nodes.some((node) => node.key === key)) {
      const [kind, id] = key.split(":") as [EntityKind, string];
      const result = await loadEntityPreview(kind, id);
      if (previewSequence.current === request) setExternal(result);
    }
  }
  async function mutate(edge: WorkspaceEdge, edgePath: string[], operation: "remove" | "mirror") {
    if (!graph) return;
    const node = graph.nodes.find((n) => n.key === edge.child)!;
    const parent = graph.nodes.find((n) => n.key === edge.parent);
    await stage({ id: crypto.randomUUID(), type: "command", label: `${operation === "remove" ? "Remove" : "Mirror"} ${node.name}`, payload: parent
      ? { operation: operation === "remove" ? "remove-reference" : "mirror-reference", target: parent.key, path: edgePath.slice(0, -1), expectedHash: hash(parent), edgeId: edge.id }
      : { operation: operation === "remove" ? "detach" : "mirror-instance", target: node.key, path: edgePath, expectedHash: hash(node) } });
    setSelectedRows([]);
  }
  async function addSet(items: DiscoverySuggestion[]) {
    if (!base || !destinationChosen || composer) return;
    if (controller.error) throw new Error("Undo the last change or discard this draft before making more changes.");
    await controller.stageMany(items.map((item): DraftOperation => ({ id: crypto.randomUUID(), type: "create", label: `Add ${item.name} to ${destination}`, payload: {
      kind:item.kind, category, existingId:item.key.slice(item.key.indexOf(":")+1),draft:{},mirrored:item.mirrored,
      ...(selected ? {target:selected.key,path,expectedHash:hash(selected)} : {}),
    }})), base.revision);
    setNotice("Added the selected set to your draft.");
  }
  async function replace(item: DiscoverySuggestion) {
    if (!base || !graph || !currentEdge || !selected) return;
    if (controller.error) throw new Error("Undo the last change or discard this draft before making more changes.");
    const parent = graph.nodes.find((node) => node.key === currentEdge.parent);
    const operations: DraftOperation[] = [
      {id:crypto.randomUUID(),type:"create",label:`Replace ${selected.name} with ${item.name}`,payload:{kind:item.kind,category,existingId:item.key.slice(item.key.indexOf(":")+1),draft:{},mirrored:item.mirrored,...(parent?{target:parent.key,path:path.slice(0,-1),expectedHash:hash(parent)}:{})}},
      {id:crypto.randomUUID(),type:"command",label:`Remove replaced occurrence of ${selected.name}`,payload:parent?{operation:"remove-reference",target:parent.key,path:path.slice(0,-1),expectedHash:null,edgeId:currentEdge.id}:{operation:"detach",target:selected.key,path,expectedHash:hash(selected)}}
    ];
    await controller.stageMany(operations,base.revision);
    setPath(path.slice(0,-1)); setNotice("Replacement saved in your draft. Review its final cost and effects.");
  }
  const saveRequest: typeof fetch = async (_url, init) => {
    if (!composer || !graph) return Response.json({ error: "Select what to build first." }, { status: 400 });
    try {
      const form = { ...JSON.parse(String(init?.body ?? "{}")), isPublic: false };
      const id = crypto.randomUUID();
      const result = await stage(composer.node
        ? { id, type: "command", label: `Edit ${composer.node.name}`, payload: { operation: "edit", target: composer.node.key, path, expectedHash: hash(composer.node), draft: form } }
        : { id, type: "create", label: `Create ${form.name || names[composer.kind]} in ${destination}`, payload: { kind: composer.kind, category: composer.kind === "heritage" ? form.kind : category, draft: form, ...(selected ? { target: selected.key, path, expectedHash: hash(selected) } : {}) } });
      const saved = result.results.find((entry) => entry.operationId === id)?.result ?? {};
      const response = (saved["entityResponse"] ?? saved) as Record<string, unknown>;
      return Response.json(response);
    } catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : "Unable to add to draft." }, { status: 400 }); }
  };
  function startBuild(kind: EntityKind) { if (!destinationChosen) return; setInspecting(false); setIncomingPiece(null); setLivePreview(null); setComposer({ kind }); setShowCreate(false); setMobile("build"); }
  function row(edge: WorkspaceEdge, parentPath: string[] = path) {
    const node = graph?.nodes.find((entry) => entry.key === edge.child);
    if (!node) return null;
    const rowPath = [...parentPath, edge.id];
    const selectedRow = selectedRows.includes(edge.id);
    return <article key={edge.id} className={`sheet-piece ${selectedRow ? "is-selected" : ""}`}>
      <div className="sheet-piece-heading"><input type="checkbox" aria-label={`Select ${node.name}`} checked={selectedRow} onChange={() => setSelectedRows((old) => selectedRow ? old.filter((id) => id !== edge.id) : [...old, edge.id])}/><button type="button" onClick={() => openPiece(edge, parentPath)}><strong>{node.name}</strong><span>{names[node.kind]}{edge.isMirrored ? " · Mirrored" : ""}</span></button><span className="sheet-bu">{edge.isMirrored ? "−" : ""}{bundleBu(graph!, node.key)} BU</span></div>
      <p className="sheet-rule" data-copy-role="mechanical">{edge.isMirrored && node.kind === "primitive" ? mirrorConsequence({id:Number(node.id),buCost:node.bu,...node.data}) : String(node.data["mechanicalOutputText"] || node.description || "Open to explore the rules inside.")}</p>
      <div className="sheet-row-actions"><button type="button" onClick={() => attempt(() => showPreview(node.key))}><Eye size={14}/> Preview</button><button type="button" onClick={() => navigate(() => { setInspecting(false); setIncomingPiece(null); setLivePreview(null); setPath(rowPath); setComposer({ kind: node.kind, node }); setMobile("build"); })}>Edit</button><button type="button" disabled={busy} onClick={() => setMove({ edge, path: rowPath, reuse: false })}>Move</button><button type="button" disabled={busy} onClick={() => setMove({ edge, path: rowPath, reuse: true })}>Use in…</button>{node.kind === "primitive" && Boolean(node.data["isMirrorable"]) && <button type="button" disabled={busy} onClick={() => attempt(() => mutate(edge, rowPath, "mirror"))}>{edge.isMirrored ? "Restore benefit" : "Mirror"}</button>}<button type="button" disabled={busy} onClick={() => attempt(() => mutate(edge, rowPath, "remove"))}>Remove</button></div>
    </article>;
  }
  const inspection = graph?.nodes.find((node) => node.key === inspect) ?? selected;
  const preview = <div className="sheet-result"><header><span className="sheet-kicker">See the result</span><h3>{composer && !inspecting ? "Current build" : external?.row.name ?? inspection?.name ?? "Your character"}</h3>{composer && inspecting && <button className="sheet-button" type="button" onClick={() => setInspecting(false)}>Back to current build</button>}</header>
    {composer && livePreview && !inspecting ? livePreview : external ? <EntityPreview item={external}/> : inspection && graph ? <WorkspaceEntityPreview node={inspection} graph={graph} onOpen={(key) => attempt(() => showPreview(key))}/> : <p>Select a piece to read its rule and explore what it contains.</p>}
    <div className="sheet-ledger"><h4>Build Units</h4><dl><div><dt>Character budget</dt><dd>{pool}</dd></div><div><dt>Allocated</dt><dd>{spent}</dd></div><div><dt>Drawback credit</dt><dd>{credit} / {debtMax}</dd></div><div><dt>Available to spend</dt><dd>{remaining}</dd></div></dl><p>You can leave points unspent and add more later.</p></div>
    {sheet && controller.preview && <div className="sheet-ledger"><h4>Build preview</h4><p>Play toggles and current vitality are kept separately.</p><dl><div><dt>Max Vitality</dt><dd>{controller.preview.beforeSheet.vitality.max} → {sheet.vitality.max}</dd></div><div><dt>Carry capacity</dt><dd>{controller.preview.beforeSheet.carryCapacity} → {sheet.carryCapacity}</dd></div>{sheet.defensiveDCs.map((entry) => <div key={entry.attribute}><dt>{entry.attribute} defense</dt><dd>{controller.preview!.beforeSheet.defensiveDCs.find((old) => old.attribute === entry.attribute)?.dc} → {entry.dc}</dd></div>)}</dl></div>}
  </div>;
  // The composer owns the drawer while authoring. Otherwise offer contextual actions.
  const drawerOverview = { build: <div className="sheet-drawer-overview"><h3>Build on your character</h3><p>Choose where the next piece belongs. Your draft stays with this character.</p>{roots.filter((entry) => entry.key !== "ALL").map((entry) => <button className="sheet-button" key={entry.key} onClick={() => { changeRoot(entry.key); closeDrawer(); }}><entry.icon size={18}/>{entry.name}<small>{entry.subtitle}</small></button>)}<button className="sheet-button" onClick={() => { setReview(true); closeDrawer(); }}>Review draft · {operations.length} changes</button></div>, preview };
  useDrawerSlot(composer ? {} : drawerOverview);
  if (!base || !character || !controller.ready) return <section className="sheet-build"><p role="status">Opening character workspace…</p>{(error || controller.error) && <p role="alert">{error || controller.error}</p>}</section>;
  const children = graph!.edges.filter((edge) => selected ? edge.parent === selected.key : edge.parent === null && (root === "ALL" || edge.category === root)).sort((a,b) => a.order-b.order);
  const chooser = <div className="sheet-create-menu"><h3>What are you making?</h3><p>Start with the idea. The preview will show its rule and cost.</p>{kinds.map((kind) => <button type="button" className="sheet-create-choice" key={kind} onClick={() => startBuild(kind)}><Plus size={18}/><span><strong>{names[kind]}</strong><small>{kind === "primitive" ? "A single rule, bonus, subject, or drawback" : kind === "capability" ? "An ability made from the rules you choose" : kind === "heritage" ? "Group traits under a part of your story" : kind === "item" ? "Equipment and the abilities it supplies" : "A group of rules to reuse in abilities"}</small></span><ChevronRight size={16}/></button>)}</div>;
  const find = <aside className="sheet-find"><header><span className="sheet-kicker">Discover & compose</span><h3>Find something</h3></header><nav className="sheet-source-tabs" aria-label="Find sources">{([["library", "Library"], ["owned", "On character"], ["suggestions", "Ideas"]] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={source === value} onClick={() => setSource(value)}>{label}</button>)}</nav><div className="sheet-destination"><small>Adding to</small><strong>{destinationChosen ? destination : "Choose a heritage or Items"}</strong></div>
    {!destinationChosen && <p className="sheet-empty">Choose a destination in the center to start. Nothing is added until you choose it.</p>}<div hidden={!destinationChosen}>
    <div hidden={source !== "library"}>{!kinds.length ? <p className="sheet-empty">This is a single rule. Return to its parent to add another piece.</p> : <BuildLibrary kinds={kinds} destination={destination} disabled={compositionBlocked} onAdd={(key,name) => attempt(() => add(key,name))} onPreview={(item) => attempt(() => showPreview(`${previewKind(item.targetType)}:${item.targetId}`))}/>}</div>
    <div hidden={source !== "owned"}><p>Reuse a rule you already have. Its conditions and source still apply.</p>{graph!.nodes.filter((node) => kinds.includes(node.kind)).map((node) => <article className="sheet-catalogue-row" key={node.key}><strong>{node.name}</strong><p className="sheet-rule" data-copy-role="mechanical">{String(node.data["mechanicalOutputText"] || node.description)}</p><div className="sheet-row-actions"><button type="button" onClick={() => attempt(() => showPreview(node.key))}>Preview</button><button type="button" disabled={busy} onClick={() => attempt(() => add(node.key,node.name))}>Use in {destination}</button></div></article>)}</div>
    <div hidden={source !== "suggestions"}><WorkspaceSuggestions characterId={characterId} destinationLabel={destination} kinds={kinds} graph={graph!} destinationIsItem={root === "ITEM"} budget={Math.max(0, remaining)} debtAvailable={Math.max(0,debtMax-credit)} excludedKeys={graph!.nodes.map((node) => node.key)} onAdd={(item) => add(item.key,item.name,item.mirrored)} {...(!composer ? {onAddSet:addSet} : {})} {...(selected && !composer ? {replaceTarget:{key:selected.key,name:selected.name,availableBudget:Math.max(0,remaining + bundleBu(graph!,selected.key))},onReplace:replace} : {})} onPreview={(key) => attempt(() => showPreview(key))} onBuildOwn={() => { setShowCreate(true); setMobile("build"); }}/></div></div>
  </aside>;
  const center = <main className="sheet-composition"><header className="sheet-composition-heading"><div><span className="sheet-kicker">{rootLabel}</span><nav aria-label="Composition path"><button type="button" onClick={() => { navigate(() => { setPath([]); setComposer(null); }); }}>{rootLabel}</button>{path.map((id,index) => { const edge = graph!.edges.find((entry) => entry.id === id); const node = graph!.nodes.find((entry) => entry.key === edge?.child); return node ? <span key={id}><ChevronRight size={13}/><button type="button" onClick={() => { navigate(() => { setPath(path.slice(0,index+1)); setComposer(null); }); }}>{node.name}</button></span> : null; })}</nav></div>{composer && <button type="button" className="sheet-button" onClick={() => navigate(() => setComposer(null))}><ArrowLeft size={14}/> Composition</button>}</header>
    {composer ? <EntityComposer key={`${composer.kind}:${composer.node?.key ?? "new"}`} graph={graph!} kind={composer.kind} {...(composer.node ? { node: composer.node } : {})} category={category === "ITEM" ? "MANIFEST" : category} sessionKey={`${composer.kind}:${composer.node?.key ?? "new"}:${path.join("/")}`} incomingPiece={incomingPiece} onPreviewChange={setLivePreview} integratedSources selection={composer.selection ?? []} selectionEdges={composer.selectionEdges ?? []} saveRequest={saveRequest} onSaved={() => { setComposer(null); closeDrawer(); setSelectedRows([]); }}/>
    : root === "ALL" ? <div className="sheet-overview"><h2>Make {draftCharacter.name} yours.</h2><p>Build from their story. Add a trait, shape an ability, or give them something to wield. You do not need to fill every heritage or spend every point.</p>{draftCharacter.notes && <details className="sheet-concept"><summary>Your character concept</summary><Markdown>{String(draftCharacter.notes)}</Markdown></details>}<div className="sheet-composition-actions"><button className="sheet-button is-gold" onClick={() => setFoundation("concept")}>Edit concept & roots</button><button className="sheet-button" onClick={() => setFoundation("foundation")}>Body & strengths</button><button className="sheet-button" onClick={() => setFoundation("backstory")}>Backstory</button></div><div className="sheet-roots-grid">{roots.filter((entry) => entry.key !== "ALL").map((entry) => { const count = graph!.edges.filter((edge) => edge.parent === null && edge.category === entry.key).length; return <button type="button" className="sheet-root-card" key={entry.key} onClick={() => changeRoot(entry.key)}><span className="sheet-medallion"><entry.icon size={24}/></span><span><strong>{entry.name}</strong><p>{entry.subtitle}</p><small>{count} direct {count === 1 ? "piece" : "pieces"}</small></span><ArrowRight size={18}/></button>; })}</div><details className="sheet-explainer"><summary>How the pieces fit together</summary><p>A primitive is a rule you purchase. A capability is an ability built with those rules. Heritages explain where your traits and abilities come from; items keep their own effects.</p><p>Range and effect dice require their access rules. At the table, describe targets, shape, scale, duration, and casting time; larger or faster effects may raise Strain. You and the DM agree on the cost before rolling.</p></details></div>
    : <><div className="sheet-section-intro"><h2>{selected?.name ?? roots.find((entry) => entry.key === root)?.subtitle}</h2><p>{selected ? selected.description : root === "LINEAGE" ? "Inherited, built, or transformed: add what belongs to their nature." : root === "UPBRINGING" ? "Their upbringing, background, and training. What did experience teach them?" : root === "MANIFEST" ? "Their developing powers, disciplines, and role. Who are they becoming?" : "Equipment has its own rules and availability. Its BU stays separate."}</p></div>
      {help && <div className="sheet-guidance"><span>Find an existing piece on the left, or build your own. Every change stays in your draft until you apply it.</span><button type="button" aria-label="Dismiss editing guidance" onClick={() => { setHelp(false); localStorage.setItem(`sw:build-help:${characterId}`,"hidden"); }}><X size={15}/></button></div>}
      <div className="sheet-composition-actions"><button type="button" className="sheet-button is-gold" disabled={!kinds.length} onClick={() => setShowCreate(!showCreate)}><Plus size={15}/> Build your own</button><button type="button" className="sheet-button" onClick={() => { setSource("library"); setMobile("find"); }}><Library size={15}/> Find in Library</button>{selected && <button className="sheet-button" type="button" onClick={() => setComposer({kind:selected.kind,node:selected})}>Edit details</button>}</div>
      {showCreate && chooser}
      {selectedRows.length > 0 && !selected && <div className="sheet-guidance"><strong>{selectedRows.length} selected</strong><button className="sheet-button" type="button" disabled={children.some(edge => selectedRows.includes(edge.id) && !canContain("capability", edge.child.split(":")[0] as EntityKind))} onClick={() => { const keys = children.filter((edge) => selectedRows.includes(edge.id)).map((edge) => edge.child); setComposer({kind:"capability",selection:keys,selectionEdges:children.filter(edge => selectedRows.includes(edge.id))}); }}>Use in new capability</button><button className="sheet-button" type="button" disabled={children.some(edge => selectedRows.includes(edge.id) && (!canContain("heritage", edge.child.split(":")[0] as EntityKind) || Number(edge.data?.["quantity"] ?? 1) !== 1))} onClick={() => { const keys = children.filter((edge) => selectedRows.includes(edge.id)).map((edge) => edge.child); setComposer({kind:"heritage",selection:keys,selectionEdges:children.filter(edge => selectedRows.includes(edge.id))}); }}>Use in new heritage</button></div>}
      <div className="sheet-pieces">{children.map((edge) => row(edge))}{!children.length && <div className="sheet-empty"><Sparkles size={24}/><h3>{selected?.kind === "primitive" ? "A single rule" : "Room for your next idea"}</h3><p>{selected?.kind === "primitive" ? "Edit this rule or preview its effect. Rules do not contain other pieces." : "Add only what helps express this character. An empty heritage is fine."}</p></div>}</div></>}
  </main>;
  return <section className="sheet-build" data-mobile-view={mobile} data-preview-collapsed={previewCollapsed}>
    <header className="sheet-build-top"><div><span className="sheet-kicker">Character workshop</span><h2>{draftCharacter.name}<span>{permission === "SUGGESTER" ? "Proposed changes" : "Build"}</span></h2></div><div className="sheet-top-actions"><span role="status">{busy ? "Saving & checking…" : controller.error ? "Draft needs attention" : operations.length ? "Draft saved" : "No pending changes"}</span><button type="button" className="sheet-button sheet-preview-toggle" aria-pressed={!previewCollapsed} onClick={() => setPreviewCollapsed(value => !value)}>{previewCollapsed ? "Show preview" : "Hide preview"}</button><button type="button" className="sheet-button" onClick={() => openDrawer("build")}><Eye size={15}/> Build & Preview</button><button type="button" className="sheet-button" onClick={() => navigate(onPlay)}>Back to play</button></div></header>
    <nav className="sheet-root-nav" aria-label="Character roots">{roots.map((entry) => <button type="button" key={entry.key} aria-pressed={root === entry.key} onClick={() => changeRoot(entry.key)}><entry.icon size={16}/>{entry.name}</button>)}</nav>
    <div className="sheet-build-budget"><span><b>{remaining}</b> BU available</span><span>{spent} allocated · {pool} budget</span><span>Drawbacks {credit}/{debtMax}</span><span className="sheet-budget-note">Leaving BU unspent is fine.</span></div>
    {remaining < 0 && <p className="sheet-error" role="alert">This build is {Math.abs(remaining)} BU over budget. Review it with your group before applying.</p>}{(error || controller.error) && <p className="sheet-error" role="alert">{error || controller.error}{controller.error && <button className="sheet-button" onClick={() => setReview(true)}>Review or discard draft</button>}</p>}{notice && <div className="sheet-notice" role="status">{notice}{controller.canUndoApplied && <button className="sheet-button" disabled={busy || operations.length > 0} onClick={() => attempt(async () => {const result=await controller.undoApplied();if(result){setBase(result.graph);await refresh();router.refresh();setNotice("Restored the previous build. Play state was kept.");}})}>Undo applied build</button>}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={13}/></button></div>}
    <nav className="sheet-mobile-nav" aria-label="Workshop views">{(["find","build","preview"] as const).map((view) => <button type="button" key={view} aria-pressed={mobile === view} onClick={() => {setMobile(view);if(view === "preview") setPreviewCollapsed(false);}}>{view}</button>)}</nav>
    <Group orientation="horizontal" className="sheet-build-panels" id={`sheet-build-${characterId}`}>
      <Panel id="find" defaultSize="27%" minSize="19%" className="sheet-panel-find">{find}</Panel><Separator className="sheet-panel-separator"/>
      <Panel id="build" defaultSize="48%" minSize="32%" className="sheet-panel-build">{center}</Panel>{!previewCollapsed && <><Separator className="sheet-panel-separator"/>
      <Panel id="preview" defaultSize="25%" minSize="19%" className="sheet-panel-preview">{preview}</Panel></>}
    </Group>
    <footer className="sheet-draft-footer"><div><button type="button" className="sheet-button" disabled={busy || !operations.length} onClick={() => attempt(controller.undo)} aria-label="Undo draft change"><Undo2 size={16}/> Undo</button><button type="button" className="sheet-button" disabled={busy || !controller.canRedo} onClick={() => attempt(controller.redo)} aria-label="Redo draft change"><Redo2 size={16}/> Redo</button></div><span>{operations.length ? `${operations.length} pending changes` : "Your live character is unchanged"}</span><button type="button" className="sheet-button is-gold" onClick={() => setReview(true)}>Review {operations.length > 0 ? `changes (${operations.length})` : "& collaborate"}<ArrowRight size={15}/></button></footer>
    {review && <WorkspaceSurface modal title="Review character changes" kicker="Your draft" onClose={() => setReview(false)}><div className="sheet-review"><p>Check the rules, placement, and budget before updating your character. Current vitality and other play state stay separate.</p>{operations.length ? <ol>{operations.map((operation,index) => <li key={operation.id}><span>{String(index+1).padStart(2,"0")}</span>{operation.label ?? operation.type}</li>)}</ol> : <p>No pending build changes.</p>}{controller.preview?.warnings?.map(warning => <p className="sheet-guidance" key={warning}>{warning}</p>)}{controller.preview && <DraftChangeReview preview={controller.preview}/>}<div className="sheet-review-commit">{operations.length > 0 && <button className="sheet-button" disabled={busy} onClick={() => setConfirmDiscard(true)}>Discard draft</button>}<button className="sheet-button" type="button" onClick={() => setReview(false)}>Keep editing</button>{permission !== "SUGGESTER" && <button className="sheet-button is-gold" type="button" disabled={busy || !operations.length || !!controller.error} onClick={() => attempt(async () => { const result = await controller.apply(); if (result) { setBase(result.graph); setPath([]); setReview(false); setNotice("Changes applied to your character."); await refresh(); router.refresh(); } })}><Check size={16}/> Apply changes</button>}</div><DraftCollaborationPanel characterId={characterId} permission={permission} draft={controller.draft} onApplied={() => { void refresh(); void controller.reload(); router.refresh(); }}/></div></WorkspaceSurface>}
    {foundation && <WorkspaceSurface modal title="Character foundation" kicker="Your character draft" onClose={() => navigate(() => {setFoundationDirty(false);setFoundation(null);})}><CharacterFoundationEditor characterId={characterId} character={character} operations={operations} initialSection={foundation} busy={busy} onDirtyChange={setFoundationDirty} onClose={() => {setFoundationDirty(false);setFoundation(null);}} onSave={async payload => {await stage({id:crypto.randomUUID(),type:"character",label:"Update character foundation",payload});setFoundationDirty(false);setFoundation(null);}}/></WorkspaceSurface>}
    {confirmDiscard && <WorkspaceSurface modal title="Discard this draft?" kicker="Live character stays unchanged" onClose={() => setConfirmDiscard(false)}><div className="sheet-review"><p>This removes the pending changes in this draft. It does not undo an applied build.</p><div className="sheet-row-actions"><button className="sheet-button" onClick={() => setConfirmDiscard(false)}>Keep draft</button><button className="sheet-button" disabled={busy} onClick={() => attempt(async () => {await controller.discard();await refresh();setConfirmDiscard(false);setReview(false);setPath([]);setNotice("Draft discarded. Your live character is unchanged.");})}>Discard pending changes</button></div></div></WorkspaceSurface>}
    {leaveEditor && <WorkspaceSurface modal title="Unfinished changes" kicker="Keep your work" onClose={() => setLeaveEditor(null)}><div className="sheet-review"><p>These fields have not been added to your draft yet. Finish editing before leaving, or discard this unfinished form. Your saved draft is kept.</p><div className="sheet-row-actions"><button className="sheet-button is-gold" onClick={() => setLeaveEditor(null)}>Keep working</button><button className="sheet-button" onClick={() => {discardUnfinished();leaveEditor.run();setLeaveEditor(null);}}>Discard unfinished form</button></div></div></WorkspaceSurface>}
    {move && <WorkspaceSurface modal title={`${move.reuse ? "Use" : "Move"} ${graph!.nodes.find((node) => node.key === move.edge.child)?.name ?? "piece"}`} kicker="Choose a destination" onClose={() => setMove(null)}><div className="sheet-move-options"><p>{move.reuse ? "Keep the current source and use its rule in another composition." : "Move this occurrence. The preview will show any change to cost or availability."}</p>{roots.filter((entry) => entry.key !== "ALL" && entry.key !== "ITEM").map((entry) => <button className="sheet-button" type="button" key={entry.key} disabled={busy || move.reuse || move.edge.child.startsWith("heritage:") || move.edge.child.startsWith("item:")} onClick={() => attempt(async () => { await stage({id:crypto.randomUUID(),type:"relocate",label:`Move to ${entry.name}`,path:move.path,category:entry.key}); setMove(null); setPath([]); })}>{entry.name} · direct piece</button>)}{graph!.nodes.filter((node) => node.key !== move.edge.child && canContain(node.kind, move.edge.child.split(":")[0] as EntityKind)).map((node) => { const destPath = supplyPaths(graph!,node.key)[0]?.edges.map((edge) => edge.id); return destPath ? <button className="sheet-button" type="button" key={node.key} disabled={busy} onClick={() => attempt(async () => { if (move.reuse) await stage({id:crypto.randomUUID(),type:"command",label:`Use in ${node.name}`,payload:{operation:"add-reference",target:node.key,path:destPath,expectedHash:hash(node),child:move.edge.child,membership:{...move.edge.data,isMirrored:move.edge.isMirrored}}}); else await stage({id:crypto.randomUUID(),type:"relocate",label:`Move into ${node.name}`,path:move.path,destinationPath:destPath,category}); setMove(null); })}>{node.name}<small>{names[node.kind]}</small></button> : null; })}</div></WorkspaceSurface>}
  </section>;
}
