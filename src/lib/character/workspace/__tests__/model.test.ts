import { describe, it, expect } from "vitest";
import {
  supplyPaths,
  instanceSupplyPaths,
  effectiveAvailability,
  validateReference,
  type WorkspaceGraph,
  type WorkspaceNode,
  type EntityKey,
} from "../model";
function node(key: EntityKey): WorkspaceNode {
  const [kind, id] = key.split(":");
  return {
    key,
    kind: kind as WorkspaceNode["kind"],
    id: id!,
    name: key,
    bu: 1,
    versionId: null,
    latestVersionId: null,
    userId: null,
    description: "",
    data: {},
  };
}
const graph: WorkspaceGraph = {
  characterId: "char",
  revision: 0,
  nodes: [
    node("capability:a"),
    node("capability:b"),
    node("primitive:1"),
    node("effect:e"),
    node("heritage:h"),
  ],
  edges: [
    {
      id: "a",
      parent: null,
      child: "capability:a",
      category: "MANIFEST",
      order: 0,
      isMirrored: false,
    },
    {
      id: "b",
      parent: null,
      child: "capability:b",
      category: "LINEAGE",
      order: 1,
      isMirrored: false,
    },
    {
      id: "ap",
      parent: "capability:a",
      child: "primitive:1",
      category: "ALL",
      order: 0,
      isMirrored: false,
    },
    {
      id: "bp",
      parent: "capability:b",
      child: "primitive:1",
      category: "ALL",
      order: 0,
      isMirrored: false,
    },
  ],
};
describe("canonical supply paths", () => {
  it("retains alternate sources without duplicating an entity", () => {
    const paths = supplyPaths(graph, "primitive:1");
    expect(paths).toHaveLength(2);
    const available = effectiveAvailability("primitive:1", paths, [
      { kind: "capability", entityId: "a", reason: "Spent" },
    ]);
    expect(available.available).toBe(true);
    expect(available.availablePaths.map((p) => p.nodes)).toEqual([
      ["capability:b", "primitive:1"],
    ]);
  });
  it("combines blockers and disables primitives globally", () => {
    const paths = supplyPaths(graph, "primitive:1");
    expect(
      effectiveAvailability("primitive:1", paths, [
        { kind: "primitive", entityId: "1", reason: "Injured" },
      ]).available,
    ).toBe(false);
    expect(
      effectiveAvailability("primitive:1", paths, [], new Set(["a", "b"]))
        .available,
    ).toBe(false);
    expect(
      effectiveAvailability("primitive:1", paths, [], new Set(["a"])).available,
    ).toBe(true);
  });
  it("keeps explicit instance paths and item contribution distinct", () => {
    const next = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id: "copy",
          parent: null,
          child: "primitive:1" as const,
          category: "ITEM" as const,
          order: 2,
          isMirrored: false,
          instanceId: "copy",
        },
      ],
    };
    expect(supplyPaths(next, "primitive:1").filter((p) => p.item)).toHaveLength(
      1,
    );
    expect(supplyPaths(next, "primitive:1")).toHaveLength(3);
  });
  it("rejects unsupported nesting and corrupted cyclic membership", () => {
    expect(validateReference(graph, "effect:e", "capability:a")).toContain(
      "cannot contain",
    );
    expect(validateReference(graph, "capability:a", "effect:e")).toBeNull();
    const corrupt = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id: "bad",
          parent: "effect:e" as const,
          child: "capability:a" as const,
          category: "ALL" as const,
          order: 0,
          isMirrored: false,
        },
      ],
    };
    expect(validateReference(corrupt, "capability:a", "effect:e")).toContain(
      "cycle",
    );
  });
  it("keeps a reused direct instance available without borrowing another paid copy", () => {
    const g = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id: "direct",
          instanceId: "direct",
          parent: null,
          child: "primitive:1" as const,
          category: "MANIFEST" as const,
          order: 3,
          isMirrored: false,
        },
      ],
    };
    const common = { primitiveId: 1, originCapabilityId: "a" };
    expect(
      effectiveAvailability(
        "primitive:1",
        instanceSupplyPaths(g, {
          ...common,
          instanceId: "direct",
          directSource: "PERSONAL",
        }),
        [],
        new Set(["a", "b"]),
      ).available,
    ).toBe(true);
    expect(
      effectiveAvailability(
        "primitive:1",
        instanceSupplyPaths(g, { ...common, instanceId: "inherited" }),
        [],
        new Set(["a", "b"]),
      ).available,
    ).toBe(false);
  });
});
