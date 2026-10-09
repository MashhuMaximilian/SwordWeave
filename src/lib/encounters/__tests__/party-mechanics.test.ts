import { describe, expect, it } from "vitest";
import { partyMechanics } from "../party-mechanics";
import type { WorkspaceGraph } from "@/lib/character/workspace/model";
function graph(): WorkspaceGraph {
  return {
    characterId: "character",
    revision: 1,
    nodes: [
      {
        key: "primitive:1",
        kind: "primitive",
        id: "1",
        name: "Fire",
        bu: 4,
        versionId: "pin",
        latestVersionId: null,
        userId: null,
        description: "",
        data: {
          mechanicalRule: { family: "DOMAIN_ACCESS" },
          mechanicalOutputText: "Grant Tier I access to fire.",
        },
      },
      {
        key: "primitive:2",
        kind: "primitive",
        id: "2",
        name: "Tier II verbs",
        bu: 8,
        versionId: "pin",
        latestVersionId: null,
        userId: null,
        description: "",
        data: { mechanicalRule: { family: "VERB_ACCESS" } },
      },
      {
        key: "primitive:3",
        kind: "primitive",
        id: "3",
        name: "d6",
        bu: 4,
        versionId: "pin",
        latestVersionId: null,
        userId: null,
        description: "",
        data: {
          mechanicalRule: { family: "DICE" },
          mechanicalOutputText: "Use a d6 output die.",
        },
      },
    ],
    edges: [1, 2, 3].map((id) => ({
      id: String(id),
      parent: null,
      child: `primitive:${id}` as const,
      category: "ALL",
      order: id,
      isMirrored: false,
    })),
  };
}
describe("party owned mechanics snapshot", () => {
  it("uses the pinned authored grants without inferring extra permissions", () => {
    expect(partyMechanics(graph())).toEqual({
      domains: ["Fire — Grant Tier I access to fire."],
      verbTiers: ["Tier II verbs"],
      diceTypes: ["d6 — Use a d6 output die."],
    });
  });
  it("omits mirrored and unreachable rules", () => {
    const g = graph();
    g.edges[0]!.isMirrored = true;
    g.edges = g.edges.filter((e) => e.child !== "primitive:3");
    expect(partyMechanics(g)).toEqual({
      domains: [],
      verbTiers: ["Tier II verbs"],
      diceTypes: [],
    });
  });
  it("deduplicates multiple ownership paths but preserves a normal path beside a mirror", () => {
    const g = graph();
    g.edges.push({ ...g.edges[0]!, id: "mirror", isMirrored: true });
    expect(partyMechanics(g).domains).toHaveLength(1);
  });
});
