import type { PlayMutation } from "./model";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
import { supplyPaths } from "@/lib/character/workspace/model";
/** Clears may remove obsolete overrides, but new toggles must belong to this build. */
export function validatePlayReferences(graph: WorkspaceGraph, mutation: PlayMutation) {
  for (const change of mutation.changes) {
    if (change.value === null) continue;
    if (change.field.startsWith("cap:") || change.field.startsWith("eff:")) {
      const key = `${change.field.startsWith("cap:") ? "capability" : "effect"}:${change.field.slice(4)}`;
      if (!graph.nodes.some(n => n.key === key) || !supplyPaths(graph, key as import("@/lib/character/workspace/model").EntityKey).length) throw new Error("This toggle is no longer part of the sheet's build.");
    }
    if (change.field.startsWith("itemcap:")) {
      const [, item, cap] = change.field.split(":");
      if (!supplyPaths(graph, `capability:${cap}`).some(path => path.nodes.includes(`item:${item}`))) throw new Error("This item capability is no longer part of the sheet's build.");
    }
  }
}
