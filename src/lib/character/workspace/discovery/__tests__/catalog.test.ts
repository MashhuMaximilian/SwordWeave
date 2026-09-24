import { describe, expect, it, vi } from "vitest";
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/publishing/library-query", () => ({ queryCompleteLibrary: vi.fn(), visibilityCondition: vi.fn() }));
import { loadCompleteLibraryType } from "../catalog";
import type { LibraryItem } from "@/lib/publishing/library-query";

describe("complete discovery corpus", () => {
  it("requests the complete mixed-origin corpus once with viewer identity and no search prefilter", async () => {
    const items = Array.from({ length: 251 }, (_, id) => ({ id: `PRIMITIVE:${id}`, targetId: String(id) }) as LibraryItem);
    const query = vi.fn().mockResolvedValue(items);
    const result = await loadCompleteLibraryType("PRIMITIVE", "viewer-1", query);
    expect(result).toHaveLength(251);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({ targetType: "PRIMITIVE", viewerClerkId: "viewer-1", origin: "all", sort: "ALPHABETICAL" });
  });
  it("deduplicates identical rows without collapsing independently authored entries", async () => {
    const query = vi.fn().mockResolvedValue([{ id: "PRIMITIVE:1", name: "Shield" }, { id: "PRIMITIVE:1", name: "Shield" }, { id: "PRIMITIVE:2", name: "Shield" }]);
    expect(await loadCompleteLibraryType("PRIMITIVE", "viewer", query)).toHaveLength(2);
  });
});
