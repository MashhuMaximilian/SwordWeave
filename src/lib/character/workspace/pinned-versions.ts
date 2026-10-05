import { reconstructVersion, type VersionPayload } from "@/lib/versions/delta";
import type { EntityKind, WorkspaceGraph } from "./model";
import type { LoadedNode } from "./load-nodes";
import { readDependencyPins } from "@/lib/versions/dependency-pins";

/** A graph node can represent only one effective version. Never pick the first
 * occurrence when the character has explicitly pinned different versions. */
export function resolvePinnedNode(kind: EntityKind, entry: LoadedNode, pins: readonly string[]): { row: Record<string, unknown>; links: LoadedNode["links"]; versionId: string | null; latestVersionId: string | null } {
  const latest = entry.versions.filter(v => v.latest).sort((a,b) => b.number-a.number)[0]?.id ?? null;
  const unique = [...new Set(pins)].sort();
  const versionId = unique.length === 1 ? unique[0]! : unique.length ? null : latest;
  const selected = entry.versions.find(v => v.id === versionId);
  const metadata = { workspacePinnedVersions: unique, workspaceVersionNumber: selected?.number ?? null, ...(unique.length > 1 ? { workspacePinnedSnapshots: entry.versions.filter(v => unique.includes(v.id)) } : {}) };
  const failure = (reason: string) => ({ row: { ...entry.row, ...metadata, workspaceVersionIssue: reason }, links: entry.links, versionId, latestVersionId: latest });
  if (unique.length > 1) return failure("This piece has different pinned versions on this character. Choose a single version before editing its rules or moving its memberships.");
  if (unique.length && !selected) return failure("The pinned version is missing. Restore or explicitly choose a valid version before editing this piece.");
  const directPins = selected && selected.deltaKind === "FULL" ? readDependencyPins(selected.snapshot) : null;
  if (!selected || (selected.id === latest && !unique.length)) return { row: { ...entry.row, ...metadata }, links: directPins ?? entry.links, versionId, latestVersionId: latest };
  try {
    const chain = entry.versions.filter(v => v.number <= selected.number).sort((a,b) => a.number-b.number).map(v => ({
      versionNumber: v.number,
      payload: v.deltaKind === "DELTA" ? { kind: "DELTA", patch: v.snapshot } : { kind: "FULL", data: v.snapshot },
    } as { versionNumber: number; payload: VersionPayload }));
    // A FULL snapshot is self-contained, including when earlier history has
    // been archived. Only DELTA snapshots require reconstruction of the chain.
    let snapshot = selected.deltaKind === "DELTA" ? reconstructVersion(chain, selected.number) : selected.snapshot;
    if (snapshot && "id" in snapshot && snapshot["data"] && typeof snapshot["data"] === "object" && !Array.isArray(snapshot["data"]))
      snapshot = snapshot["data"] as Record<string, unknown>;
    if (!snapshot || typeof snapshot["name"] !== "string") return failure("The pinned version has an incomplete snapshot. Restore it before editing this piece.");
    const row: Record<string, unknown> = {
      ...Object.fromEntries(["id", "userId", "sourceOrigin", "sourceId", "sourceVersionId", "createdAt"].map(key => [key, entry.row[key]])),
      ...snapshot, ...metadata,
      // Container BU is a derived aggregate, absent from canonical snapshots;
      // retain the resolver's current aggregate and expose that limitation.
      ...(kind !== "primitive" && snapshot["buCost"] === undefined ? { buCost: entry.row["buCost"], workspaceCostUsesCurrentMembers: true } : {}),
      // Retain the live hash separately for conflict diagnostics; never label
      // historical content with the live definition's content hash.
      workspaceLiveContentHash: entry.row["contentHash"] ?? null,
      workspaceHistoricalVersion: selected.id !== latest,
      workspacePinnedSnapshot: true,
    };
    const links: LoadedNode["links"] = [];
    const primitives = Array.isArray(snapshot["primitiveSlots"]) ? snapshot["primitiveSlots"] :
      Array.isArray(snapshot["primitiveIds"]) ? snapshot["primitiveIds"].map(primitiveId => ({ primitiveId })) : [];
    if (kind !== "primitive") for (const value of primitives) {
      const data = value as Record<string, unknown>;
      if (typeof data["primitiveId"] === "number") links.push({ kind: "primitive", id: data["primitiveId"], data: { ...data } });
    }
    for (const [field, childKind] of [["capabilityIds", "capability"], ["effectIds", "effect"]] as const)
      if (Array.isArray(snapshot[field])) for (const id of snapshot[field])
        if (typeof id === "string") links.push({ kind: childKind, id, data: { [`${childKind}Id`]: id } });
    const immutableLinks = readDependencyPins(snapshot) ?? links;
    row["workspacePinnedMemberships"] = immutableLinks;
    return { row, links: immutableLinks, versionId, latestVersionId: latest };
  } catch {
    return failure("The pinned version cannot be reconstructed. Restore it before editing this piece.");
  }
}

/** Historical content can be viewed and unrelated character work can continue.
 * Operations touching it need an explicit version-aware fork flow, not a live
 * definition save (which would silently promote the pin). */
export function pinnedOperationIssue(graph: WorkspaceGraph, operation: unknown, allowHistoricalFork = false): string | null {
  if (operation && typeof operation === "object" && "type" in operation && operation.type === "character") return null;
  const strings = new Set<string>();
  function visit(value: unknown, field = "") {
    if (typeof value === "string") strings.add(value);
    else if (typeof value === "number" && /Ids?$/.test(field)) strings.add(String(value));
    else if (Array.isArray(value)) value.forEach(item => visit(item, field));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => visit(item, key));
  }
  visit(operation);
  const touched = new Set(graph.edges.filter(e => strings.has(e.id)).flatMap(e => [e.child, ...(e.parent ? [e.parent] : [])]));
  for (const n of graph.nodes) if (strings.has(n.key) || strings.has(n.id)) touched.add(n.key);
  const blocked = graph.nodes.find(n => touched.has(n.key) && (n.data["workspaceVersionIssue"] || (!allowHistoricalFork && n.data["workspaceHistoricalVersion"])));
  if (!blocked) return null;
  return `${blocked.name}: ${blocked.data["workspaceVersionIssue"] ?? "This piece is pinned to an older version. Explicitly update its version before editing or moving it; your saved draft and its current mechanics are preserved."}`;
}
