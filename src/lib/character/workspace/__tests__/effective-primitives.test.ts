import { describe, expect, it, vi, beforeEach } from "vitest";
const query = vi.hoisted(() => ({ calls: 0, rows: [] as Record<string, unknown>[] }));
vi.mock("@/db/client", () => ({ db: { select: () => { query.calls++; return { from: () => ({ where: async () => query.rows }) }; } } }));
import { effectivePrimitiveDefinition, effectivePrimitiveLinks } from "../effective-primitives";
const versions = [
  { id: "old", number: 1, latest: false, deltaKind: "FULL", snapshot: { name: "Saved", buCost: 4, hardModifiers: [{ target: "vitality", operation: "add", value: 2 }] } },
  { id: "new", number: 2, latest: true, deltaKind: "FULL", snapshot: { name: "Live", buCost: 12, hardModifiers: [{ target: "vitality", operation: "add", value: 10 }] } },
];
const live = { id: 1, name: "Live", buCost: 12, hardModifiers: [{ target: "vitality", operation: "add", value: 10 }], consequenceBehavior: { kind: "new-only" } };
beforeEach(() => { query.calls = 0; query.rows = versions.map(v => ({ id: v.id, primitiveId: 1, versionNumber: v.number, isLatest: v.latest, deltaKind: v.deltaKind, snapshot: v.snapshot })); });
describe("shared pinned primitive overlay", () => {
  it("uses the same saved mechanics for Play and draft resolver input", () => {
    const result = effectivePrimitiveDefinition(live, "old", versions);
    expect(result.name).toBe("Saved"); expect(result.buCost).toBe(4);
    expect(result.hardModifiers).toEqual(versions[0]!.snapshot.hardModifiers);
    expect(result.consequenceBehavior).toBeNull();
    expect(live.name).toBe("Live");
  });
  it("resolves differing pins per occurrence with one batched database query", async () => {
    const result = await effectivePrimitiveLinks([
      { primitiveId: 1, versionId: "old", instanceId: "a", primitive: live },
      { primitiveId: 1, versionId: "new", instanceId: "b", primitive: live },
      { primitiveId: 1, versionId: "old", instanceId: "c", primitive: live },
    ]);
    expect(query.calls).toBe(1); expect(result.map(l => l.primitive.buCost)).toEqual([4,12,4]);
    expect(result.map(l => l.instanceId)).toEqual(["a","b","c"]);
  });
  it("does not query versions for entirely unpinned primitive lists", async () => {
    expect(await effectivePrimitiveLinks([{ primitiveId: 1, primitive: live }])).toEqual([{ primitiveId: 1, primitive: live }]);
    expect(query.calls).toBe(0);
  });
});
