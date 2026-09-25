import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { EntityKind, WorkspaceGraph, WorkspaceNode } from "../model";
const state=vi.hoisted(()=>({ rows:{} as Record<string,Record<string,unknown>[]>, updates:[] as {table:string;values:Record<string,unknown>;where:SQL}[], inserts:[] as unknown[], deletes:[] as unknown[] }));
vi.mock("@/db/client",()=>({db:{
  select:()=>({from:(table:Parameters<typeof getTableName>[0])=>({where:async()=>state.rows[getTableName(table)]??[]})}),
  update:(table:Parameters<typeof getTableName>[0])=>({set:(values:Record<string,unknown>)=>({where:async(where:SQL)=>{state.updates.push({table:getTableName(table),values,where});}})}),
  insert:(table:Parameters<typeof getTableName>[0])=>({values:async(values:unknown)=>{state.inserts.push({table:getTableName(table),values});}}),
  delete:(table:Parameters<typeof getTableName>[0])=>({where:async(where:unknown)=>{state.deletes.push({table:getTableName(table),where});}}),
}}));
import { materializeWorkspace } from "../materialize";
function node(kind:EntityKind,id:string):WorkspaceNode{return{key:`${kind}:${id}`,kind,id,name:id,bu:4,versionId:"current-version",latestVersionId:"current-version",userId:"owner",description:"",data:{}};}
function graph(heritageId="lineage"):WorkspaceGraph{return{characterId:"character",revision:2,nodes:[node("heritage",heritageId),node("capability","ability"),node("primitive","1")],edges:[
  {id:"root",parent:null,child:`heritage:${heritageId}`,category:"LINEAGE",order:0,isMirrored:false},
  {id:"ability",parent:`heritage:${heritageId}`,child:"capability:ability",category:"ALL",order:1,isMirrored:false},
  {id:"rule",parent:"capability:ability",child:"primitive:1",category:"ALL",order:2,isMirrored:false},
]};}
beforeEach(()=>{
  state.rows={
    character_primitives:[{instanceId:"stable-instance",characterId:"character",primitiveId:1,source:"LINEAGE",directSource:"MANIFEST",originHeritageId:"lineage",originCapabilityId:"ability",originEffectId:null,originItemId:null,isMirrored:false,versionId:"saved-version",slotSource:"PINNED",acquiredAtLevel:1}],
    character_capabilities:[{characterId:"character",capabilityId:"ability",originHeritageId:"lineage",versionId:"saved-capability-version",slotSource:"PINNED",acquiredAtLevel:1}],
  };state.updates=[];state.inserts=[];state.deletes=[];
});
describe("materialization avoids unchanged inherited-row writes",()=>{
  it("does not rewrite unchanged primitive or capability memberships",async()=>{
    await materializeWorkspace(graph(),"owner",10);
    expect(state.updates).toEqual([]);expect(state.inserts).toEqual([]);expect(state.deletes).toEqual([]);
  });
  it("updates changed origins while preserving the purchase, pin, and instance identity",async()=>{
    await materializeWorkspace(graph("new-lineage"),"owner",10);
    expect(state.updates).toHaveLength(2);
    const primitive=state.updates.find(update=>update.table==="character_primitives")!;
    expect(primitive.values).toEqual({source:"LINEAGE",originHeritageId:"new-lineage",originCapabilityId:"ability",originEffectId:null,originItemId:null,isMirrored:false});
    expect(new PgDialect().sqlToQuery(primitive.where).params).toEqual(["stable-instance"]);
    const retained={...state.rows["character_primitives"]![0],...primitive.values};
    expect(retained).toMatchObject({instanceId:"stable-instance",directSource:"MANIFEST",versionId:"saved-version",slotSource:"PINNED",acquiredAtLevel:1});
    expect(state.updates.find(update=>update.table==="character_capabilities")?.values).toEqual({originHeritageId:"new-lineage"});
    expect(state.inserts).toEqual([]);expect(state.deletes).toEqual([]);
  });
  it("updates changed category even when the supplying entities remain the same",async()=>{
    const changed=graph();changed.edges[0]!.category="UPBRINGING";
    await materializeWorkspace(changed,"owner",10);
    expect(state.updates).toHaveLength(1);expect(state.updates[0]?.values["source"]).toBe("UPBRINGING");
  });
  it("still restores a direct purchase when its inherited supply disappears",async()=>{
    await materializeWorkspace({characterId:"character",revision:3,nodes:[],edges:[]},"owner",10);
    expect(state.updates[0]?.values).toEqual({source:"MANIFEST",directSource:null,originHeritageId:null,originCapabilityId:null,originEffectId:null,originItemId:null});
    expect(state.updates[0]?.values).not.toHaveProperty("versionId");
    expect(state.deletes).toHaveLength(1);
  });
});
