import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as any[], revision: 4, fingerprint: "base", permissions: new Map<string,string>(), applied: [] as string[] }));
vi.mock("@/db/schema", () => ({
  characters: { table: "characters", id: "id" },
  users: { table: "users", clerkUserId: "clerkUserId", displayName: "displayName", username: "username" },
  characterWorkspaceState: { table: "state", characterId: "characterId" },
  characterWorkspaceCommands: { table: "commands", characterId: "characterId", commandId: "commandId", kind: "kind" },
}));
vi.mock("drizzle-orm", () => ({ eq: (column: string, value: unknown) => (row: any) => row[column] === value, inArray: (column: string, values: unknown[]) => (row: any) => values.includes(row[column]), and: (...conditions: ((row:any)=>boolean)[]) => (row:any) => conditions.every(check => check(row)) }));
vi.mock("@/db/client", () => ({
  db: {
    select: () => ({ from: (table:any) => ({ where: (test:(row:any)=>boolean) => {
      const rows = table.table === "commands" ? state.rows.filter(test) : table.table === "state" ? [{ revision: state.revision }] : table.table === "users" ? [] : [{ id: "character" }];
      const promise = Promise.resolve(rows) as any;
      promise.for = () => promise;
      return promise;
    } }) }),
    insert: () => ({ values: (value:any) => ({ onConflictDoUpdate: async () => { const index=state.rows.findIndex(row=>row.commandId===value.commandId); if(index<0)state.rows.push(structuredClone(value));else state.rows[index]=structuredClone(value); } }) }),
  },
  withDatabaseTransaction: async (work:()=>Promise<unknown>) => {
    const saved = { rows:structuredClone(state.rows), applied:[...state.applied], revision:state.revision };
    try { return await work(); } catch(error) { state.rows=saved.rows;state.applied=saved.applied;state.revision=saved.revision;throw error; }
  },
}));
vi.mock("@/lib/character/resolve-character-access", () => ({ resolveCharacterAccess: async (actor:string,_id:string,opts?:{require?:string}) => {
  const role=state.permissions.get(actor); const ranks:any={VIEWER:0,SUGGESTER:1,EDITOR:2,OWNER:3};
  if(!role || (opts?.require && ranks[role]<ranks[opts.require]))throw new Error("Access denied");
  return {permission:role};
} }));
vi.mock("../drafts", () => ({workspaceBuildFingerprint:()=>state.fingerprint}));
vi.mock("../read", () => ({readWorkspace:async()=>({revision:state.revision})}));
import { submitCharacterProposal, decideCharacterProposal, readCollaboration, markCharacterReviewed } from "../collaboration";
const operations = [{id:"operation-1",type:"command" as const,payload:{type:"edit"}}];
async function proposal(actor="dm") { return submitCharacterProposal("character",actor,{baseRevision:4,operations,expectedBaseHash:"base",requestId:"request"}); }
beforeEach(()=>{state.rows=[];state.applied=[];state.revision=4;state.fingerprint="base";state.permissions=new Map([["owner","OWNER"],["dm","SUGGESTER"],["friend","SUGGESTER"],["viewer","VIEWER"]]);});
describe("whole-character proposal transaction",()=>{
  it("keeps proposals separate from the saved build",async()=>{const result=await proposal();expect(result.status).toBe("pending");expect(state.revision).toBe(4);expect(state.applied).toEqual([]);});
  it("does not grant viewers proposal rights",async()=>{await expect(proposal("viewer")).rejects.toThrow("Access denied");expect(state.rows).toHaveLength(0);});
  it("does not let another collaborator see private proposed changes",async()=>{await proposal();expect((await readCollaboration("character","friend")).proposals).toHaveLength(0);expect((await readCollaboration("character","owner")).proposals).toHaveLength(1);});
  it("prevents a collaborator approving their own proposal",async()=>{const p=await proposal();const execute=vi.fn();await expect(decideCharacterProposal("character","dm",p.id,"approve","",execute)).rejects.toThrow("Only the owner");expect(execute).not.toHaveBeenCalled();});
  it("rolls all writes back when any operation fails",async()=>{const p=await proposal();await expect(decideCharacterProposal("character","owner",p.id,"approve","",async()=>{state.applied.push("first");state.revision++;throw new Error("Second operation failed");})).rejects.toThrow("Second operation");expect(state.applied).toEqual([]);expect(state.revision).toBe(4);expect((await readCollaboration("character","owner")).proposals[0]?.status).toBe("pending");});
  it("rejects stale builds before executing",async()=>{const p=await proposal();state.revision++;const execute=vi.fn();await expect(decideCharacterProposal("character","owner",p.id,"approve","",execute)).rejects.toThrow("older build");expect(execute).not.toHaveBeenCalled();});
  it("rejects changed underlying rule versions even if revision did not move",async()=>{const p=await proposal();state.fingerprint="different";await expect(decideCharacterProposal("character","owner",p.id,"approve","",vi.fn())).rejects.toThrow("referenced rule");});
  it("rechecks revoked proposer access before accepting",async()=>{const p=await proposal();state.permissions.delete("dm");await expect(decideCharacterProposal("character","owner",p.id,"approve","",vi.fn())).rejects.toThrow("Access denied");});
  it("records proposer and reviewer and applies retries only once",async()=>{const p=await proposal();const execute=vi.fn(async()=>{state.applied.push("applied");state.revision=5;return {revision:5};});const result=await decideCharacterProposal("character","owner",p.id,"approve","Looks good",execute);await decideCharacterProposal("character","owner",p.id,"approve","",execute);expect(execute).toHaveBeenCalledTimes(1);expect(result).toMatchObject({authorId:"dm",reviewerId:"owner",status:"applied",appliedRevision:5});});
  it("makes submission retry idempotent",async()=>{await proposal();await proposal();expect(state.rows).toHaveLength(1);});
  it("rejects a changed payload reusing the same submission ID",async()=>{await proposal();await expect(submitCharacterProposal("character","dm",{baseRevision:4,operations:[{...operations[0]!,id:"other"}],requestId:"request"})).rejects.toThrow("different changes");});
  it("binds DM review to exact revision",async()=>{await expect(markCharacterReviewed("character","dm",3,"")).rejects.toThrow("changed");const review=await markCharacterReviewed("character","dm",4,"Ready");expect(review.revision).toBe(4);state.revision=5;const read=await readCollaboration("character","owner");expect(read.reviews[0]?.revision).not.toBe(read.revision);});
});
