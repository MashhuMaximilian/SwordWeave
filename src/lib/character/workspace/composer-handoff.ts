import { supplyPaths, type EntityKey, type WorkspaceCategory, type WorkspaceGraph } from "./model";

/** Resolve the occurrence just attached, including parents copied while editing
 * a shared bundle. A piece's entity key alone does not identify its destination. */
export function resolveComposerHandoff({ before, after, result, parentPath, category, mirrored = false }: {
  before: WorkspaceGraph;
  after: WorkspaceGraph;
  result: Record<string, unknown>;
  parentPath: string[];
  category: Exclude<WorkspaceCategory, "ALL">;
  mirrored?: boolean;
}) {
  const node = after.nodes.find((entry) => entry.key === result["savedKey"]);
  if (!node) return null;
  const replacements = (result["replacements"] ?? {}) as Record<string, EntityKey>;
  const parentKeys = parentPath.map((id) => before.edges.find((edge) => edge.id === id)?.child);
  if (parentKeys.some((key) => !key)) return null;
  const expected = parentKeys.map((key) => replacements[key!] ?? key);
  const candidates = supplyPaths(after, node.key).filter((candidate) =>
    candidate.edges[0]?.category === category &&
    candidate.edges.at(-1)?.isMirrored === mirrored &&
    candidate.nodes.length === expected.length + 1 &&
    expected.every((key, index) => candidate.nodes[index] === key),
  );
  // Stable ancestor edge IDs distinguish repeated placements of one bundle.
  candidates.sort((a, b) => parentPath.reduce((score, id, index) =>
    score + Number(b.edges[index]?.id === id) - Number(a.edges[index]?.id === id), 0));
  const occurrence = candidates[0];
  return occurrence ? { node, path: occurrence.edges.map((edge) => edge.id) } : null;
}
