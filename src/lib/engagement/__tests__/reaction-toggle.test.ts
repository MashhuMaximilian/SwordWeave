import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ existing: vi.fn(), deleteRow: vi.fn(), insertRow: vi.fn(), updateRow: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
  query: { reactions: { findFirst: mocks.existing } },
  delete: () => ({ where: mocks.deleteRow }),
  update: () => ({ set: () => ({ where: mocks.updateRow }) }),
  insert: () => ({ values: mocks.insertRow }),
}) } }));
import { setReaction } from "../reactions-service";

describe("reaction toggle response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertRow.mockReturnValue({ onConflictDoUpdate: () => ({ returning: async () => [{ likesCount: 0, dislikesCount: 0 }] }) });
  });
  it.each(["LIKE", "DISLIKE"] as const)("clears selected %s when toggled off", async kind => {
    mocks.existing.mockResolvedValue({ id: "reaction", kind });
    const result = await setReaction({ userId: "viewer", targetType: "ENCOUNTER", targetId: "encounter", versionId: "version", kind });
    expect(result).toMatchObject({ liked: false, disliked: false });
    expect(mocks.deleteRow).toHaveBeenCalledOnce();
  });
  it("selects the new kind when switching reactions", async () => {
    mocks.existing.mockResolvedValue({ id: "reaction", kind: "LIKE" });
    const result = await setReaction({ userId: "viewer", targetType: "COLLECTION", targetId: "collection", versionId: "version", kind: "DISLIKE" });
    expect(result).toMatchObject({ liked: false, disliked: true });
    expect(mocks.updateRow).toHaveBeenCalledOnce();
  });
});
