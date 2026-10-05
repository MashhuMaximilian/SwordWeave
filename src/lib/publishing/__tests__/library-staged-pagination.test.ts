import {beforeEach,describe,expect,it,vi} from "vitest";
import {PgDialect} from "drizzle-orm/pg-core";
import {getTableName,type SQL} from "drizzle-orm";
const fixture=vi.hoisted(()=>({count:1200,reads:[] as {columns:string[];limit:number|null;returned:number;sql:string}[]}));
vi.mock("@/db/client",()=>({db:{query:{users:{findMany:async()=>[]}},select:(columns:Record<string,unknown>)=>{
 let table="",condition:SQL|undefined;
 const read=(limit:number|null)=>{const compiled=condition?new PgDialect().sqlToQuery(condition):{sql:"",params:[]};const ids=compiled.sql.includes('::text IN')?new Set(compiled.params.filter(p=>typeof p==="string"&&p.startsWith("entry-"))):null;
 let rows=table==="builds"?Array.from({length:fixture.count},(_,i)=>({id:`entry-${i}`,name:`Entry ${i}`,createdAt:new Date("2026-09-01"),userId:null,sourceOrigin:null,startingBu:25,level:1})).filter(row=>!ids||ids.has(row.id)):[];
 if(limit!==null)rows=rows.slice(0,limit);fixture.reads.push({columns:Object.keys(columns),limit,returned:rows.length,sql:compiled.sql});return rows.map(row=>Object.fromEntries(Object.keys(columns).map(key=>[key,row[key as keyof typeof row]])));};
 const chain={from:(value:Parameters<typeof getTableName>[0])=>{table=getTableName(value);return chain;},where:(value:SQL)=>{condition=value;return chain;},limit:async(value:number)=>read(value),then:(resolve:(rows:unknown[])=>unknown)=>Promise.resolve(read(null)).then(resolve)};return chain;
}}}));
vi.mock("@/lib/engagement/engagement-aggregates",()=>({resolveEngagementMap:async(ids:string[])=>new Map(ids.map(id=>[id,{likes:Number(id.split("-").at(-1)),dislikes:0,forks:0}]))}));
vi.mock("@/lib/engagement/library-flag-counts",()=>({loadLibraryFlagCounts:async()=>new Map()}));
import {queryLibrary,queryCompleteLibrary} from "../library-query";
beforeEach(()=>{fixture.count=1200;fixture.reads=[];});
describe("bounded staged library pagination",()=>{
 it("ranks lightweight metadata across all candidates then hydrates only selected page IDs",async()=>{
  const result=await queryLibrary({targetType:"BUILD_TEMPLATE",limit:2,offset:1,sort:"LIKES"});
  expect(result.total).toBe(1200);expect(result.items.map(item=>item.targetId)).toEqual(["entry-1198","entry-1197"]);
  expect(result.items.map(item=>item.buCost)).toEqual([25,25]);expect(fixture.reads).toHaveLength(2);
  expect(fixture.reads[0]).toMatchObject({limit:5001,returned:1200});expect(fixture.reads[0]?.columns).not.toContain("startingBu");
  expect(fixture.reads[1]).toMatchObject({limit:2,returned:2});expect(fixture.reads[1]?.columns).toContain("startingBu");expect(fixture.reads[1]?.sql).toContain("::text IN");
 });
 it("rejects candidate overflow before expensive hydration instead of inventing truncated totals",async()=>{fixture.count=6000;await expect(queryLibrary({targetType:"BUILD_TEMPLATE",limit:2})).rejects.toThrow("5,000 candidates");expect(fixture.reads).toHaveLength(1);expect(fixture.reads[0]?.returned).toBe(5001);});
 it("preserves complete internal callers without paging or the request budget",async()=>{const result=await queryCompleteLibrary({targetType:"BUILD_TEMPLATE",limit:2});expect(result).toHaveLength(1200);expect(fixture.reads).toHaveLength(1);expect(fixture.reads[0]?.limit).toBeNull();expect(fixture.reads[0]?.columns).toContain("startingBu");});
});
