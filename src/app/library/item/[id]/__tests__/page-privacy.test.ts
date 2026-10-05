import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { getTableName } from "drizzle-orm";
const mocks = vi.hoisted(() => ({
  viewer: null as string | null,
  visibleEntries: vi.fn(),
  capability: vi.fn(), heritage: vi.fn(), effect: vi.fn(), item: vi.fn(), primitive: vi.fn(),
  effectPrimitives: vi.fn(), effectEdges: vi.fn(), itemPrimitives: vi.fn(), itemEffects: vi.fn(), itemCapabilities: vi.fn(),
  select: vi.fn(), source: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: mocks.viewer }) }));
vi.mock("@/db/client", () => ({ db: {
  query: {
    capabilities: { findFirst: mocks.capability }, heritage: { findFirst: mocks.heritage },
    effects: { findFirst: mocks.effect }, items: { findFirst: mocks.item }, primitives: { findFirst: mocks.primitive },
    effectPrimitives: { findMany: mocks.effectPrimitives }, effectEffects: { findMany: mocks.effectEdges },
    itemPrimitives: { findMany: mocks.itemPrimitives }, itemEffects: { findMany: mocks.itemEffects }, itemCapabilities: { findMany: mocks.itemCapabilities },
  }, select: mocks.select,
} }));
vi.mock("@/lib/collections/service", () => ({ visibleEntries: mocks.visibleEntries }));
vi.mock("@/lib/publishing/visibility", () => ({ checkVisibility: async () => ({ allowed: true }) }));
vi.mock("@/lib/auth/author-resolver", () => ({ resolveAuthorByClerkId: async () => null, resolveUserIdByClerkId: async () => "internal-viewer" }));
vi.mock("@/lib/publishing/fork-lineage", () => ({ getForkSource: mocks.source }));
vi.mock("@/lib/engagement/flags-service", () => ({ getFlagAggregate: async () => ({}), listFlagNotes: async () => [] }));
vi.mock("@/lib/versions/bulk-resolve-latest-version-numbers", () => ({ bulkResolveLatestVersionNumbers: async () => new Map() }));
vi.mock("@/lib/versions/bulk-compute-bu-cost", () => ({ bulkComputeEffectBuCost: async () => new Map(), bulkComputeCapabilityBuCost: async () => new Map() }));
vi.mock("@/components/preview/entity-preview", () => ({ EntityPreview: () => null }));
vi.mock("@/components/engagement/like-fork-bar", () => ({ LikeForkBar: () => null }));
vi.mock("@/components/engagement/forks-list", () => ({ ForksList: () => null }));
vi.mock("@/components/engagement/fork-map-button", () => ({ ForkMapButton: () => null }));
vi.mock("@/components/engagement/flag-and-fork-footer", () => ({ FlagAndForkFooter: () => null }));
import LibraryItemPage from "../page";

const publicPrimitive = { id: 1, name: "Visible primitive", buCost: 2, category: "COMBAT" };
const privatePrimitive = { id: 2, name: "Secret primitive", buCost: 7, category: "COMBAT" };
const common = { userId: "author", isPublic: true, tags: [], sourceOrigin: "Public book", name: "Public parent", type: "PASSIVE", sourceType: "CHARACTER", verboseDescription: "Public parent description", narrativeDescription: "Public parent narrative" };
let flatRows: Record<string, unknown[]>;
const key = (reference: { targetType: string; targetId: string }) => `${reference.targetType}:${reference.targetId}`;
function permissions(allowed: string[]) {
  mocks.visibleEntries.mockImplementation(async (refs: { targetType: string; targetId: string }[]) => refs.filter(ref => allowed.includes(key(ref))));
}
function serialise(value: unknown) { return JSON.stringify(value, (_key, entry) => isValidElement(entry) ? entry.props : entry); }
async function detail(type: string): Promise<ReactElement<Record<string, unknown>>> {
  const result = await LibraryItemPage({ params: Promise.resolve({ id: `${type}:${type === "PRIMITIVE" ? "1" : "parent"}` }) });
  const component = result.type as (props: typeof result.props) => Promise<ReactElement<Record<string, unknown>>>;
  return component(result.props);
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.viewer = null; flatRows = {};
  mocks.source.mockResolvedValue(null);
  mocks.select.mockImplementation(() => {
    let tableName = "";
    const query = {
      from: (table: Parameters<typeof getTableName>[0]) => { tableName = getTableName(table); return query; },
      innerJoin: () => query,
      where: () => Promise.resolve(flatRows[tableName] ?? []),
    };
    // Join chaining precedes where; aggregation queries also use this shape.
    return query;
  });
  permissions(["PRIMITIVE:1", "CAPABILITY:visible-cap", "EFFECT:visible-effect"]);
});
describe("source page child permissions", () => {
  it("redacts direct and transitive capability components while preserving the real BU total", async () => {
    mocks.capability.mockResolvedValue({ ...common, id: "parent", primitiveLinks: [
      { capabilityId: "parent", primitiveId: 1, primitive: publicPrimitive, quantity: 1, role: "DIRECT" },
      { capabilityId: "parent", primitiveId: 2, primitive: privatePrimitive, quantity: 1, role: "DIRECT" },
    ], effectLinks: [
      { capabilityId: "parent", effectId: "visible-effect", effect: { id: "visible-effect", name: "Visible effect" } },
      { capabilityId: "parent", effectId: "secret-effect", effect: { id: "secret-effect", name: "Secret effect" } },
    ] });
    flatRows["effect_primitives"] = [
      { effectId: "visible-effect", primitiveId: 1, quantity: 1, name: publicPrimitive.name, buCost: 2 },
      { effectId: "visible-effect", primitiveId: 2, quantity: 1, name: privatePrimitive.name, buCost: 7 },
      { effectId: "secret-effect", primitiveId: 3, quantity: 1, name: "Secret transitive primitive", buCost: 5 },
    ];
    const view = await detail("CAPABILITY");
    expect(view.props["buCost"]).toBe(14);
    const serialized = serialise(view);
    expect(serialized).toContain("Visible primitive");
    expect(serialized).toContain("Visible effect");
    expect(serialized).not.toContain("Secret");
    expect(serialized).not.toContain("secret-effect");
    expect(mocks.visibleEntries).toHaveBeenCalledTimes(1);
    expect(mocks.visibleEntries.mock.calls[0]?.[1]).toBeNull();
  });

  it("redacts nested capability maps on heritage and item pages with a single batch", async () => {
    const capabilities = [
      { capabilityId: "visible-cap", capability: { id: "visible-cap", name: "Visible capability", type: "PASSIVE" } },
      { capabilityId: "secret-cap", capability: { id: "secret-cap", name: "Secret capability", type: "PASSIVE" } },
    ];
    flatRows["capability_primitives"] = [
      { capabilityId: "visible-cap", primitiveId: 1, quantity: 1, name: publicPrimitive.name, buCost: 2 },
      { capabilityId: "visible-cap", primitiveId: 2, quantity: 1, name: privatePrimitive.name, buCost: 7 },
      { capabilityId: "secret-cap", primitiveId: 3, quantity: 1, name: "Secret cap primitive", buCost: 5 },
    ];
    flatRows["capability_effects"] = [
      { capabilityId: "visible-cap", effectId: "secret-effect", effectName: "Secret effect", primitiveId: 4, quantity: 1, name: "Secret effect primitive", buCost: 3 },
    ];
    mocks.heritage.mockResolvedValue({ ...common, id: "parent", kind: "LINEAGE", primitiveLinks: [], capabilityLinks: capabilities });
    const heritage = await detail("LINEAGE_TEMPLATE");
    expect(heritage.props["buCost"]).toBe(17);
    expect(serialise(heritage)).toContain("Visible capability");
    expect(serialise(heritage)).not.toContain("Secret");
    expect(mocks.visibleEntries).toHaveBeenCalledTimes(1);
    mocks.visibleEntries.mockClear();
    mocks.item.mockResolvedValue({ ...common, id: "parent", buCost: 0, rarity: "COMMON" });
    mocks.itemPrimitives.mockResolvedValue([]); mocks.itemEffects.mockResolvedValue([]); mocks.itemCapabilities.mockResolvedValue(capabilities);
    const item = await detail("ITEM");
    expect(item.props["buCost"]).toBe(17);
    expect(serialise(item)).not.toContain("Secret");
    expect(mocks.visibleEntries).toHaveBeenCalledTimes(1);
  });

  it("omits hidden effect parents, nested child narrative, and hidden primitives", async () => {
    mocks.viewer = "follower";
    mocks.effect.mockResolvedValue({ ...common, id: "parent" });
    mocks.effectPrimitives.mockResolvedValue([{ effectId: "parent", primitiveId: 2, quantity: 1, primitive: privatePrimitive }]);
    mocks.effectEdges.mockResolvedValueOnce([
      { childEffectId: "visible-effect", childEffect: { id: "visible-effect", name: "Visible nested effect", narrativeDescription: "Visible narrative", primitiveLinks: [
        { primitiveId: 1, primitive: publicPrimitive, quantity: 1 }, { primitiveId: 2, primitive: privatePrimitive, quantity: 1 },
      ] } },
      { childEffectId: "secret-child", childEffect: { id: "secret-child", name: "Secret child", narrativeDescription: "Secret child narrative", primitiveLinks: [] } },
    ]).mockResolvedValueOnce([{ parentEffectId: "secret-parent", parentEffect: { id: "secret-parent", name: "Secret parent", narrativeDescription: "Secret parent narrative" } }]);
    const view = await detail("EFFECT");
    expect(view.props["buCost"]).toBe(7);
    expect(serialise(view)).toContain("Visible nested effect");
    expect(serialise(view)).not.toContain("Secret");
    expect(serialise(view)).not.toContain("secret-parent");
    expect(mocks.visibleEntries).toHaveBeenCalledTimes(1);
    expect(mocks.visibleEntries.mock.calls[0]?.[1]).toBe("follower");
  });

  it("hides an inaccessible fork source and raw fork-origin details", async () => {
    mocks.primitive.mockResolvedValue({ ...common, ...publicPrimitive, sourceOrigin: "fork:PRIMITIVE:2:Secret original" });
    mocks.source.mockResolvedValue({ sourceTargetType: "PRIMITIVE", sourceTargetId: "2", sourceAuthorUsername: "Secret author", forkedAt: new Date() });
    const view = await detail("PRIMITIVE");
    expect(view.props["forkSource"]).toBeNull();
    expect(view.props["sourceOrigin"]).toBeNull();
    expect(serialise(view)).not.toContain("Secret");
  });

  it("preserves child details for an authorized viewer", async () => {
    mocks.viewer = "owner";
    permissions(["PRIMITIVE:2"]);
    mocks.capability.mockResolvedValue({ ...common, id: "parent", primitiveLinks: [{ capabilityId: "parent", primitiveId: 2, primitive: privatePrimitive, quantity: 1, role: "DIRECT" }], effectLinks: [] });
    const view = await detail("CAPABILITY");
    expect(serialise(view)).toContain("Secret primitive");
    expect(mocks.visibleEntries.mock.calls[0]?.[1]).toBe("owner");
  });
});
