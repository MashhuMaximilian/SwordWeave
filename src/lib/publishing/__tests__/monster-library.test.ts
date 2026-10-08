import { beforeEach,describe,it,expect,vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks=vi.hoisted(()=>({where:vi.fn(),columns:vi.fn()}));
vi.mock("@/db/client",()=>({db:{select:(columns:unknown)=>{mocks.columns(columns);return {from:()=>({where:mocks.where})};},query:{users:{findMany:async()=>[]}}}}));
vi.mock("@/lib/engagement/engagement-aggregates",()=>({resolveEngagementMap:async()=>new Map()}));
vi.mock("@/lib/engagement/library-flag-counts",()=>({loadLibraryFlagCounts:async()=>new Map()}));
import { queryLibrary } from "../library-query";
import { monsterToLibraryItem } from "../monster-library-item";
import { libraryOrigin, libraryAuthorLabel } from "../library-classification";
const row={id:"monster",userId:"author",name:"Moss guardian",description:"Guards the grove",visibility:"PUBLIC" as const,createdAt:new Date("2026-10-01"),forkedFromId:null,version:1,budget:25,size:"MEDIUM"};
beforeEach(()=>{vi.clearAllMocks();mocks.where.mockResolvedValue([row]);});
describe("monster discovery",()=>{
 it("loads discovery columns, preserving the actual source id and author",async()=>{const result=await queryLibrary({targetType:"MONSTER",sort:"RECENT"});expect(result.items[0]?.id).toBe("MONSTER:monster");expect(result.items[0]?.authorId).toBe("author");expect(mocks.columns.mock.calls[0]![0]).not.toHaveProperty("definition");});
 it("gates anonymous discovery by the live monster visibility",async()=>{await queryLibrary({targetType:"MONSTER"});const compiled=new PgDialect().sqlToQuery(mocks.where.mock.calls[0]![0]);expect(compiled.sql).toContain("visibility");expect(compiled.sql).toContain("'PUBLIC'");expect(compiled.params).not.toContain("viewer");});
 it("filters a saved collection by independent collection access and actual entry membership",async()=>{await queryLibrary({targetType:"MONSTER",viewerClerkId:"viewer",collectionId:"saved-collection"});const compiled=new PgDialect().sqlToQuery(mocks.where.mock.calls[0]![0]);expect(compiled.sql).toContain("collection_entries");expect(compiled.sql).toContain("c.visibility='PUBLIC'");expect(compiled.params).toContain("saved-collection");expect(compiled.params).toContain("viewer");});
 it("maps private templates as drafts and preserves explicit fork provenance",()=>{const mapped=monsterToLibraryItem({...row,visibility:"PRIVATE",forkedFromId:"source"});expect(mapped.publishedAt).toBeNull();expect(mapped.visibility).toBe("PRIVATE");expect(mapped.sourceOrigin).toBe("fork:source");});
 it("attributes reserved system bestiary owners to System",()=>{const mapped=monsterToLibraryItem({...row,userId:"system:bestiary-2026-10",sourceOrigin:"SRD"});expect(mapped.sourceOrigin).toBe("system:bestiary-2026-10");expect(libraryOrigin(mapped)).toBe("system");expect(libraryAuthorLabel(mapped)).toBe("System");});
 it("does not turn an authored source label into System attribution",()=>{expect(libraryOrigin(monsterToLibraryItem({...row,sourceOrigin:"SRD"}))).toBe("community");});
});

it("preserves every pinned containment path and quantity for catalogue mechanics", () => {
 const mapped = monsterToLibraryItem({...row, compositionSlots:[{primitiveId:1,name:"Strong",category:"METRIC",hardModifiers:[{kind:"modify",target:"attribute.physical",operation:"add",value:2,stacking:"stack"}],isMirrored:false,isMirrorable:true,mirrorVector:null,originHeritageId:null,originCapabilityId:"cap",originEffectId:null,buCost:4,quantity:2,dependencyKey:"p1",item:false,supplyKeys:[["capability:cap","primitive:1"],["primitive:1"]],supplyNames:{"capability:cap":"Strength"}}]});
 expect(mapped.compositionPaths).toHaveLength(2);
 expect(mapped.compositionPaths?.[0]?.containers).toEqual([{targetType:"CAPABILITY",targetId:"cap",name:"Strength"}]);
 expect(mapped.compositionPaths?.[1]?.containers).toEqual([]);
 expect(mapped.compositionPaths?.[0]?.quantity).toBe(2);
 expect(mapped.compositionPaths?.[0]?.mechanicalDescription).toMatch(/2.*Physical/);
});
