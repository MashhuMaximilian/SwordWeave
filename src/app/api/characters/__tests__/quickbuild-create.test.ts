import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  heritage,
  heritagePrimitives,
  heritageCapabilities,
  primitives,
  characters,
  characterPrimitives,
  characterHeritages,
  items,
} from "@/db/schema";
const mocks = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  writes: vi.fn(),
  volatility: vi.fn(),
  created: null as Record<string, unknown> | null,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: { protect: async () => ({ userId: "creator" }) },
}));
vi.mock("@/lib/api/volatility", () => ({
  validateMirrorSet: mocks.volatility,
}));
vi.mock("@/lib/publishing/auto-publish", () => ({
  autoPublishOnCreate: vi.fn(),
}));
vi.mock("@/lib/auth/author-resolver", () => ({
  resolveUserIdByClerkId: async () => null,
}));
vi.mock("@/lib/versions/slot-source", () => ({
  resolveLatestVersionId: async () => "pinned-version",
  resolveSlotSource: () => "PINNED",
}));
vi.mock("@/db/client", () => {
  const select = () => ({
    from: (table: unknown) => ({
      where: async () => mocks.rows.get(table) ?? [],
    }),
  });
  const insert = (table: unknown) => ({
    values: (values: unknown) => {
      mocks.writes(table, values);
      if (table === characters)
        mocks.created = { id: "created", ...(values as object) };
      return { returning: async () => [mocks.created] };
    },
  });
  const tx = {
    select,
    insert,
    query: { characters: { findFirst: async () => mocks.created } },
  };
  return {
    db: {
      select,
      transaction: async (work: (tx: unknown) => unknown) => work(tx),
    },
  };
});
import { POST } from "../route";
const request = (overrides: object = {}) =>
  new Request("http://localhost/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creationMode: "quick",
      name: "Tavi",
      level: 1,
      startingBu: 25,
      attrPhysical: 4,
      attrMental: 3,
      attrMagical: 3,
      attrProficient: "PHYSICAL",
      heritages: [{ id: "lineage" }],
      buSpent: 999,
      size: "HUGE",
      ...overrides,
    }),
  });
beforeEach(() => {
  mocks.rows.clear();
  mocks.writes.mockClear();
  mocks.created = null;
  mocks.volatility.mockResolvedValue({ ok: true });
  mocks.rows.set(heritage, [
    {
      id: "lineage",
      kind: "LINEAGE",
      name: "Hearthspark",
      defaultSize: "SMALL",
      isPublic: true,
      imageUrl: "/image.webp",
      description: "Compact",
    },
  ]);
  mocks.rows.set(heritagePrimitives, [
    { templateId: "lineage", primitiveId: 1, isMirrored: false },
  ]);
  mocks.rows.set(heritageCapabilities, []);
  mocks.rows.set(primitives, [
    { id: 1, buCost: 6, mirrorBuCredit: 2, userId: null, isPublic: true },
  ]);
});
describe("Quickbuild creation API", () => {
  it("uses lineage size and authoritative costs instead of caller values, preserving pins", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.created).toMatchObject({
      size: "SMALL",
      buSpent: 6,
      startingBu: 25,
      lineageName: "Hearthspark",
      lineageImageUrl: "/image.webp",
    });
    expect(
      mocks.writes.mock.calls.find(
        (call) => call[0] === characterPrimitives,
      )?.[1],
    ).toEqual([
      expect.objectContaining({
        primitiveId: 1,
        versionId: "pinned-version",
        originHeritageId: "lineage",
        isMirrored: false,
      }),
    ]);
    expect(
      mocks.writes.mock.calls.find(
        (call) => call[0] === characterHeritages,
      )?.[1],
    ).toEqual([
      expect.objectContaining({
        heritageId: "lineage",
        versionId: "pinned-version",
      }),
    ]);
  });
  it("allows a name-only build with no roots or package and defaults to Medium", async () => {
    const response = await POST(request({ heritages: [], buSpent: 500 }));
    expect(response.status).toBe(201);
    expect(mocks.created).toMatchObject({ size: "MEDIUM", buSpent: 0 });
  });
  it("preserves explicit size and legacy cost handling in complete creation", async () => {
    const response = await POST(
      request({ creationMode: "complete", buSpent: 6, size: "LARGE" }),
    );
    expect(response.status).toBe(201);
    expect(mocks.created).toMatchObject({ size: "LARGE", buSpent: 6 });
  });
  it.each(["duplicate", "private", "missing"])(
    "rejects %s roots before any write",
    async (scenario) => {
      let body = {};
      if (scenario === "duplicate")
        body = { heritages: [{ id: "lineage" }, { id: "lineage" }] };
      if (scenario === "private")
        mocks.rows.set(heritage, [
          { id: "lineage", kind: "LINEAGE", isPublic: false },
        ]);
      if (scenario === "missing") mocks.rows.set(heritage, []);
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.writes).not.toHaveBeenCalled();
    },
  );
  it("keeps separate direct-paid and mirrored occurrences and validates mirror debt", async () => {
    const response = await POST(
      request({
        primitiveInstances: [
          { primitiveId: 1, isMirrored: false },
          { primitiveId: 1, isMirrored: true },
        ],
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.created?.["buSpent"]).toBe(12);
    const slots = mocks.writes.mock.calls.find(
      (call) => call[0] === characterPrimitives,
    )?.[1] as Array<{ isMirrored: boolean }>;
    expect(slots).toHaveLength(3);
    expect(slots.filter((p) => p.isMirrored)).toHaveLength(1);
    expect(mocks.volatility).toHaveBeenCalledWith(1, [1], [1, 1, 1]);
  });
  it("a debt violation prevents character and junction writes", async () => {
    mocks.volatility.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Debt exceeds ceiling",
    });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it("items enter inventory with pins without contributing character BU", async () => {
    mocks.rows.set(items, [{ id: "kit", userId: null, sourceOrigin: "SRD" }]);
    expect(
      (
        await POST(
          request({
            itemsBySource: { PERSONAL: [{ id: "kit", quantity: 1 }] },
          }),
        )
      ).status,
    ).toBe(201);
    expect(mocks.created?.["buSpent"]).toBe(6);
  });
});
