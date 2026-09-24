import { describe, expect, it } from "vitest";
import { resolvePinnedNode, pinnedOperationIssue } from "../pinned-versions";
import type { LoadedNode } from "../load-nodes";
import type { WorkspaceGraph } from "../model";
const entry: LoadedNode = {
  row: { id: 1, name: "New rule", buCost: 12, mechanicalOutputText: "Add 9", hardModifiers: [{ value: 9 }], contentHash: "live", userId: "author" }, links: [],
  versions: [
    { id: "old", number: 1, latest: false, deltaKind: "FULL", snapshot: { name: "Old rule", buCost: 4, mechanicalOutputText: "Add 1", hardModifiers: [{ value: 1 }] } },
    { id: "latest", number: 2, latest: true, deltaKind: "FULL", snapshot: { name: "New rule", buCost: 12, mechanicalOutputText: "Add 9" } },
  ],
};
function graph(): WorkspaceGraph {
  const resolved = resolvePinnedNode("primitive", entry, ["old"]);
  return { characterId: "c", revision: 0, nodes: [{ key: "primitive:1", id: "1", kind: "primitive", name: String(resolved.row["name"]), bu: 4, userId: "author", description: "", versionId: resolved.versionId, latestVersionId: resolved.latestVersionId, data: resolved.row }], edges: [{ id: "slot", parent: null, child: "primitive:1", category: "MANIFEST", order: 0, isMirrored: false, versionId: "old" }] };
}
describe("workspace version pins", () => {
  it("reads the pinned mechanics instead of relabeling the live row as old", () => {
    const result = resolvePinnedNode("primitive", entry, ["old", "old"]);
    expect(result.versionId).toBe("old"); expect(result.row["name"]).toBe("Old rule");
    expect(result.row["buCost"]).toBe(4); expect(result.row["hardModifiers"]).toEqual([{ value: 1 }]);
    expect(result.row["contentHash"]).toBeUndefined(); expect(entry.row["name"]).toBe("New rule");
  });
  it("recognizes legacy seed snapshot envelopes", () => {
    const seeded = structuredClone(entry); seeded.versions[0]!.snapshot = { id: 1, data: entry.versions[0]!.snapshot };
    expect(resolvePinnedNode("primitive", seeded, ["old"]).row["name"]).toBe("Old rule");
  });
  it("does not select an arbitrary first occurrence for mixed pins", () => {
    const result = resolvePinnedNode("primitive", entry, ["latest", "old"]);
    expect(result.versionId).toBeNull(); expect(result.row["workspaceVersionIssue"]).toMatch(/different pinned versions/);
    expect(result.row["workspacePinnedVersions"]).toEqual(["latest", "old"]);
  });
  it("reports a missing pin instead of falling back silently", () => {
    expect(resolvePinnedNode("primitive", entry, ["missing"]).row["workspaceVersionIssue"]).toMatch(/missing/);
  });
  it("gates touched pinned paths, while allowing foundation and unrelated direct additions", () => {
    expect(pinnedOperationIssue(graph(), { type: "command", payload: { target: "primitive:1" } })).toMatch(/older version/);
    expect(pinnedOperationIssue(graph(), { type: "relocate", path: ["slot"] })).toMatch(/older version/);
    expect(pinnedOperationIssue(graph(), { type: "command", payload: { target: "primitive:1" } }, true)).toBeNull();
    expect(pinnedOperationIssue(graph(), { type: "character", payload: { level: 1 } })).toBeNull();
    expect(pinnedOperationIssue(graph(), { type: "create", payload: { kind: "primitive", draft: { name: "New", buCost: 1 } } })).toBeNull();
  });
  it("retains historical memberships in the fingerprint instead of silently substituting live memberships", () => {
    const container: LoadedNode = { ...entry, row: { id: "e", name: "Live", buCost: 12 }, links: [{ kind: "primitive", id: 2, data: { primitiveId: 2 } }], versions: [{ ...entry.versions[0]!, snapshot: { name: "Old effect", primitiveSlots: [{ primitiveId: 1, quantity: 2 }] } }, entry.versions[1]!] };
    const result = resolvePinnedNode("effect", container, ["old"]);
    expect(result.row["workspacePinnedMemberships"]).toEqual([{ kind: "primitive", id: 1, data: { primitiveId: 1, quantity: 2 } }]);
    expect(result.links).toEqual([{ kind: "primitive", id: 1, data: { primitiveId: 1, quantity: 2 } }]);
  });
});
