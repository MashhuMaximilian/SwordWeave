import { loadWorkspaceNodes } from "@/lib/character/workspace/load-nodes";
import type { EntityKey } from "@/lib/character/workspace/model";
import { dependencyReferences } from "./dependency-pins";
/** Capture direct immutable component references for newly-created versions only.
 * Existing snapshots remain untouched; their missing pins cannot be inferred historically. */
export async function withDependencyPins(snapshot: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (Array.isArray(snapshot["dependencyPins"])) return snapshot;
  const refs = dependencyReferences(snapshot);
  if (!refs.length) return snapshot;
  if (refs.length > 5000) throw new Error("Too many component references in one version.");
  const nodes = await loadWorkspaceNodes(refs.map(r => `${r.kind}:${r.id}` as EntityKey));
  const pins = refs.map(ref => {
    const node = nodes.get(`${ref.kind}:${ref.id}`);
    const versionId = ref.versionId ?? node?.versions.filter(v => v.latest).sort((a,b) => b.number-a.number)[0]?.id ?? null;
    // Retain an explicit missing legacy pin rather than silently selecting a different version.
    return { ...ref, versionId, data: { ...ref.data, versionId } };
  });
  return { ...snapshot, dependencyPins: pins };
}
