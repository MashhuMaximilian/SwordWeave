"use client";
import { useCharacterReadOnly } from "../character-read-only";
import { bundleBu } from "@/lib/character/workspace/model";
import type { WorkspaceNode, WorkspaceGraph, WorkspaceEdge, EntityKey } from "@/lib/character/workspace/model";
import { CapabilityCard } from "../capability-card";
import { mechanicalDescriptionFromModifiers } from "@/lib/primitives/mechanical-rule";
import { flipOperation } from "@/lib/engine/mirror";
import type { HardModifier } from "@/types/swordweave";
import {
  CompactCompositeCard,
  CompactHierarchyBranch,
  CompactPrimitiveCard,
} from "../compact-hierarchy";

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
  const readOnly = useCharacterReadOnly();
  if (seen.includes(node.key)) return null;
  const contents = graph.edges
    .filter((e) => e.parent === node.key)
    .sort((a, b) => a.order - b.order);
  const renderEntry = (edge: WorkspaceEdge) => {
        const child = graph.nodes.find((n) => n.key === edge.child);
        if (!child) return null;
        const version = Number(child.data["workspaceVersionNumber"] ?? 1);
        const mirrored = edge.isMirrored;
        const childHasContents = graph.edges.some((candidate) => candidate.parent === child.key);
        const effects = child.kind === "capability" ? graph.edges
          .filter((candidate) => candidate.parent === child.key && candidate.child.startsWith("effect:"))
          .sort((a, b) => a.order - b.order)
          .flatMap((candidate) => {
            const effect = graph.nodes.find((node) => node.key === candidate.child);
            return effect ? [{ effectId: effect.id, effect: { id: effect.id, name: effect.name, description: effect.description } }] : [];
          }) : [];
        if (child.kind === "primitive") {
          return (
            <CompactPrimitiveCard
              key={edge.id}
              name={child.name}
              version={Number.isFinite(version) ? version : 1}
              mechanicalText={ruleText(child, mirrored)}
              narrativeText={child.description !== "null" ? child.description : null}
              mirrored={mirrored}
              onOpen={() => onOpen(edge, ancestors)}
            />
          );
        }

        const nested = childHasContents ? (
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
        ) : null;
        const actions = child.kind === "capability" && characterId && mode === "PLAY" ? (
          <CapabilityCard characterId={characterId} actionsOnly showPrimitives={false} showPreviewButton={false} capability={{ id: child.id, name: child.name, type: String(child.data["type"] ?? "Capability"), sourceType: String(child.data["sourceType"] ?? "Character"), acquiredAtLevel: Number(edge.data?.["acquiredAtLevel"] ?? 1), versionId: child.versionId, latestVersionId: child.latestVersionId, slotSource: null, verboseDescription: child.description, effectLinks: effects }} />
        ) : null;
        return (
          <CompactCompositeCard
            key={edge.id}
            kind={child.kind === "effect" ? "effect" : "capability"}
            name={child.name}
            version={Number.isFinite(version) ? version : 1}
            cost={bundleBu(graph, child.key)}
            state={child.kind === "effect" ? null : String(child.data["type"] ?? "")}
            description={child.description !== "null" ? child.description : null}
            onOpen={() => onOpen(edge, ancestors)}
            collapsible={child.kind === "capability"}
            defaultExpanded
            actions={child.kind === "effect" && characterId && mode === "PLAY" ? (
              <button
                disabled={readOnly}
                className="v12-effect-toggle"
                aria-pressed={!effectIsOff?.(child.id)}
                onClick={() => onToggleEffect?.(child.id)}
              >
                {effectIsOff?.(child.id) ? "Inactive" : "Active"}
              </button>
            ) : actions}
          >
            {nested}
          </CompactCompositeCard>
        );
  };
  const directRules = contents.filter(edge => graph.nodes.find(child => child.key === edge.child)?.kind === "primitive");
  const grantedEntries = contents.filter(edge => graph.nodes.find(child => child.key === edge.child)?.kind !== "primitive");
  const sourceLabel = String(node.data["kind"] ?? node.data["type"] ?? "heritage").toLowerCase();
  return (
    <div
      className={`v12-bundle-contents${node.kind === "heritage" ? " v12-expression-grid" : ""}${ancestors.length ? " is-nested" : ""}`}
      data-depth={ancestors.length}
      data-parent-kind={node.kind}
    >
      {!contents.length && <p className="text-muted-foreground">Nothing added yet.</p>}
      {node.kind === "heritage" ? <>
        {grantedEntries.length > 0 && <CompactHierarchyBranch label="Capabilities" count={grantedEntries.length} tone="gold">{grantedEntries.map(renderEntry)}</CompactHierarchyBranch>}
        {directRules.length > 0 && <CompactHierarchyBranch className="v12-expression-direct" label={`Direct ${sourceLabel} primitives`} count={directRules.length} tone="teal">{directRules.map(renderEntry)}</CompactHierarchyBranch>}
      </> : node.kind === "capability" ? <>
        {directRules.length > 0 && <CompactHierarchyBranch className="v12-expression-direct" label="Direct primitives" count={directRules.length} tone="teal">{directRules.map(renderEntry)}</CompactHierarchyBranch>}
        {grantedEntries.length > 0 && <CompactHierarchyBranch label="Effects" count={grantedEntries.length} tone="copper">{grantedEntries.map(renderEntry)}</CompactHierarchyBranch>}
      </> : node.kind === "effect" ? <div className="v12-canonical-effect-primitives">{directRules.map(renderEntry)}</div> : contents.map(renderEntry)}
    </div>
  );
}
