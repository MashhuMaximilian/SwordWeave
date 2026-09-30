import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  save: vi.fn(), preview: vi.fn(), log: vi.fn(), max: vi.fn(), package: vi.fn(), workspace: vi.fn(), availability: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect: async () => ({ userId: "owner" }) } }));
vi.mock("@/lib/character/workspace/drafts", () => ({
  saveWorkspaceDraft: mock.save, previewWorkspaceDraft: mock.preview,
  workspaceBuildFingerprint: vi.fn(), getWorkspaceDraft: vi.fn(), applyWorkspaceDraft: vi.fn(), discardWorkspaceDraft: vi.fn(), undoWorkspaceDraft: vi.fn(),
}));
vi.mock("@/lib/character/workspace/draft-sheet", () => ({ readDraftSheet: vi.fn() }));
vi.mock("@/lib/cache/character-resolver-cache", () => ({ bustResolverCache: vi.fn() }));
vi.mock("@/lib/character/resolve-character-access", () => ({ resolveCharacterAccess: async () => ({ character: { currentVitality: 30 } }) }));
vi.mock("@/lib/character/mutation-transaction", () => ({ withCharacterMutation: async (_id: string, work: () => unknown) => work() }));
vi.mock("@/lib/character/character-log", () => ({ appendCharacterLog: mock.log }));
vi.mock("@/lib/character/character-vitality", () => ({ loadCharacterMaxVitality: mock.max, clampVitality: (n: number, max: number) => Math.max(0, Math.min(n, max)) }));
vi.mock("@/lib/character/workspace/read", () => ({ readWorkspace: mock.workspace }));
vi.mock("@/lib/character/workspace/model", () => ({ supplyPaths: () => [], effectiveAvailability: mock.availability }));
vi.mock("@/lib/character/consequences/package", () => ({ consequencePackage: mock.package }));
vi.mock("@/db/client", () => ({ db: {
  query: { characterCapabilities: { findFirst: async () => ({ capability: { name: "Strike" } }) } },
  select: () => ({ from: () => ({ where: async () => [] }) }),
} }));
import { PUT } from "../[id]/workspace/draft/route";
import { POST } from "../[id]/capabilities/[capabilityId]/trigger/route";
const context = { params: Promise.resolve({ id: "character", capabilityId: "cap" }) };
const request = (body: object) => new Request("https://example.test", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.save.mockResolvedValue({ id: "draft", version: 4 });
  mock.preview.mockResolvedValue({ revision: 7, applied: false });
  mock.package.mockReturnValue({ pieces: [], vitalityDelta: 0 });
  mock.availability.mockReturnValue({ available: true });
  mock.max.mockResolvedValue({ max: 100 });
  mock.workspace.mockResolvedValue({ nodes: [], edges: [] });
});
describe("combined draft review", () => {
  it("saves and checks the returned version in one request", async () => {
    const response = await PUT(request({ review: true }), context);
    expect(await response.json()).toEqual({ draft: { id: "draft", version: 4 }, preview: { revision: 7, applied: false } });
    expect(mock.preview).toHaveBeenCalledWith("character", "owner", "draft", 4);
  });
  it("returns the committed draft version even when checking fails", async () => {
    mock.preview.mockRejectedValueOnce(new Error("Referenced rule changed"));
    const response = await PUT(request({ review: true }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ draft: { id: "draft", version: 4 }, previewError: "Referenced rule changed" });
  });
  it("does not run a preview for ordinary saves or a rejected save", async () => {
    await PUT(request({}), context);
    expect(mock.preview).not.toHaveBeenCalled();
    mock.save.mockRejectedValueOnce(new Error("Version changed"));
    expect((await PUT(request({ review: true }), context)).status).toBe(400);
    expect(mock.preview).not.toHaveBeenCalled();
  });
});
describe("single-request capability trigger", () => {
  it("logs a simple trigger without computing a redundant vitality preview", async () => {
    const response = await POST(request({ previewIfRequired: true }), context);
    expect(response.status).toBe(200);
    expect((await response.json()).capability.id).toBe("cap");
    expect(mock.workspace).toHaveBeenCalledTimes(1);
    expect(mock.max).not.toHaveBeenCalled();
    expect(mock.log).toHaveBeenCalledTimes(1);
  });
  it("returns a confirmation preview without triggering a consequence package", async () => {
    mock.package.mockReturnValue({ pieces: [{ id: 1 }], vitalityDelta: -5 });
    const response = await POST(request({ previewIfRequired: true }), context);
    expect((await response.json()).preview).toMatchObject({ previous: 30, next: 25, currentVitality: 30, max: 100 });
    expect(mock.log).not.toHaveBeenCalled();
  });
  it("keeps the existing rejection for callers that do not request a preview", async () => {
    mock.package.mockReturnValue({ pieces: [{ id: 1 }] });
    expect((await POST(request({}), context)).status).toBe(409);
    expect(mock.log).not.toHaveBeenCalled();
  });
  it("never triggers or previews an unavailable capability", async () => {
    mock.availability.mockReturnValue({ available: false, reasons: ["Disabled"] });
    expect((await POST(request({ previewIfRequired: true }), context)).status).toBe(409);
    expect(mock.package).not.toHaveBeenCalled();
    expect(mock.log).not.toHaveBeenCalled();
  });
});
