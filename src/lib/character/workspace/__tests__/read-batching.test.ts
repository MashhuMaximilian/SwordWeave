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
  it("revisits a primitive when a container discovered later pins its older version", async () => {
    state.slots["character_heritages"]=[{heritageId:"h1"}];
    state.slots["character_primitives"]=[{primitiveId:1,source:"PERSONAL"}];
    const primitive=state.nodes.get("primitive:1") as LoadedNode;
    primitive.versions=[{id:"old",number:1,latest:false,deltaKind:"FULL",snapshot:{name:"Pinned old",buCost:1,hardModifiers:[]}},{id:"new",number:2,latest:true,deltaKind:"FULL",snapshot:{name:"New"}}];
    (state.nodes.get("capability:c1") as LoadedNode).links=[{kind:"primitive",id:1,data:{versionId:"old"}}];
    const graph=await readWorkspace("character");
    expect(graph.nodes.find(n=>n.key==="primitive:1")?.name).toBe("Pinned old");
    expect(graph.nodes.find(n=>n.key==="primitive:1")?.versionId).toBe("old");
    expect(state.batches.flat().filter(k=>k==="primitive:1")).toHaveLength(1);
  });
  it("replaces a previously processed container's outgoing live memberships after a late pin",async()=>{
    state.slots["character_heritages"]=[{heritageId:"h1"}];
    state.slots["character_capabilities"]=[{capabilityId:"c1",slotTab:"MANIFEST"}];
    (state.nodes.get("heritage:h1") as LoadedNode).links=[{kind:"capability",id:"c2",data:{}}];
    (state.nodes.get("capability:c2") as LoadedNode).links=[{kind:"capability",id:"c1",data:{versionId:"old"}}];
    const c1=state.nodes.get("capability:c1") as LoadedNode;
    c1.versions=[{id:"old",number:1,latest:false,deltaKind:"FULL",snapshot:{name:"Pinned container",primitiveSlots:[{primitiveId:2}]}},{id:"new",number:2,latest:true,deltaKind:"FULL",snapshot:{name:"Live"}}];
    const graph=await readWorkspace("character");
    expect(graph.nodes.find(n=>n.key==="capability:c1")?.name).toBe("Pinned container");
    expect(graph.edges.filter(e=>e.parent==="capability:c1").map(e=>e.child)).toEqual(["primitive:2"]);
    expect(graph.nodes.some(n=>n.key==="primitive:1")).toBe(false);
  });
  it("retains a conflict when the direct pin and a later inherited pin disagree",async()=>{
    state.slots["character_heritages"]=[{heritageId:"h1"}];
    state.slots["character_primitives"]=[{primitiveId:1,source:"PERSONAL",versionId:"new"}];
    const primitive=state.nodes.get("primitive:1") as LoadedNode;
    primitive.versions=[{id:"old",number:1,latest:false,deltaKind:"FULL",snapshot:{name:"Old"}},{id:"new",number:2,latest:true,deltaKind:"FULL",snapshot:{name:"New"}}];
    (state.nodes.get("capability:c1") as LoadedNode).links=[{kind:"primitive",id:1,data:{versionId:"old"}}];
    const graph=await readWorkspace("character");const node=graph.nodes.find(n=>n.key==="primitive:1");
    expect(node?.versionId).toBeNull();expect(node?.data["workspaceVersionIssue"]).toMatch(/different pinned versions/);
  });

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
