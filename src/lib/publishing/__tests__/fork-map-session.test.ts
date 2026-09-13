import { describe, expect, it } from "vitest";
import { mergeForkMap, layoutForkMap } from "../fork-map-session";
import type { ForkMapNode, ForkMapResult } from "../fork-map";
const node = (key:string):ForkMapNode => ({key,targetType:"PRIMITIVE",targetId:key,name:key,relation:"child",authorName:null,forkedAt:null});
const page = (selected:string, children:string[], ancestry:string[]=[]):ForkMapResult => ({selected:node(selected),children:children.map(node),ancestry:ancestry.map(node),edges:[...ancestry.slice(1).map((to,i)=>({from:ancestry[i]!,to})),...(ancestry.length?[{from:ancestry.at(-1)!,to:selected}]:[]),...children.map(to=>({from:selected,to}))],totalChildren:children.length,nextCursor:null});
describe("progressive fork canvas",()=>{
 it("retains sibling branches and previous positions when a child expands",()=>{
  const first=mergeForkMap({nodes:[],edges:[]},page("root",["a","b"]));
  const expanded=mergeForkMap(first,page("a",["grandchild"],["root"]));
  expect(expanded.nodes.map(n=>n.key)).toEqual(["root","a","b","grandchild"]);
  expect(expanded.edges).toContainEqual({from:"root",to:"b"});
  const before=layoutForkMap(first),after=layoutForkMap(expanded);
  for(const original of before){const current=after.find(n=>n.node.key===original.node.key)!;expect([current.x,current.y]).toEqual([original.x,original.y]);}
  expect(expanded.nodes.filter(n=>n.relation==="selected").map(n=>n.key)).toEqual(["a"]);
 });
 it("deduplicates revisited pages and overlapping pagination",()=>{
  const first=mergeForkMap({nodes:[],edges:[]},page("root",["a","b"]));
  const next=mergeForkMap(first,page("root",["b","c"]));
  expect(next.nodes).toHaveLength(4);expect(next.edges).toHaveLength(3);
 });
 it("terminates on malformed cyclic ancestry",()=>{
  const nodes=[node("a"),node("b")];
  expect(layoutForkMap({nodes,edges:[{from:"a",to:"b"},{from:"b",to:"a"}]})).toHaveLength(2);
 });
});
