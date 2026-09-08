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
