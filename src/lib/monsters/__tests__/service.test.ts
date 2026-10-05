import {describe,it,expect,vi,beforeEach} from "vitest";
import {getTableName} from "drizzle-orm";
const state=vi.hoisted(()=>({rows:new Map<string,Record<string,unknown>[]>(),inserts:[] as {table:string;values:Record<string,unknown>}[],selections:[] as unknown[],updates:[] as {table:string;values:Record<string,unknown>}[]}));
vi.mock("@/db/client",()=>({withDatabaseTransaction:async(work:()=>Promise<unknown>)=>work(),db:{
 select:(fields:unknown)=>{state.selections.push(fields);return {from:(table:Parameters<typeof getTableName>[0])=>({where:()=>{const rows=state.rows.get(getTableName(table))??[];return {then:(resolve:(value:unknown[])=>unknown)=>Promise.resolve(rows).then(resolve),for:async()=>rows,orderBy:()=>({limit:()=>({offset:async()=>rows})})};}})};} ,
 insert:(table:Parameters<typeof getTableName>[0])=>({values:(values:Record<string,unknown>)=>{const name=getTableName(table);state.inserts.push({table:name,values});return {returning:async()=>[{id:"new-copy",...values}],then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(undefined).then(resolve)};}}),
 update:(table:Parameters<typeof getTableName>[0])=>({set:(values:Record<string,unknown>)=>{const name=getTableName(table);state.updates.push({table:name,values});return {where:()=>({returning:async()=>[{...(state.rows.get(name)?.[0]??{}),...values}]})};}}),
}}));
vi.mock("@/lib/publishing/fork-attribution",()=>({recordForkAttribution:vi.fn()}));
vi.mock("@/lib/auth/author-resolver",()=>({resolveUserIdByClerkId:async()=>"actor"}));
vi.mock("@/lib/collections/service",()=>({setSourceCollection:vi.fn()}));
vi.mock("../pins",()=>({pinMonsterReferences:async(d:unknown)=>d}));
vi.mock("../composition",()=>({resolveMonsterComposition:async(_:unknown,__:unknown,capture?:(value:unknown[])=>void)=>{capture?.([]);return [];}}));
import {monsterDefinitionSchema} from "../model";
import {publishMonster,createMonsterCopy,listMonsters} from "../service";
const definition=monsterDefinitionSchema.parse({name:"Watchman",budget:25,attributes:{physical:3,mental:0,magical:0}});
beforeEach(()=>{state.inserts=[];state.updates=[];state.selections=[];state.rows=new Map([["monsters",[{id:"template",userId:"owner",name:definition.name,version:3,visibility:"PRIVATE",isPublic:false,sourceCollectionId:null,definition:{...definition,componentPins:[]}}]],["monster_versions",[{id:"version-3",monsterId:"template",version:3,definition:{...definition,componentPins:[]}}]]]);});
describe("monster immutable publication and compact copies",()=>{
 it("selects only metadata for discovery without definitions or private component pins",async()=>{await listMonsters(null);expect(state.selections[0]).not.toHaveProperty("definition");expect(state.selections[0]).toHaveProperty("name");});
 it("does not write or increment versions when the canonical definition is unchanged",async()=>{const row=await publishMonster("template","owner",definition,false,"PRIVATE");expect(row.version).toBe(3);expect(state.inserts).toEqual([]);expect(state.updates).toEqual([]);});
 it("changes visibility without creating a duplicate immutable version",async()=>{const row=await publishMonster("template","owner",definition,true,"PUBLIC");expect(row.version).toBe(3);expect(state.inserts).toEqual([]);expect(state.updates).toHaveLength(1);expect(state.updates[0]!.values).not.toHaveProperty("definition");});
 it("pins a private named copy by immutable version FK without copying rules or definition",async()=>{const copy=await createMonsterCopy("template","owner","Encounter scout",3);expect(copy?.templateVersionId).toBe("version-3");expect(copy?.templateVersion).toBe(3);expect(copy?.definition).toBeNull();expect(copy?.currentVitality).toBe(13);expect(copy?.name).toBe("Encounter scout");expect(state.inserts[0]!.values["userId"]).toBe("owner");});
});
