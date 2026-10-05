import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({publication:vi.fn(),user:vi.fn(),follow:vi.fn()}));
vi.mock("@/db/client",()=>({db:{query:{publications:{findFirst:mocks.publication},users:{findFirst:mocks.user},follows:{findFirst:mocks.follow}}}}));
import {checkVisibility} from "../visibility";
const input={targetType:"CAPABILITY",targetId:"cap",ownerId:"author",isPublic:true,viewerId:null};
beforeEach(()=>vi.clearAllMocks());
it("denies source access if a publication permission lookup fails",async()=>{
 mocks.publication.mockRejectedValue(new Error("Unavailable database"));
 expect(await checkVisibility(input)).toEqual({allowed:false,reason:"private"});
});
it("honors public publication before a legacy false flag",async()=>{
 mocks.publication.mockResolvedValue({visibility:"PUBLIC"});
 expect(await checkVisibility({...input,isPublic:false})).toEqual({allowed:true});
});
it("keeps explicitly private and unpublished sources hidden",async()=>{
 mocks.publication.mockResolvedValueOnce({visibility:"PRIVATE"});
 expect((await checkVisibility(input)).allowed).toBe(false);
 mocks.publication.mockResolvedValueOnce(undefined).mockResolvedValueOnce({unpublishedAt:new Date()});
 expect((await checkVisibility(input)).allowed).toBe(false);
});
it("allows established legacy public sources only when no publication overrides them",async()=>{
 mocks.publication.mockResolvedValue(undefined);
 expect((await checkVisibility(input)).allowed).toBe(true);
});
it("requires an actual follower for follower-only sources",async()=>{
 mocks.publication.mockResolvedValue({visibility:"FOLLOWERS_ONLY"});
 mocks.user.mockResolvedValue({id:"viewer-internal"});mocks.follow.mockResolvedValue(undefined);
 expect((await checkVisibility({...input,viewerId:"viewer"})).allowed).toBe(false);
 mocks.follow.mockResolvedValue({followerId:"viewer-internal"});
 expect((await checkVisibility({...input,viewerId:"viewer"})).allowed).toBe(true);
});
