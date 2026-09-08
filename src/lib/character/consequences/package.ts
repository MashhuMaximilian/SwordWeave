import { createHash } from "node:crypto";
import { consequenceBehaviorSchema } from "./validation";
import type { WorkspaceGraph, EntityKey } from "../workspace/model";
import type { HardModifier } from "@/types/swordweave";
import type { ConsequenceBehavior } from "./types";
export function consequencePackage(graph: WorkspaceGraph, key: EntityKey) {
  const root = graph.nodes.find((n) => n.key === key);
  if (!root) throw new Error("This package is not on the character.");
  const seen = new Set<EntityKey>();
  const pieces: {
    id: number;
    versionId: string | null;
    title: string;
    description: string;
    behavior: ConsequenceBehavior;
    modifiers: readonly HardModifier[];
  }[] = [];
  function visit(key: EntityKey) {
    if (seen.has(key)) return;
    seen.add(key);
    const node = graph.nodes.find((n) => n.key === key);
    if (!node) return;
    if (node.kind === "primitive" && node.data["consequenceBehavior"])
      pieces.push({
        id: Number(node.id),
        versionId: node.versionId,
        title: node.name,
        description: node.description,
        behavior: consequenceBehaviorSchema.parse(
          node.data["consequenceBehavior"],
        ),
        modifiers: (node.data["hardModifiers"] ?? []) as HardModifier[],
      });
    for (const edge of graph.edges.filter((e) => e.parent === key))
      visit(edge.child);
  }
  visit(key);
  const hash = createHash("sha256")
    .update(JSON.stringify(pieces))
    .digest("hex");
  return {
    key,
    name: root.name,
    pieces,
    hash,
    vitalityDelta: pieces.reduce((sum, p) => sum + p.behavior.vitalityDelta, 0),
  };
}
