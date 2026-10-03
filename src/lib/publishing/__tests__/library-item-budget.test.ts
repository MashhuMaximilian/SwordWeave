import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", async () => {
  const { items } = await import("@/db/schema");
  const rows = [{ id: "kit", name: "Kit", buCost: 2, itemType: "TRINKET", createdAt: new Date(), tags: [] }];
  return { db: {
    query: { users: { findMany: async () => [] } },
    execute: async () => ({ rows: [
      { owner_id: "kit", primitive_id: 1, primitive_name: "Preparation", bu_cost: 2, quantity: 1, path: ["Item", "Kit", "Primitive", "Preparation"], container_types: [], container_ids: [], container_names: [] },
      // The same rule is also reachable through a capability; don't buy it twice.
      { owner_id: "kit", primitive_id: 1, primitive_name: "Preparation", bu_cost: 2, quantity: 1, path: ["Item", "Kit", "Capability", "Care", "Primitive", "Preparation"], container_types: ["CAPABILITY"], container_ids: ["care"], container_names: ["Care"] },
    ] }),
    select: () => {
      let source: unknown;
      const chain = {
        from: (table: unknown) => { source = table; return chain; },
        where: () => chain, innerJoin: () => chain, leftJoin: () => chain,
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(source === items ? rows : []).then(resolve),
      };
      return chain;
    },
  } };
});
vi.mock("@/lib/engagement/engagement-aggregates", () => ({ resolveEngagementMap: async () => new Map() }));
vi.mock("@/lib/engagement/library-flag-counts", () => ({ loadLibraryFlagCounts: async () => new Map() }));
import { queryLibrary } from "../library-query";

describe("item picker budgets", () => {
  it("filters and displays complete item cost, including one purchase of a shared rule", async () => {
    const result = await queryLibrary({ targetType: "ITEM", minBu: 3, maxBu: 4, sort: "BU" });
    expect(result.total).toBe(1);
    expect(result.items[0]?.buCost).toBe(4);
  });
  it("excludes an item when only its extra cost fits the limit", async () => {
    const result = await queryLibrary({ targetType: "ITEM", maxBu: 2 });
    expect(result.total).toBe(0);
  });
});
