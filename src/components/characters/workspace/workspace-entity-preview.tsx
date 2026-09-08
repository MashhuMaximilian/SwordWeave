"use client";
import { EntityPreview } from "@/components/preview/entity-preview";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type {
  EntityKey,
  EntityKind,
  WorkspaceGraph,
  WorkspaceNode,
} from "@/lib/character/workspace/model";

export function previewKind(type: string): EntityKind {
  return type.endsWith("_TEMPLATE")
    ? "heritage"
    : (type.toLowerCase() as EntityKind);
}
export async function loadEntityPreview(
  kind: EntityKind,
  id: string,
  signal?: AbortSignal,
): Promise<SandboxPreviewItem> {
  const endpoint = {
    primitive: "primitives",
    capability: "capabilities",
    effect: "effects",
    heritage: "heritage",
    item: "items",
  }[kind];
  const response = await fetch(`/api/${endpoint}/${id}`, {
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to load preview.");
  const row = data[kind === "heritage" ? "template" : kind];
  if (!row) throw new Error("Preview unavailable.");
  return { kind, row } as SandboxPreviewItem;
}
export function WorkspaceEntityPreview({
  node,
  graph,
  onOpen,
}: {
  node: WorkspaceNode;
  graph: WorkspaceGraph;
  onOpen: (key: EntityKey) => void;
}) {
  function rowFor(
    current: WorkspaceNode,
    seen: EntityKey[] = [],
  ): Record<string, unknown> {
    const result = {
      ...current.data,
      id: current.kind === "primitive" ? Number(current.id) : current.id,
      name: current.name,
      buCost: current.bu,
      tags: current.data["tags"] ?? [],
      primitiveLinks: [],
      capabilityLinks: [],
      effectLinks: [],
    } as Record<string, unknown>;
    if (seen.includes(current.key)) return result;
    for (const kind of ["primitive", "capability", "effect"] as const) {
      result[`${kind}Links`] = graph.edges
        .filter(
          (e) => e.parent === current.key && e.child.startsWith(`${kind}:`),
        )
        .sort((a, b) => a.order - b.order)
        .flatMap((e) => {
          const child = graph.nodes.find((n) => n.key === e.child);
          return child
            ? [
                {
                  ...e.data,
                  [`${kind}Id`]:
                    kind === "primitive" ? Number(child.id) : child.id,
                  [kind]: rowFor(child, [...seen, current.key]),
                  quantity: e.data?.["quantity"] ?? 1,
                  isMirrored: e.isMirrored,
                },
              ]
            : [];
        });
    }
    return result;
  }
  return (
    <EntityPreview
      item={{ kind: node.kind, row: rowFor(node) } as SandboxPreviewItem}
      callbacks={{
        onSubLinkClick: (link) =>
          onOpen(`${previewKind(link.targetType)}:${link.targetId}`),
      }}
    />
  );
}
