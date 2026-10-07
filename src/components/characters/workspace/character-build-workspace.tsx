"use client";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
import { browserUuid } from "@/lib/browser-uuid";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useRouter } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Dna, Eye, Hammer, Library, Plus, Redo2, Shield, Sparkles, Swords, Undo2, X } from "lucide-react";
import { FabThemeIcon } from "@/components/layout/fab-theme-icon";
import { resolveComposerHandoff } from "@/lib/character/workspace/composer-handoff";
import { useCharacterDraft } from "./use-character-draft";
import { CharacterFoundationEditor, type CharacterFoundationValues } from "./character-foundation-editor";
import { BuildLibrary } from "./build-library";
import { WorkspaceSuggestions } from "./workspace-suggestions";
import { EntityComposer } from "./entity-composer";
import { WorkspaceEntityPreview, previewKind } from "./workspace-entity-preview";
import { type PreviewActionProps } from "@/components/preview/preview-shared";
import { EntityPreview, FetchedEntityPreview } from "@/components/preview/entity-preview";
import { useModalStack } from "@/components/ui/modal-stack";
import { OPEN_PREVIEW_EVENT_NAME, type OpenPreviewEvent } from "@/lib/sandbox/slot-events";
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
import type { QuickRuleSeed } from "@/lib/character/workspace/discovery/quick-rules";
import { draftReviewChangeCount } from "./draft-change-review-model";
import { ProceduralRandomizer, type RandomizerHeritage } from "./procedural-randomizer";
import type { GeneratedProposal } from "@/lib/character/workspace/discovery/procedural-generator";
import { readJsonResponse } from "@/lib/http/read-json-response";
import { Markdown } from "@/components/ui/markdown";

const roots = [
  { key: "ALL", name: "Overview", subtitle: "Your character's foundation", icon: Sparkles },
  { key: "LINEAGE", name: "Lineage", subtitle: "What comes from their nature", icon: Dna },
  { key: "UPBRINGING", name: "Upbringing", subtitle: "What life and training taught them", icon: Shield },
  { key: "MANIFEST", name: "Manifest", subtitle: "Who they are becoming", icon: Swords },
  { key: "ITEM", name: "Items", subtitle: "What they carry and wield", icon: Hammer },
] as const;
const names: Record<EntityKind, string> = { primitive: "Rule or trait", capability: "Capability", effect: "Reusable effect", heritage: "Heritage bundle", item: "Item" };
type ComposerSession = { kind: EntityKind; node?: WorkspaceNode; selection?: EntityKey[];selectionEdges?:WorkspaceEdge[]; primitiveSeed?:QuickRuleSeed; generatedNodes?:WorkspaceNode[]; capabilitySeed?:{name:string;description:string;type:string;sourceType:string} } & {sessionId?:string;sourceOnly?:boolean;sourceGraph?:WorkspaceGraph};
type Permission = "OWNER" | "EDITOR" | "SUGGESTER" | "VIEWER";
interface CharacterInfo extends CharacterFoundationValues { name: string; level: number; startingBu: number; dmBonusBu: number; buSpent: number; notes: string | null; backstory?: unknown }
const hash = (node: WorkspaceNode | undefined) => typeof node?.data["contentHash"] === "string" ? node.data["contentHash"] : null;

export function CharacterBuildWorkspace({ characterId, initialRoot = "ALL", permission, onPlay, initialIntent }: {
  characterId: string; initialRoot?: WorkspaceCategory; permission: Permission; onPlay: () => void; initialIntent?: "concept" | "foundation" | "backstory" | "items" | "overview";
}) {
  const router = useRouter();
  const phone = useIsMobile();
  const controller = useCharacterDraft(characterId);
  const [base, setBase] = useState<WorkspaceGraph | null>(null);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [randomizer,setRandomizer] = useState(false);
  const [root, setRoot] = useState<WorkspaceCategory>(initialRoot);
  const [path, setPath] = useState<string[]>([]);
  const [source, setSource] = useState<"library" | "owned" | "suggestions">("library");
  const [mobile, setMobile] = useState<"find" | "build" | "preview">("build");
  const [phoneTools, setPhoneTools] = useState(false);
  const [composer, setComposer] = useState<ComposerSession | null>(null);
  const [sendToModal,setSendToModal]=useState(false);
  const [modalComposer,setModalComposer]=useState<ComposerSession|null>(null);
  const [modalIncoming,setModalIncoming]=useState<{key:EntityKey;label:string;sequence:number}|null>(null);
  const [modalPreview,setModalPreview]=useState<ReactNode>(null);
  const [modalCategory,setModalCategory]=useState<Exclude<WorkspaceCategory,"ALL">>("MANIFEST");
  const [modalPath,setModalPath]=useState<string[]>([]);
  const [replaceModal,setReplaceModal]=useState<(()=>void)|null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [livePreview, setLivePreview] = useState<ReactNode>(null);
  const [incomingPiece, setIncomingPiece] = useState<{key: EntityKey;label:string;sequence:number;isMirrored?:boolean}|null>(null);
  const [leaveEditor, setLeaveEditor] = useState<{run:()=>void}|null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [foundationDirty, setFoundationDirty] = useState(false);
  const [foundation, setFoundation] = useState<"concept"|"foundation"|"backstory"|null>(null);
  const { push: pushPreview, clear: clearPreview } = useModalStack();
  const [inspecting, setInspecting] = useState(false);
  const [inspect, setInspect] = useState<EntityKey | null>(null);
  const [external, setExternal] = useState<SandboxPreviewItem | null>(null);
  const [review, setReview] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectingPieces,setSelectingPieces] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [move, setMove] = useState<{ edge: WorkspaceEdge; path: string[]; reuse: boolean } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(true);
  const { dark, openDrawer, closeDrawer } = useGlobalControls();
  const refresh = useCallback(async () => {
    const [graphResponse, characterResponse] = await Promise.all([fetch(`/api/characters/${characterId}/workspace`), fetch(`/api/characters/${characterId}`)]);
    const graph = await readJsonResponse(graphResponse), info = await readJsonResponse(characterResponse);
    if (!graphResponse.ok || !characterResponse.ok) throw new Error(graph.error ?? info.error ?? "Unable to open character.");
    setBase(graph); setCharacter(info.character);
  }, [characterId]);
  // Initial fetch hydrates external character data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh().catch((cause) => setError(cause.message)); }, [refresh]);
  // Restore this character’s saved guidance preference.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHelp(localStorage.getItem(`sw:build-help:${characterId}`) !== "hidden"); }, [characterId]);
  const graph = useMemo(() => {
    const value=controller.preview?.graph ?? base;if(!value)return value;
    const sources=[composer?.sourceGraph,modalComposer?.sourceGraph].filter((v):v is WorkspaceGraph=>!!v);
    const extra=[...(composer?.generatedNodes ?? []),...(modalComposer?.generatedNodes ?? []),...sources.flatMap(g=>g.nodes)];
    const nodes=[...value.nodes,...extra.filter((n,index)=>!value.nodes.some(old=>old.key===n.key) && extra.findIndex(other=>other.key===n.key)===index)];
    const edges=[...value.edges,...sources.flatMap(g=>g.edges).filter((edge,index,all)=>edge.parent && !value.nodes.some(n=>n.key===edge.parent) && all.findIndex(e=>e.id===edge.id)===index)];
    return {...value,nodes,edges};
  },[controller.preview?.graph,base,composer,modalComposer]);
  function showPreview(key: EntityKey, label?: string) {
    const node = graph?.nodes.find((entry) => entry.key === key);
    const [kind, id] = key.split(":") as [EntityKind, string];
    pushPreview({
      key: `workspace-preview:${key}`,
      label: node?.name ?? label ?? "Piece preview",
      category: kind,
      content: node && graph
        ? <WorkspaceEntityPreview node={node} graph={graph} onOpen={showPreview} actionBar={entryActions(key, node.name)}/>
        : <FetchedEntityPreview targetType={kind.toUpperCase()} targetId={id} actionBar={entryActions(key, label ?? "this entry")} onSubLinkClick={link => showPreview(`${previewKind(link.targetType)}:${link.targetId}`, link.label)}/>,
    });
  }
  useEffect(() => {
    const open = (event: Event) => {
      const {targetType, targetId, label} = (event as CustomEvent<OpenPreviewEvent>).detail;
      showPreview(`${previewKind(targetType)}:${targetId}`, label);
    };
    window.addEventListener(OPEN_PREVIEW_EVENT_NAME, open);
    return () => window.removeEventListener(OPEN_PREVIEW_EVENT_NAME, open);
  });
  const draftCharacter = useMemo(() => (controller.draft?.operations ?? []).reduce<CharacterFoundationValues>((value,operation) => operation.type === "character" ? {...value,...operation.payload} : value,character ?? {}),[character,controller.draft]);
  // Resume the exact authoring destination only after its server draft has resolved.
  useEffect(() => {
    if (contextReady || !graph || !controller.ready) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`sw:workshop-context:${characterId}`) ?? "null");
      if(saved?.modalComposer && Object.hasOwn(names,saved.modalComposer.kind)) {
        // Restore the independent editor once after browser context is loaded.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setModalComposer(saved.modalComposer);setModalPath(saved.modalPath ?? []);
        if(["LINEAGE","UPBRINGING","MANIFEST","ITEM"].includes(saved.modalCategory))setModalCategory(saved.modalCategory);
      }
      if (saved && !initialIntent) {
        // Browser recovery is hydrated once after server data becomes available.
        if (roots.some(entry => entry.key === saved.root)) setRoot(saved.root);
        const validPath = Array.isArray(saved.path) && saved.path.every((id: unknown) => typeof id === "string" && graph.edges.some(edge => edge.id === id));
        if (validPath) setPath(saved.path);
        if (["library","owned","suggestions"].includes(saved.source)) setSource(saved.source);
        if (saved.composer && validPath && Object.hasOwn(names,saved.composer.kind)) {
          const node = graph.nodes.find(entry => entry.key === saved.composer.nodeKey) ?? saved.composer.sourceGraph?.nodes.find((entry:WorkspaceNode)=>entry.key===saved.composer.nodeKey);
          if (!saved.composer.nodeKey || node) setComposer({kind:saved.composer.kind,...(node ? {node} : {}),selection:saved.composer.selection,selectionEdges:saved.composer.selectionEdges,generatedNodes:saved.composer.generatedNodes,capabilitySeed:saved.composer.capabilitySeed,sourceOnly:saved.composer.sourceOnly,sourceGraph:saved.composer.sourceGraph,sessionId:saved.composer.sessionId,...(saved.composer.primitiveSeed ? {primitiveSeed:saved.composer.primitiveSeed} : {})});
        }
      }
    } catch { /* Recovery is optional if browser storage is unavailable. */ }
    setContextReady(true);
    // Hydration intentionally sets state once, after the graph and saved draft arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph,controller.ready,contextReady]);
  useEffect(() => {
    if (!contextReady) return;
    try { localStorage.setItem(`sw:workshop-context:${characterId}`, JSON.stringify({root,path,source,modalComposer,modalCategory,modalPath,composer:composer ? {kind:composer.kind,sessionId:composer.sessionId,sourceOnly:composer.sourceOnly,sourceGraph:composer.sourceGraph,nodeKey:composer.node?.key,selection:composer.selection,selectionEdges:composer.selectionEdges,primitiveSeed:composer.primitiveSeed,generatedNodes:composer.generatedNodes,capabilitySeed:composer.capabilitySeed} : null})); }
    catch { /* Server-backed draft remains available. */ }
  },[characterId,contextReady,root,path,source,composer,modalComposer,modalCategory,modalPath]);
  function discardUnfinished() {
    if (composer) {
      const session = `middle:${composer.sessionId ?? composer.kind}:${composer.node?.key ?? composer.primitiveSeed?.key ?? "new"}:${path.join("/")}`;
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
  const libraryKinds: EntityKind[] = ["primitive", "effect", "capability", "heritage", "item"];
  const kinds: EntityKind[] = composer ? libraryKinds.filter(kind => canContain(composer.kind,kind)) : selected ? libraryKinds.filter(kind => canContain(selected.kind,kind)) : root === "ITEM" ? ["item"] : ["primitive","capability","effect","heritage"];
  const operations = controller.draft?.operations ?? [];
  const changeCount = useMemo(()=>controller.preview ? draftReviewChangeCount(controller.preview) ?? 0 : 0,[controller.preview]);
  const sheet = controller.preview?.sheet ?? controller.baseSheet;
  const pool = sheet?.buBalance.progressionPool ?? (character ? computeProgressionPool(character.startingBu, character.level, character.dmBonusBu) : 0);
  const spent = sheet?.buLedger.positiveSpent ?? character?.buSpent ?? 0;
  const credit = sheet?.volatility.rating ?? 0;
  const debtMax = sheet?.volatility.ceiling ?? getVolatilityCeiling(character?.level ?? 1).maxNegativeBu;
  const remaining = sheet ? pool - sheet.buLedger.netSpent : pool - spent;
  const busy = controller.busy || controller.phase !== "idle";
  const compositionBlocked = busy || !!controller.pendingRecovery;
  const draftStatus = controller.phase === "saving" ? "Saving draft…" : controller.phase === "checking" ? "Draft saved · checking numbers…" : controller.phase === "applying" ? "Applying reviewed changes…" : busy ? "Updating draft…" : controller.pendingRecovery ? "Local change needs recovery" : controller.error ? "Draft needs attention" : operations.length ? controller.preview?.local ? "Draft saved in this browser" : "Draft checked · account copy saved" : "No pending changes";
  function attempt(action: () => Promise<unknown>) { setError(""); void action().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to make this change.")); }
  function navigate(run:()=>void) { if (composer || foundationDirty) setLeaveEditor({run}); else run(); }
  useEffect(() => {
    if (!composer && !modalComposer && !foundationDirty) return;
    function preventLoss(event: BeforeUnloadEvent) { event.preventDefault(); }
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [composer,modalComposer,foundationDirty]);
  useEffect(() => {
    // A scoped editor event can change the requested surface while mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialIntent === "items") setRoot("ITEM");
    else if (initialIntent && initialIntent !== "overview") setFoundation(initialIntent);
  }, [initialIntent]);
  function changeRoot(value: WorkspaceCategory) { navigate(() => { setRandomizer(false); setRoot(value); setPath([]); setComposer(null); setInspect(null); setExternal(null); setSelectedRows([]); setShowCreate(false); setMobile("build"); }); }
  function openPiece(edge: WorkspaceEdge, parentPath = path) {
    navigate(() => { setPath([...parentPath, edge.id]); setComposer(null); setInspect(edge.child); setExternal(null); setSelectedRows([]); setShowCreate(false); setMobile("build"); });
  }
  async function stage(operation: DraftOperation) {
    if (!base) throw new Error("Character is still loading.");
    const result = await controller.stage(operation, base.revision);
    setNotice("Saved in this browser. Review when you’re ready to apply the changes.");
    return result;
  }
  async function add(key: EntityKey, name: string, mirrored = false, focused = false) {
    if (!destinationChosen) { setNotice("Choose Lineage, Upbringing, Manifest, or Items before adding a piece."); setMobile("build"); return; }
    // The sequence is generated only when a preview action is clicked.
    // eslint-disable-next-line react-hooks/purity
    if (composer) { setInspecting(false); setIncomingPiece({key,label:name,sequence:Date.now(),isMirrored:mirrored}); setNotice(`Added ${name} to the open ${composer.kind}. Finish it to save to your draft.`); if (focused) openDrawer("build"); return; }
    const [kind, id] = key.split(":") as [EntityKind, string];
    const operation: DraftOperation = { id: browserUuid(), type: "create", label: `Add ${name} to ${destination}`, payload: {
      kind, category, existingId: id, draft: {}, mirrored,
      ...(selected ? { target: selected.key, path, expectedHash: hash(selected) } : {}),
    } };
    const updated = await stage(operation);
    if (focused && graph) {
      const result = updated.results.find((entry) => entry.operationId === operation.id)?.result;
      const handoff = result && resolveComposerHandoff({ before: graph, after: updated.graph, result, parentPath: selected ? path : [], category, mirrored });
      if (!handoff) throw new Error("Added to your draft. Open the piece from its destination to edit it.");
      setInspecting(false); setIncomingPiece(null); setLivePreview(null); setExternal(null);
      setPath(handoff.path); setComposer({ kind: handoff.node.kind, node: handoff.node }); setMobile("build");
      openDrawer("build");
    }
  }

  function openGenerated(proposal:GeneratedProposal, destination:RandomizerHeritage, target:"middle"|"modal"="middle") {
    const run=()=>{attempt(async()=>{
      let sourceGraph:WorkspaceGraph|undefined=graph??undefined;
      const references=(proposal.libraryPieces??[]).map(p=>p.key).filter(key=>!graph?.nodes.some(n=>n.key===key));
      if(references.length){
        const query=new URLSearchParams();references.forEach(key=>query.append("piece",key));
        const response=await fetch(`/api/characters/${characterId}/workspace?${query}`,{cache:"no-store"});
        const loaded=await readJsonResponse<WorkspaceGraph & {error?:string}>(response);
        if(!response.ok)throw new Error(loaded.error??"Unable to load the generated composition.");
        sourceGraph=graph ? {...loaded,nodes:[...graph.nodes,...loaded.nodes.filter(n=>!graph.nodes.some(old=>old.key===n.key))],edges:[...graph.edges,...loaded.edges.filter(e=>!graph.edges.some(old=>old.id===e.id))]} : loaded;
      }
      const install=(session:ComposerSession)=>target==="modal"?setModalComposer(session):setComposer(session);
      if(target==="modal"){setModalCategory(proposal.kind==="item"?"ITEM":destination);setModalPath([]);setModalIncoming(null);setModalPreview(null);openDrawer("build");}
      else {
      setRandomizer(false);setRoot(proposal.kind==="item"?"ITEM":destination);setPath([]);setInspecting(false);setLivePreview(null);setIncomingPiece(null);setMobile("build");}
      if(proposal.kind==="primitive") {install({kind:"primitive",sessionId:browserUuid(),primitiveSeed:proposal.pieces[0]!.seed});return;}
      const generatedNodes:WorkspaceNode[]=[];
      const selection=proposal.pieces.map(piece=>{
        if(piece.ownedKey)return piece.ownedKey;
        const id=String(-parseInt(browserUuid().replaceAll("-","").slice(0,12),16));
        const key:EntityKey=`primitive:${id}`;
        const data={...piece.seed,id:Number(id),isPublic:false,isMirrorable:false,mirrorVector:"STANDARD_ONLY",mirrorBuCredit:0,mirrorEligibilityNotes:"",sourceOrigin:null,tags:[],iconSource:null,iconKey:null,iconUrl:null,iconColor:"#d4af37"};
        generatedNodes.push({key,id,kind:"primitive",name:piece.seed.name,bu:piece.seed.buCost,description:piece.seed.narrativeRule,versionId:null,latestVersionId:null,userId:null,data});return key;
      });
      selection.push(...(proposal.libraryPieces??[]).map(p=>p.key));
      install({kind:proposal.kind,...(sourceGraph?{sourceGraph}:{}),sessionId:browserUuid(),selection,generatedNodes,capabilitySeed:{name:proposal.name,description:proposal.description,type:proposal.capabilityType??"ACTIVE",sourceType:proposal.sourceType??"MAGICAL"}});
    });};
    if(target==="modal"){if(modalComposer){setReplaceModal(()=>run);openDrawer("build");}else run();}else navigate(run);
  }
  function openReview(){setReview(true);}
  function closeReview(){controller.cancelReview();setReview(false);}
  async function mutate(edge: WorkspaceEdge, edgePath: string[], operation: "remove" | "mirror") {
    if (!graph) return;
    const node = graph.nodes.find((n) => n.key === edge.child)!;
    const parent = graph.nodes.find((n) => n.key === edge.parent);
    await stage({ id: browserUuid(), type: "command", label: `${operation === "remove" ? "Remove" : "Mirror"} ${node.name}`, payload: parent
      ? { operation: operation === "remove" ? "remove-reference" : "mirror-reference", target: parent.key, path: edgePath.slice(0, -1), expectedHash: hash(parent), edgeId: edge.id }
      : { operation: operation === "remove" ? "detach" : "mirror-instance", target: node.key, path: edgePath, expectedHash: hash(node) } });
    setSelectedRows([]);
  }
  async function addSet(items: DiscoverySuggestion[]) {
    if (!base || !destinationChosen || composer) return;
    await controller.stageMany(items.map((item): DraftOperation => ({ id: browserUuid(), type: "create", label: `Add ${item.name} to ${destination}`, payload: {
      kind:item.kind, category, existingId:item.key.slice(item.key.indexOf(":")+1),draft:{},mirrored:item.mirrored,
      ...(selected ? {target:selected.key,path,expectedHash:hash(selected)} : {}),
    }})), base.revision);
    setNotice("Added the selected set to your draft.");
  }
  async function replace(item: DiscoverySuggestion) {
    if (!base || !graph || !currentEdge || !selected) return;
    const parent = graph.nodes.find((node) => node.key === currentEdge.parent);
    const operations: DraftOperation[] = [
      {id:browserUuid(),type:"create",label:`Replace ${selected.name} with ${item.name}`,payload:{kind:item.kind,category,existingId:item.key.slice(item.key.indexOf(":")+1),draft:{},mirrored:item.mirrored,...(parent?{target:parent.key,path:path.slice(0,-1),expectedHash:hash(parent)}:{})}},
      {id:browserUuid(),type:"command",label:`Remove replaced occurrence of ${selected.name}`,payload:parent?{operation:"remove-reference",target:parent.key,path:path.slice(0,-1),expectedHash:null,edgeId:currentEdge.id}:{operation:"detach",target:selected.key,path,expectedHash:hash(selected)}}
    ];
    await controller.stageMany(operations,base.revision);
    setPath(path.slice(0,-1)); setNotice("Replacement saved in your draft. Review its final cost and effects.");
  }
  const makeSaveRequest = (active:ComposerSession|null, activePath:string[], activeCategory:Exclude<WorkspaceCategory,"ALL">, inModal=false):typeof fetch => async (_url, init) => {
    const composer=active, path=activePath, category=activeCategory;
    const selected=graph?.nodes.find(node=>node.key===graph.edges.find(edge=>edge.id===path.at(-1))?.child);
    if (!composer || !graph) return Response.json({ error: "Select what to build first." }, { status: 400 });
    try {
      const form = { ...JSON.parse(String(init?.body ?? "{}")), isPublic: false };
      const id = browserUuid();
      const operation: DraftOperation = composer.node && !composer.sourceOnly
        ? { id, type: "command", label: `Edit ${composer.node.name}`, payload: { operation: "edit", target: composer.node.key, path, expectedHash: hash(composer.node), draft: form } }
        : { id, type: "create", label: `Create ${form.name || names[composer.kind]} in ${destination}`, payload: { kind: composer.kind, category: composer.kind === "heritage" ? form.kind : category, draft: form, ...(selected ? { target: selected.key, path, expectedHash: hash(selected) } : {}) } };
      let result;
      if (composer.generatedNodes?.length && base) {
        const usedIds=new Set([...(form.primitiveSlots ?? []).map((slot:{primitiveId:number})=>Number(slot.primitiveId)),...(form.primitiveIds ?? []).map(Number)]);
        const pieces=composer.generatedNodes.filter(node=>usedIds.has(Number(node.id)));
        const entries=pieces.map(node=>({node,instanceId:browserUuid()}));
        const generated:DraftOperation[]=entries.map(({node,instanceId})=>({id:browserUuid(),type:"create",label:`Create ${node.name}`,payload:{kind:"primitive",category,draft:node.data},localBindings:{nodes:[{key:node.key}],instances:[{id:instanceId,child:node.key,category,isMirrored:false}]}}));
        const removals:DraftOperation[]=entries.map(({node,instanceId})=>({id:browserUuid(),type:"command",label:`Place ${node.name} inside the composition`,payload:{operation:"detach",target:node.key,path:[instanceId],expectedHash:null}}));
        result=await controller.stageMany([...generated,operation,...removals],base.revision);
      } else result=await stage(operation);
      const saved = result.results.find((entry) => entry.operationId === id)?.result ?? {};
      if(!inModal && sendToModal && modalComposer && canContain(modalComposer.kind,composer.kind)) {
        const handoff=resolveComposerHandoff({before:graph,after:result.graph,result:saved,parentPath:selected?path:[],category,mirrored:false});
        if(handoff)setModalIncoming({key:handoff.node.key,label:handoff.node.name,sequence:Date.now()});
      }
      const response = (saved["entityResponse"] ?? saved) as Record<string, unknown>;
      return Response.json(response);
    } catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : "Unable to add to draft." }, { status: 400 }); }
  };
  const saveRequest=makeSaveRequest(composer,path,category);
  function selectModal(kind:EntityKind,key?:EntityKey) {
    const run=()=>{const node=graph?.nodes.find(n=>n.key===key);const route=node && graph?supplyPaths(graph,node.key)[0]:undefined;
      setModalComposer({kind,...(node?{node}:{}),sessionId:browserUuid()});setModalIncoming(null);setModalPreview(null);
      setModalPath(route?.edges.map(e=>e.id) ?? []);if(route?.edges[0]?.category && route.edges[0].category!=="ALL")setModalCategory(route.edges[0].category);else setModalCategory(kind==="item"?"ITEM":"MANIFEST");
    };
    if(modalComposer)setReplaceModal(()=>run);else run();
  }
  async function routeLibrary(key:EntityKey,name:string,target:"middle-add"|"middle-replace"|"modal-add"|"modal-replace") {
    const modal=target.startsWith("modal"), replace=target.endsWith("replace");
    const current=modal?modalComposer:composer;
    if(!replace && current){
      const kind=key.split(":")[0] as EntityKind;
      if(!canContain(current.kind,kind))throw new Error(`A ${current.kind} cannot contain a ${kind}. Choose Replace to open it instead.`);
      // Called by the action callback, never while rendering its button.
      // eslint-disable-next-line react-hooks/purity
      const piece={key,label:name,sequence:Date.now()};if(modal)setModalIncoming(piece);else setIncomingPiece(piece);
      setNotice(`Added ${name} to the ${modal?"modal":phone?"main":"middle"} build.`);return;
    }
    if(!modal && !replace){await add(key,name);return;}
    const run=()=>{attempt(async()=>{
      const query=new URLSearchParams({piece:key});
      const response=await fetch(`/api/characters/${characterId}/workspace?${query}`,{cache:"no-store"});
      const loaded=await readJsonResponse<WorkspaceGraph & {error?:string}>(response);
      if(!response.ok)throw new Error(loaded.error ?? "Unable to open this piece.");
      const node=graph?.nodes.find(n=>n.key===key) ?? loaded.nodes.find(n=>n.key===key);
      if(!node)throw new Error("Piece unavailable.");
      const next:ComposerSession={kind:node.kind,node,sourceOnly:true,sourceGraph:loaded,sessionId:browserUuid()};
      if(modal){setModalCategory(node.kind==="item"?"ITEM":modalCategory==="ITEM"?"MANIFEST":modalCategory);setModalComposer(next);setModalPath([]);setModalIncoming(null);setModalPreview(null);openDrawer("build");}
      else{if(node.kind==="item")setRoot("ITEM");else if(root==="ITEM" || root==="ALL")setRoot("MANIFEST");setComposer(next);setPath([]);setRandomizer(false);setIncomingPiece(null);setLivePreview(null);}

    });};
    if(current){if(modal){setReplaceModal(()=>run);openDrawer("build");}else navigate(run);}else run();
  }
  function entryActions(key: EntityKey, name: string): PreviewActionProps | undefined {
    if (permission === "VIEWER") return undefined;
    const kind = key.split(":")[0] as EntityKind;
    const invoke = (target: "middle-add" | "middle-replace" | "modal-add" | "modal-replace") => () => { clearPreview(); attempt(() => routeLibrary(key, name, target)); };
    const acceptsMiddle = composer ? canContain(composer.kind, kind) : selected ? canContain(selected.kind, kind) : destinationChosen && (root === "ITEM" ? kind === "item" : kind !== "item");
    return {
      workspace: { label: phone ? "Replace primary build" : "Edit in middle workspace", description: phone ? "Replace the draft in the Build tab." : "Replace the current draft in the middle column.", onClick: invoke("middle-replace"), disabled: compositionBlocked },
      ...(acceptsMiddle ? { primarySecondary: { label: `Add to ${composer ? `active ${composer.kind}` : destination}`, description: "Insert this into the current character build.", onClick: invoke("middle-add"), disabled: compositionBlocked } } : {}),
      ...(!modalComposer || canContain(modalComposer.kind, kind) ? { buildModal: { label: phone ? "Add to modal build" : "Add to persistent build", description: "Keep it in the independent Build & Preview workspace.", onClick: invoke("modal-add"), disabled: compositionBlocked } } : {}),
      ...(modalComposer ? { primary: { label: "Replace modal build", description: "Replace the independent Build & Preview draft.", onClick: invoke("modal-replace"), disabled: compositionBlocked } } : {}),
    };
  }
  function chooseAnotherEntity(kind:EntityKind,key?:EntityKey) {
    navigate(()=>{
      const node=key ? graph?.nodes.find(item=>item.key===key) : undefined;
      const route=node && graph ? supplyPaths(graph,node.key)[0] : undefined;
      const nextRoot=route?.edges[0]?.category;
      if(nextRoot) setRoot(nextRoot);
      else if(kind==="item")setRoot("ITEM");
      else if(root==="ITEM" || root==="ALL")setRoot("MANIFEST");
      setPath(route?.edges.map(edge=>edge.id) ?? []);setIncomingPiece(null);setLivePreview(null);setInspecting(false);setRandomizer(false);setShowCreate(false);
      setComposer({kind,...(node?{node}:{}),sessionId:browserUuid()});setMobile("build");
    });
  }
  function startBuild(kind: EntityKind) { if (!destinationChosen) return; setRandomizer(false); setInspecting(false); setIncomingPiece(null); setLivePreview(null); setComposer({ kind,sessionId:browserUuid() }); setShowCreate(false); setMobile("build"); }
  function row(edge: WorkspaceEdge, parentPath: string[] = path) {
    const node = graph?.nodes.find((entry) => entry.key === edge.child);
    if (!node) return null;
    const rowPath = [...parentPath, edge.id];
    const selectedRow = selectedRows.includes(edge.id);
    return <article key={edge.id} className={`sheet-piece ${selectedRow ? "is-selected" : ""}`}>
      <div className="sheet-piece-heading">{(!phone || selectingPieces) && <input type="checkbox" aria-label={`Select ${node.name}`} checked={selectedRow} onChange={() => setSelectedRows((old) => selectedRow ? old.filter((id) => id !== edge.id) : [...old, edge.id])}/>}<button type="button" onClick={() => showPreview(node.key)}><strong>{node.name}</strong><span>{names[node.kind]}{edge.isMirrored ? " · Mirrored" : ""}</span></button><span className="sheet-bu">{edge.isMirrored ? "−" : ""}{bundleBu(graph!, node.key)} BU</span></div>
      <p className="sheet-rule" data-copy-role="mechanical">{edge.isMirrored && node.kind === "primitive" ? mirrorConsequence({id:Number(node.id),buCost:node.bu,...node.data}) : String(node.data["mechanicalOutputText"] || node.description || "Open to explore the rules inside.")}</p>
      <details className="sheet-piece-menu" open={!phone}><summary aria-label={`Actions for ${node.name}`}>Actions</summary><div className="sheet-row-actions"><button type="button" onClick={() => showPreview(node.key)}><Eye size={14}/> Preview</button>{node.kind !== "primitive" && <button type="button" onClick={() => openPiece(edge, parentPath)}>Open composition</button>}<button type="button" onClick={() => navigate(() => { setInspecting(false); setIncomingPiece(null); setLivePreview(null); setPath(rowPath); setComposer({ kind: node.kind, node }); setMobile("build"); })}>Edit</button><button type="button" disabled={busy} onClick={() => setMove({ edge, path: rowPath, reuse: false })}>Move</button><button type="button" disabled={busy} onClick={() => setMove({ edge, path: rowPath, reuse: true })}>Use in…</button>{node.kind === "primitive" && Boolean(node.data["isMirrorable"]) && <button type="button" disabled={busy} onClick={() => attempt(() => mutate(edge, rowPath, "mirror"))}>{edge.isMirrored ? "Undo mirror" : "Mirror"}</button>}<button type="button" disabled={busy} onClick={() => attempt(() => mutate(edge, rowPath, "remove"))}>Remove</button></div></details>
    </article>;
  }
  const inspection = graph?.nodes.find((node) => node.key === inspect) ?? selected;
  const preview = <div className="sheet-result"><details className="sheet-result-section" open><summary>Piece preview</summary><header><span className="sheet-kicker">See the result</span><h3>{composer && !inspecting ? "Current build" : external?.row.name ?? inspection?.name ?? "Your character"}</h3>{composer && inspecting && <button className="sheet-button" type="button" onClick={() => setInspecting(false)}>Back to current build</button>}</header>
    {composer && livePreview && !inspecting ? livePreview : external ? <EntityPreview item={external} actionBar={entryActions(`${external.kind}:${external.row.id}`,external.row.name)}/> : inspection && graph ? <WorkspaceEntityPreview node={inspection} graph={graph} onOpen={(key) => showPreview(key)} actionBar={entryActions(inspection.key,inspection.name)}/> : <p>Select a piece to read its rule and explore what it contains.</p>}
    </details><details className="sheet-result-section" open><summary>Character numbers <span>{remaining} BU available</span></summary><div className="sheet-ledger"><h4>Build Units</h4><dl><div><dt>Character budget</dt><dd>{pool}</dd></div><div><dt>Allocated</dt><dd>{spent}</dd></div><div><dt>Drawback credit</dt><dd>{credit} / {debtMax}</dd></div><div><dt>Available to spend</dt><dd>{remaining}</dd></div></dl><p>{controller.preview?.local ? "Budget estimate. Check the draft in Review for complete character numbers." : "You can leave points unspent and add more later."}</p></div>
    {sheet && controller.preview && !controller.preview.local && <div className="sheet-ledger"><h4>Build preview</h4><p>Play toggles and current vitality are kept separately.</p><dl><div><dt>Max Vitality</dt><dd>{controller.preview.beforeSheet.vitality.max} → {sheet.vitality.max}</dd></div><div><dt>Carry capacity</dt><dd>{controller.preview.beforeSheet.carryCapacity} → {sheet.carryCapacity}</dd></div><div><dt>DC</dt><dd>{controller.preview.beforeSheet.dc} → {sheet.dc}</dd></div></dl></div>}
  </details></div>;
  const modalBuild=<section className="sheet-modal-workbench"><header><h3>Modal workbench</h3><p>{phone ? "Build a new piece, then add it to your character." : "This build is independent of the middle column. Close this panel to keep working there."}</p><label>Add finished piece to<select value={modalCategory} disabled={!!modalComposer?.node && !modalComposer.sourceOnly} onChange={e=>setModalCategory(e.target.value as Exclude<WorkspaceCategory,"ALL">)}>{roots.filter(r=>r.key!=="ALL" && (modalComposer?.kind==="item"?r.key==="ITEM":r.key!=="ITEM")).map(r=><option key={r.key} value={r.key}>{r.name}</option>)}</select></label><button className="sheet-button" onClick={closeDrawer}>{phone ? "Back to character" : "Return to middle builder"}</button></header>
    {replaceModal && <div className="sheet-guidance" role="alertdialog" aria-label="Replace modal build?" tabIndex={-1} ref={element=>element?.focus()}><h3>Replace modal build?</h3><p>Replace the unfinished modal form? Pieces already saved in your draft will remain.</p><button className="sheet-button" onClick={()=>setReplaceModal(null)}>Keep working</button><button className="sheet-button is-gold" onClick={()=>{replaceModal();setReplaceModal(null);}}>Discard unfinished form & replace</button></div>}
    {graph && modalComposer ? <EntityComposer key={modalComposer.sessionId ?? modalComposer.node?.key ?? modalComposer.kind} graph={graph} kind={modalComposer.kind} node={modalComposer.node} {...(modalComposer.primitiveSeed?{primitiveSeed:modalComposer.primitiveSeed}:{})} {...(modalComposer.capabilitySeed?{capabilitySeed:modalComposer.capabilitySeed}:{})} selection={modalComposer.selection ?? []} selectionEdges={modalComposer.selectionEdges ?? []} category={modalCategory==="ITEM"?"MANIFEST":modalCategory} sessionKey={`modal:${modalComposer.sessionId ?? modalComposer.kind}`} incomingPiece={modalIncoming} onPreviewChange={setModalPreview} onChooseEntity={selectModal} integratedSources saveRequest={makeSaveRequest(modalComposer,modalPath,modalCategory,true)} onSaved={()=>{setModalComposer(null);setModalPreview(null);setNotice("Modal build saved to your draft.");}}/> : <div className="sheet-create-menu">{(["primitive","effect","capability","heritage","item"] as EntityKind[]).map(kind=><button className="sheet-button" key={kind} onClick={()=>selectModal(kind)}>New {kind}</button>)}</div>}

  </section>;
  useDrawerSlot({build:modalBuild,preview:modalPreview ?? <p className="sheet-empty">Start a piece in the modal workbench to preview it here.</p>});
  if (!base || !character || !controller.ready) return <section className="sheet-build sheet-workspace-loading" aria-busy="true"><header><span className="sheet-kicker">Character workshop</span><h2>Preparing your workspace</h2><p role="status">{!base || !character ? "Loading your character and its pieces…" : "Restoring your editing draft…"}</p></header>{(error || controller.error) ? <div role="alert"><p>{error || controller.error}</p><button className="sheet-button" onClick={()=>{void refresh().catch(c=>setError(c.message));void controller.reload();}}>Retry loading</button></div> : <div className="sheet-loading-columns" aria-hidden="true">{[0,1,2].map(n=><div key={n}>{[0,1,2,3].map(i=><span key={i}/>)}</div>)}</div>}<button className="sheet-button" onClick={onPlay}>Back to character</button></section>;
  const children = graph!.edges.filter((edge) => selected ? edge.parent === selected.key : edge.parent === null && (root === "ALL" || edge.category === root)).sort((a,b) => a.order-b.order);
  const chooser = <div className="sheet-create-menu"><h3>What are you making?</h3><p>Start with the idea. The preview will show its rule and cost.</p>{kinds.map((kind) => <button type="button" className="sheet-create-choice" key={kind} onClick={() => startBuild(kind)}><Plus size={18}/><span><strong>{names[kind]}</strong><small>{kind === "primitive" ? "A single rule, bonus, subject, or drawback" : kind === "capability" ? "An ability made from the rules you choose" : kind === "heritage" ? "Group traits under a part of your story" : kind === "item" ? "Equipment and the abilities it supplies" : "A group of rules to reuse in abilities"}</small></span><ChevronRight size={16}/></button>)}</div>;
  const find = <aside className="sheet-find"><header><span className="sheet-kicker">Discover & compose</span><h3>Find something</h3></header><nav className="sheet-source-tabs" aria-label="Find sources">{([["library", "Library"], ["owned", "On character"], ["suggestions", "Ideas"]] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={source === value} onClick={() => setSource(value)}>{label}</button>)}</nav><div className="sheet-destination"><small>Adding to</small><strong>{destinationChosen ? destination : "Choose a heritage or Items"}</strong></div>
    {!destinationChosen && <p className="sheet-empty">{phone ? "Choose a character section above to start." : "Choose a destination in the center to start. Nothing is added until you choose it."}</p>}<div>
    {!kinds.length && <div className="sheet-empty"><h3>One rule at a time</h3><p>A primitive describes a single rule. Use the form to refine it; return to the composition to combine it with other pieces.</p><button className="sheet-button" onClick={() => navigate(() => {if (composer) setComposer(null); else setPath(path.slice(0,-1));})}>Return to composition</button></div>}<div hidden={source !== "library"}><BuildLibrary heritageCategory={category} kinds={libraryKinds} destination={destination} disabled={compositionBlocked} previewOnly onAdd={(key,name) => showPreview(key,name)} onPreview={(item) => showPreview(`${previewKind(item.targetType)}:${item.targetId}`,item.name)}/></div>
    <div className="sheet-owned-catalogue" hidden={source !== "owned"}><p>Reuse a rule you already have. Its conditions and source still apply.</p>{graph!.nodes.filter((node) => libraryKinds.includes(node.kind) && supplyPaths(graph!,node.key).length>0).map((node) => <article className="sheet-catalogue-row" key={node.key}><header><span className="sheet-kicker">{node.kind} · {node.bu} BU</span><strong>{node.name}</strong></header><p className="sheet-rule" data-copy-role="mechanical">{String(node.data["mechanicalOutputText"] || node.description)}</p><details className="sheet-piece-menu" open={!phone}><summary aria-label={`Actions for ${node.name}`}>Actions</summary><div className="sheet-row-actions"><button type="button" onClick={() => showPreview(node.key)}>Preview</button><button type="button" disabled={busy} onClick={() => showPreview(node.key,node.name)}>Use this entry</button></div></details></article>)}</div>
    <div hidden={source !== "suggestions" || !kinds.length}><WorkspaceSuggestions heritageCategory={category} characterId={characterId} destinationLabel={destination} kinds={kinds} graph={graph!} destinationIsItem={root === "ITEM"} budget={Math.max(0, remaining)} debtAvailable={Math.max(0,debtMax-credit)} excludedKeys={graph!.nodes.map((node) => node.key)} onAdd={(item) => add(item.key,item.name,item.mirrored)} {...(!composer ? {onAddSet:addSet} : {})} {...(selected && !composer ? {replaceTarget:{key:selected.key,name:selected.name,availableBudget:Math.max(0,remaining + bundleBu(graph!,selected.key))},onReplace:replace} : {})} onPreview={(key) => showPreview(key)} onBuildRule={(seed) => navigate(() => {setRandomizer(false);setInspecting(false);setIncomingPiece(null);setLivePreview(null);setComposer({kind:"primitive",primitiveSeed:seed});setShowCreate(false);setMobile("build");})} onBuildOwn={() => { setRandomizer(false); setShowCreate(true); setMobile("build"); }}/></div></div>
  </aside>;
  const center = <main className="sheet-composition"><header className="sheet-composition-heading" hidden={phone && !path.length && !composer}><div><span className="sheet-kicker">{rootLabel}</span><nav aria-label="Composition path"><button type="button" onClick={() => { navigate(() => { setPath([]); setComposer(null); }); }}>{rootLabel}</button>{path.map((id,index) => { const edge = graph!.edges.find((entry) => entry.id === id); const node = graph!.nodes.find((entry) => entry.key === edge?.child); return node ? <span key={id}><ChevronRight size={13}/><button type="button" onClick={() => { navigate(() => { setPath(path.slice(0,index+1)); setComposer(null); }); }}>{node.name}</button></span> : null; })}</nav></div>{composer && <button type="button" className="sheet-button" onClick={() => navigate(() => setComposer(null))}><ArrowLeft size={14}/> Composition</button>}</header>
    {composer && modalComposer && canContain(modalComposer.kind,composer.kind) && <label className="sheet-guidance"><input type="checkbox" checked={sendToModal} onChange={e=>setSendToModal(e.target.checked)}/> Also add this finished piece to the modal {modalComposer.kind} when I save it to draft</label>}
    {randomizer ? <ProceduralRandomizer graph={graph!} budget={Math.max(0,remaining)} category={category === "ITEM" ? "MANIFEST" : category} onChoose={openGenerated}/> : composer ? <EntityComposer key={composer.sessionId ?? `${composer.kind}:${composer.node?.key ?? composer.primitiveSeed?.key ?? "new"}`} graph={graph!} kind={composer.kind} {...(composer.capabilitySeed?{capabilitySeed:composer.capabilitySeed}:{})} {...(composer.node ? { node: composer.node } : {})} category={category === "ITEM" ? "MANIFEST" : category} sessionKey={`middle:${composer.sessionId ?? composer.kind}:${composer.node?.key ?? composer.primitiveSeed?.key ?? "new"}:${path.join("/")}`} incomingPiece={incomingPiece} onPreviewChange={setLivePreview} {...(composer.primitiveSeed ? {primitiveSeed:composer.primitiveSeed} : {})} onChooseEntity={chooseAnotherEntity} integratedSources selection={composer.selection ?? []} selectionEdges={composer.selectionEdges ?? []} saveRequest={saveRequest} onSaved={() => { setComposer(null); setSelectedRows([]); }}/>
    : root === "ALL" ? <div className="sheet-overview"><h2>Make {draftCharacter.name} yours.</h2><p>Build from their story. Add a trait, shape an ability, or give them something to wield. You do not need to fill every heritage or spend every point.</p>{draftCharacter.notes && <details className="sheet-concept"><summary>Your character concept</summary><Markdown>{String(draftCharacter.notes)}</Markdown></details>}<div className="sheet-composition-actions"><button className="sheet-button is-gold" onClick={() => setFoundation("concept")}>Edit concept & roots</button><button className="sheet-button" onClick={() => setFoundation("foundation")}>Body & strengths</button><button className="sheet-button" onClick={() => setFoundation("backstory")}>Backstory</button></div><div className="sheet-roots-grid">{roots.filter((entry) => entry.key !== "ALL").map((entry) => { const count = graph!.edges.filter((edge) => edge.parent === null && edge.category === entry.key).length; return <button type="button" className="sheet-root-card" key={entry.key} onClick={() => changeRoot(entry.key)}><span className="sheet-medallion"><EntityTypeIcon type={entry.key} size={24}/></span><span><strong>{entry.name}</strong><p>{entry.subtitle}</p><small>{count} direct {count === 1 ? "piece" : "pieces"}</small></span><ArrowRight size={18}/></button>; })}</div><details className="sheet-explainer"><summary>How the pieces fit together</summary><p>A primitive is a rule you purchase. A capability is an ability built with those rules. Heritages explain where your traits and abilities come from; items keep their own effects.</p><p>Range and effect dice require their access rules. At the table, describe targets, shape, scale, duration, and casting time; larger or faster effects may raise Strain. You and the DM agree on the cost before rolling.</p></details></div>
    : <><details className="sheet-root-help" open={!phone}><summary>About this section</summary><div className="sheet-section-intro"><h2>{selected?.name ?? roots.find((entry) => entry.key === root)?.subtitle}</h2><p>{selected ? selected.description : root === "LINEAGE" ? "Inherited, built, or transformed: add what belongs to their nature." : root === "UPBRINGING" ? "Their upbringing, background, and training. What did experience teach them?" : root === "MANIFEST" ? "Their developing powers, disciplines, and role. Who are they becoming?" : "Equipment has its own rules and availability. Its BU stays separate."}</p></div>
      {help && <div className="sheet-guidance"><span>Use Library or Ideas to find a piece, or build your own. Every change stays in your draft until you apply it.</span><button type="button" aria-label="Dismiss editing guidance" onClick={() => { setHelp(false); localStorage.setItem(`sw:build-help:${characterId}`,"hidden"); }}><X size={15}/></button></div>}
      </details><div className="sheet-composition-actions"><button type="button" className="sheet-button is-gold" disabled={!kinds.length} onClick={() => setShowCreate(!showCreate)}><Plus size={15}/> {phone ? "New piece" : "Build your own"}</button><button type="button" className="sheet-button" onClick={() => { setSource("library"); setMobile("find"); }}><Library size={15}/> {phone ? "Find" : "Find in Library"}</button>{phone && children.length > 0 && <button className="sheet-button sheet-select-pieces" onClick={()=>{setSelectingPieces(value=>!value);setSelectedRows([]);}}>{selectingPieces ? "Done" : "Select"}</button>}{selected && <button className="sheet-button" type="button" onClick={() => setComposer({kind:selected.kind,node:selected})}>Edit details</button>}</div>
      {showCreate && chooser}
      {selectedRows.length > 0 && !selected && <div className="sheet-guidance"><strong>{selectedRows.length} selected</strong><button className="sheet-button" type="button" disabled={children.some(edge => selectedRows.includes(edge.id) && !canContain("capability", edge.child.split(":")[0] as EntityKind))} onClick={() => { const keys = children.filter((edge) => selectedRows.includes(edge.id)).map((edge) => edge.child); setComposer({kind:"capability",selection:keys,selectionEdges:children.filter(edge => selectedRows.includes(edge.id))}); }}>Use in new capability</button><button className="sheet-button" type="button" disabled={children.some(edge => selectedRows.includes(edge.id) && (!canContain("heritage", edge.child.split(":")[0] as EntityKind) || Number(edge.data?.["quantity"] ?? 1) !== 1))} onClick={() => { const keys = children.filter((edge) => selectedRows.includes(edge.id)).map((edge) => edge.child); setComposer({kind:"heritage",selection:keys,selectionEdges:children.filter(edge => selectedRows.includes(edge.id))}); }}>Use in new heritage</button></div>}
      <div className="sheet-pieces">{children.map((edge) => row(edge))}{!children.length && <div className="sheet-empty"><Sparkles size={24}/><h3>{selected?.kind === "primitive" ? "A single rule" : "Room for your next idea"}</h3><p>{selected?.kind === "primitive" ? "Edit this rule or preview its effect. Rules do not contain other pieces." : "Add only what helps express this character. An empty heritage is fine."}</p></div>}</div></>}
  </main>;
  return <section className="sheet-build" data-mobile-view={mobile} data-preview-collapsed={previewCollapsed}>
    <header className="sheet-build-top" hidden={phone}><div><span className="sheet-kicker">Character workshop</span><h2>{draftCharacter.name}<span>{permission === "SUGGESTER" ? "Proposed changes" : "Build"}</span></h2></div><div className="sheet-top-actions"><span role="status">{draftStatus}</span><button type="button" className="sheet-button sheet-preview-toggle" aria-pressed={!previewCollapsed} onClick={() => setPreviewCollapsed(value => !value)}>{previewCollapsed ? "Show preview" : "Hide preview"}</button><button type="button" className="sheet-button" onClick={() => openDrawer("build")}><FabThemeIcon iconKey="lorc/anvil-impact" dark={dark}/> Build & Preview</button><button type="button" className="sheet-button" onClick={() => navigate(onPlay)}>Back to play</button></div></header>
    {phone && <div className="sheet-phone-context"><select aria-label="Character section" value={randomizer ? "randomizer" : root} onChange={event => { if(event.target.value === "randomizer") navigate(()=>{setRandomizer(true);setComposer(null);setPath([]);setMobile("build");}); else changeRoot(event.target.value as WorkspaceCategory); }}>{roots.map(entry=><option key={entry.key} value={entry.key}>{entry.name}</option>)}<option value="randomizer">Randomizer</option></select><span><b>{remaining}</b><small>BU left</small></span><button type="button" className="sheet-phone-tool-button" aria-label="Draft tools" onClick={()=>setPhoneTools(true)}>•••</button><button type="button" className="sheet-phone-play" onClick={()=>navigate(onPlay)}>Play<ArrowRight size={15}/></button></div>}
    <nav className="sheet-root-nav" aria-label="Character roots">{roots.map((entry) => <button type="button" key={entry.key} aria-pressed={!randomizer && root === entry.key} onClick={() => changeRoot(entry.key)}>{entry.key === "ALL" ? <entry.icon size={16}/> : <EntityTypeIcon type={entry.key} size={18}/>}{entry.name}</button>)}<button type="button" aria-pressed={randomizer} onClick={()=>navigate(()=>{setRandomizer(true);setComposer(null);setPath([]);setMobile("build");})}><Sparkles size={16}/>Randomizer</button></nav>
    <div className="sheet-build-budget"><span><b>{remaining}</b> BU available</span><span>{spent} allocated · {pool} budget</span><span>Drawbacks {credit}/{debtMax}</span><span className="sheet-budget-note">Leaving BU unspent is fine.</span></div>
    {controller.pendingRecovery && <section className="sheet-recovery" role="alert"><div><strong>An interrupted change is saved in this browser</strong><p>{controller.recoveryConflict || "Recover it to continue your draft. Nothing has been applied to the live character."}</p><details><summary>See saved changes</summary><ul>{controller.pendingRecovery.request.operations.map(operation => <li key={operation.id}>{operation.label ?? operation.type}</li>)}</ul></details></div><div className="sheet-row-actions"><button className="sheet-button is-gold" disabled={busy || !!controller.recoveryConflict} onClick={() => attempt(async () => {const recovered = await controller.recoverPending();if(recovered){discardUnfinished();setFoundation(null);setNotice("Recovered and checked your draft. Review it before applying.");}})}>Recover local change</button><button className="sheet-button" disabled={busy} onClick={() => attempt(async () => {controller.dismissPending();await controller.reload();})}>Discard local copy</button></div></section>}
    {controller.persistenceWarning && <p className="sheet-guidance" role="status">{controller.persistenceWarning}</p>}
    {phone && <div className="sheet-phone-workbench-access"><span>{composer ? "Editing a piece" : "On your character"}</span><button type="button" onClick={() => openDrawer("build")}><Hammer size={15}/> Build &amp; Preview <ChevronRight size={14}/></button></div>}
    {remaining < 0 && <p className="sheet-error" role="alert">This build is {Math.abs(remaining)} BU over budget. Review it with your group before applying.</p>}{(error || controller.error) && (phone ? <details className="sheet-phone-warning"><summary>Draft needs attention · tap to review</summary><p role="alert">{error || controller.error}</p><button className="sheet-button" onClick={openReview}>Review or discard draft</button></details> : <p className="sheet-error" role="alert">{error || controller.error}{controller.error && <button className="sheet-button" onClick={openReview}>Review or discard draft</button>}</p>)}{notice && <div className="sheet-notice" role="status">{notice}{controller.canUndoApplied && <button className="sheet-button" disabled={busy || operations.length > 0} onClick={() => attempt(async () => {const result=await controller.undoApplied();if(result){setBase(result.graph);await refresh();router.refresh();setNotice("Restored the previous build. Play state was kept.");}})}>Undo applied build</button>}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={13}/></button></div>}
    <nav className="sheet-mobile-nav" hidden={phone} aria-label="Workshop views">{(["find","build","preview"] as const).map((view) => <button type="button" key={view} aria-pressed={mobile === view} onClick={() => {setMobile(view);if(view === "preview") setPreviewCollapsed(false);}}>{view}</button>)}</nav>
    {phone ? <div className="sheet-phone-task-body"><div hidden={mobile!=="find"} className="sheet-phone-task-pane">{find}</div><div hidden={mobile!=="build"} className="sheet-phone-task-pane">{center}</div><div hidden={mobile!=="preview"} className="sheet-phone-task-pane">{preview}</div></div> : <Group orientation="horizontal" className="sheet-build-panels" id={`sheet-build-${characterId}`}>
      <Panel id="find" defaultSize="27%" minSize="19%" className="sheet-panel-find">{find}</Panel><Separator className="sheet-panel-separator"/>
      <Panel id="build" defaultSize="48%" minSize="32%" className="sheet-panel-build">{center}</Panel>{!previewCollapsed && <><Separator className="sheet-panel-separator"/>
      <Panel id="preview" defaultSize="25%" minSize="19%" className="sheet-panel-preview">{preview}</Panel></>}
    </Group>}
    {phone && <nav className="sheet-phone-task-nav" aria-label="Workshop tasks">{([["build","Character",Hammer],["find","Browse",Library],["preview","Preview",Eye]] as const).map(([view,label,Icon])=><button key={view} type="button" aria-current={mobile===view?"page":undefined} onClick={()=>{setMobile(view);if(view==="preview")setPreviewCollapsed(false);}}><Icon size={18}/><span>{label}</span></button>)}<button type="button" onClick={openReview}><Check size={18}/><span>Review{changeCount>0?` (${changeCount})`:""}</span></button></nav>}
    <footer className="sheet-draft-footer" hidden={phone}><div><button type="button" className="sheet-button" disabled={busy || !!controller.pendingRecovery || !operations.length} onClick={() => attempt(controller.undo)} aria-label="Undo draft change"><Undo2 size={16}/>{!phone && " Undo"}</button><button type="button" className="sheet-button" disabled={busy || !!controller.pendingRecovery || !controller.canRedo} onClick={() => attempt(controller.redo)} aria-label="Redo draft change"><Redo2 size={16}/>{!phone && " Redo"}</button></div><span>{operations.length ? `${changeCount} pending changes` : "Your live character is unchanged"}</span><button type="button" className="sheet-button is-gold" onClick={openReview}>Review {operations.length > 0 ? `changes (${changeCount})` : "& collaborate"}<ArrowRight size={15}/></button></footer>
    {phone && phoneTools && <WorkspaceSurface modal title="Draft tools" kicker="Character workshop" onClose={()=>setPhoneTools(false)}><div className="sheet-phone-tools"><p role="status">{draftStatus}</p><dl><div><dt>Allocated</dt><dd>{spent} / {pool} BU</dd></div><div><dt>Drawback credit</dt><dd>{credit} / {debtMax} BU</dd></div></dl><div className="sheet-row-actions"><button className="sheet-button" disabled={busy || !!controller.pendingRecovery || !operations.length} onClick={()=>attempt(controller.undo)}><Undo2 size={16}/> Undo</button><button className="sheet-button" disabled={busy || !!controller.pendingRecovery || !controller.canRedo} onClick={()=>attempt(controller.redo)}><Redo2 size={16}/> Redo</button></div><button className="sheet-button" onClick={()=>{setPhoneTools(false);openDrawer("build");}}><FabThemeIcon iconKey="lorc/anvil-impact" dark={dark}/> Separate build & preview</button><p>Keep an independent piece here while you work on your character.</p><button className="sheet-button is-gold" onClick={()=>{setPhoneTools(false);openReview();}}>Review draft <ArrowRight size={16}/></button></div></WorkspaceSurface>}
    {review && <WorkspaceSurface modal title="Review character changes" kicker="Your draft" onClose={closeReview}><div className="sheet-review">{(error || controller.error) && <p className="sheet-error" role="alert">{error || controller.error}</p>}<p>Check the rules, placement, and budget before updating your character. Current vitality and other play state stay separate.</p>{!changeCount && <p>No net build changes.</p>}{controller.preview?.local && operations.length>0 && <div className="sheet-guidance"><p>{busy ? "Checking your complete draft and calculating character numbers…" : "Your edits are saved in this browser. Check the complete draft to verify its numbers and save a copy to your account."}</p><button className="sheet-button is-gold" disabled={busy} onClick={()=>attempt(controller.checkReview)}>{busy ? "Checking draft…" : "Check draft & numbers"}</button></div>}{controller.preview?.warnings?.map(warning => <p className="sheet-guidance" key={warning}>{warning}</p>)}{controller.preview && <DraftChangeReview preview={controller.preview}/>}<div className="sheet-review-commit">{operations.length > 0 && <button className="sheet-button" disabled={busy} onClick={() => setConfirmDiscard(true)}>Discard draft</button>}<button className="sheet-button" type="button" onClick={closeReview}>Keep editing</button>{permission !== "SUGGESTER" && <button className="sheet-button is-gold" type="button" disabled={!changeCount || busy || !!controller.pendingRecovery} onClick={() => attempt(async () => { const result = await controller.apply(); if (result) { discardUnfinished(); window.location.reload(); } })}><Check size={16}/> {controller.phase === "applying" ? "Saving character…" : busy ? "Checking draft…" : "Save & return to play"}</button>}</div><DraftCollaborationPanel characterId={characterId} permission={permission} draft={controller.canReview ? controller.draft : null} onApplied={() => { void refresh(); void controller.reload(); router.refresh(); }}/></div></WorkspaceSurface>}
    {foundation && <WorkspaceSurface modal title="Character foundation" kicker="Your character draft" onClose={() => navigate(() => {setFoundationDirty(false);setFoundation(null);})}><CharacterFoundationEditor characterId={characterId} character={character} operations={operations} initialSection={foundation} busy={busy} onDirtyChange={setFoundationDirty} onClose={() => {setFoundationDirty(false);setFoundation(null);}} onSave={async payload => {await stage({id:browserUuid(),type:"character",label:"Update character foundation",payload});setFoundationDirty(false);setFoundation(null);}}/></WorkspaceSurface>}
    {confirmDiscard && <WorkspaceSurface modal title="Discard this draft?" kicker="Live character stays unchanged" onClose={() => setConfirmDiscard(false)}><div className="sheet-review"><p>This removes the pending changes in this draft. It does not undo an applied build.</p><div className="sheet-row-actions"><button className="sheet-button" onClick={() => setConfirmDiscard(false)}>Keep draft</button><button className="sheet-button" disabled={busy} onClick={() => attempt(async () => {await controller.discard();await refresh();setConfirmDiscard(false);setReview(false);setPath([]);setNotice("Draft discarded. Your live character is unchanged.");})}>Discard pending changes</button></div></div></WorkspaceSurface>}
    {leaveEditor && <WorkspaceSurface modal title="Unfinished changes" kicker="Keep your work" onClose={() => setLeaveEditor(null)}><div className="sheet-review"><p>These fields have not been added to your draft yet. Finish editing before leaving, or discard this unfinished form. Your saved draft is kept.</p><div className="sheet-row-actions"><button className="sheet-button is-gold" onClick={() => setLeaveEditor(null)}>Keep working</button><button className="sheet-button" onClick={() => {discardUnfinished();leaveEditor.run();setLeaveEditor(null);}}>Discard unfinished form</button></div></div></WorkspaceSurface>}
    {move && <WorkspaceSurface modal title={`${move.reuse ? "Use" : "Move"} ${graph!.nodes.find((node) => node.key === move.edge.child)?.name ?? "piece"}`} kicker="Choose a destination" onClose={() => setMove(null)}><div className="sheet-move-options"><p>{move.reuse ? "Keep the current source and use its rule in another composition." : "Move this occurrence. The preview will show any change to cost or availability."}</p>{roots.filter((entry) => entry.key !== "ALL" && entry.key !== "ITEM").map((entry) => <button className="sheet-button" type="button" key={entry.key} disabled={busy || move.reuse || move.edge.child.startsWith("heritage:") || move.edge.child.startsWith("item:")} onClick={() => attempt(async () => { await stage({id:browserUuid(),type:"relocate",label:`Move to ${entry.name}`,path:move.path,category:entry.key}); setMove(null); setPath([]); })}>{entry.name} · direct piece</button>)}{graph!.nodes.filter((node) => node.key !== move.edge.child && canContain(node.kind, move.edge.child.split(":")[0] as EntityKind)).map((node) => { const destPath = supplyPaths(graph!,node.key)[0]?.edges.map((edge) => edge.id); return destPath ? <button className="sheet-button" type="button" key={node.key} disabled={busy} onClick={() => attempt(async () => { if (move.reuse) await stage({id:browserUuid(),type:"command",label:`Use in ${node.name}`,payload:{operation:"add-reference",target:node.key,path:destPath,expectedHash:hash(node),child:move.edge.child,membership:{...move.edge.data,isMirrored:move.edge.isMirrored}}}); else await stage({id:browserUuid(),type:"relocate",label:`Move into ${node.name}`,path:move.path,destinationPath:destPath,category}); setMove(null); })}>{node.name}<small>{names[node.kind]}</small></button> : null; })}</div></WorkspaceSurface>}
  </section>;
}
