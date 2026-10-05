import {beforeEach,describe,expect,it,vi} from "vitest";
const fixture=vi.hoisted(()=>({viewer:"owner" as string|null,visible:true,fail:false}));
const composition=vi.hoisted(()=>vi.fn(async()=>{if(fixture.fail)throw new Error("Private secret component name");return [];}));
vi.mock("@clerk/nextjs/server",()=>({auth:async()=>({userId:fixture.viewer})}));
vi.mock("../service",()=>({visibleMonster:async()=>fixture.visible?{id:"template",userId:"owner",definition:{name:"Sentinel"}}:undefined}));
vi.mock("../composition",()=>({resolveMonsterComposition:composition}));
vi.mock("../resolve",()=>({resolveMonster:()=>({maximum:13})}));
import {GET} from "@/app/api/monsters/[id]/route";
beforeEach(()=>{fixture.viewer="owner";fixture.visible=true;fixture.fail=false;composition.mockClear();});
describe("monster source access",()=>{
 it("passes the authenticated owner to private dependency resolution",async()=>{const result=await GET(new Request("https://example.test/api/monsters/template"),{params:Promise.resolve({id:"template"})});expect(result.status).toBe(200);expect(composition).toHaveBeenCalledWith({name:"Sentinel"},"owner");expect((await result.json()).canEdit).toBe(true);});
 it("allows an anonymous public preview with anonymous component permissions",async()=>{fixture.viewer=null;const result=await GET(new Request("https://example.test/api/monsters/template"),{params:Promise.resolve({id:"template"})});expect(result.status).toBe(200);expect(composition).toHaveBeenCalledWith({name:"Sentinel"},null);});
 it("returns a safe unavailable response without hidden component content",async()=>{fixture.viewer=null;fixture.fail=true;const result=await GET(new Request("https://example.test/api/monsters/template"),{params:Promise.resolve({id:"template"})});expect(result.status).toBe(409);expect(JSON.stringify(await result.json())).not.toContain("Private secret");});
});
