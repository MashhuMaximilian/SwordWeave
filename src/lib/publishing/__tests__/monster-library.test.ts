import { beforeEach,describe,it,expect,vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks=vi.hoisted(()=>({where:vi.fn(),columns:vi.fn()}));
vi.mock("@/db/client",()=>({db:{select:(columns:unknown)=>{mocks.columns(columns);return {from:()=>({where:mocks.where})};},query:{users:{findMany:async()=>[]}}}}));
vi.mock("@/lib/engagement/engagement-aggregates",()=>({resolveEngagementMap:async()=>new Map()}));
vi.mock("@/lib/engagement/library-flag-counts",()=>({loadLibraryFlagCounts:async()=>new Map()}));
import { queryLibrary } from "../library-query";
import { monsterToLibraryItem } from "../monster-library-item";
const row={id:"monster",userId:"author",name:"Moss guardian",description:"Guards the grove",visibility:"PUBLIC" as const,createdAt:new Date("2026-10-01"),forkedFromId:null,version:1,budget:25,size:"MEDIUM"};
beforeEach(()=>{vi.clearAllMocks();mocks.where.mockResolvedValue([row]);});
describe("monster discovery",()=>{
 it("loads only metadata, preserving the actual source id and author",async()=>{const result=await queryLibrary({targetType:"MONSTER",sort:"RECENT"});expect(result.items[0]?.id).toBe("MONSTER:monster");expect(result.items[0]?.authorId).toBe("author");expect(mocks.columns.mock.calls[0]![0]).not.toHaveProperty("definition");});
 it("gates anonymous discovery by the live monster visibility",async()=>{await queryLibrary({targetType:"MONSTER"});const compiled=new PgDialect().sqlToQuery(mocks.where.mock.calls[0]![0]);expect(compiled.sql).toContain("visibility");expect(compiled.sql).toContain("'PUBLIC'");expect(compiled.params).not.toContain("viewer");});
 it("filters a saved collection by independent collection access and actual entry membership",async()=>{await queryLibrary({targetType:"MONSTER",viewerClerkId:"viewer",collectionId:"saved-collection"});const compiled=new PgDialect().sqlToQuery(mocks.where.mock.calls[0]![0]);expect(compiled.sql).toContain("collection_entries");expect(compiled.sql).toContain("c.visibility='PUBLIC'");expect(compiled.params).toContain("saved-collection");expect(compiled.params).toContain("viewer");});
 it("maps private templates as drafts and preserves explicit fork provenance",()=>{const mapped=monsterToLibraryItem({...row,visibility:"PRIVATE",forkedFromId:"source"});expect(mapped.publishedAt).toBeNull();expect(mapped.visibility).toBe("PRIVATE");expect(mapped.sourceOrigin).toBe("fork:source");});
});
