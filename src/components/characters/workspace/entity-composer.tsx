"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import { createPortal } from "react-dom";
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
import { useDrawerSlot } from "@/components/layout/build-preview-drawer";
import { WorkspaceLibraryPicker } from "./library-picker";
import { canContain } from "@/lib/character/workspace/model";
import type {
  WorkspaceGraph,
  WorkspaceNode,
  EntityKind,
  EntityKey,
} from "@/lib/character/workspace/model";

export function EntityComposer({
  graph: initialGraph,
  node,
  kind,
  category,
  selection = [],
  saveRequest,
  onSaved,
}: {
  graph: WorkspaceGraph;
  node?: WorkspaceNode | undefined;
  kind: EntityKind;
  category: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  selection?: EntityKey[];
  saveRequest: typeof fetch;
  onSaved: () => void;
}) {
  const [heritageKind, setHeritageKind] = useState(category);
  const [slotEvents] = useState(() => new EventTarget());
  const [extra, setExtra] = useState<WorkspaceNode[]>([]);
  const [library, setLibrary] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  } | null>(null);
  const graph = useMemo(
    () => ({
      ...initialGraph,
      nodes: [
        ...initialGraph.nodes,
        ...extra.filter(
          (n) => !initialGraph.nodes.some((p) => p.key === n.key),
        ),
      ],
    }),
    [initialGraph, extra],
  );
  useEffect(() => {
    if (delivery)
      slotEvents.dispatchEvent(
        new CustomEvent("sw-sandbox-slot", {
          detail: { ...delivery, operation: "add-reference" },
        }),
      );
  }, [delivery, slotEvents]);
  async function choose(key: EntityKey, label: string) {
    const [childKind, id] = key.split(":") as [EntityKind, string];
    if (!graph.nodes.some((n) => n.key === key)) {
      const endpoint =
        childKind === "capability"
          ? "capabilities"
          : childKind === "primitive"
            ? "primitives"
            : "effects";
      const response = await fetch(`/api/${endpoint}/${id}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Piece unavailable.");
      const row = data[childKind];
      if (!row) throw new Error("Piece unavailable.");
      setExtra((previous) => [
        ...previous,
        {
          key,
          kind: childKind,
          id,
          name: row.name,
          bu: row.buCost ?? 0,
          versionId: null,
          latestVersionId: null,
          userId: row.userId ?? null,
          description: "",
          data: row,
        },
      ]);
    }
    setDelivery((previous) => ({
      kind: childKind,
      id,
      label,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
    setLibrary(false);
  }
  const primitives = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.kind === "primitive")
        .map((n) => ({
          id: Number(n.id),
          name: n.name,
          category: String(n.data["category"]),
          buCost: n.bu,
        })),
    [graph.nodes],
  );
  const capabilities = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.kind === "capability")
        .map((n) => ({
          id: n.id,
          name: n.name,
          type: String(n.data["type"]),
          sourceType: String(n.data["sourceType"]),
        })),
    [graph.nodes],
  );
  const effects = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.kind === "effect")
        .map((n) => ({ id: n.id, name: n.name })),
    [graph.nodes],
  );
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
        `capability:${JSON.stringify(state)}`,
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
      : undefined,
  );
  const initialPrimitiveIds = selection
    .filter((k) => k.startsWith("primitive:"))
    .map((k) => Number(k.slice(10)));
  const initialEffectIds = selection
    .filter((k) => k.startsWith("effect:"))
    .map((k) => k.slice(7));
  const initialCapabilityIds = selection
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
      {kind === "heritage" && !node && (
        <label className="v12-heritage-kind-control flex items-center gap-3 font-medium">
          Heritage type
          <select aria-label="Heritage type" value={heritageKind} onChange={(event) => setHeritageKind(event.target.value as typeof heritageKind)}>
            <option value="LINEAGE">Lineage</option><option value="UPBRINGING">Upbringing</option><option value="MANIFEST">Manifest</option>
          </select>
        </label>
      )}
      {compositionStudio}
      {form}
    </div>
  );
  useDrawerSlot(useMemo(() => ({ build: authoringStudio, preview: previewNode }), [authoringStudio, previewNode]));
  return (
    <div className="space-y-4">
      <div className="v12-workspace-authoring-bridge">
        <div><span>Atelier authoring</span><strong>{node ? `Editing ${node.name}` : `New ${kind}`}</strong></div>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
        >
          Open live preview
        </button>
      </div>
      <div className="v12-workspace-drawer-guide">
        <span>Atelier connected</span>
        <h3>{node ? `${node.name} is ready to edit` : `New ${kind} authoring is ready`}</h3>
        <p>The complete Atelier form, character pieces, Library browser, and live preview are now in Build &amp; Preview.</p>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("sw-open-build-drawer", { detail: "build" }))}>Open authoring studio</button>
      </div>
      {previewOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="v12-author-preview-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={`Preview ${node?.name ?? kind}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setPreviewOpen(false);
              }}
            >
              <section className="v12-author-preview-modal">
                <header>
                  <div>
                    <span>Build &amp; Preview</span>
                    <h2>{node?.name ?? `New ${kind}`}</h2>
                  </div>
                  <button type="button" onClick={() => setPreviewOpen(false)}>
                    Close
                  </button>
                </header>
                <div className="v12-author-preview-body">{previewNode}</div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
