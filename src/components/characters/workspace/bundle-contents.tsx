"use client";
import { bundleBu } from "@/lib/character/workspace/model";
import type { WorkspaceNode, WorkspaceGraph, WorkspaceEdge, EntityKey } from "@/lib/character/workspace/model";
import { CapabilityCard } from "../capability-card";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import { flipOperation } from "@/lib/engine/mirror";
import type { HardModifier } from "@/types/swordweave";
import { Markdown } from "@/components/ui/markdown";

function ruleText(node: WorkspaceNode, mirrored: boolean): string {
  const stored = typeof node.data["mechanicalOutputText"] === "string" ? node.data["mechanicalOutputText"] : "";
  if (!mirrored) return stored;
  const modifiers = node.data["hardModifiers"];
  if (!Array.isArray(modifiers) || modifiers.length === 0) return stored;
  const inverse = modifiers.map((modifier) => {
    const value = modifier as HardModifier;
    return { ...value, operation: flipOperation(String(value.operation)) ?? value.operation };
  });
  return mechanicalDescriptionFromModifiers(inverse as HardModifier[]) || stored;
}

export function BundleContents({
  node,
  graph,
  onOpen,
  characterId,
  mode = "PLAY",
  effectIsOff,
  onToggleEffect,
  ancestors = [],
  seen = [],
}: {
  node: WorkspaceNode;
  graph: WorkspaceGraph;
  onOpen: (edge: WorkspaceEdge, ancestors: string[]) => void;
  characterId?: string | undefined;
  mode?: "BUILD" | "PLAY";
  effectIsOff?: ((id: string) => boolean) | undefined;
  onToggleEffect?: ((id: string) => void) | undefined;
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
        const versionLabel = child.data["workspaceVersionNumber"]
          ? `v${child.data["workspaceVersionNumber"]}`
          : child.versionId
            ? `v:${child.versionId.slice(0, 8)}`
            : "v:1";
        const mirrored = edge.isMirrored;
        const effects = child.kind === "capability" ? graph.edges
          .filter((candidate) => candidate.parent === child.key && candidate.child.startsWith("effect:"))
          .sort((a, b) => a.order - b.order)
          .flatMap((candidate) => {
            const effect = graph.nodes.find((node) => node.key === candidate.child);
            return effect ? [{ effectId: effect.id, effect: { id: effect.id, name: effect.name, description: effect.description } }] : [];
          }) : [];
        return (
          <div
            key={edge.id}
            data-expression-kind={child.kind}
            className={
              child.kind !== "primitive"
                ? `v12-expression-piece${mirrored ? " is-mirrored" : ""}`
                : `v12-expression-rule${mirrored ? " is-mirrored" : ""}`
            }
          >
            {child.kind !== "primitive" && <div className="v12-expression-heading"><p className="v12-kicker">{child.kind}{child.kind !== "effect" && typeof child.data["type"] === "string" ? ` · ${child.data["type"]}` : ""}</p><span className="v12-tag">{bundleBu(graph, child.key)} BU</span></div>}
            {child.kind === "primitive" ? <div className="v12-bundled-primitive-title">
              <span className="v12-workspace-version">{versionLabel}</span>
              <button
                className="min-w-0 text-left text-primary hover:underline"
                onClick={() => onOpen(edge, ancestors)}
              >
                {child.name}
              </button>
              <span className="v12-workspace-kind">Primitive</span>
            </div> : child.kind === "effect" ? <div className="v12-effect-title-row">
              <button
                className="min-w-0 text-left text-primary hover:underline"
                onClick={() => onOpen(edge, ancestors)}
              >
                {child.name}
              </button>
              {characterId && mode === "PLAY" && <button
                className="v12-effect-toggle"
                aria-pressed={!effectIsOff?.(child.id)}
                onClick={() => onToggleEffect?.(child.id)}
              >
                {effectIsOff?.(child.id) ? "Inactive" : "Active"}
              </button>}
            </div> : <button
              className="py-1 text-left text-primary hover:underline"
              onClick={() => onOpen(edge, ancestors)}
            >
              {child.name}{" "}
              <span className="ml-2 text-xs text-muted-foreground">{child.kind}</span>
            </button>}
            {child.kind === "primitive" && edge.isMirrored && <div className="v12-rule-provenance" aria-label={`${child.name} supply state`}>
              {edge.isMirrored && <span className="is-mirrored">Mirrored inverse</span>}
            </div>}
            {child.kind === "primitive" && ruleText(child, mirrored) && ruleText(child, mirrored) !== child.description && <p className="v12-rule-text v12-rule-output">{ruleText(child, mirrored)}</p>}
            {child.description && child.description !== "null" && <Markdown className={child.kind === "primitive" ? "v12-rule-text v12-rule-description" : "v12-expression-description"}>{child.description}</Markdown>}
            {child.kind === "capability" && characterId && mode === "PLAY" && <CapabilityCard characterId={characterId} actionsOnly showPrimitives={false} showPreviewButton={false} capability={{ id: child.id, name: child.name, type: String(child.data["type"] ?? "Capability"), sourceType: String(child.data["sourceType"] ?? "Character"), acquiredAtLevel: Number(edge.data?.["acquiredAtLevel"] ?? 1), versionId: child.versionId, latestVersionId: child.latestVersionId, slotSource: null, verboseDescription: child.description, effectLinks: effects }} />}
            {child.kind === "capability" && <div className="v12-expression-recipe" aria-label={`${child.name} recipe`}>
              {graph.edges.filter(piece => piece.parent === child.key).sort((a,b)=>a.order-b.order).map(piece => {
                const ingredient=graph.nodes.find(candidate=>candidate.key===piece.child);
                return ingredient ? <button key={piece.id} onClick={()=>onOpen(piece,[...ancestors,edge.id])}>{ingredient.name}{ingredient.kind === "effect" ? " · effect" : ""}</button> : null;
              })}
            </div>}
            {child.kind !== "primitive" && (
              <BundleContents
                node={child}
                graph={graph}
                onOpen={onOpen}
                characterId={characterId}
                mode={mode}
                effectIsOff={effectIsOff}
                onToggleEffect={onToggleEffect}
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
          <header><p className="v12-kicker">Direct {sourceLabel} primitives</p><span className="v12-tag">{directRules.length} {directRules.length === 1 ? "rule" : "rules"}</span></header>
          <div>{directRules.map(renderEntry)}</div>
        </section>}
      </> : contents.map(renderEntry)}
    </div>
  );
}
