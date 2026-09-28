import { describe, expect, it } from "vitest";
import { resolveComposerHandoff } from "../composer-handoff";
import type { EntityKey, WorkspaceEdge, WorkspaceGraph, WorkspaceNode } from "../model";

const node = (key: EntityKey): WorkspaceNode => ({ key, id:key.split(":")[1]!, kind:key.split(":")[0] as WorkspaceNode["kind"], name:key, bu:4, versionId:null, latestVersionId:null, userId:null, description:"", data:{} });
const edge = (id:string, parent:EntityKey|null, child:EntityKey, category:WorkspaceEdge["category"]="ALL", isMirrored=false):WorkspaceEdge => ({id,parent,child,category,isMirrored,order:0});
const graph = (edges:WorkspaceEdge[]):WorkspaceGraph => ({ characterId:"character", revision:1, nodes:[...new Set(edges.flatMap(e=>e.parent?[e.parent,e.child]:[e.child]))].map(node), edges });

describe("Build & Preview occurrence handoff", () => {
  it("opens the added root in its chosen heritage, including an existing attachment", () => {
    const after = graph([edge("nature",null,"primitive:1","LINEAGE"),edge("training",null,"primitive:1","UPBRINGING")]);
    expect(resolveComposerHandoff({before:after,after,result:{savedKey:"primitive:1"},parentPath:[],category:"UPBRINGING"})?.path).toEqual(["training"]);
  });
  it("follows copied parent bundles and their new edge IDs", () => {
    const before = graph([edge("root",null,"heritage:shared","MANIFEST"),edge("old-child","heritage:shared","capability:shared")]);
    const after = graph([edge("root",null,"heritage:private","MANIFEST"),edge("new-child","heritage:private","capability:private"),edge("rule","capability:private","primitive:1")]);
    const handoff = resolveComposerHandoff({before,after,result:{savedKey:"primitive:1",replacements:{"heritage:shared":"heritage:private","capability:shared":"capability:private"}},parentPath:["root","old-child"],category:"MANIFEST"});
    expect(handoff?.path).toEqual(["root","new-child","rule"]);
    expect(handoff?.node.key).toBe("primitive:1");
  });
  it("preserves the exact instance when the same container is used twice", () => {
    const before = graph([edge("first",null,"capability:shared","LINEAGE"),edge("second",null,"capability:shared","LINEAGE")]);
    const after = graph([...before.edges,edge("rule","capability:shared","primitive:1")]);
    expect(resolveComposerHandoff({before,after,result:{savedKey:"primitive:1"},parentPath:["second"],category:"LINEAGE"})?.path).toEqual(["second","rule"]);
  });
  it("does not open a mirrored or unrelated occurrence", () => {
    const after = graph([edge("drawback",null,"primitive:1","MANIFEST",true)]);
    expect(resolveComposerHandoff({before:after,after,result:{savedKey:"primitive:1"},parentPath:[],category:"MANIFEST"})).toBeNull();
    expect(resolveComposerHandoff({before:after,after,result:{savedKey:"primitive:1"},parentPath:[],category:"MANIFEST",mirrored:true})?.path).toEqual(["drawback"]);
    expect(resolveComposerHandoff({before:after,after,result:{savedKey:"primitive:missing"},parentPath:[],category:"MANIFEST"})).toBeNull();
  });
});
