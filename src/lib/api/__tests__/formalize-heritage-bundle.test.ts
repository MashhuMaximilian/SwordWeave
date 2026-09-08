import { describe, expect, it, vi } from "vitest";
import { formalizeHeritageBundle } from "../formalize-heritage-bundle";
import { characterPrimitives, characterCapabilities } from "@/db/schema";
vi.mock("@/lib/versions/slot-source", () => ({
  resolveLatestVersionId: vi.fn(async () => "version-1"),
  resolveSlotSource: vi.fn(() => "OWNED"),
}));

function fixture(existing: unknown[] = []) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> =
    [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> =
    [];
  const template = {
    id: "heritage-1",
    kind: "MANIFEST",
    primitiveLinks: [{ primitiveId: 1, isMirrored: true }],
    capabilityLinks: [
      {
        capabilityId: "cap-1",
        capability: {
          id: "cap-1",
          userId: "owner",
          primitiveLinks: [{ primitiveId: 2 }],
          effectLinks: [
            {
              effectId: "effect-1",
              effect: { primitiveLinks: [{ primitiveId: 3 }] },
            },
          ],
        },
      },
    ],
  };
  const tx = {
    query: {
      primitives: {
        findMany: vi.fn(async () =>
          [1, 2, 3].map((id) => ({ id, userId: "owner", sourceOrigin: null })),
        ),
      },
      heritage: { findFirst: vi.fn(async () => template) },
      characterPrimitives: { findMany: vi.fn(async () => existing) },
      characterCapabilities: { findMany: vi.fn(async () => []) },
    },
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
      },
    }),
  };
  return {
    tx: tx as unknown as Parameters<typeof formalizeHeritageBundle>[0],
    updates,
    inserts,
  };
}
describe("heritage formalization materialization", () => {
  it("converts a slotted primitive in place and expands capability/effect descendants", async () => {
    const f = fixture([
      {
        instanceId: "keep-instance",
        primitiveId: 1,
        isMirrored: true,
        source: "MANIFEST",
        originHeritageId: null,
        originCapabilityId: null,
        originEffectId: null,
      },
    ]);
    expect(
      await formalizeHeritageBundle(
        f.tx,
        "character",
        "heritage-1",
        "owner",
        1,
      ),
    ).toBe(3);
    expect(f.updates).toEqual([
      {
        table: characterPrimitives,
        values: {
          originHeritageId: "heritage-1",
          originCapabilityId: null,
          originEffectId: null,
        },
      },
    ]);
    const primitiveInserts = f.inserts.filter(
      (i) => i.table === characterPrimitives,
    );
    expect(primitiveInserts.map((i) => i.values["primitiveId"])).toEqual([
      2, 3,
    ]);
    expect(primitiveInserts[1]?.values["originEffectId"]).toBe("effect-1");
    expect(
      f.inserts.filter((i) => i.table === characterCapabilities),
    ).toHaveLength(1);
  });
  it("does not duplicate an existing inherited baseline", async () => {
    const f = fixture([
      {
        instanceId: "inherited",
        primitiveId: 1,
        isMirrored: true,
        source: "LINEAGE",
        originHeritageId: "other-heritage",
      },
    ]);
    await formalizeHeritageBundle(f.tx, "character", "heritage-1", "owner", 1);
    expect(f.updates).toHaveLength(0);
    expect(
      f.inserts
        .filter((i) => i.table === characterPrimitives)
        .map((i) => i.values["primitiveId"]),
    ).toEqual([2, 3]);
  });
});
