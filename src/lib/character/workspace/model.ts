import type { AccessRestriction } from "../consequences/types";

export type EntityKind =
  "primitive" | "effect" | "capability" | "heritage" | "item";
export type EntityKey = `${EntityKind}:${string}`;
export type WorkspaceCategory =
  "ALL" | "LINEAGE" | "UPBRINGING" | "MANIFEST" | "ITEM";
export interface WorkspaceNode {
  key: EntityKey;
  kind: EntityKind;
  id: string;
  name: string;
  bu: number;
  versionId: string | null;
  latestVersionId: string | null;
  userId: string | null;
  description: string;
  data: Record<string, unknown>;
}
export interface WorkspaceEdge {
  id: string;
  parent: EntityKey | null;
  child: EntityKey;
  category: WorkspaceCategory;
  order: number;
  isMirrored: boolean;
  data?: Record<string, unknown>;
  instanceId?: string;
  versionId?: string | null;
  slotSource?: string | null;
}
export interface WorkspaceGraph {
  characterId: string;
  revision: number;
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
}
export interface SupplyPath {
  edges: WorkspaceEdge[];
  nodes: EntityKey[];
  item: boolean;
}
const allowed: Record<EntityKind, readonly EntityKind[]> = {
  primitive: [],
  effect: ["primitive"],
  capability: ["primitive", "effect"],
  heritage: ["primitive", "capability"],
  item: ["primitive", "capability", "effect"],
};
export function canContain(parent: EntityKind, child: EntityKind): boolean {
  return allowed[parent].includes(child);
}
export function validateReference(
  graph: WorkspaceGraph,
  parent: EntityKey,
  child: EntityKey,
): string | null {
  const p = graph.nodes.find((n) => n.key === parent);
  const c = graph.nodes.find((n) => n.key === child);
  if (!p || !c)
    return "This piece is no longer available. Refresh and try again.";
  if (!canContain(p.kind, c.kind)) return `${p.kind} cannot contain ${c.kind}.`;
  const visited = new Set<EntityKey>();
  function reaches(key: EntityKey): boolean {
    if (key === parent) return true;
    if (visited.has(key)) return false;
    visited.add(key);
    return graph.edges.some((e) => e.parent === key && reaches(e.child));
  }
  return reaches(child) ? "This reference would create a cycle." : null;
}

/** Keep every root-to-piece path. A single origin column is not a supply graph. */
export function supplyPaths(
  graph: WorkspaceGraph,
  target: EntityKey,
): SupplyPath[] {
  const children = new Map<EntityKey | null, WorkspaceEdge[]>();
  for (const e of graph.edges)
    children.set(e.parent, [...(children.get(e.parent) ?? []), e]);
  const out: SupplyPath[] = [];
  function walk(
    edge: WorkspaceEdge,
    edges: WorkspaceEdge[],
    nodes: EntityKey[],
  ) {
    if (nodes.includes(edge.child)) return;
    const path = {
      edges: [...edges, edge],
      nodes: [...nodes, edge.child],
      item:
        edge.category === "ITEM" || edges.some((e) => e.category === "ITEM"),
    };
    if (edge.child === target) out.push(path);
    for (const next of children.get(edge.child) ?? [])
      walk(next, path.edges, path.nodes);
  }
  for (const root of children.get(null) ?? []) walk(root, [], []);
  return out;
}
export function effectiveAvailability(
  key: EntityKey,
  paths: readonly SupplyPath[],
  restrictions: readonly AccessRestriction[],
  offCapabilities: ReadonlySet<string> = new Set(),
  offEffects: ReadonlySet<string> = new Set(),
): { available: boolean; reasons: string[]; availablePaths: SupplyPath[] } {
  const global = restrictions.filter(
    (r) => r.kind === "primitive" && `primitive:${r.entityId}` === key,
  );
  const reasons = new Set(global.map((r) => r.reason || "Primitive disabled"));
  const availablePaths = global.length
    ? []
    : paths.filter((path) => {
        const inactiveItem = path.edges.find(
          (e) =>
            e.parent === null &&
            e.child.startsWith("item:") &&
            e.data?.["equipped"] === false &&
            !e.data?.["isNotEquippable"],
        );
        if (inactiveItem) {
          reasons.add("Item is not equipped");
          return false;
        }
        const blocked = path.nodes.flatMap((node) => {
          const [kind, id] = node.split(":");
          const explicit = restrictions
            .filter(
              (r) =>
                r.kind === "capability" && node === `capability:${r.entityId}`,
            )
            .map((r) => r.reason || "Capability disabled");
          if (
            (kind === "capability" && offCapabilities.has(id!)) ||
            (kind === "effect" && offEffects.has(id!))
          )
            explicit.push(`${kind} switched off`);
          return explicit;
        });
        blocked.forEach((reason) => reasons.add(reason));
        return !blocked.length;
      });
  return {
    available: availablePaths.length > 0,
    reasons: [...reasons],
    availablePaths,
  };
}

/** Select supply paths for one mechanical instance, retaining its direct supply
 * when the same instance also participates in bundles. Additional purchased
 * instances remain independent rather than inheriting another instance's path. */
export function instanceSupplyPaths(
  graph: WorkspaceGraph,
  slot: {
    primitiveId: number;
    isMirrored?: boolean;
    instanceId?: string;
    directSource?: string | null;
    originHeritageId?: string | null;
    originCapabilityId?: string | null;
    originEffectId?: string | null;
    originItemId?: string | null;
  },
): SupplyPath[] {
  const inherited = !!(
    slot.originHeritageId ||
    slot.originCapabilityId ||
    slot.originEffectId ||
    slot.originItemId
  );
  return supplyPaths(graph, `primitive:${slot.primitiveId}`).filter((path) => {
    if (path.nodes.length > 1)
      return (
        inherited &&
        (slot.isMirrored === undefined ||
          path.edges.some((e) => e.isMirrored) === slot.isMirrored)
      );
    if (inherited && !slot.directSource) return false;
    return !slot.instanceId || path.edges[0]?.instanceId === slot.instanceId;
  });
}

/** Definition cost, counted once per shared primitive. Character instance costs
 * remain the engine's authoritative ledger and are displayed in the top drawer. */
export function bundleBu(graph: WorkspaceGraph, key: EntityKey): number {
  const node = graph.nodes.find((n) => n.key === key);
  if (!node) return 0;
  if (node.kind === "primitive" || node.kind === "item") return node.bu;
  const rooted: WorkspaceGraph = {
    ...graph,
    edges: [
      ...graph.edges.filter((e) => e.parent !== null),
      {
        id: "cost-root",
        parent: null,
        child: key,
        category: "ALL",
        order: 0,
        isMirrored: false,
      },
    ],
  };
  return graph.nodes
    .filter((n) => n.kind === "primitive")
    .reduce(
      (total, primitive) =>
        total +
        (supplyPaths(rooted, primitive.key).some(
          (p) => !p.edges.some((e) => e.isMirrored),
        )
          ? primitive.bu
          : 0),
      0,
    );
}
