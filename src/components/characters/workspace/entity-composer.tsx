"use client";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import { CapabilityForm } from "@/components/sandbox/capability-form";
import { EffectForm } from "@/components/sandbox/effect-form";
import { HeritageForm } from "@/components/sandbox/heritage-form";
import { ItemForm } from "@/components/sandbox/item-form";
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
  const [error, setError] = useState("");
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
  const capabilities = graph.nodes
    .filter((n) => n.kind === "capability")
    .map((n) => ({
      id: n.id,
      name: n.name,
      type: String(n.data["type"]),
      sourceType: String(n.data["sourceType"]),
    }));
  const effects = graph.nodes
    .filter((n) => n.kind === "effect")
    .map((n) => ({ id: n.id, name: n.name }));
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
  return (
    <div className="space-y-4">
      {kind === "heritage" && !node && (
        <label className="flex items-center gap-3 font-medium">
          Heritage type
          <select
            aria-label="Heritage type"
            className="rounded border border-border bg-card p-2"
            value={heritageKind}
            onChange={(e) =>
              setHeritageKind(e.target.value as typeof heritageKind)
            }
          >
            <option value="LINEAGE">Lineage</option>
            <option value="UPBRINGING">Upbringing</option>
            <option value="MANIFEST">Manifest</option>
          </select>
        </label>
      )}
      {kinds.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-medium">Add to this {kind}</p>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Choose existing character content"
              className="min-w-0 flex-1 rounded border border-border bg-background p-2"
              value=""
              onChange={(e) => {
                const n = graph.nodes.find((n) => n.key === e.target.value);
                if (n)
                  void choose(n.key, n.name).catch((e) => setError(e.message));
              }}
            >
              <option value="">On this character…</option>
              {initialGraph.nodes
                .filter((n) => canContain(kind, n.kind))
                .map((n) => (
                  <option key={n.key} value={n.key}>
                    {n.name} · {n.kind}
                  </option>
                ))}
            </select>
            <button
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={() => setLibrary(!library)}
            >
              Library
            </button>
          </div>
          {library && (
            <WorkspaceLibraryPicker
              kinds={kinds}
              category={category}
              onSelect={(key, name) => {
                void choose(key, name).catch((e) => setError(e.message));
              }}
            />
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      {form}
    </div>
  );
}
