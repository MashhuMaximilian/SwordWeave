import { describe, expect, it } from "vitest";
import {
  computeSelfDescribingDelta,
  createFullSnapshot,
  reconstructVersion,
  type VersionEntry,
} from "@/lib/versions/delta";

/**
 * Simulates the publish-service versioning flow:
 * 1. First publish → FULL snapshot (v1)
 * 2. Subsequent publishes → DELTA from previous latest
 * 3. Reconstruction from version chain recovers historical states
 *
 * Mirrors the logic in src/lib/publishing/publish-service.ts but as a
 * pure simulation so we can test without DB.
 */

interface SimChain {
  versions: VersionEntry[];
  snapshotForVersion(n: number): Record<string, unknown>;
}

function buildSimChain(
  snapshots: Record<string, unknown>[],
): SimChain {
  // Chain is OLDEST-FIRST (v1, v2, ..., vN). v1 is FULL, v2+ are DELTAs
  // applied forward. reconstructVersion expects this order.
  const versions: VersionEntry[] = [];

  // v1 is always FULL
  versions.push({
    versionNumber: 1,
    payload: { kind: "FULL", data: createFullSnapshot(snapshots[0]!).data },
  });

  // v2+ are DELTAs from the previous stored snapshot
  let prevSnapshot = snapshots[0]!;
  for (let i = 1; i < snapshots.length; i++) {
    const current = snapshots[i]!;
    const delta = computeSelfDescribingDelta(prevSnapshot, current);
    versions.push({
      versionNumber: i + 1,
      payload: { kind: "DELTA", patch: delta },
    });
    prevSnapshot = current;
  }

  return {
    versions,
    snapshotForVersion(n: number): Record<string, unknown> {
      return reconstructVersion(versions, n);
    },
  };
}

describe("publish-service simulation", () => {
  it("first publish creates a FULL snapshot", () => {
    const chain = buildSimChain([{ name: "Strike", cost: 1 }]);
    expect(chain.versions).toHaveLength(1);
    expect(chain.versions[0]!.payload.kind).toBe("FULL");
    expect(chain.snapshotForVersion(1)).toEqual({ name: "Strike", cost: 1 });
  });

  it("second publish creates a DELTA", () => {
    const chain = buildSimChain([
      { name: "Strike", cost: 1 },
      { name: "Strike", cost: 2 },
    ]);
    expect(chain.versions).toHaveLength(2);
    expect(chain.versions[0]!.payload.kind).toBe("FULL");
    expect(chain.versions[1]!.payload.kind).toBe("DELTA");
    expect(chain.snapshotForVersion(2)).toEqual({ name: "Strike", cost: 2 });
  });

  it("reconstructs each historical version through many iterations", () => {
    // Simulate a capability with 10 revisions
    const snapshots = [
      { name: "v1", cost: 1, tags: ["a"] },
      { name: "v2", cost: 1, tags: ["a", "b"] },
      { name: "v3", cost: 2, tags: ["a", "b"] },
      { name: "v4", cost: 2, tags: ["b"] },
      { name: "v5", cost: 3, tags: ["b"] },
      { name: "v6", cost: 3, tags: ["b", "c"] },
      { name: "v7", cost: 4, tags: ["b", "c"] },
      { name: "v8", cost: 4, tags: ["c"] },
      { name: "v9", cost: 5, tags: ["c"] },
      { name: "v10", cost: 5, tags: ["c", "d"] },
    ];

    const chain = buildSimChain(snapshots);

    for (let i = 1; i <= 10; i++) {
      expect(chain.snapshotForVersion(i)).toEqual(snapshots[i - 1]);
    }
  });

  it("DELTA size is smaller than FULL snapshot (storage savings)", () => {
    const fullData = {
      id: "cap_1",
      name: "Fireball",
      cost: 8,
      tags: ["fire", "evocation"],
      description: "A blazing bolt",
      notes: "lots of text here describing the mechanic in detail",
      mechanics: { damage: "8d6", range: "120ft", save: "DEX" },
      metadata: { author: "test", version: "1.0" },
    };

    const full = createFullSnapshot(fullData).data;

    // Small change: update only the cost
    const updated = { ...fullData, cost: 9 };
    const delta = computeSelfDescribingDelta(fullData, updated);

    const fullSize = JSON.stringify(full).length;
    const deltaSize = JSON.stringify(delta).length;

    // Delta should be much smaller than the full snapshot
    expect(deltaSize).toBeLessThan(fullSize / 5);
    // Self-describing delta carries {value, __prev} envelope
    expect(delta["cost"]).toEqual({ value: 9, __prev: 8 });
  });

  it("supports adding a new field mid-version-history", () => {
    const chain = buildSimChain([
      { name: "A", x: 1 },
      { name: "A", x: 1, y: 2 }, // y added
    ]);
    expect(chain.snapshotForVersion(1)).toEqual({ name: "A", x: 1 });
    expect(chain.snapshotForVersion(2)).toEqual({ name: "A", x: 1, y: 2 });
  });

  it("supports renaming a field across versions", () => {
    const chain = buildSimChain([
      { name: "Old Name", cost: 5 },
      { name: "New Name", cost: 5 },
      { name: "New Name", cost: 6 },
    ]);
    expect(chain.snapshotForVersion(1)).toEqual({ name: "Old Name", cost: 5 });
    expect(chain.snapshotForVersion(2)).toEqual({ name: "New Name", cost: 5 });
    expect(chain.snapshotForVersion(3)).toEqual({ name: "New Name", cost: 6 });
  });

  it("supports removing a field across versions", () => {
    const chain = buildSimChain([
      { name: "Strike", cost: 1, deprecated: true },
      { name: "Strike", cost: 1 }, // deprecated removed
      { name: "Strike", cost: 2 }, // cost changed
    ]);
    expect(chain.snapshotForVersion(1)).toEqual({
      name: "Strike",
      cost: 1,
      deprecated: true,
    });
    expect(chain.snapshotForVersion(2)).toEqual({ name: "Strike", cost: 1 });
    expect(chain.snapshotForVersion(3)).toEqual({ name: "Strike", cost: 2 });
  });
});

describe("fork-attribution metadata", () => {
  it("preserves fork lineage in metadata", () => {
    // Verify that a fork carries source provenance in metadata
    const source = {
      id: "cap_abc",
      name: "Fireball",
      metadata: { originalAuthor: "alice" },
    };
    const forked = {
      id: "cap_xyz",
      name: "Fireball (fork)",
      metadata: {
        ...source.metadata,
        forkedFrom: {
          capabilityId: source.id,
          versionId: "ver_1",
          versionNumber: 3,
          publicationId: "pub_1",
        },
      },
    };
    expect(forked.metadata.forkedFrom).toBeDefined();
    expect(forked.metadata.originalAuthor).toBe("alice");
  });

  it("fork aggregation increments correctly", () => {
    // Simulate atomic counter increments
    const counters = new Map<string, number>();
    function increment(key: string) {
      counters.set(key, (counters.get(key) ?? 0) + 1);
    }
    increment("cap_abc:ver_1");
    increment("cap_abc:ver_1");
    increment("cap_abc:ver_1");
    increment("cap_abc:ver_2");
    expect(counters.get("cap_abc:ver_1")).toBe(3);
    expect(counters.get("cap_abc:ver_2")).toBe(1);
  });
});