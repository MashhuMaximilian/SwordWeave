import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),visible:vi.fn(),reaction:vi.fn(),flag:vi.fn()}));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.auth}));
vi.mock("@/db/client",()=>({db:{query:{users:{findFirst:mocks.user}}}}));
vi.mock("@/lib/collections/service",()=>({visibleEntries:mocks.visible}));
vi.mock("@/lib/engagement/reactions-service",()=>({setReaction:mocks.reaction,removeReaction:vi.fn()}));
vi.mock("@/lib/engagement/flags-service",()=>({flagTarget:mocks.flag,getFlagAggregate:vi.fn(),listFlagNotes:vi.fn(),unflagTarget:vi.fn()}));
import { POST as react } from "@/app/api/reactions/route";
import { POST as flag } from "@/app/api/flags/route";
const request=(body:unknown)=>new NextRequest("https://swordweave.test/api/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({userId:"viewer"});mocks.user.mockResolvedValue({id:"internal-viewer"});mocks.visible.mockResolvedValue([{targetId:"record"}]);mocks.reaction.mockResolvedValue({liked:true,disliked:false,likesCount:1,dislikesCount:0});mocks.flag.mockResolvedValue({flagged:true});});
describe.each(["COLLECTION","ENCOUNTER"])("%s shared actions",targetType=>{
 it.each(["LIKE","DISLIKE"])("accepts %s for an authorized record",async kind=>{const result=await react(request({targetType,targetId:"record",kind}));expect(result.status).toBe(200);expect(result.headers.get("Cache-Control")).toBe("private, no-store");expect(mocks.reaction).toHaveBeenCalledWith(expect.objectContaining({targetType,targetId:"record",kind,userId:"internal-viewer"}));});
 it("accepts a flag using the same access check",async()=>{const result=await flag(request({targetType,targetId:"record",reason:"OTHER",note:"Review the description"}));expect(result.status).toBe(200);expect(mocks.flag).toHaveBeenCalledWith(expect.objectContaining({targetType,targetId:"record",reason:"OTHER"}));});
 it("rejects private or revoked access before either write",async()=>{mocks.visible.mockResolvedValue([]);expect((await react(request({targetType,targetId:"record",kind:"LIKE"}))).status).toBe(404);expect((await flag(request({targetType,targetId:"record",reason:"OTHER"}))).status).toBe(404);expect(mocks.reaction).not.toHaveBeenCalled();expect(mocks.flag).not.toHaveBeenCalled();});
});
