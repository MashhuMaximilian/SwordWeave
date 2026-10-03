import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  engagement: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/publishing/library-query", () => ({ queryLibrary: mocks.query }));
vi.mock("@/lib/auth/author-resolver", () => ({ resolveUserIdByClerkId: async () => "viewer" }));
vi.mock("@/lib/engagement/library-engagement", () => ({ loadLibraryEngagement: mocks.engagement }));
vi.mock("@/lib/engagement/library-viewer-state", () => ({ applyViewerEngagement: (items: unknown[]) => items }));
import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "signed-in-author" });
  mocks.query.mockResolvedValue({ items: [], total: 0 });
  mocks.engagement.mockResolvedValue({});
});

describe("creation picker visibility", () => {
  it("keeps public pickers public while retaining viewer engagement", async () => {
    const response = await GET(new NextRequest("http://localhost/api/library?publicOnly=1&targetType=LINEAGE_TEMPLATE"));
    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[0]![0]).not.toHaveProperty("viewerClerkId");
    expect(mocks.query.mock.calls[0]![0].targetType).toBe("LINEAGE_TEMPLATE");
    expect(mocks.engagement).toHaveBeenCalledWith("viewer", []);
  });

  it("preserves owned and followed entries for normal signed-in browsing", async () => {
    await GET(new NextRequest("http://localhost/api/library?targetType=ITEM"));
    expect(mocks.query.mock.calls[0]![0].viewerClerkId).toBe("signed-in-author");
  });
});
