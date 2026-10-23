import { describe, expect, it } from "vitest";
import { ATELIER_SESSION_PREFIX, clearAtelierExperiment, readAtelierExperiment, writeAtelierExperiment } from "../atelier-experiment-session";
function memoryStorage() {
  const data = new Map<string,string>();
  return { get length() { return data.size; }, key: (index:number) => [...data.keys()][index] ?? null, getItem: (key:string) => data.get(key) ?? null, setItem: (key:string,value:string) => { data.set(key,value); }, removeItem: (key:string) => { data.delete(key); } };
}
describe("temporary Atelier draft recovery", () => {
  it("retains primary and secondary drafts and composition metadata independently", () => {
    const storage = memoryStorage();
    const draft = { form: { name: "Unfinished ward" }, slots: [{ primitiveId: 10, quantity: 3, isMirrored: true, notes: "Only at dusk" }] };
    writeAtelierExperiment(storage,"primary:new:capability",draft,100);
    writeAtelierExperiment(storage,"secondary:new:capability",{ ...draft, form: { name:"Another ward" } },100);
    writeAtelierExperiment(storage,"auth-resume",{ requested:true },100);
    expect(readAtelierExperiment(storage,"primary:new:capability",200)).toEqual(draft);
    expect(readAtelierExperiment(storage,"secondary:new:capability",200)).toMatchObject({ form:{ name:"Another ward" } });
    clearAtelierExperiment(storage,"primary:new:capability");
    expect(readAtelierExperiment(storage,"primary:new:capability",200)).toBeNull();
    expect(readAtelierExperiment(storage,"secondary:new:capability",200)).not.toBeNull();
  });
  it("rejects corrupt, obsolete, oversized and expired data without replacing a valid draft", () => {
    const storage = memoryStorage();
    writeAtelierExperiment(storage,"draft",{ name:"Preserved" },100);
    expect(writeAtelierExperiment(storage,"draft",{ text:"x".repeat(256001) },101)).toBe(false);
    expect(readAtelierExperiment(storage,"draft",102)).toEqual({ name:"Preserved" });
    expect(readAtelierExperiment(storage,"draft",100+24*60*60*1000+1)).toBeNull();
    for (const raw of ["bad JSON", JSON.stringify({ version:0, updatedAt:100, state:{} }), JSON.stringify({version:1,updatedAt:90000,state:{}})]) {
      storage.setItem(ATELIER_SESSION_PREFIX+"draft",raw);
      expect(readAtelierExperiment(storage,"draft",100)).toBeNull();
    }
  });
  it("bounds accumulated draft data while retaining authentication return state and unrelated storage", () => {
    const storage = memoryStorage();
    storage.setItem("unrelated","keep");
    writeAtelierExperiment(storage,"auth-resume",{ requested:true },1);
    for(let index=0;index<20;index++) writeAtelierExperiment(storage,`draft:${index}`,{ text:"x".repeat(100000) },index+1);
    expect(storage.length).toBeLessThanOrEqual(12);
    expect(storage.getItem("unrelated")).toBe("keep");
    expect(readAtelierExperiment(storage,"auth-resume",30)).toEqual({ requested:true });
    expect(readAtelierExperiment(storage,"draft:19",30)).not.toBeNull();
  });
  it("retains earlier recoverable drafts when browser quota rejects a new record", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 16; index++) writeAtelierExperiment(storage, `draft:${index}`, { name: `Draft ${index}` }, index + 1);
    const before = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    const full = { ...storage, setItem: () => { throw new DOMException("Storage full", "QuotaExceededError"); } };
    expect(writeAtelierExperiment(full, "new-draft", { name: "New draft" }, 20)).toBe(false);
    expect(Array.from({ length: storage.length }, (_, index) => storage.key(index))).toEqual(before);
    expect(readAtelierExperiment(storage, "draft:0", 20)).toEqual({ name: "Draft 0" });
  });
});
