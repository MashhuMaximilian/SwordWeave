import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ access: vi.fn(), max: vi.fn(), sheet: vi.fn(), log: vi.fn(), update: vi.fn(), bust: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect: async () => ({ userId: "owner" }) } }));
vi.mock("@/lib/character/resolve-character-access", () => ({ resolveCharacterAccess: mock.access }));
vi.mock("@/lib/character/character-vitality", () => ({ loadCharacterMaxVitality: mock.max, clampVitality: (n: number, max: number) => Math.max(0, Math.min(Math.floor(n), max)) }));
vi.mock("@/lib/character/workspace/draft-sheet", () => ({ readDraftSheet: mock.sheet }));
vi.mock("@/lib/character/character-log", () => ({ appendCharacterLog: mock.log }));
vi.mock("@/lib/cache/character-resolver-cache", () => ({ bustResolverCache: mock.bust }));
vi.mock("@/lib/character/mutation-transaction", () => ({ withCharacterMutation: async (_id: string, work: () => unknown) => work() }));
vi.mock("@/db/client", () => ({ db: { update: () => ({ set: (values: object) => {
  mock.update(values);
  const done = Promise.resolve([{ id: "character", currentVitality: (values as { currentVitality: number }).currentVitality }]);
  return { where: () => Object.assign(done, { returning: () => done }) };
} }) } }));
import { POST as damage } from "../[id]/vitality/route";
import { POST as rest } from "../[id]/rest/route";
const graph = { characterId: "character", nodes: [], edges: [], revision: 1 };
const runtime = { encumbrance: { capacity: 40 }, carryCapacity: 40, speedByType: { walking: 6 }, behaviorVariables: [] };
const context = { params: Promise.resolve({ id: "character" }) };
const request = (body: object) => new Request("https://example.test", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.access.mockResolvedValue({ character: { currentVitality: 30, level: 1 } });
  mock.max.mockResolvedValue({ max: 100, graph });
  mock.sheet.mockResolvedValue(runtime);
});
describe("targeted vitality confirmations", () => {
  it("returns confirmed damage and refreshed derived fields while reusing the graph", async () => {
    const response = await damage(request({ delta: -10 }), context);
    expect(await response.json()).toMatchObject({ character: { currentVitality: 20 }, runtime, delta: { applied: -10 } });
    expect(mock.sheet).toHaveBeenCalledWith("character", graph);
    expect(mock.log).toHaveBeenCalledTimes(1);
  });
  it("returns a boundary confirmation without writing character state", async () => {
    mock.access.mockResolvedValue({ character: { currentVitality: 0, level: 1 } });
    const response = await damage(request({ delta: -10 }), context);
    expect(await response.json()).toMatchObject({ character: { currentVitality: 0 }, runtime, delta: { applied: 0 } });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it.each([["short", 80], ["long", 100]])("confirms %s rest with derived fields and cache invalidation", async (restType, currentVitality) => {
    const response = await rest(request({ restType }), context);
    expect(await response.json()).toMatchObject({ character: { currentVitality }, runtime });
    expect(mock.log).toHaveBeenCalledTimes(2);
    expect(mock.bust).toHaveBeenCalledWith("character");
  });
  it("denies unauthorized mutations before loading the graph or updating data", async () => {
    mock.access.mockRejectedValue(Object.assign(new Error("Denied"), { name: "CharacterAccessDenied" }));
    expect((await damage(request({ delta: 1 }), context)).status).toBe(403);
    expect(mock.max).not.toHaveBeenCalled();
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.sheet).not.toHaveBeenCalled();
  });
});
