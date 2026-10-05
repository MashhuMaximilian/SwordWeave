import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), transaction: vi.fn(), mutate: vi.fn(), auth: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/db/client", () => ({ db: {}, withDatabaseTransaction: mocks.transaction }));
vi.mock("@/lib/character/resolve-character-access", () => ({ resolveCharacterAccess: mocks.access }));
vi.mock("@/lib/play-state/service", () => ({ readPlayState: vi.fn(), reconcilePlayState: vi.fn(), mutatePlayState: mocks.mutate }));
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
