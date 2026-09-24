import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ protect: vi.fn(), access: vi.fn(), catalog: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect: mocks.protect } }));
vi.mock("@/lib/character/can-resolve-character", () => ({
  canResolveCharacter: mocks.access,
  CharacterAccessDenied: class CharacterAccessDenied extends Error {},
}));
vi.mock("@/lib/character/workspace/discovery/catalog", () => ({ loadDiscoveryCatalog: mocks.catalog }));
import { CharacterAccessDenied } from "@/lib/character/can-resolve-character";
import { POST } from "../route";

const context = { params: Promise.resolve({ id: "character-1" }) };
function request(body: unknown) { return new Request("http://localhost/api/characters/character-1/workspace/suggestions", { method: "POST", body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.protect.mockResolvedValue({ userId: "viewer" }); mocks.access.mockResolvedValue({ permission: "OWNER" }); mocks.catalog.mockResolvedValue([]); });

describe("character discovery endpoint", () => {
  it("checks character access before retrieving Library content", async () => {
    mocks.access.mockRejectedValue(new CharacterAccessDenied("character-1"));
    expect((await POST(request({ budget: 25 }), context)).status).toBe(403);
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it("validates allowance and rejects malformed kinds", async () => {
    expect((await POST(request({ budget: -1 }), context)).status).toBe(400);
    expect((await POST(request({ budget: 10, kinds: ["arbitrary_table"] }), context)).status).toBe(400);
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it("allows read-only exploration for viewers without giving mutation rights", async () => {
    mocks.access.mockResolvedValue({ permission: "VIEWER" });
    const response = await POST(request({ budget: 25 }), context);
    expect(response.status).toBe(200);
    expect(mocks.catalog).toHaveBeenCalledWith(["primitive"], "viewer");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not truncate the matching corpus to the three displayed cards or first Library page", async () => {
    mocks.catalog.mockResolvedValue(Array.from({ length: 152 }, (_, id) => ({ key: `primitive:${id}`, kind: "primitive", name: `Entry ${id}`, description: "", mechanicalDescription: "Add 1 to defense", tags: [], family: "", structuredRules: "", origin: id % 2 ? "community" : "system", cost: 4, versionNumber: 1 })));
    const response = await POST(request({ budget: 25, intent: "defense" }), context);
    const data = await response.json();
    expect(data.suggestions).toHaveLength(152);
    expect(data.catalogCount).toBe(152);
  });
  it("restricts mirror discovery to primitives even when browsing bundles", async () => {
    await POST(request({ budget: 25, debtAvailable: 12, intent: "weakness", kinds: ["heritage"] }), context);
    expect(mocks.catalog).toHaveBeenCalledWith(["primitive"], "viewer");
  });
});
