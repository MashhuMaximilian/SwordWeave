"use client";
import { compositionRow } from "@/lib/character/workspace/composition-row";
import { readJsonResponse } from "@/lib/http/read-json-response";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import { Eye, Wrench } from "lucide-react";
import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import { CapabilityForm } from "@/components/sandbox/capability-form";
import { EffectForm } from "@/components/sandbox/effect-form";
import { HeritageForm } from "@/components/sandbox/heritage-form";
import { ItemForm } from "@/components/sandbox/item-form";
import { PrimitiveFormPreview } from "@/components/sandbox/primitive-form-preview";
import { CapabilityFormPreview } from "@/components/sandbox/capability-form-preview";
import { EffectFormPreview } from "@/components/sandbox/effect-form-preview";
import { HeritageFormPreview } from "@/components/sandbox/heritage-form-preview";
import { ItemFormPreview } from "@/components/sandbox/item-form-preview";

import { CharacterAuthoringProvider, type CharacterSlotMetadata } from "@/components/sandbox/character-authoring-context";
import { WorkspaceLibraryPicker } from "./library-picker";
import { canContain, supplyPaths } from "@/lib/character/workspace/model";
import type { QuickRuleSeed } from "@/lib/character/workspace/discovery/quick-rules";
import type {
  WorkspaceGraph,
  WorkspaceNode,
  WorkspaceEdge,
  EntityKind,
  EntityKey,
} from "@/lib/character/workspace/model";

export function EntityComposer({
  graph: initialGraph,
  node,
  kind,
  category,
  selection = [],
  selectionEdges = [],
  saveRequest,
  onSaved,
  sessionKey,
  incomingPiece,
  onPreviewChange,
  integratedSources = false,
  onChooseEntity,
  primitiveSeed,
  capabilitySeed,
}: {
  graph: WorkspaceGraph;
  node?: WorkspaceNode | undefined;
  kind: EntityKind;
  category: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  selection?: EntityKey[];
  selectionEdges?: WorkspaceEdge[];
  saveRequest: typeof fetch;
  onSaved: () => void;
  sessionKey?: string;
  incomingPiece?: ({ key: EntityKey; label: string; sequence: number } & CharacterSlotMetadata) | null;
  onPreviewChange?: (preview: ReactNode) => void;
  integratedSources?: boolean;
  primitiveSeed?: QuickRuleSeed;
  onChooseEntity?: (kind:EntityKind, key?:EntityKey)=>void;
  capabilitySeed?: {name:string;description:string;type:string;sourceType:string};
}) {
  const [heritageKind, setHeritageKind] = useState(category);
  const [slotEvents] = useState(() => new EventTarget());
  const [extra, setExtra] = useState<WorkspaceNode[]>([]);
  const [extraEdges,setExtraEdges]=useState<WorkspaceEdge[]>([]);
  const [library, setLibrary] = useState(false);
  const [studioTab, setStudioTab] = useState<"build" | "preview">("build");
  const [error, setError] = useState("");
  const [previewNode, setPreviewNode] = useState<ReactNode>(
    <div className="v12-workspace-preview-empty">
      <span>Live preview</span>
      <strong>Start authoring to preview this piece.</strong>
      <p>The preview uses the same renderer as the Atelier and Library.</p>
    </div>,
  );
  const [delivery, setDelivery] = useState<{
    kind: EntityKind;
    id: string;
    label: string;
    sequence: number;
  } & CharacterSlotMetadata | null>(null);
  useEffect(() => { onPreviewChange?.(previewNode); }, [previewNode, onPreviewChange]);
  useEffect(() => {
    if (incomingPiece) void choose(incomingPiece.key, incomingPiece.label, incomingPiece).catch((cause) => setError(cause.message));
    // Deliver each explicit selection once; graph updates must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingPiece?.sequence]);
  const graph = useMemo(
    () => ({
      ...initialGraph,
      edges:[...initialGraph.edges,...extraEdges.filter(edge=>!initialGraph.edges.some(current=>current.id===edge.id))],
      nodes: [
        ...initialGraph.nodes,
        ...extra.filter(
          (n) => !initialGraph.nodes.some((p) => p.key === n.key),
        ),
      ],
    }),
    [initialGraph, extra, extraEdges],
  );
  useEffect(() => {
    if (delivery)
      slotEvents.dispatchEvent(
        new CustomEvent("sw-sandbox-slot", {
          detail: { ...delivery, operation: "add-reference" },
        }),
      );
  }, [delivery, slotEvents]);
  async function choose(key: EntityKey, label: string, metadata: CharacterSlotMetadata = {}) {
    const [childKind, id] = key.split(":") as [EntityKind, string];
    if (!graph.nodes.some((n) => n.key === key)) {
      const response = await fetch(`/api/characters/${graph.characterId}/workspace?${new URLSearchParams({piece:key})}`,{cache:"no-store"});
      const loaded=await readJsonResponse<WorkspaceGraph & {error?:string}>(response);
      if(!response.ok)throw new Error(loaded.error??"Piece unavailable.");
      if(!loaded.nodes.some(node=>node.key===key))throw new Error("Piece unavailable.");
      const imported=new Set(loaded.nodes.filter(node=>!graph.nodes.some(current=>current.key===node.key)).map(node=>node.key));
      setExtra(previous=>[...previous,...loaded.nodes.filter(node=>imported.has(node.key)&&!previous.some(current=>current.key===node.key))]);
      setExtraEdges(previous=>[...previous,...loaded.edges.filter(edge=>edge.parent&&imported.has(edge.parent)&&!previous.some(current=>current.id===edge.id))]);
    }
    setDelivery((previous) => ({
      kind: childKind,
      id,
      label,
      ...(metadata.isMirrored !== undefined ? { isMirrored: metadata.isMirrored } : {}),
      ...(metadata.quantity !== undefined ? { quantity: metadata.quantity } : {}),
      ...(metadata.role !== undefined ? { role: metadata.role } : {}),
      sequence: (previous?.sequence ?? 0) + 1,
    }));
    setLibrary(false);
  }
  const primitives = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.kind === "primitive")
        .map((n) => ({
          ...n.data,
          id: Number(n.id),
          name: n.name,
          category: String(n.data["category"]),
          buCost: n.bu,
        })),
    [graph.nodes],
  );
  // Workspace rows store links as graph edges. Rebuild nested form rows so
  // opening a generated bundle retains its descendants and preview price.
  const effects = useMemo(() => graph.nodes.filter(n=>n.kind==="effect").map(n=>({
    ...compositionRow(graph,n),id:n.id,name:n.name,
    primitiveLinks:graph.edges.filter(e=>e.parent===n.key && e.child.startsWith("primitive:")).map(e=>({...e.data,primitiveId:Number(e.child.slice(10)),primitive:primitives.find(p=>p.id===Number(e.child.slice(10)))!,quantity:Number(e.data?.["quantity"]??1)})),
  })),[graph,primitives]);
  const capabilities = useMemo(() => graph.nodes.filter(n=>n.kind==="capability").map(n=>({
    ...compositionRow(graph,n),id:n.id,name:n.name,type:String(n.data["type"]),sourceType:String(n.data["sourceType"]),
    primitiveLinks:graph.edges.filter(e=>e.parent===n.key && e.child.startsWith("primitive:")).map(e=>({...e.data,primitiveId:Number(e.child.slice(10)),primitive:primitives.find(p=>p.id===Number(e.child.slice(10)))!,quantity:Number(e.data?.["quantity"]??1)})),
    effects:effects.filter(effect=>graph.edges.some(e=>e.parent===n.key&&e.child===`effect:${effect.id}`)),
    effectLinks:graph.edges.filter(e=>e.parent===n.key && e.child.startsWith("effect:")).map(e=>({...e.data,effectId:e.child.slice(7),effect:effects.find(p=>p.id===e.child.slice(7))!})),
  })),[graph,primitives,effects]);
  const previewFingerprintRef = useRef("");
  const commitPreview = useCallback((fingerprint: string, preview: ReactNode) => {
    if (previewFingerprintRef.current === fingerprint) return;
    previewFingerprintRef.current = fingerprint;
    setPreviewNode(preview);
  }, []);
  const handlePrimitivePreview = useCallback<
    NonNullable<ComponentProps<typeof PrimitiveForm>["onStateChange"]>
  >(
    (state) =>
      commitPreview(
        `primitive:${JSON.stringify(state)}`,
        <PrimitiveFormPreview form={state.form} modifiers={state.modifiers} />,
      ),
    [commitPreview],
  );
  const handleCapabilityPreview = useCallback<
    NonNullable<ComponentProps<typeof CapabilityForm>["onStateChange"]>
  >(
    (state) =>
      commitPreview(
        `capability:${JSON.stringify({state,effects})}`,
        <CapabilityFormPreview
          form={state.form}
          slots={state.slots}
          effects={effects.filter((effect) =>
            state.effectIds.includes(effect.id),
          )}
        />,
      ),
    [commitPreview, effects],
  );
  const handleEffectPreview = useCallback<
    NonNullable<ComponentProps<typeof EffectForm>["onStateChange"]>
  >(
    (state) =>
      commitPreview(
        `effect:${JSON.stringify(state)}`,
        <EffectFormPreview form={state.form} slots={state.slots} />,
      ),
    [commitPreview],
  );
  const handleHeritagePreview = useCallback<
    NonNullable<ComponentProps<typeof HeritageForm>["onStateChange"]>
  >(
    (state) =>
      commitPreview(
        `heritage:${JSON.stringify(state)}`,
        <HeritageFormPreview
          form={state.form}
          primitives={state.primitives}
          capabilities={state.capabilities}
        />,
      ),
    [commitPreview],
  );
  const handleItemPreview = useCallback<
    NonNullable<ComponentProps<typeof ItemForm>["onStateChange"]>
  >(
    (state) =>
      commitPreview(
        `item:${JSON.stringify({
          form: state.form,
          primitiveSlots: state.primitiveSlots.map((slot) => ({
            primitiveId: slot.primitiveId,
            isMirrored: slot.isMirrored,
          })),
          capabilityIds: state.capabilityIds,
          effectIds: state.effectIds,
          capabilities,effects,
          isDirty: state.isDirty,
        })}`,
        <ItemFormPreview
          form={state.form}
          primitiveSlots={state.primitiveSlots}
          capabilitySlots={capabilities.filter((capability) =>
            state.capabilityIds.includes(capability.id),
          )}
          effectSlots={effects.filter((effect) =>
            state.effectIds.includes(effect.id),
          )}
        />,
      ),
    [capabilities, commitPreview, effects],
  );
  const links = graph.edges
    .filter((e) => e.parent === node?.key)
    .sort((a, b) => a.order - b.order);
  const primitiveLinks = links
    .filter((e) => e.child.startsWith("primitive:"))
    .map((e) => ({
      ...e.data,
      primitiveId: Number(e.child.slice(10)),
      primitive: primitives.find((p) => p.id === Number(e.child.slice(10)))!,
      isMirrored: e.isMirrored,
    }));
  const capabilityLinks = links
    .filter((e) => e.child.startsWith("capability:"))
    .map((e) => ({
      ...e.data,
      capabilityId: e.child.slice(11),
      capability: capabilities.find((c) => c.id === e.child.slice(11))!,
    }));
  const effectLinks = links
    .filter((e) => e.child.startsWith("effect:"))
    .map((e) => ({
      ...e.data,
      effectId: e.child.slice(7),
      effect: effects.find((c) => c.id === e.child.slice(7))!,
    }));
  const [row] = useState(() =>
    node
      ? { ...node.data, primitiveLinks, capabilityLinks, effectLinks }
      : primitiveSeed ? {
        ...primitiveSeed,
        id: -1, userId: null, isPublic: false, isMirrorable: false,
        mirrorVector: "STANDARD_ONLY", mirrorBuCredit: 0, mirrorEligibilityNotes: "",
        iconSource: null, iconKey: null, iconUrl: null, iconColor: "#d4af37",
        sourceOrigin: null, tags: [],
      } : capabilitySeed ? {id: "", itemType:"TRINKET",rarity:"COMMON",size:"SMALL",buCost:0,slotCost:1,quantity:1,isTwoHanded:false,isConsumable:false,actsAsFocus:false,isNotEquippable:false,capabilityLinks:selection.filter(key=>key.startsWith("capability:")).map(key=>({capabilityId:key.slice(11),capability:capabilities.find(c=>c.id===key.slice(11))!})),effectLinks:selection.filter(key=>key.startsWith("effect:")).map(key=>({effectId:key.slice(7),effect:effects.find(e=>e.id===key.slice(7))!})),userId:null, name:capabilitySeed.name,kind:heritageKind,description:capabilitySeed.description,narrativeDescription:capabilitySeed.description,suggestedTraits:"",type:capabilitySeed.type,sourceType:capabilitySeed.sourceType,verboseDescription:capabilitySeed.description,isPublic:false,sourceOrigin:null,tags:[],iconSource:null,iconKey:null,iconUrl:null,iconColor:null,primitiveLinks:selection.filter(key=>key.startsWith("primitive:")).map(key=>({primitiveId:Number(key.slice(10)),primitive:primitives.find(p=>p.id===Number(key.slice(10)))!,role:"OTHER",quantity:1,sortOrder:0,slotLabel:null}))} : undefined,
  );
  const initialPrimitiveSlots: Record<number, CharacterSlotMetadata> = Object.fromEntries(selectionEdges
    .filter((edge) => edge.child.startsWith("primitive:"))
    .map((edge) => [Number(edge.child.slice(10)), {
      isMirrored: edge.isMirrored,
      ...(typeof edge.data?.["quantity"] === "number" ? { quantity: edge.data["quantity"] } : {}),
      ...(typeof edge.data?.["role"] === "string" ? { role: edge.data["role"] } : {}),
      ...(typeof edge.data?.["slotLabel"] === "string" ? { slotLabel: edge.data["slotLabel"] } : {}),
      ...(typeof edge.data?.["notes"] === "string" ? { notes: edge.data["notes"] } : {}),
    }]));
  const initialMirroredIds = selectionEdges.filter((edge) => edge.isMirrored && edge.child.startsWith("primitive:")).map((edge) => Number(edge.child.slice(10)));
  const selectedKeys = [...new Set([...selection, ...selectionEdges.map((edge) => edge.child)])];
  const initialPrimitiveIds = selectedKeys
    .filter((k) => k.startsWith("primitive:"))
    .map((k) => Number(k.slice(10)));
  const initialEffectIds = selectedKeys
    .filter((k) => k.startsWith("effect:"))
    .map((k) => k.slice(7));
  const initialCapabilityIds = selectedKeys
    .filter((k) => k.startsWith("capability:"))
    .map((k) => k.slice(11));
  const shared = {
    slotEvents,
    saveRequest,
    onSaved,
    intent: node ? ("load" as const) : null,
    sourceId: node?.id ?? null,
  };
  let form: ReactNode;
  switch (kind) {
    case "primitive":
      form = (
        <PrimitiveForm
          {...shared}
          characterId={graph.characterId}
          onStateChange={handlePrimitivePreview}
          initialPrimitive={
            (row ?? null) as Exclude<
              ComponentProps<typeof PrimitiveForm>["initialPrimitive"],
              undefined
            >
          }
        />
      );
      break;
    case "capability":
      form = (
        <CapabilityForm
          {...shared}
          onStateChange={handleCapabilityPreview}
          initialCapability={
            (row ?? null) as Exclude<
              ComponentProps<typeof CapabilityForm>["initialCapability"],
              undefined
            >
          }
          availablePrimitives={primitives}
          availableEffects={effects}
          initialPrimitiveIds={initialPrimitiveIds}
          initialPrimitiveSlots={initialPrimitiveSlots}
          initialEffectIds={initialEffectIds}
        />
      );
      break;
    case "effect":
      form = (
        <EffectForm
          {...shared}
          onStateChange={handleEffectPreview}
          initialEffect={
            (row ?? null) as Exclude<
              ComponentProps<typeof EffectForm>["initialEffect"],
              undefined
            >
          }
          availablePrimitives={primitives}
          initialPrimitiveIds={initialPrimitiveIds}
          initialPrimitiveSlots={initialPrimitiveSlots}
        />
      );
      break;
    case "heritage":
      form = (
        <HeritageForm
          {...shared}
          onStateChange={handleHeritagePreview}
          initialTemplate={
            (row ?? null) as Exclude<
              ComponentProps<typeof HeritageForm>["initialTemplate"],
              undefined
            >
          }
          initialKind={heritageKind}
          availablePrimitives={primitives}
          availableCapabilities={capabilities}
          initialPrimitiveIds={initialPrimitiveIds}
          initialMirroredIds={initialMirroredIds}
          initialCapabilityIds={initialCapabilityIds}
        />
      );
      break;
    case "item":
      form = (
        <ItemForm
          {...shared}
          onStateChange={handleItemPreview}
          initialItem={
            (row ?? null) as Exclude<
              ComponentProps<typeof ItemForm>["initialItem"],
              undefined
            >
          }
          availablePrimitives={primitives}
          availableCapabilities={capabilities}
          availableEffects={effects}
          initialPrimitiveIds={initialPrimitiveIds}
          initialMirroredIds={initialMirroredIds}
          initialCapabilityIds={initialCapabilityIds}
          initialEffectIds={initialEffectIds}
        />
      );
      break;
  }
  const kinds = (["primitive", "effect", "capability"] as EntityKind[]).filter(
    (child) => canContain(kind, child),
  );
  const compositionStudio = kinds.length > 0 ? (
    <section className="v12-composition-studio" aria-label={`Compose ${kind}`}>
      <header className="v12-composition-studio-head">
        <div><span>Composition studio</span><h3>Build this {kind}</h3></div>
        <nav aria-label="Composition sources">
          <button type="button" aria-pressed={!library} onClick={() => setLibrary(false)}>On this character</button>
          <button type="button" aria-pressed={library} onClick={() => setLibrary(true)}>Library</button>
        </nav>
      </header>
      {!library && (
        <div className="v12-composition-source-grid">
          {initialGraph.nodes.filter((n) => canContain(kind, n.kind)).length ? initialGraph.nodes
            .filter((n) => canContain(kind, n.kind))
            .map((n) => (
              <article key={n.key} data-kind={n.kind}>
                <div><span>{n.kind}</span><strong>{n.name}</strong></div>
                <button type="button" onClick={() => void choose(n.key, n.name).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to add piece."))}>Add</button>
              </article>
            )) : <p className="v12-composition-source-empty">No compatible pieces are on this character yet. Open Library to bring one in.</p>}
        </div>
      )}
      {library && (
        <WorkspaceLibraryPicker
          kinds={kinds}
          category={category}
          destinationLabel={node?.name ?? `this ${kind}`}
          onSelect={(key, name) => {
            void choose(key, name).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to add piece."));
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  ) : null;
  const authoringStudio = (
    <div className="v12-character-atelier-modal-body space-y-4">
      {onChooseEntity && <details className="sheet-entity-switcher"><summary>Choose another entity</summary><p>Start a new piece or open one on your character. Switching asks you to handle unfinished edits first.</p><div>{(["primitive","effect","capability","heritage","item"] as EntityKind[]).map(next=><button className="sheet-button" type="button" key={next} onClick={()=>onChooseEntity(next)}>New {next}</button>)}</div><label>Open a character piece<select aria-label="Choose another character entity" value="" onChange={event=>{const target=graph.nodes.find(item=>item.key===event.target.value);if(target)onChooseEntity(target.kind,target.key);}}><option value="">Choose an existing piece…</option>{graph.nodes.filter(item=>supplyPaths(graph,item.key).length>0).map(item=><option key={item.key} value={item.key}>{item.name} · {item.kind}</option>)}</select></label></details>}

      {kind === "heritage" && !node && (
        <label className="v12-heritage-kind-control flex items-center gap-3 font-medium">
          Heritage type
          <select aria-label="Heritage type" value={heritageKind} onChange={(event) => setHeritageKind(event.target.value as typeof heritageKind)}>
            <option value="LINEAGE">Lineage</option><option value="UPBRINGING">Upbringing</option><option value="MANIFEST">Manifest</option>
          </select>
        </label>
      )}
      {!integratedSources && compositionStudio}
      {integratedSources && kinds.length > 0 && <p className="sheet-guidance">Use Find on the left to bring rules into this piece. Add the finished piece to your draft when it is ready.</p>}
      {error && integratedSources && <p role="alert">{error}</p>}
      {form}
    </div>
  );
  return (
    <section className="v12-character-atelier" data-active-pane={studioTab} data-integrated-sources={integratedSources}>
      <header className="v12-character-atelier-head">
        <div>
          <span>Character Atelier</span>
          <strong>{node ? `Editing ${node.name}` : `New ${kind}`}</strong>
          <p>Add this piece to your draft, then review all changes together.</p>
        </div>
        <nav aria-label="Build and preview panes">
          <button type="button" aria-pressed={studioTab === "build"} onClick={() => setStudioTab("build")}>
            <Wrench className="size-3.5" /> Build
          </button>
          <button type="button" aria-pressed={studioTab === "preview"} onClick={() => setStudioTab("preview")}>
            <Eye className="size-3.5" /> Preview
          </button>

        </nav>
      </header>
      <div className="v12-character-atelier-stage">
        <div className="v12-character-atelier-build" data-atelier-pane="build">
          <CharacterAuthoringProvider characterId={graph.characterId} sessionKey={sessionKey ?? `${kind}:${node?.key ?? "new"}`} isEditing={!!node} destinationLabel={category.toLowerCase()}>{authoringStudio}</CharacterAuthoringProvider>
        </div>
        <aside className="v12-character-atelier-preview" data-atelier-pane="preview" aria-label="Live entity preview">
          <div className="v12-character-atelier-preview-label"><span>Live preview</span><b>How it reads at the table</b></div>
          {previewNode}
        </aside>
      </div>
    </section>
  );
}
