import { beforeEach,describe,it,expect,vi } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks=vi.hoisted(()=>({execute:vi.fn()}));
vi.mock("@/db/client",()=>({db:{execute:mocks.execute},withDatabaseTransaction:vi.fn()}));
vi.mock("@/lib/publishing/library-query",()=>({visibilityCondition:()=>sql`e.is_public=true`}));
import { collectionContents,getCollection,visibleEntries } from "../service";
const dialect=new PgDialect();
const query=(i:number)=>dialect.sqlToQuery(mocks.execute.mock.calls[i]![0]).sql;
beforeEach(()=>vi.clearAllMocks());
describe("collection privacy queries",()=>{
 it("denies an inaccessible collection before looking up entries or their count",async()=>{mocks.execute.mockResolvedValue({rows:[]});await expect(collectionContents("11111111-1111-4111-8111-111111111111",null)).rejects.toThrow("Collection not found");expect(mocks.execute).toHaveBeenCalledTimes(1);expect(query(0)).toContain("c.visibility='PUBLIC'");});
 it("redacts an inaccessible parent's identifier from an independently public collection",async()=>{mocks.execute.mockResolvedValueOnce({rows:[{id:"child",parent_id:"private-parent",visibility:"PUBLIC",name:"Open collection"}]}).mockResolvedValueOnce({rows:[]});const c=await getCollection("child",null);expect(c["parent_id"]).toBeNull();expect(query(1)).toContain("c.visibility='PUBLIC'");});
 it("applies entry visibility to the visible count as well as the paginated entries",async()=>{mocks.execute.mockResolvedValueOnce({rows:[{id:"collection",parent_id:null,system_kind:null,owner_id:"owner"}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{total:0}]});const result=await collectionContents("11111111-1111-4111-8111-111111111111",null);expect(result.entries).toEqual([]);expect(result.total).toBe(0);expect(query(1)).toContain("LIMIT");expect(query(2)).toContain("count(*)");for(const i of [1,2]){expect(query(i)).toContain("e.is_public=true");expect(query(i)).toContain("e.visibility='PUBLIC'");expect(query(i)).not.toContain("character_shares");}});
 it("uses active direct shares for the specific authenticated viewer only",async()=>{mocks.execute.mockResolvedValue({rows:[]});await visibleEntries([{targetType:"CHARACTER",targetId:"id"}],"viewer");const compiled=dialect.sqlToQuery(mocks.execute.mock.calls[0]![0]);expect(compiled.sql).toContain("character_shares");expect(compiled.sql).toContain("cs.revoked_at IS NULL");expect(compiled.params).toContain("viewer");});
 it("reads Monster visibility without casting MONSTER into the publication enum",async()=>{mocks.execute.mockResolvedValue({rows:[]});await visibleEntries([{targetType:"MONSTER",targetId:"id"}],null);expect(query(0)).toContain("e.visibility='PUBLIC'");expect(query(0)).not.toContain("publications");});
 it("gates heritage references to their actual kind before checking publication visibility",async()=>{mocks.execute.mockResolvedValue({rows:[]});await visibleEntries([{targetType:"LINEAGE_TEMPLATE",targetId:"upbringing-id"}],"viewer");const compiled=dialect.sqlToQuery(mocks.execute.mock.calls[0]![0]);expect(compiled.sql).toContain("e.kind=");expect(compiled.params).toContain("LINEAGE");});
});
