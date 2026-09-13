"use client";
import type { WorkspaceNode, WorkspaceGraph, WorkspaceEdge, EntityKey } from "@/lib/character/workspace/model";

export function BundleContents({
  node,
  graph,
  onOpen,
  ancestors = [],
  seen = [],
}: {
  node: WorkspaceNode;
  graph: WorkspaceGraph;
  onOpen: (edge: WorkspaceEdge, ancestors: string[]) => void;
  ancestors?: string[];
  seen?: EntityKey[];
}) {
  if (seen.includes(node.key)) return null;
  const contents = graph.edges
    .filter((e) => e.parent === node.key)
    .sort((a, b) => a.order - b.order);
  const renderEntry = (edge: WorkspaceEdge) => {
        const child = graph.nodes.find((n) => n.key === edge.child);
        if (!child) return null;
        return (
          <div
            key={edge.id}
            className={
              child.kind !== "primitive"
                ? "v12-expression-piece"
                : "v12-expression-rule"
            }
          >
            <button
              className="py-1 text-left text-primary hover:underline"
              onClick={() => onOpen(edge, ancestors)}
            >
              {child.name}
              <span className="ml-2 text-xs text-muted-foreground">
                {child.kind === "primitive" ? "Primitive" : child.kind}
              </span>
            </button>
            {child.kind === "primitive" && typeof child.data["mechanicalOutputText"] === "string" && child.data["mechanicalOutputText"] && child.data["mechanicalOutputText"] !== child.description && <p className="v12-rule-text">{child.data["mechanicalOutputText"]}</p>}
            {child.description && child.description !== "null" && <p className={child.kind === "primitive" ? "v12-rule-text" : "v12-expression-description"}>{child.description}</p>}
            {child.kind !== "primitive" && (
              <BundleContents
                node={child}
                graph={graph}
                onOpen={onOpen}
                ancestors={[...ancestors, edge.id]}
                seen={[...seen, node.key]}
              />
            )}
          </div>
        );
  };
  const directRules = contents.filter(edge => graph.nodes.find(child => child.key === edge.child)?.kind === "primitive");
  const grantedEntries = contents.filter(edge => graph.nodes.find(child => child.key === edge.child)?.kind !== "primitive");
  const sourceLabel = String(node.data["kind"] ?? node.data["type"] ?? "heritage").toLowerCase();
  return (
    <div className={`v12-bundle-contents ${node.kind === "heritage" ? "v12-expression-grid" : ""}`}>
      {!ancestors.length && node.kind !== "heritage" && <p className="v12-kicker">Composition</p>}
      {!contents.length && <p className="text-muted-foreground">Nothing added yet.</p>}
      {node.kind === "heritage" ? <>
        {grantedEntries.length > 0 && <div className="v12-expression-grants">{grantedEntries.map(renderEntry)}</div>}
        {directRules.length > 0 && <section className="v12-expression-direct">
          <header><p className="v12-kicker">Direct {sourceLabel} primitives</p><span className="v12-tag">{directRules.length} rules</span></header>
          <div>{directRules.map(renderEntry)}</div>
        </section>}
      </> : contents.map(renderEntry)}
    </div>
  );
}
