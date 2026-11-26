import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), transaction: vi.fn(), mutate: vi.fn(), auth: vi.fn(), lock: vi.fn(), readPlayState: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ for: mocks.lock }) }) }) }, withDatabaseTransaction: mocks.transaction }));
vi.mock("@/lib/character/resolve-character-access", () => ({ resolveCharacterAccess: mocks.access }));
vi.mock("@/lib/play-state/service", () => ({ readPlayState: mocks.readPlayState, reconcilePlayState: vi.fn(), mutatePlayState: mocks.mutate }));
vi.mock("@/lib/character/workspace/read", () => ({ readWorkspace: vi.fn() }));
vi.mock("@/lib/character/character-vitality", () => ({ loadCharacterMaxVitality: vi.fn(), clampVitality: vi.fn() }));
vi.mock("@/lib/character/workspace/draft-sheet", () => ({ readDraftSheet: vi.fn() }));
vi.mock("@/lib/cache/character-resolver-cache", () => ({ bustResolverCache: vi.fn() }));
import { GET, POST } from "../route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({userId: "editor"}); });
it("requires editor access before reading session state", async () => {
  mocks.access.mockRejectedValue(Object.assign(new Error("Denied"), { name: "CharacterAccessDenied" }));
  const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "c" }) });
  expect(response.status).toBe(403); expect(mocks.access).toHaveBeenCalledWith("editor", "c", { require: "EDITOR" }); expect(mocks.transaction).not.toHaveBeenCalled();
});
it("does not mutate state for a viewer or unrelated user", async () => {
  mocks.access.mockRejectedValue(Object.assign(new Error("Denied"), { name: "CharacterAccessDenied" }));
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ opId: "11111111-1111-4111-8111-111111111111", baseRevision: 0, changes: [{ field: "currentVitality", value: 10 }] }) }), { params: Promise.resolve({ id: "c" }) });
  expect(response.status).toBe(403); expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
});
it("rejects authored fields in a session import without touching the database", async () => {
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ opId: "11111111-1111-4111-8111-111111111111", baseRevision: 0, changes: [{ field: "name", value: "Hacked" }] }) }), { params: Promise.resolve({ id: "c" }) });
  expect(response.status).toBe(400); expect(mocks.transaction).not.toHaveBeenCalled();
});

it("returns an explicit uncached 401 to anonymous session requests", async () => {
  mocks.auth.mockResolvedValue({userId: null});
  const response = await GET(new Request("http://localhost"), {params: Promise.resolve({id: "c"})});
  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.access).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it.each(["GET", "POST"] as const)("checks current edit access after acquiring the character lock on %s", async method => {
  mocks.access.mockResolvedValueOnce({ permission: "EDITOR" });
  mocks.access.mockRejectedValueOnce(Object.assign(new Error("Revoked"), { name: "CharacterAccessDenied" }));
  mocks.transaction.mockImplementation(work => work());
  mocks.lock.mockResolvedValue([{ id: "c", currentVitality: null }]);
  const body = method === "POST" ? JSON.stringify({ opId: "11111111-1111-4111-8111-111111111111", baseRevision: 0,
    changes: [{ field: "currentVitality", value: 10 }] }) : null;
  const response = await (method === "GET" ? GET : POST)(new Request("http://localhost", { method, body }), { params: Promise.resolve({ id: "c" }) });
  expect(response.status).toBe(403);
  expect(mocks.access).toHaveBeenCalledTimes(2);
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.access.mock.invocationCallOrder[1]!);
  expect(mocks.readPlayState).not.toHaveBeenCalled();
  expect(mocks.mutate).not.toHaveBeenCalled();
});
