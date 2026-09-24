import { describe, expect, it, vi, beforeEach } from "vitest";
const state = vi.hoisted(() => ({ revision: 0, spent: 0, debtExceeded: false, effects: [] as string[], transactionDepth: 0, commits: 0 }));
vi.mock("@/db/client", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ for: async () => [{ id: "character", level: 1, mode: "PLAY" }] }) }) }) },
  withDatabaseTransaction: async (work: () => Promise<unknown>) => {
    if (state.transactionDepth) return work();
    const before = structuredClone(state); state.transactionDepth++;
    try { const result = await work(); state.transactionDepth--; state.commits++; return result; }
    catch (error) { Object.assign(state, before); throw error; }
  },
}));
vi.mock("../read", () => ({ readWorkspace: async () => ({ characterId: "character", revision: state.revision, nodes: [], edges: [] }) }));
vi.mock("../draft-sheet", () => ({ readDraftSheet: async () => ({ buBalance: { progressionPool: 25, progressionSpent: state.spent, overBudget: state.spent > 25 }, buLedger: { netSpent: state.spent }, volatility: { exceeded: state.debtExceeded } }) }));
vi.mock("../create", () => ({ executeWorkspaceCreate: async (_id: string, _user: string, command: { draft: { name: string } }) => {
  if (command.draft.name === "fail") throw new Error("Invalid contained piece");
  state.effects.push(command.draft.name); state.revision++; state.spent += 4; return { id: command.draft.name };
} }));
vi.mock("../commands", () => ({ WorkspaceConflict: class extends Error {}, executeWorkspaceCommand: vi.fn() }));
vi.mock("../relocate", () => ({ relocateWorkspacePiece: vi.fn() }));
vi.mock("@/lib/character/can-resolve-character", () => ({ canResolveCharacter: vi.fn(), CharacterAccessDenied: class extends Error {} }));
import { draftOperationsSchema, executeDraftOperations, workspaceBuildFingerprint } from "../drafts";
import type { DraftOperation } from "../draft-types";
function create(index: number, name: string): DraftOperation { return { id: `26ca493d-20cf-48aa-b0fb-f5567bcb792${index}`, type: "create", payload: { kind: "effect", category: "MANIFEST", draft: { name } } }; }
beforeEach(() => Object.assign(state, { revision: 0, spent: 0, debtExceeded: false, effects: [], transactionDepth: 0, commits: 0 }));
describe("atomic character drafts", () => {
  it("commits the whole operation sequence once", async () => {
    const result = await executeDraftOperations("character", "owner", 0, [create(1, "A"), create(2, "B")]);
    expect(state.effects).toEqual(["A", "B"]); expect(state.commits).toBe(1); expect(result.buSpent).toBe(8);
    expect(result.beforeSheet.buBalance.progressionSpent).toBe(0);
  });
  it("rolls back previous actions if a later action fails", async () => {
    await expect(executeDraftOperations("character", "owner", 0, [create(1, "A"), create(2, "fail")])).rejects.toThrow("Invalid contained piece");
    expect(state.effects).toEqual([]); expect(state.revision).toBe(0); expect(state.commits).toBe(0);
  });
  it("rejects a stale base before making any changes", async () => {
    state.revision = 3;
    await expect(executeDraftOperations("character", "owner", 2, [create(1, "A")])).rejects.toThrow("character changed");
    expect(state.effects).toEqual([]);
  });
  it("retains the existing soft warning for overspending", async () => {
    const operations = Array.from({ length: 7 }, (_, index) => create(index, String(index)));
    const result = await executeDraftOperations("character", "owner", 0, operations);
    expect(result.warnings?.[0]).toContain("Build Units");
    expect(state.effects).toHaveLength(7);
  });
  it("hard-fails excess drawback credit and rolls back all additions", async () => {
    state.debtExceeded = true;
    await expect(executeDraftOperations("character", "owner", 0, [create(1, "A")])).rejects.toThrow("drawback credit");
    expect(state.effects).toEqual([]);
  });
  it("accepts uploaded portrait paths and framing, clears URLs, and rejects invalid frames", () => {
    const operation = { id: create(1, "x").id, type: "character", payload: { portraitUrl: " /api/icons/blob/portrait.png ", portraitFrame: { x: 20, y: 80, zoom: 0.5 } } };
    expect(draftOperationsSchema.parse([operation])[0]).toMatchObject({ payload: { portraitUrl: "/api/icons/blob/portrait.png", portraitFrame: { x: 20, y: 80, zoom: 0.5 } } });
    expect(draftOperationsSchema.parse([{ ...operation, payload: { portraitUrl: " " } }])[0]).toMatchObject({ payload: { portraitUrl: null } });
    expect(draftOperationsSchema.safeParse([{ ...operation, payload: { portraitFrame: { x: 0, y: 100, zoom: 0 } } }]).success).toBe(false);
  });
  it("detects concurrent portrait and framing edits before applying a draft", () => {
    const graph = { characterId: "character", revision: 0, nodes: [], edges: [] };
    const before = { portraitUrl: "/portrait-a", portraitFrame: { x: 50, y: 50, zoom: 1 } };
    expect(workspaceBuildFingerprint(graph, before)).not.toBe(workspaceBuildFingerprint(graph, { ...before, portraitUrl: "/portrait-b" }));
    expect(workspaceBuildFingerprint(graph, before)).not.toBe(workspaceBuildFingerprint(graph, { ...before, portraitFrame: { x: 10, y: 80, zoom: 2 } }));
  });
  it("prevents runtime mutations from being smuggled into foundation editing", () => {
    expect(draftOperationsSchema.safeParse([{ id: create(1,"x").id, type: "character", payload: { currentVitality: 999, mode: "PLAY" } }]).success).toBe(false);
  });
  it("keeps the user-action group identity for durable batch undo", () => {
    const groupId = "81a1161d-a31c-42d4-b22c-c25e8b351804";
    expect(draftOperationsSchema.parse([{ ...create(1, "A"), groupId }])[0]?.groupId).toBe(groupId);
  });
  it("rejects duplicate operation identities", () => {
    expect(draftOperationsSchema.safeParse([create(1,"x"),create(1,"y")]).success).toBe(false);
  });
  it("fingerprints survive JSONB key reordering and date serialization", () => {
    const graph = { characterId: "character", revision: 0, nodes: [], edges: [{ id: "e", parent: null, child: "primitive:1" as const, category: "MANIFEST" as const, order: 0, isMirrored: false, data: { notes: "n", quantity: 2 } }] };
    const stored = { ...graph, edges: [{ ...graph.edges[0]!, data: { quantity: 2, notes: "n" } }] };
    expect(workspaceBuildFingerprint(graph, { name: "A", backstory: { origin: "o", goals: "g" } })).toBe(workspaceBuildFingerprint(stored, { backstory: { goals: "g", origin: "o" }, name: "A" }));
  });
  it("fingerprints build changes but allows concurrent runtime changes", () => {
    const graph = { characterId: "character", revision: 0, nodes: [], edges: [] };
    expect(workspaceBuildFingerprint(graph, { name: "A", currentVitality: 10 })).toBe(workspaceBuildFingerprint(graph, { name: "A", currentVitality: 3 }));
    expect(workspaceBuildFingerprint(graph, { name: "A" })).not.toBe(workspaceBuildFingerprint(graph, { name: "B" }));
  });
});
