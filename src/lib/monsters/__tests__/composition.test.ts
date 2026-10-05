import { describe,it,expect,vi,beforeEach } from "vitest";
import type { LoadedNode } from "@/lib/character/workspace/load-nodes";
import type { EntityKey } from "@/lib/character/workspace/model";
const fixtures=vi.hoisted(()=>({nodes:new Map<string,LoadedNode>(),denied:new Set<string>()}));
const load=vi.hoisted(()=>vi.fn(async(keys:EntityKey[])=>new Map(keys.map(k=>[k,fixtures.nodes.get(k)!] as [EntityKey,LoadedNode]).filter(([,n])=>!!n))));
vi.mock("@/lib/character/workspace/load-nodes",()=>({loadWorkspaceNodes:load}));
vi.mock("../visibility",()=>({readableMonsterComponents:async(keys:EntityKey[])=>new Set(keys.filter(k=>!fixtures.denied.has(k)))}));
vi.mock("@/db/client",()=>({db:{select:()=>({from:()=>({where:async()=>[]})})}}));
import { resolveMonsterComposition,type MonsterComponentPin } from "../composition";
import { monsterDefinitionSchema } from "../model";
const definition=(references:unknown[])=>monsterDefinitionSchema.parse({name:"Sentinel",budget:100,attributes:{physical:6,mental:0,magical:0},references});
const primitive=(id:number,value:number):LoadedNode=>({row:{id,name:`P${id}`,category:"METRIC",buCost:4,isPublic:true,hardModifiers:[{kind:"modify",target:"max_vitality",operation:"add",value}]},links:[],versions:[]});
beforeEach(()=>{fixtures.nodes.clear();fixtures.denied.clear();load.mockClear();});
describe("monster version-aware composition",()=>{
 it("reads canonical slots from historical containers and exact child pins",async()=>{
  fixtures.nodes.set("primitive:1",{...primitive(1,999),versions:[{id:"new",number:2,latest:true,deltaKind:"FULL",snapshot:{name:"Latest",buCost:4,hardModifiers:[]}},{id:"old",number:1,latest:false,deltaKind:"FULL",snapshot:{name:"Historical",category:"METRIC",buCost:3,hardModifiers:[{kind:"modify",target:"max_vitality",operation:"add",value:2}]}}]});
  fixtures.nodes.set("capability:c",{row:{id:"c",name:"C",isPublic:true},links:[],versions:[{id:"c2",number:2,latest:true,deltaKind:"FULL",snapshot:{name:"new"}},{id:"c1",number:1,latest:false,deltaKind:"FULL",snapshot:{name:"old",primitiveSlots:[{primitiveId:1}],dependencyPins:[{kind:"primitive",id:1,versionId:"old",data:{primitiveId:1,versionId:"old",quantity:2}}]}}]});
  const slots=await resolveMonsterComposition(definition([{kind:"CAPABILITY",id:"c",versionId:"c1"}]));expect(slots).toHaveLength(1);expect(slots[0]!.name).toBe("Historical");expect(slots[0]!.buCost).toBe(3);expect(slots[0]!.quantity).toBe(2);expect(slots[0]!.hardModifiers[0]!.value).toBe(2);expect(slots[0]!.dependencyVersions).toContain("primitive:1:old");
 });
 it("batches sibling primitives and retains shared alternate supplies",async()=>{
  fixtures.nodes.set("primitive:1",primitive(1,2));fixtures.nodes.set("primitive:2",primitive(2,3));
  fixtures.nodes.set("capability:a",{row:{name:"A",isPublic:true},versions:[],links:[{kind:"primitive",id:1,data:{}},{kind:"primitive",id:2,data:{}}]});fixtures.nodes.set("capability:b",{row:{name:"B",isPublic:true},versions:[],links:[{kind:"primitive",id:1,data:{}}]});
  const slots=await resolveMonsterComposition(definition([{kind:"CAPABILITY",id:"a"},{kind:"CAPABILITY",id:"b"}]));expect(slots).toHaveLength(2);expect(slots[0]!.supplyKeys).toHaveLength(2);expect(load.mock.calls).toEqual([[["capability:a","capability:b"]],[["primitive:1","primitive:2"]]]);
 });
 it("does not borrow live modifier content when a historical snapshot lacks it",async()=>{
  fixtures.nodes.set("primitive:1",{...primitive(1,999),versions:[{id:"new",number:2,latest:true,deltaKind:"FULL",snapshot:{name:"New"}},{id:"old",number:1,latest:false,deltaKind:"FULL",snapshot:{name:"Old",category:"METRIC",buCost:1}}]});const slots=await resolveMonsterComposition(definition([{kind:"PRIMITIVE",id:"1",versionId:"old"}]));expect(slots[0]!.hardModifiers).toEqual([]);expect(slots[0]!.consequenceBehavior).toBeNull();
 });
 it("stores only references for published rules and retains a bounded fallback for unversioned ones",async()=>{
  fixtures.nodes.set("primitive:1",{...primitive(1,999),versions:[{id:"p1",number:1,latest:true,deltaKind:"FULL",snapshot:{name:"Published",category:"METRIC",buCost:4,hardModifiers:[{kind:"modify",target:"max_vitality",operation:"add",value:2}]}}]});fixtures.nodes.set("primitive:2",primitive(2,3));
  let pins:MonsterComponentPin[]=[];const d=definition([{kind:"PRIMITIVE",id:"1",versionId:"p1"},{kind:"PRIMITIVE",id:"2"}]);await resolveMonsterComposition(d,null,value=>{pins=value;});
  expect(pins.find(p=>p.id==="1")?.fallback).toBeUndefined();expect(JSON.stringify(pins.find(p=>p.id==="1"))).not.toContain("hardModifiers");expect(pins.find(p=>p.id==="2")?.fallback?.["hardModifiers"]).toHaveLength(1);
  const unversioned=fixtures.nodes.get("primitive:2")!;unversioned.row["hardModifiers"]=[{value:999}];unversioned.versions=[{id:"future",number:1,latest:true,deltaKind:"FULL",snapshot:{name:"Future",hardModifiers:[{value:999}]}}];
  const restored=await resolveMonsterComposition({...d,componentPins:pins});expect(restored.find(p=>p.primitiveId===2)?.hardModifiers[0]?.value).toBe(3);
 });
 it("rejects private dependencies before materializing their rules",async()=>{fixtures.nodes.set("primitive:1",primitive(1,999));fixtures.denied.add("primitive:1");await expect(resolveMonsterComposition(definition([{kind:"PRIMITIVE",id:"1"}]))).rejects.toThrow("unavailable");});
 it("keeps authorized exact play pins after source permissions change, while public sources stay gated",async()=>{
  fixtures.nodes.set("primitive:1",primitive(1,2));const d=definition([{kind:"PRIMITIVE",id:"1"}]);let pins:MonsterComponentPin[]=[];await resolveMonsterComposition(d,"owner",value=>{pins=value;});fixtures.denied.add("primitive:1");
  await expect(resolveMonsterComposition({...d,componentPins:pins},null)).rejects.toThrow("unavailable");
  const slots=await resolveMonsterComposition({...d,componentPins:pins},"owner",undefined,{trustedPinnedComposition:true});expect(slots[0]?.hardModifiers[0]?.value).toBe(2);
  await expect(resolveMonsterComposition(d,"owner",undefined,{trustedPinnedComposition:true})).rejects.toThrow("incomplete");
 });
 it("rejects cycles rather than silently losing dependencies",async()=>{fixtures.nodes.set("effect:a",{row:{name:"a",isPublic:true},versions:[],links:[{kind:"effect",id:"b",data:{}}]});fixtures.nodes.set("effect:b",{row:{name:"b",isPublic:true},versions:[],links:[{kind:"effect",id:"a",data:{}}]});await expect(resolveMonsterComposition(definition([{kind:"EFFECT",id:"a"}]))).rejects.toThrow("Cyclic");});
});
