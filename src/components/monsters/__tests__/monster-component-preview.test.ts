import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/components/characters/workspace/workspace-entity-preview",()=>({loadEntityPreview:vi.fn(),previewKind:(kind:string)=>kind.toLowerCase()}));
vi.mock("@/components/library/version-preview-button",()=>({mapPayloadToPreviewItem:(_kind:string,id:string,payload:Record<string,unknown>)=>({kind:"primitive",row:{id,...payload}})}));
import { loadMonsterComponentPreview } from "../monster-component-preview";
afterEach(()=>vi.unstubAllGlobals());
describe("selected monster component versions",()=>{
 it("loads the exact published payload selected by its immutable ID",async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({versions:[{id:"pin",versionNumber:2}],nextBefore:null})}).mockResolvedValueOnce({ok:true,json:async()=>({version:{payload:{name:"Old name"}}})});vi.stubGlobal("fetch",fetcher);
 const item=await loadMonsterComponentPreview({kind:"PRIMITIVE",id:"12",versionId:"pin"},new AbortController().signal);
 expect(item.row.name).toBe("Old name");expect(fetcher.mock.calls[1]?.[0]).toContain("version=2");
 });
 it("does not substitute latest content when the selected version is missing",async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({versions:[],nextBefore:null})});vi.stubGlobal("fetch",fetcher);
 await expect(loadMonsterComponentPreview({kind:"PRIMITIVE",id:"12",versionId:"missing"},new AbortController().signal)).rejects.toThrow("not substituted");expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
