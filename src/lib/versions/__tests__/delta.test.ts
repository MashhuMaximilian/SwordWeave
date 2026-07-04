import { describe, expect, it } from "vitest";
import {
  applyDelta,
  applySelfDescribingDelta,
  compactSnapshot,
  computeDelta,
  computeSelfDescribingDelta,
  createFullSnapshot,
  deepEqual,
  invertSelfDescribingDelta,
  reconstructVersion,
  type VersionEntry,
} from "../delta";

describe("createFullSnapshot", () => {
  it("creates a FULL snapshot with a copy of the data", () => {
    const data = { name: "Fireball", cost: 5 };
    const snap = createFullSnapshot(data);
    expect(snap.kind).toBe("FULL");
    expect(snap.data).toEqual(data);
    // Copy, not reference
    expect(snap.data).not.toBe(data);
  });

  it("handles empty objects", () => {
    const snap = createFullSnapshot({});
    expect(snap.data).toEqual({});
  });
});

describe("computeDelta", () => {
  it("captures additions", () => {
    const prev = { a: 1 };
    const next = { a: 1, b: 2 };
    const delta = computeDelta(prev, next);
    expect(delta).toEqual({ b: 2 });
  });

  it("captures modifications", () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1, b: 99 };
    const delta = computeDelta(prev, next);
    expect(delta).toEqual({ b: 99 });
  });

  it("captures deletions with sentinel", () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1 };
    const delta = computeDelta(prev, next);
    expect(delta).toEqual({ b: { __deleted: true } });
  });

  it("captures mixed add/modify/delete", () => {
    const prev = { a: 1, b: 2, c: 3 };
    const next = { a: 1, b: 99, d: 4 };
    const delta = computeDelta(prev, next);
    expect(delta).toEqual({
      b: 99,
      d: 4,
      c: { __deleted: true },
    });
  });

  it("returns empty delta for identical objects", () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1, b: 2 };
    const delta = computeDelta(prev, next);
    expect(delta).toEqual({});
  });

  it("handles nested objects with deepEqual", () => {
    const prev = { config: { tags: ["a", "b"] } };
    const next = { config: { tags: ["a", "b"] } };
    const delta = computeDelta(prev, next);
    expect(delta).toEqual({});
  });

  it("detects nested object changes", () => {
    const prev = { config: { tags: ["a"] } };
    const next = { config: { tags: ["a", "b"] } };
    const delta = computeDelta(prev, next);
    expect(delta).toEqual({ config: { tags: ["a", "b"] } });
  });
});

describe("applyDelta", () => {
  it("applies additions", () => {
    const result = applyDelta({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("applies modifications", () => {
    const result = applyDelta({ a: 1, b: 2 }, { b: 99 });
    expect(result).toEqual({ a: 1, b: 99 });
  });

  it("applies deletions", () => {
    const result = applyDelta({ a: 1, b: 2 }, { b: { __deleted: true } });
    expect(result).toEqual({ a: 1 });
  });

  it("is pure (does not mutate input)", () => {
    const input = { a: 1 };
    applyDelta(input, { b: 2 });
    expect(input).toEqual({ a: 1 });
  });

  it("round-trips: applyDelta(prev, computeDelta(prev, next)) === next", () => {
    const prev = { a: 1, b: 2, c: 3 };
    const next = { a: 1, b: 99, d: 4 };
    const delta = computeDelta(prev, next);
    const result = applyDelta(prev, delta);
    expect(result).toEqual(next);
  });
});

describe("computeSelfDescribingDelta + invertSelfDescribingDelta", () => {
  it("captures previous values in __prev envelope", () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1, b: 99, c: 3 };
    const delta = computeSelfDescribingDelta(prev, next);
    expect(delta["b"]).toEqual({ value: 99, __prev: 2 });
    expect(delta["c"]).toEqual({ value: 3, __prev: undefined });
  });

  it("captures deletions with __deleted flag", () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1 };
    const delta = computeSelfDescribingDelta(prev, next);
    expect(delta["b"]).toEqual({ value: undefined, __prev: 2, __deleted: true });
  });

  it("invertSelfDescribingDelta recovers the prior partial state", () => {
    // Delta describes change FROM prev TO next. Inverting gives the keys
    // from prev (with __prev values), but only for keys the delta touched.
    // Keys not in the patch are NOT recovered (you'd need the full prev
    // snapshot for that). For reconstruction with full state, use
    // reconstructVersion which starts from a FULL snapshot.
    //
    // Note: deleted keys are STILL included in the inverted output with
    // their __prev value — this is by design so reconstructVersion can
    // restore them when undoing a deletion.
    const prev = { a: 1, b: 2, c: 3 };
    const next = { a: 1, b: 99, d: 4 };
    const delta = computeSelfDescribingDelta(prev, next);
    const recovered = invertSelfDescribingDelta(delta);
    // b changed (99 → 2), d was added (undefined → undefined), c was deleted
    // (still appears with __prev=3 for reconstruction purposes)
    expect(recovered).toEqual({ b: 2, c: 3, d: undefined });
  });

  it("applySelfDescribingDelta on prev produces next", () => {
    const prev = { a: 1, b: 2, c: 3 };
    const next = { a: 1, b: 99, d: 4 };
    const delta = computeSelfDescribingDelta(prev, next);
    const result = applySelfDescribingDelta(prev, delta);
    expect(result).toEqual(next);
  });
});

describe("reconstructVersion", () => {
  function buildChain(): VersionEntry[] {
    // v1 = { a: 1, b: 2 }     (FULL — oldest)
    // v2 = { a: 1, b: 99 }    (DELTA from v1)
    // v3 = { a: 1, b: 99, d: 4 }  (DELTA from v2)
    //
    // Chain is stored OLDEST-FIRST. v1 must be FULL, v2+ are DELTAs applied
    // forward to reconstruct any historical or current version.
    const v1Data = { a: 1, b: 2 };
    const v2Data = { a: 1, b: 99 };
    const v3Data = { a: 1, b: 99, d: 4 };

    const d1to2 = computeSelfDescribingDelta(v1Data, v2Data);
    const d2to3 = computeSelfDescribingDelta(v2Data, v3Data);

    return [
      { versionNumber: 1, payload: { kind: "FULL", data: v1Data } },
      { versionNumber: 2, payload: { kind: "DELTA", patch: d1to2 } },
      { versionNumber: 3, payload: { kind: "DELTA", patch: d2to3 } },
    ];
  }

  it("reconstructs the latest version (v3)", () => {
    const chain = buildChain();
    const v3 = reconstructVersion(chain, 3);
    expect(v3).toEqual({ a: 1, b: 99, d: 4 });
  });

  it("reconstructs v2 from the FULL v3 + delta", () => {
    const chain = buildChain();
    const v2 = reconstructVersion(chain, 2);
    expect(v2).toEqual({ a: 1, b: 99 });
  });

  it("reconstructs v1 by walking back through both deltas", () => {
    const chain = buildChain();
    const v1 = reconstructVersion(chain, 1);
    expect(v1).toEqual({ a: 1, b: 2 });
  });

  it("throws on empty chain", () => {
    expect(() => reconstructVersion([], 1)).toThrow(/empty version chain/);
  });

  it("throws if chain head is DELTA not FULL", () => {
    const chain: VersionEntry[] = [
      {
        versionNumber: 1,
        payload: { kind: "DELTA", patch: {} },
      },
    ];
    expect(() => reconstructVersion(chain, 1)).toThrow(/expected FULL/);
  });

  it("throws if target version not in chain", () => {
    const chain = buildChain();
    expect(() => reconstructVersion(chain, 99)).toThrow(/not in chain/);
  });

  it("handles deep nested changes across many versions", () => {
    // Simulate 5 versions of a capability spec, oldest→newest
    const v1 = { name: "Strike", cost: 1, tags: ["melee"] };
    const v2 = { name: "Strike", cost: 2, tags: ["melee"] };
    const v3 = { name: "Strike+", cost: 2, tags: ["melee", "weapon"] };
    const v4 = { name: "Strike+", cost: 3, tags: ["melee", "weapon"] };
    const v5 = { name: "Power Strike", cost: 4, tags: ["melee", "weapon"] };

    // Chain stores OLDEST first. v1 is FULL; v2+ are DELTAs forward.
    const chain: VersionEntry[] = [
      { versionNumber: 1, payload: { kind: "FULL", data: v1 } },
      {
        versionNumber: 2,
        payload: {
          kind: "DELTA",
          patch: computeSelfDescribingDelta(v1, v2) as never,
        },
      },
      {
        versionNumber: 3,
        payload: {
          kind: "DELTA",
          patch: computeSelfDescribingDelta(v2, v3) as never,
        },
      },
      {
        versionNumber: 4,
        payload: {
          kind: "DELTA",
          patch: computeSelfDescribingDelta(v3, v4) as never,
        },
      },
      {
        versionNumber: 5,
        payload: {
          kind: "DELTA",
          patch: computeSelfDescribingDelta(v4, v5) as never,
        },
      },
    ];

    expect(reconstructVersion(chain, 5)).toEqual(v5);
    expect(reconstructVersion(chain, 4)).toEqual(v4);
    expect(reconstructVersion(chain, 3)).toEqual(v3);
    expect(reconstructVersion(chain, 2)).toEqual(v2);
    expect(reconstructVersion(chain, 1)).toEqual(v1);
  });
});

describe("deepEqual", () => {
  it("compares primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
  });

  it("compares arrays", () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([1], [1, 2])).toBe(false);
  });

  it("compares nested objects", () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("treats null and undefined as distinct", () => {
    expect(deepEqual(null, undefined)).toBe(false);
  });
});

describe("compactSnapshot", () => {
  it("strips undefined values", () => {
    const result = compactSnapshot({ a: 1, b: undefined, c: "x" });
    expect(result).toEqual({ a: 1, c: "x" });
  });

  it("preserves null values (null != undefined)", () => {
    const result = compactSnapshot({ a: null, b: undefined });
    expect(result).toEqual({ a: null });
  });

  it("returns empty object for all-undefined", () => {
    const result = compactSnapshot({ a: undefined, b: undefined });
    expect(result).toEqual({});
  });
});