import { describe, it, expect } from "vitest";
import { membershipCostChange } from "../cost-preview";
import type { WorkspaceGraph, WorkspaceEdge } from "../model";
const direct: WorkspaceEdge = {
  id: "direct",
  parent: null,
  child: "primitive:1",
  category: "MANIFEST",
  order: 0,
  isMirrored: false,
  data: { instanceId: "direct" },
};
const bundle: WorkspaceEdge = {
  id: "bundle",
  parent: null,
  child: "effect:e",
  category: "MANIFEST",
  order: 0,
  isMirrored: false,
};
const member: WorkspaceEdge = {
  id: "member",
  parent: "effect:e",
  child: "primitive:1",
  category: "ALL",
  order: 0,
  isMirrored: false,
};
function graph(edges: WorkspaceEdge[]): WorkspaceGraph {
  return {
    characterId: "test",
    revision: 1,
    nodes: [
      {
        key: "primitive:1",
        kind: "primitive",
        id: "1",
        name: "Piece",
        bu: 4,
        data: {},
        description: "",
        userId: null,
        versionId: null,
        latestVersionId: null,
      },
      {
        key: "effect:e",
        kind: "effect",
        id: "e",
        name: "Bundle",
        bu: 0,
        data: {},
        description: "",
        userId: null,
        versionId: null,
        latestVersionId: null,
      },
    ],
    edges,
  };
}
describe("membership cost previews", () => {
  it("charges only the new 30 BU in a 40 BU capability when its shared 10 BU rule is owned", () => {
    const before = graph([direct]);
    before.nodes[0]!.bu = 10;
    const after = structuredClone(before);
    after.nodes.push({ ...after.nodes[0]!, key: "primitive:2", id: "2", bu: 30, name: "New rule" });
    after.edges.push(bundle, member, { ...member, id: "new-rule", child: "primitive:2" });
    expect(membershipCostChange(before, after).characterBuDelta).toBe(30);
  });
  it("counts a shared rule supplied by two bundles only once", () => {
    const before = graph([bundle, member]);
    const after = structuredClone(before);
    after.nodes.push({ ...after.nodes[1]!, id: "second", key: "effect:second" });
    after.edges.push({ ...bundle, id: "second-bundle", child: "effect:second" }, { ...member, id: "second-member", parent: "effect:second" });
    expect(membershipCostChange(before, after).characterBuDelta).toBe(0);
  });
  it("reuses a direct piece when it gains a bundle supply", () =>
    expect(
      membershipCostChange(graph([direct]), graph([direct, bundle, member]))
        .characterBuDelta,
    ).toBe(0));
  it("retains the direct contribution when the bundle is removed", () => {
    const shared = { ...direct, data: { directSource: "PERSONAL" } };
    expect(
      membershipCostChange(graph([shared, bundle, member]), graph([shared]))
        .characterBuDelta,
    ).toBe(0);
  });
  it("charges newly supplied pieces once", () =>
    expect(
      membershipCostChange(graph([]), graph([bundle, member])).characterBuDelta,
    ).toBe(4));
  it("removes one paid instance without deleting another", () =>
    expect(
      membershipCostChange(
        graph([direct, { ...direct, id: "second" }]),
        graph([direct]),
      ).characterBuDelta,
    ).toBe(-4));
  it("keeps item contribution out of the character budget", () =>
    expect(
      membershipCostChange(graph([]), graph([{ ...direct, category: "ITEM" }]))
        .characterBuDelta,
    ).toBe(0));
});
