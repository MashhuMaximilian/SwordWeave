import { describe, it, expect } from "vitest";
import { resolveContentVersionId } from "../content-hash";

describe("resolveContentVersionId", () => {
  it("derives a deterministic UUID v5 from (entityKind, entityId, contentHash)", () => {
    const a = resolveContentVersionId("primitive", 13, "test-hash-123");
    const b = resolveContentVersionId("primitive", 13, "test-hash-123");
    expect(a).toBe(b);
  });

  it("yields different UUIDs for different content hashes (same entity)", () => {
    const a = resolveContentVersionId("primitive", 13, "alpha");
    const b = resolveContentVersionId("primitive", 13, "beta");
    expect(a).not.toBe(b);
  });

  it("yields different UUIDs for different entities (same content)", () => {
    const a = resolveContentVersionId("primitive", 13, "same-content");
    const b = resolveContentVersionId("primitive", 14, "same-content");
    expect(a).not.toBe(b);
  });

  it("yields different UUIDs for different entity kinds (same content + id)", () => {
    const a = resolveContentVersionId("primitive", 13, "x");
    const b = resolveContentVersionId("capability", 13, "x");
    expect(a).not.toBe(b);
  });

  it("produces a v5-format UUID (version=5, variant=10xx)", () => {
    const uuid = resolveContentVersionId("primitive", 1, "any-content");
    // Version digit (position 14) must be '5'
    expect(uuid[14]).toBe("5");
    // Variant digit (position 19) must be 8, 9, a, or b
    expect(["8", "9", "a", "b"]).toContain(uuid[19]);
  });

  it("handles string entityIds (UUIDs) the same as numbers (via string coercion)", () => {
    // The function stringifies the entityId via the template literal, so
    // a number 1 and a string "1" yield the same UUID. This is the
    // documented behavior - use one consistently per entity.
    const num = resolveContentVersionId("capability", 1, "hash");
    const str = resolveContentVersionId("capability", "1", "hash");
    expect(num).toBe(str);
  });

  it("throws on empty content hash", () => {
    expect(() => resolveContentVersionId("primitive", 1, "")).toThrow(
      /non-empty string/,
    );
  });

  it("throws on missing entityKind", () => {
    expect(() => resolveContentVersionId("", 1, "hash")).toThrow(
      /entityKind/,
    );
  });

  it("throws on missing entityId", () => {
    expect(() =>
      resolveContentVersionId("primitive", undefined as unknown as number, "hash"),
    ).toThrow(/entityId/);
    expect(() =>
      resolveContentVersionId("primitive", null as unknown as number, "hash"),
    ).toThrow(/entityId/);
  });

  it("is stable across many calls (idempotent)", () => {
    const first = resolveContentVersionId("primitive", 1, "stable-content");
    for (let i = 0; i < 1000; i++) {
      expect(resolveContentVersionId("primitive", 1, "stable-content")).toBe(first);
    }
  });
});
