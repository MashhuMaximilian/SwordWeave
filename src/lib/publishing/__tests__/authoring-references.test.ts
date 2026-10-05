import { beforeEach, describe, it, expect, vi } from "vitest";
const { execute, visible } = vi.hoisted(() => ({
  execute: vi.fn(),
  visible: vi.fn(),
}));
vi.mock("@/db/client", () => ({ db: { execute } }));
vi.mock("@/lib/collections/service", () => ({ visibleEntries: visible }));
import {
  assertAuthoringReferenceAccess,
  authoringReferences,
} from "../assert-authoring-references";
beforeEach(() => {
  vi.resetAllMocks();
  execute.mockResolvedValue({ rows: [] });
  visible.mockResolvedValue([]);
});
describe("new authoring component attachments", () => {
  it("rejects private newly attached components even when a sourceId is supplied", async () => {
    await expect(
      assertAuthoringReferenceAccess(
        new Request("https://test/api/effects", { method: "POST" }),
        "EFFECT",
        { sourceId: "borrowed", primitiveIds: [7] },
        "actor",
      ),
    ).rejects.toThrow("private");
    expect(execute).not.toHaveBeenCalled();
    expect(visible).toHaveBeenCalledWith(
      [{ targetType: "EFFECT", targetId: "borrowed" }],
      "actor",
    );
  });
  it("preserves actual existing private links on an accessible edited parent", async () => {
    visible.mockResolvedValueOnce([
      { targetType: "EFFECT", targetId: "parent" },
    ]);
    execute.mockResolvedValueOnce({ rows: [{ id: "7" }] });
    await expect(
      assertAuthoringReferenceAccess(
        new Request("https://test/api/effects/parent", { method: "PATCH" }),
        "EFFECT",
        { primitiveIds: [7] },
        "actor",
      ),
    ).resolves.toBeUndefined();
    expect(visible).toHaveBeenCalledTimes(1);
  });
  it("preserves actual pinned links when forking a readable parent", async () => {
    visible.mockResolvedValueOnce([
      { targetType: "EFFECT", targetId: "parent" },
    ]);
    execute.mockResolvedValueOnce({ rows: [{ id: "7" }] });
    await expect(
      assertAuthoringReferenceAccess(
        new Request("https://test/api/effects", { method: "POST" }),
        "EFFECT",
        { sourceId: "parent", primitiveIds: [7] },
        "actor",
      ),
    ).resolves.toBeUndefined();
    expect(visible).toHaveBeenCalledTimes(1);
  });
  it("rejects an additional hidden attachment while keeping prior links", async () => {
    visible
      .mockResolvedValueOnce([{ targetType: "EFFECT", targetId: "parent" }])
      .mockResolvedValueOnce([]);
    execute.mockResolvedValueOnce({ rows: [{ id: "7" }] });
    await expect(
      assertAuthoringReferenceAccess(
        new Request("https://test/api/effects/parent", { method: "PATCH" }),
        "EFFECT",
        { primitiveIds: [7, 8] },
        "actor",
      ),
    ).rejects.toThrow("private");
    expect(visible).toHaveBeenLastCalledWith(
      [{ targetType: "PRIMITIVE", targetId: "8" }],
      "actor",
    );
  });
  it("accepts independently readable flat and slot references and deduplicates", async () => {
    const data = {
      primitiveIds: [7],
      primitiveSlots: [{ primitiveId: 7 }, { primitiveId: 8 }],
      effectSlots: [{ effectId: "effect" }],
    };
    visible.mockImplementation(async (refs) => refs);
    await expect(
      assertAuthoringReferenceAccess(
        new Request("https://test/api/items", { method: "POST" }),
        "ITEM",
        data,
        "actor",
      ),
    ).resolves.toBeUndefined();
    expect(authoringReferences(data)).toHaveLength(3);
  });
});
