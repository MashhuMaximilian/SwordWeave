"use client";
import { readJsonResponse } from "@/lib/http/read-json-response";
import { compositionRow } from "@/lib/character/workspace/composition-row";
import type { PreviewActionProps } from "@/components/preview/preview-shared";
import { EntityPreview } from "@/components/preview/entity-preview";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import type {
  EntityKey,
  EntityKind,
  WorkspaceGraph,
  WorkspaceNode,
} from "@/lib/character/workspace/model";

export function previewKind(type: string): EntityKind {
  return type.endsWith("_TEMPLATE") || type.startsWith("TEMPLATE_")
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
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error ?? "Unable to load preview.");
  const row = data[kind === "heritage" ? "template" : kind];
  if (!row) throw new Error("Preview unavailable.");
  return { kind, row } as SandboxPreviewItem;
}
export function WorkspaceEntityPreview({
  node,
  graph,
  onOpen,
  actionBar,
}: {
  actionBar?: PreviewActionProps | undefined;
  node: WorkspaceNode;
  graph: WorkspaceGraph;
  onOpen: (key: EntityKey) => void;
}) {
  return (
    <div className="v12-fetched-preview">
    <EntityPreview
      item={{ kind: node.kind, row: compositionRow(graph,node) } as SandboxPreviewItem}
      actionBar={actionBar}
      callbacks={{
        preferLocalSubLinks: true,
        onSubLinkClick: (link) =>
          onOpen(`${previewKind(link.targetType)}:${link.targetId}`),
      }}
    />
    </div>
  );
}
