import { z } from "zod";
import { consequencePackage } from "@/lib/character/consequences/package";
import { effectiveAvailability, supplyPaths, type EntityKey, type WorkspaceEdge, type WorkspaceNode } from "@/lib/character/workspace/model";
import { activeRestrictions, type ConsequenceOccurrence } from "@/lib/character/consequences/types";
import { VITALITY_TARGETS } from "@/lib/engine/target-registry";
import { graphChildren, type readVisibleGraph } from "./character-context";

export type PackageSourceKey = `primitive:${string}` | `effect:${string}` | `capability:${string}`;
type VisibleGraph = Awaited<ReturnType<typeof readVisibleGraph>>;
const sourceUuid = z.uuid();
const supportedModifier = z.strictObject({
  kind: z.literal("modify"), target: z.literal(VITALITY_TARGETS.max),
  operation: z.enum(["add", "subtract", "multiply", "divide", "set", "min", "max"]),
  value: z.number().finite(),
  stacking: z.enum(["stack", "highest-only", "lowest-only", "unique-by-primitive", "unique-by-target", "replace"]).optional(),
}).refine(modifier => modifier.operation !== "divide" || modifier.value !== 0);

export function packageKey(key: string): key is PackageSourceKey {
  if (/^primitive:[1-9][0-9]{0,9}$/.test(key)) return Number(key.slice(10)) <= 2147483647;
  if (!key.startsWith("effect:") && !key.startsWith("capability:")) return false;
  return sourceUuid.safeParse(key.slice(key.indexOf(":") + 1)).success && key === key.toLowerCase();
}

const edgeEvidence = (edge: WorkspaceEdge) => ({
  id: edge.id, parent: edge.parent, child: edge.child, pin: edge.versionId, order: edge.order, category: edge.category,
  role: edge.data?.["role"], quantity: edge.data?.["quantity"],
});

/** Admit complete pinned packages whose effects the Companion can show exactly. */
export function pinnedPackageSources(view: VisibleGraph, occurrences: readonly ConsequenceOccurrence[], overrides: Record<string, unknown>) {
  const nodes = new Map(view.graph.nodes.map(node => [node.key, node]));
  const children = graphChildren(view.canonical);
  const visibleEdges = new Set(view.graph.edges);
  const restrictions = activeRestrictions(occurrences);
  const off = (prefix: string) => new Set(Object.keys(overrides)
    .filter(key => key.startsWith(prefix) && overrides[key] === true).map(key => key.slice(prefix.length)));
  const offCapabilities = off("cap:");
  const offEffects = off("eff:");
  const hasPin = (node: WorkspaceNode | undefined) => !!node?.versionId && sourceUuid.safeParse(node.versionId).success &&
    node.data["workspacePinnedSnapshot"] === true && !node.data["workspaceVersionIssue"] && !node.data["templatePrimitiveId"];
  const exactEdge = (edge: WorkspaceEdge) => {
    const child = nodes.get(edge.child);
    return visibleEdges.has(edge) && !edge.isMirrored && hasPin(child) && child?.versionId === edge.versionId;
  };

  return function select(key: EntityKey) {
    if (!packageKey(key) || !hasPin(nodes.get(key))) return null;
    const paths = supplyPaths(view.graph, key).filter(path => !path.item && path.edges.length <= 20 && path.edges.every(exactEdge));
    const usablePaths = effectiveAvailability(key, paths, restrictions, offCapabilities, offEffects).availablePaths;
    if (!usablePaths.length) return null;
    const members = new Set<EntityKey>();
    const edges: WorkspaceEdge[] = [];
    const visiting = new Set<EntityKey>();
    function visit(member: EntityKey): boolean {
      if (visiting.has(member)) return false;
      if (members.has(member)) return true;
      if (visiting.size >= 20 || members.size >= 80 || !hasPin(nodes.get(member))) return false;
      visiting.add(member);
      for (const edge of children.get(member) ?? []) {
        if (edges.length >= 120 || !exactEdge(edge) || !visit(edge.child)) return false;
        edges.push(edge);
      }
      visiting.delete(member);
      members.add(member);
      return true;
    }
    if (!visit(key)) return null;

    let pkg: ReturnType<typeof consequencePackage>;
    try {
      pkg = consequencePackage(view.canonical, key);
    } catch {
      return null;
    }
    if (!pkg.pieces.length || pkg.pieces.length > 20) return null;
    const effects = [];
    for (const piece of pkg.pieces) {
      const modifiers = z.array(supportedModifier).max(10).safeParse(piece.modifiers);
      if (!modifiers.success || piece.title.length > 200 || piece.description.length > 2_000 || piece.behavior.recovery.length > 2_000 ||
          piece.behavior.restrictions.length > 10) return null;
      const targetRules = [];
      for (const restriction of piece.behavior.restrictions) {
        const target = nodes.get(`${restriction.kind}:${restriction.entityId}`);
        if (!target || !hasPin(target) || restriction.reason.length > 500) return null;
        targetRules.push({ kind: restriction.kind, title: target.name.slice(0, 180), versionId: target.versionId, reason: restriction.reason });
      }
      effects.push({
        title: piece.title, description: piece.description, sourceVersionId: piece.versionId, durationTier: "manual",
        vitalityDelta: piece.behavior.vitalityDelta, recovery: piece.behavior.recovery, restrictions: targetRules, modifiers: modifiers.data,
      });
    }
    if (Buffer.byteLength(JSON.stringify(effects)) > 24_000) return null;
    return {
      key, versionId: nodes.get(key)!.versionId!, effects,
      dependencies: {
        paths: usablePaths.map(path => path.edges.map(edgeEvidence)),
        edges: edges.map(edgeEvidence),
        nodes: [...members].sort().map(member => ({ key: member, pin: nodes.get(member)?.versionId })),
      },
    };
  };
}
