import {beforeEach,describe,expect,it,vi} from "vitest";
const services=vi.hoisted(()=>({create:vi.fn(async()=>({id:"created"})),publish:vi.fn(async()=>({id:"saved"})),visible:vi.fn(async()=>null as {id:string}|null)}));
vi.mock("@clerk/nextjs/server",()=>({auth:async()=>({userId:"owner"})}));
vi.mock("@/db/client",()=>({db:{}}));
vi.mock("../service",()=>({createMonster:services.create,publishMonster:services.publish,listMonsters:vi.fn(),prepareMonster:vi.fn(),visibleMonster:services.visible,forkMonster:vi.fn()}));
vi.mock("../shuffle",()=>({shuffleMonster:vi.fn()}));
vi.mock("../composition",()=>({resolveMonsterComposition:vi.fn()}));
import {POST} from "@/app/api/monsters/route";
import {PATCH} from "@/app/api/monsters/[id]/route";
const context={params:Promise.resolve({id:"template"})};
beforeEach(()=>{vi.clearAllMocks();services.visible.mockResolvedValue(null);});
describe("monster authored request budget",()=>{
 it.each(["POST","PATCH"])("rejects a streamed oversized %s body with413 before any authored save",async(method)=>{const request=new Request("https://example.test/api/monsters/template",{method,body:JSON.stringify({definition:{concept:"x".repeat(1_048_576)}})});const response=method==="POST"?await POST(request):await PATCH(request,context);expect(response.status).toBe(413);expect(services.create).not.toHaveBeenCalled();expect(services.publish).not.toHaveBeenCalled();});
 it.each(["POST","PATCH"])("keeps normal %s bodies compatible",async(method)=>{const definition={name:"Sentinel"};const request=new Request("https://example.test/api/monsters/template",{method,body:JSON.stringify({definition,visibility:"PRIVATE"})});const response=method==="POST"?await POST(request):await PATCH(request,context);expect(response.status).toBe(method==="POST"?201:200);expect(method==="POST"?services.create:services.publish).toHaveBeenCalled();});
});

describe("Atelier creature fork draft save",()=>{
 it("rejects a hidden fork source before saving",async()=>{const result=await POST(new Request("https://example.test/api/monsters",{method:"POST",body:JSON.stringify({definition:{name:"Draft"},forkedFromId:"hidden"})}));expect(result.status).toBe(404);expect(services.visible).toHaveBeenCalledWith("hidden","owner");expect(services.create).not.toHaveBeenCalled();});
 it("preserves visible source lineage and the edited draft",async()=>{services.visible.mockResolvedValue({id:"source"});const definition={name:"Edited creature",references:[{kind:"PRIMITIVE",id:"42"}]};const result=await POST(new Request("https://example.test/api/monsters",{method:"POST",body:JSON.stringify({definition,forkedFromId:"source",visibility:"PRIVATE"})}));expect(result.status).toBe(201);expect(services.create).toHaveBeenCalledWith("owner",definition,false,"source",undefined,"PRIVATE");});
});
