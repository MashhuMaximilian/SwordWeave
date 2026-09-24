import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), authorize: vi.fn(), execute: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { execute: mocks.execute } }));
vi.mock("@/lib/publishing/library-query", () => ({ queryCompleteLibrary: mocks.query, visibilityCondition: mocks.authorize }));
import { loadDiscoveryCatalog } from "../catalog";
function item(id: string, authorId: string) { return { id: `CAPABILITY:${id}`, targetId: id, targetType: "CAPABILITY", authorId, name: id, tags: [], buCost: 4, description: "", authorIsAdmin: false }; }
beforeEach(() => vi.clearAllMocks());
describe("discovery visibility matches character Add", () => {
  it("authorizes every candidate including explicit legacy-public compatibility", async () => {
    mocks.query.mockResolvedValue([item("null-owner-private", ""), item("legacy-explicit-public", "foreign"), item("public", "foreign"), item("owned-private", "viewer")]);
    mocks.execute.mockResolvedValue({ rows: [{ key: "CAPABILITY:null-owner-private", allowed: false }, { key: "CAPABILITY:legacy-explicit-public", allowed: true }, { key: "CAPABILITY:public", allowed: true }, { key: "CAPABILITY:owned-private", allowed: true }] });
    const result = await loadDiscoveryCatalog(["capability"], "viewer");
    expect(mocks.authorize).toHaveBeenCalledTimes(4);
    expect(result.map(candidate => candidate.name)).toEqual(["legacy-explicit-public", "public", "owned-private"]);
  });
  it("never returns a candidate the shared authorizer rejects", async () => {
    mocks.query.mockResolvedValue([item("private-stale-public-flag", "foreign"), item("unfollowed", "foreign")]);
    mocks.execute.mockResolvedValue({ rows: [{ key: "CAPABILITY:private-stale-public-flag", allowed: false }, { key: "CAPABILITY:unfollowed", allowed: false }] });
    expect(await loadDiscoveryCatalog(["capability"], "viewer")).toEqual([]);
  });
});
