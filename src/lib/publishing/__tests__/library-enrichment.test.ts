import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorReads: vi.fn(),
  engagementReads: vi.fn(),
}));
vi.mock("@/db/client", async () => {
  const { builds } = await import("@/db/schema");
  const rows = [
    { id: "new", name: "New", userId: "community", startingBu: 10, createdAt: new Date("2026-09-30") },
    { id: "popular", name: "Popular", userId: "staff", startingBu: 50, createdAt: new Date("2026-09-01") },
  ];
  return { db: {
    query: { users: { findMany: state.authorReads } },
    select: () => {
      let source: unknown;
      const chain = {
        from: (table: unknown) => { source = table; return chain; },
        where: () => chain,
        leftJoin: () => chain,
        limit: async () => source === builds ? rows : [],
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(source === builds ? rows : []).then(resolve),
      };
      return chain;
    },
  } };
});
vi.mock("@/lib/engagement/engagement-aggregates", () => ({ resolveEngagementMap: state.engagementReads }));
import { queryLibrary } from "../library-query";

beforeEach(() => {
  vi.clearAllMocks();
  state.authorReads.mockResolvedValue([
    { clerkUserId: "staff", username: "staff", isAdmin: true },
    { clerkUserId: "community", username: "author", isAdmin: false },
  ]);
  state.engagementReads.mockResolvedValue(new Map([
    ["BUILD_TEMPLATE:popular", { likes: 10, dislikes: 1, forks: 3 }],
    ["BUILD_TEMPLATE:new", { likes: 1, dislikes: 0, forks: 0 }],
  ]));
});

describe("batched library enrichment", () => {
  it("enriches before sorting and pagination", async () => {
    const result = await queryLibrary({ targetType: "BUILD_TEMPLATE", limit: 1 });
    expect(result.total).toBe(2);
    expect(result.items[0]).toMatchObject({ targetId: "popular", likesCount: 10, forkCount: 3, authorIsAdmin: true });
    expect(state.authorReads).toHaveBeenCalledTimes(1);
    expect(state.engagementReads).toHaveBeenCalledTimes(1);
  });

  it("applies system origin and engagement filters using enriched metadata", async () => {
    const result = await queryLibrary({ targetType: "BUILD_TEMPLATE", origin: "system", minLikes: 5, hasForks: true });
    expect(result.items.map(item => item.targetId)).toEqual(["popular"]);
  });

  it("filters BU before slicing and sorts BU independently of engagement", async () => {
    const result = await queryLibrary({ targetType: "BUILD_TEMPLATE", sort: "BU", minBu: 0, maxBu: 20, limit: 1 });
    expect(result.total).toBe(1);
    expect(result.items[0]?.targetId).toBe("new");
  });
  it("filters inclusive dates and minimum forks across the complete result", async () => {
    const result = await queryLibrary({ targetType: "BUILD_TEMPLATE", fromDate: "2026-09-01", toDate: "2026-09-01", minForks: 3 });
    expect(result.items.map(item => item.targetId)).toEqual(["popular"]);
  });
  it("batches metadata across the full type union", async () => {
    await queryLibrary({});
    expect(state.authorReads).toHaveBeenCalledTimes(1);
    expect(state.engagementReads).toHaveBeenCalledTimes(1);
  });
});
