import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { EntityKey } from "../model";
import type { LoadedNode } from "../load-nodes";
const state = vi.hoisted(() => ({ slots: {} as Record<string, unknown[]>, nodes: new Map<string, unknown>(), batches: [] as string[][] }));
vi.mock("@/db/client", () => ({ db: { select: () => ({ from: (table: Parameters<typeof getTableName>[0]) => ({ where: async () => state.slots[getTableName(table)] ?? [] }) }) } }));
vi.mock("../load-nodes", () => ({ loadWorkspaceNodes: async (keys: string[]) => {
  state.batches.push([...keys]);
  return new Map(keys.filter(key => state.nodes.has(key)).map(key => [key, state.nodes.get(key)]));
} }));
import { readWorkspace } from "../read";
function node(name: string, links: LoadedNode["links"] = [], extra: Record<string, unknown> = {}): LoadedNode {
  return { row: {name, buCost: 4, ...extra}, links, versions: [] };
}
const link = (kind: "capability" | "primitive", id: string | number) => ({kind,id,data:{}});
beforeEach(() => {
  state.slots = { character_heritages: [{ heritageId: "h1" }, { heritageId: "h2" }], character_workspace_state: [{revision: 7}] };
  state.nodes = new Map<string,LoadedNode>([
    ["heritage:h1",node("H1",[link("capability","c1")], {kind:"LINEAGE"})],
    ["heritage:h2",node("H2",[link("capability","c2")], {kind:"UPBRINGING"})],
    ["capability:c1",node("C1",[link("primitive",1)])],
    ["capability:c2",node("C2",[link("primitive",2)])],
    ["primitive:1",node("P1")], ["primitive:2",node("P2")],
  ]);
  state.batches=[];
});
describe("workspace breadth batching", () => {
  it("loads all sibling descendants together without changing membership order", async () => {
    const graph = await readWorkspace("character");
    expect(state.batches).toEqual([["heritage:h1","heritage:h2"],["capability:c1","capability:c2"],["primitive:1","primitive:2"]]);
    expect(graph.nodes.map(n=>n.key)).toEqual(["heritage:h1","heritage:h2","capability:c1","capability:c2","primitive:1","primitive:2"]);
    expect(graph.edges.map(e=>[e.parent,e.child,e.order,e.category])).toEqual([
      [null,"heritage:h1",0,"LINEAGE"], [null,"heritage:h2",1,"UPBRINGING"],
      ["heritage:h1","capability:c1",2,"ALL"], ["heritage:h2","capability:c2",3,"ALL"],
      ["capability:c1","primitive:1",4,"ALL"], ["capability:c2","primitive:2",5,"ALL"],
    ]);
    expect(graph.revision).toBe(7);
  });
  it("uses pinned membership snapshots to discover children, not current memberships", async () => {
    state.slots["character_heritages"] = [{heritageId:"h1",versionId:"old"}];
    const h1=state.nodes.get("heritage:h1") as LoadedNode;
    h1.versions=[
      {id:"old",number:1,latest:false,deltaKind:"FULL",snapshot:{name:"Saved lineage",kind:"LINEAGE",capabilityIds:["c2"]}},
      {id:"new",number:2,latest:true,deltaKind:"FULL",snapshot:{name:"H1"}},
    ];
    const graph=await readWorkspace("character");
    expect(state.batches).toEqual([["heritage:h1"],["capability:c2"],["primitive:2"]]);
    expect(graph.nodes[0]?.name).toBe("Saved lineage");
    expect(graph.nodes[0]?.versionId).toBe("old");
  });
  it("queries shared and dangling descendants only once while preserving every membership", async () => {
    (state.nodes.get("capability:c1") as LoadedNode).links=[link("primitive",1),link("primitive",99)];
    (state.nodes.get("capability:c2") as LoadedNode).links=[link("primitive",1),link("primitive",99)];
    const graph=await readWorkspace("character",["primitive:99" as EntityKey]);
    expect(state.batches.flat().filter(key=>key==="primitive:99")).toHaveLength(1);
    expect(state.batches.flat().filter(key=>key==="primitive:1")).toHaveLength(1);
    expect(graph.edges.filter(e=>e.child==="primitive:1")).toHaveLength(2);
    expect(graph.nodes.filter(n=>n.key==="primitive:1")).toHaveLength(1);
  });
});
