/** Additive reference metadata; never changes legacy content hashes or payloads. */
export type DependencyKind = "primitive" | "effect" | "capability" | "item" | "heritage";
export interface DependencyPin { kind: DependencyKind; id: string | number; versionId: string | null; data: Record<string, unknown>; }
export function dependencyReferences(snapshot: Record<string, unknown>): DependencyPin[] {
  const refs: DependencyPin[] = [];
  for (const [field, kind, idField] of [["primitiveSlots","primitive","primitiveId"],["capabilitySlots","capability","capabilityId"],["effectSlots","effect","effectId"],["itemSlots","item","itemId"],["heritageSlots","heritage","heritageId"]] as const) {
    if (!Array.isArray(snapshot[field])) continue;
    for (const value of snapshot[field]) {
      if (!value || typeof value !== "object") continue;
      const data = value as Record<string, unknown>; const id = data[idField];
      if (typeof id === "number" || typeof id === "string") refs.push({ kind, id, versionId: typeof data["versionId"] === "string" ? data["versionId"] : null, data });
    }
  }
  // Older publication snapshots used junction-link names. Preserve their
  // quantities, roles, ordering and explicit pins without expanding children.
  for (const [field, kind] of [["primitiveLinks", "primitive"], ["capabilityLinks", "capability"], ["effectLinks", "effect"], ["itemLinks", "item"], ["heritageLinks", "heritage"]] as const) {
    if (!Array.isArray(snapshot[field]) || refs.some(r => r.kind === kind)) continue;
    for (const value of snapshot[field]) {
      if (!value || typeof value !== "object") continue;
      const data = value as Record<string, unknown>;
      const id = data[`${kind}Id`];
      if (typeof id === "number" || typeof id === "string") refs.push({ kind, id, versionId: typeof data["versionId"] === "string" ? data["versionId"] : null, data });
    }
  }
  for (const [field,kind] of [["primitiveIds","primitive"],["capabilityIds","capability"],["effectIds","effect"]] as const) {
    if (!Array.isArray(snapshot[field]) || refs.some(r => r.kind === kind)) continue;
    for (const id of snapshot[field]) if (typeof id === "string" || typeof id === "number") refs.push({kind,id,versionId:null,data:{[`${kind}Id`]:id}});
  }
  return refs;
}
export function readDependencyPins(snapshot: Record<string, unknown>): DependencyPin[] | null {
  if (!Array.isArray(snapshot["dependencyPins"])) return null;
  return snapshot["dependencyPins"].filter((p): p is DependencyPin => p && typeof p === "object" &&
    ["primitive","effect","capability","item","heritage"].includes(p.kind) &&
    (typeof p.id === "number" || typeof p.id === "string") &&
    (p.versionId === null || typeof p.versionId === "string") && p.data && typeof p.data === "object");
}
