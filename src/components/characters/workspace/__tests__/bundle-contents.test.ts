import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BundleContents } from "../bundle-contents";
import type { WorkspaceGraph, WorkspaceNode, EntityKey } from "@/lib/character/workspace/model";
function node(key:EntityKey, name:string):WorkspaceNode {return {key,kind:key.split(":")[0] as WorkspaceNode["kind"],id:key,name,bu:4,versionId:null,latestVersionId:null,userId:null,description:`${name} description`,data:{kind:"LINEAGE",mechanicalOutputText:`${name} rule`}};}
describe("source expressions",()=>{
 it("keeps direct and nested rules distinct without dropping duplicate supply occurrences",()=>{
 const nodes=[node("heritage:bear","Bear"),node("capability:shield","Shield"),node("effect:brace","Brace"),node("primitive:guard","Guard")];
 const graph:WorkspaceGraph={characterId:"test",revision:1,nodes,edges:[["heritage:bear","primitive:guard"],["heritage:bear","capability:shield"],["capability:shield","effect:brace"],["effect:brace","primitive:guard"]].map(([parent,child],i)=>({id:String(i),parent:parent as EntityKey,child:child as EntityKey,order:i,category:"LINEAGE",isMirrored:false}))};
 const html=renderToStaticMarkup(createElement(BundleContents,{node:nodes[0]!,graph,onOpen:()=>{}}));
 expect(html).toContain("Direct lineage primitives");
 expect(html.match(/Guard rule/g)).toHaveLength(2);
 expect(html).toContain("Shield description");expect(html).toContain("Brace description");
 expect(html.match(/v12-expression-direct/g)).toHaveLength(1);
 });
});
