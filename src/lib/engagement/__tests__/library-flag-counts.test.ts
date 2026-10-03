import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ reads: vi.fn(), rows: [] as unknown[] }));
vi.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: async () => { state.reads(); return state.rows; } }) }) } }));
import { loadLibraryFlagCounts } from "../library-flag-counts";
import { resolveVirtualVersionId } from "../version-helpers";
beforeEach(() => { vi.clearAllMocks(); state.rows = []; });
describe("batched card flag counts", () => {
  it("uses exactly one read and only the same virtual version as the card API", async () => {
    state.rows = [
      {targetType: "PRIMITIVE", targetId: "1", versionId: resolveVirtualVersionId("PRIMITIVE", "1"), unbalanced: 1, broken: 2, inappropriate: 0, duplicate: 0, other: 3},
      {targetType: "PRIMITIVE", targetId: "1", versionId: "old-version", unbalanced: 99, broken: 0, inappropriate: 0, duplicate: 0, other: 0},
      {targetType: "ITEM", targetId: "1", versionId: resolveVirtualVersionId("PRIMITIVE", "1"), unbalanced: 99, broken: 0, inappropriate: 0, duplicate: 0, other: 0},
    ];
    const counts = await loadLibraryFlagCounts([{id:"PRIMITIVE:1",targetType:"PRIMITIVE",targetId:"1"}, {id:"ITEM:2",targetType:"ITEM",targetId:"2"}]);
    expect(counts.get("PRIMITIVE:1")).toBe(6);
    expect(counts.has("ITEM:2")).toBe(false);
    expect(state.reads).toHaveBeenCalledTimes(1);
  });
  it("does not read for empty results", async () => {
    expect((await loadLibraryFlagCounts([])).size).toBe(0);
    expect(state.reads).not.toHaveBeenCalled();
  });
});
