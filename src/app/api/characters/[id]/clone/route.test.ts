import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const inserted: unknown[] = [];
  const source = {
    id: "source",
    name: "Test Hero",
    size: "MEDIUM",
    level: 4,
    attrPhysical: 4,
    attrMental: 3,
    attrMagical: 3,
    attrProficient: "PHYSICAL",
    practiceSlices: {},
    currentVitality: 22,
    startingBu: 25,
    buSpent: 30,
    dmBonusBu: 0,
    enforceTemplateCaps: false,
    isMirrored: false,
    backstory: { origin: "A copied history" },
    mode: "BUILD",
    portraitFrame: { x: 50, y: 50, zoom: 1 },
    primitiveLinks: [{
      primitiveId: 42,
      source: "LINEAGE",
      directSource: "PERSONAL",
      acquiredAtLevel: 2,
      isMirrored: true,
      versionId: "primitive-version",
      slotSource: "FORKED",
      originHeritageId: "heritage",
      originCapabilityId: "capability",
      originEffectId: "effect",
      originItemId: null,
      notes: "mirrored",
    }],
    capabilityLinks: [{
      capabilityId: "capability",
      acquiredAtLevel: 2,
      versionId: "capability-version",
      slotSource: "PINNED",
      originHeritageId: "heritage",
      slotTab: "LINEAGE",
      notes: "capability note",
    }],
    heritageLinks: [{
      heritageId: "heritage",
      acquiredAtLevel: 1,
      isMirrored: true,
      versionId: "heritage-version",
      slotSource: "OWNED",
      notes: "heritage note",
    }],
    itemLinks: [{
      itemId: "item",
      quantity: 2,
      equipped: true,
      versionId: "item-version",
      slotSource: "PINNED",
    }],
  };
  return { inserted, source };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: { protect: async () => ({ userId: "copy-owner" }) },
}));
vi.mock("@/db/client", () => ({
  db: {
    query: { characters: { findFirst: async () => mock.source } },
    transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
      insert: () => ({
        values: (row: unknown) => {
          mock.inserted.push(row);
          return { returning: async () => [{ id: "copy" }] };
        },
      }),
      query: { characters: { findFirst: async () => ({ id: "copy" }) } },
    }),
  },
}));

import { POST } from "./route";

beforeEach(() => { mock.inserted.length = 0; });

describe("character clone", () => {
  it("preserves the source build's pinned slots, mirrors, origins, and heritage links", async () => {
    const response = await POST(
      new Request("https://example.test/api/characters/source/clone", { method: "POST" }),
      { params: Promise.resolve({ id: "source" }) },
    );

    expect(response.status).toBe(201);
    expect(mock.inserted).toHaveLength(5);
    expect(mock.inserted[0]).toMatchObject({
      userId: "copy-owner",
      name: "Test Hero (Copy)",
      backstory: { origin: "A copied history" },
      mode: "BUILD",
      isPublic: false,
    });
    expect(mock.inserted[1]).toEqual([{ characterId: "copy", ...mock.source.primitiveLinks[0] }]);
    expect(mock.inserted[2]).toEqual([{ characterId: "copy", ...mock.source.capabilityLinks[0] }]);
    expect(mock.inserted[3]).toEqual([{ characterId: "copy", ...mock.source.heritageLinks[0] }]);
    expect(mock.inserted[4]).toEqual([{ characterId: "copy", ...mock.source.itemLinks[0] }]);
  });
});
