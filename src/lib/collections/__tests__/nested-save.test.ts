import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(()=>({execute:vi.fn(),owned:vi.fn(),txExecute:vi.fn(),insert:vi.fn(),remove:vi.fn()}));
vi.mock("@/db/client",()=>({db:{execute:mocks.execute,select:()=>({from:()=>({where:mocks.owned})})},withDatabaseTransaction:async(work:(tx:unknown)=>Promise<unknown>)=>work({execute:mocks.txExecute,insert:mocks.insert,delete:mocks.remove})}));
vi.mock("@/lib/publishing/library-query",()=>({visibilityCondition:vi.fn()}));
import { saveMemberships,visibleEntries } from "../service";
const dialect=new PgDialect();
beforeEach(()=>{vi.clearAllMocks();mocks.execute.mockResolvedValue({rows:[{targetType:"COLLECTION",targetId:"source",name:"Public set"}]});mocks.owned.mockResolvedValue([{id:"dest",ownerId:"owner",systemKind:null}]);mocks.txExecute.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id:"source"}]});mocks.insert.mockReturnValue({values:()=>({onConflictDoNothing:async()=>{}})});mocks.remove.mockReturnValue({where:async()=>{}});});
describe("saving a collection within another",()=>{
 it("enforces collection visibility without publication or entity owner columns",async()=>{await visibleEntries([{targetType:"COLLECTION",targetId:"source"}],"viewer");const q=dialect.sqlToQuery(mocks.execute.mock.calls[0]![0]);expect(q.sql).toContain('"collections"');expect(q.sql).toContain("e.owner_id=");expect(q.sql).toContain("FOLLOWERS_ONLY");expect(q.sql).not.toContain("publications");});
 it("rejects an inaccessible source before changing memberships",async()=>{mocks.execute.mockResolvedValue({rows:[]});await expect(saveMemberships("owner","COLLECTION","source",["dest"])).rejects.toThrow("Entry not found");expect(mocks.insert).not.toHaveBeenCalled();expect(mocks.txExecute).not.toHaveBeenCalled();});
 it("serializes the graph check and saves a readable collection",async()=>{await saveMemberships("owner","COLLECTION","source",["dest"]);expect(dialect.sqlToQuery(mocks.txExecute.mock.calls[0]![0]).sql).toContain("pg_advisory_xact_lock");expect(dialect.sqlToQuery(mocks.txExecute.mock.calls[1]![0]).sql).toContain("WITH RECURSIVE");expect(mocks.insert).toHaveBeenCalledTimes(2);});
 it("rejects self saving and transitive cycles before inserting",async()=>{mocks.txExecute.mockReset().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id:"source"},{id:"dest"}]});await expect(saveMemberships("owner","COLLECTION","source",["dest"])).rejects.toThrow("cannot contain itself");expect(mocks.insert).not.toHaveBeenCalled();});
 it("cannot save into someone else's collection",async()=>{mocks.owned.mockResolvedValue([]);await expect(saveMemberships("owner","COLLECTION","source",["dest"])).rejects.toThrow("Choose your own");expect(mocks.txExecute).not.toHaveBeenCalled();});
});
