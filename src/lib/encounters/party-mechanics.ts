import {
  supplyPaths,
  type WorkspaceGraph,
} from "@/lib/character/workspace/model";

/** Read owned, pinned rule grants; mirrored restrictions are not owned permissions. */
export function partyMechanics(graph: WorkspaceGraph) {
  const result = {
    domains: [] as string[],
    verbTiers: [] as string[],
    diceTypes: [] as string[],
  };
  for (const node of graph.nodes) {
    if (
      node.kind !== "primitive" ||
      !supplyPaths(graph, node.key).some((path) =>
        path.edges.every((edge) => !edge.isMirrored),
      )
    )
      continue;
    const rule = node.data["mechanicalRule"] as
      | Record<string, unknown>
      | undefined;
    const family = String(rule?.["family"] ?? "").toUpperCase();
    const category = String(node.data["category"] ?? "").toUpperCase();
    const list =
      family === "DOMAIN_ACCESS"
        ? result.domains
        : family === "VERB_ACCESS"
          ? result.verbTiers
          : family === "DICE" ||
              category === "INTENSITY_DICE" ||
              category === "OUTPUT"
            ? result.diceTypes
            : null;
    if (!list) continue;
    const detail = String(
      node.data["mechanicalOutputText"] ?? rule?.["text"] ?? "",
    ).trim();
    const text = detail ? `${node.name} — ${detail}` : node.name;
    if (!list.includes(text)) list.push(text);
  }
  return result;
}
