import { describe, it, expect, vi } from "vitest";
vi.mock("@/db/client", () => ({ db: {}, withDatabaseTransaction: vi.fn() }));
vi.mock("@/lib/publishing/library-query", () => ({
  visibilityCondition: vi.fn(),
}));
import { collectionReadable, wouldCreateCycle } from "../service";
describe("independent collection access", () => {
  it("allows anonymous access only to public collections", () => {
    expect(collectionReadable("PUBLIC", "owner", null, false)).toBe(true);
    expect(collectionReadable("PRIVATE", "owner", null, false)).toBe(false);
    expect(collectionReadable("FOLLOWERS_ONLY", "owner", null, true)).toBe(
      false,
    );
  });
  it("requires a follower for follower collections and never grants private access to followers", () => {
    expect(collectionReadable("FOLLOWERS_ONLY", "owner", "viewer", true)).toBe(
      true,
    );
    expect(collectionReadable("FOLLOWERS_ONLY", "owner", "viewer", false)).toBe(
      false,
    );
    expect(collectionReadable("PRIVATE", "owner", "viewer", true)).toBe(false);
  });
  it("always permits the owner", () => {
    for (const v of ["PUBLIC", "PRIVATE", "FOLLOWERS_ONLY"])
      expect(collectionReadable(v, "owner", "owner", false)).toBe(true);
  });
});
describe("collection hierarchy", () => {
  const nodes = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
  ];
  it("rejects itself and any descendant as a new parent", () => {
    expect(wouldCreateCycle("a", "a", nodes)).toBe(true);
    expect(wouldCreateCycle("a", "c", nodes)).toBe(true);
    expect(wouldCreateCycle("b", "c", nodes)).toBe(true);
  });
  it("allows moving to the root or an ancestor", () => {
    expect(wouldCreateCycle("c", null, nodes)).toBe(false);
    expect(wouldCreateCycle("c", "a", nodes)).toBe(false);
  });
  it("terminates safely even with an existing corrupt cycle", () => {
    expect(
      wouldCreateCycle("x", "a", [
        { id: "a", parentId: "b" },
        { id: "b", parentId: "a" },
      ]),
    ).toBe(true);
  });
});
