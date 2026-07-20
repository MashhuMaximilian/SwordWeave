// =============================================================================
// hash-content.test — verifies the canonical-JSON hash is stable across
// formatting differences and key-order permutations, and that mirror
// normalization actually changes the hash (so non-mirrorable rows with
// "raw" mirror fields don't accidentally collide with mirrorable rows).
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  buildCanonicalPrimitivePayload,
  canonicalJsonStringify,
  computePrimitiveContentHash,
  hashPrimitiveContent,
  isPrimitiveDraftEmpty,
} from "../publishing/hash-content";

describe("canonicalJsonStringify", () => {
  it("sorts keys at the top level", () => {
    expect(canonicalJsonStringify({ b: 1, a: 2 })).toBe(`{"a":2,"b":1}`);
  });

  it("sorts keys recursively in nested objects", () => {
    expect(
      canonicalJsonStringify({ z: { y: 1, x: 2 }, a: 3 }),
    ).toBe(`{"a":3,"z":{"x":2,"y":1}}`);
  });

  it("preserves array order", () => {
    expect(canonicalJsonStringify([3, 1, 2])).toBe(`[3,1,2]`);
    expect(canonicalJsonStringify({ a: [3, 1, 2] })).toBe(`{"a":[3,1,2]}`);
  });

  it("drops undefined values", () => {
    expect(canonicalJsonStringify({ a: 1, b: undefined, c: 3 })).toBe(
      `{"a":1,"c":3}`,
    );
  });

  it("preserves null values", () => {
    expect(canonicalJsonStringify({ a: null, b: 1 })).toBe(`{"a":null,"b":1}`);
  });

  it("throws on non-finite numbers", () => {
    expect(() => canonicalJsonStringify(Infinity)).toThrow();
    expect(() => canonicalJsonStringify(NaN)).toThrow();
  });
});

describe("buildCanonicalPrimitivePayload", () => {
  it("normalizes mirrorVector/mirrorBuCredit for non-mirrorable rows", () => {
    const payload = buildCanonicalPrimitivePayload({
      name: "Strike",
      category: "VERB_TIER",
      costTier: "Tier 1",
      buCost: 4,
      mechanicalOutputText: "",
      narrativeRule: "Hit things.",
      isPublic: true,
      isMirrorable: false,
      mirrorVector: "RAW_GARBAGE", // should be ignored for non-mirrorable
      mirrorBuCredit: 999, // should be ignored for non-mirrorable
      mirrorEligibilityNotes: "",
      hardModifiers: [],
    });
    expect(payload.mirrorVector).toBe("STANDARD_ONLY");
    expect(payload.mirrorBuCredit).toBe(0);
  });

  it("preserves mirror fields for mirrorable rows (Phase 7 Q-M: mirror_bu_credit = bu_cost)", () => {
    const payload = buildCanonicalPrimitivePayload({
      name: "Strike",
      category: "VERB_TIER",
      costTier: "Tier 1",
      buCost: 4,
      mechanicalOutputText: "",
      narrativeRule: "Hit things.",
      isPublic: true,
      isMirrorable: true,
      mirrorVector: "VARIABLE_VECTOR",
      mirrorBuCredit: 2,
      mirrorEligibilityNotes: "",
      hardModifiers: [],
    });
    expect(payload.mirrorVector).toBe("VARIABLE_VECTOR");
    // Phase 7 Q-M canonical rule: mirror_bu_credit is auto-derived from
    // bu_cost regardless of the form value passed in. The form value (2
    // here) is ignored. The server also enforces this on write.
    expect(payload.mirrorBuCredit).toBe(4);
  });

  it("treats empty mirrorVector on mirrorable rows as VARIABLE_VECTOR", () => {
    const payload = buildCanonicalPrimitivePayload({
      name: "Strike",
      category: "VERB_TIER",
      costTier: "Tier 1",
      buCost: 4,
      mechanicalOutputText: "",
      narrativeRule: "Hit things.",
      isPublic: true,
      isMirrorable: true,
      mirrorVector: "",
      mirrorBuCredit: 0,
      mirrorEligibilityNotes: "",
      hardModifiers: [],
    });
    expect(payload.mirrorVector).toBe("VARIABLE_VECTOR");
  });

  it("coerces buCost string to number", () => {
    const payload = buildCanonicalPrimitivePayload({
      name: "Strike",
      category: "VERB_TIER",
      costTier: "Tier 1",
      buCost: "12",
      mechanicalOutputText: "",
      narrativeRule: "",
      isPublic: true,
      isMirrorable: false,
      mirrorVector: "STANDARD_ONLY",
      mirrorBuCredit: 0,
      mirrorEligibilityNotes: "",
      hardModifiers: [],
    });
    expect(payload.buCost).toBe(12);
  });

  it("fills empty costTier with default", () => {
    const payload = buildCanonicalPrimitivePayload({
      name: "Strike",
      category: "VERB_TIER",
      costTier: "",
      buCost: 0,
      mechanicalOutputText: "",
      narrativeRule: "",
      isPublic: true,
      isMirrorable: false,
      mirrorVector: "STANDARD_ONLY",
      mirrorBuCredit: 0,
      mirrorEligibilityNotes: "",
      hardModifiers: [],
    });
    expect(payload.costTier).toBe("Tier 1: Minor (4 BU anchor)");
  });
});

describe("isPrimitiveDraftEmpty", () => {
  it("returns true when name is empty/whitespace", () => {
    expect(isPrimitiveDraftEmpty({
      name: "",
      category: "VERB_TIER",
      costTier: "Tier 1",
      buCost: 4,
      mechanicalOutputText: "",
      narrativeRule: "stuff",
      isPublic: true,
      isMirrorable: false,
      mirrorVector: "STANDARD_ONLY",
      mirrorBuCredit: 0,
      mirrorEligibilityNotes: "",
      hardModifiers: [],
      iconSource: null,
      iconKey: null,
      iconUrl: null,
      iconColor: "#ffffff",
      tags: [],
    })).toBe(true);
    expect(isPrimitiveDraftEmpty({
      name: "   ",
      category: "VERB_TIER",
      costTier: "Tier 1",
      buCost: 4,
      mechanicalOutputText: "",
      narrativeRule: "stuff",
      isPublic: true,
      isMirrorable: false,
      mirrorVector: "STANDARD_ONLY",
      mirrorBuCredit: 0,
      mirrorEligibilityNotes: "",
      hardModifiers: [],
      iconSource: null,
      iconKey: null,
      iconUrl: null,
      iconColor: "#ffffff",
      tags: [],
    })).toBe(true);
  });

  it("returns false when name has content", () => {
    expect(isPrimitiveDraftEmpty({
      name: "Strike",
      category: "VERB_TIER",
      costTier: "Tier 1",
      buCost: 4,
      mechanicalOutputText: "",
      narrativeRule: "",
      isPublic: true,
      isMirrorable: false,
      mirrorVector: "STANDARD_ONLY",
      mirrorBuCredit: 0,
      mirrorEligibilityNotes: "",
      hardModifiers: [],
      iconSource: null,
      iconKey: null,
      iconUrl: null,
      iconColor: "#ffffff",
      tags: [],
    })).toBe(false);
  });
});

describe("hashPrimitiveContent", () => {
  const baseArgs = {
    name: "Strike",
    category: "VERB_TIER",
    costTier: "Tier 1: Minor (4 BU anchor)",
    buCost: 4,
    mechanicalOutputText: "",
    narrativeRule: "Hit things.",
    isPublic: true,
    isMirrorable: false,
    mirrorVector: "STANDARD_ONLY",
    mirrorBuCredit: 0,
    mirrorEligibilityNotes: "",
    hardModifiers: [],
  };

  it("produces a stable 64-char lowercase hex digest", async () => {
    const hash = await computePrimitiveContentHash(baseArgs);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same input → same hash", async () => {
    const a = await computePrimitiveContentHash(baseArgs);
    const b = await computePrimitiveContentHash(baseArgs);
    expect(a).toBe(b);
  });

  it("changing the name changes the hash", async () => {
    const a = await computePrimitiveContentHash(baseArgs);
    const b = await computePrimitiveContentHash({ ...baseArgs, name: "Slash" });
    expect(a).not.toBe(b);
  });

  it("changing a hardModifier changes the hash", async () => {
    const a = await computePrimitiveContentHash(baseArgs);
    const b = await computePrimitiveContentHash({
      ...baseArgs,
      hardModifiers: [
        {
          kind: "modify",
          target: "character.attribute.physical",
          operation: "add",
          value: 2,
        },
      ],
    });
    expect(a).not.toBe(b);
  });

  it("non-mirrorable with garbage mirror fields hashes same as canonical non-mirrorable", async () => {
    const canonical = await computePrimitiveContentHash(baseArgs);
    const garbage = await computePrimitiveContentHash({
      ...baseArgs,
      mirrorVector: "RAW_GARBAGE",
      mirrorBuCredit: 999,
    });
    expect(canonical).toBe(garbage);
  });

  it("hash is browser+node safe (uses globalThis.crypto.subtle)", async () => {
    // This test just exercises the API; if we got here it didn't throw.
    const hash = await computePrimitiveContentHash(baseArgs);
    expect(hash.length).toBe(64);
  });

  it("explicit hashPrimitiveContent accepts a pre-built payload", async () => {
    const payload = buildCanonicalPrimitivePayload(baseArgs);
    const hashA = await hashPrimitiveContent(payload);
    const hashB = await computePrimitiveContentHash(baseArgs);
    expect(hashA).toBe(hashB);
  });
});

describe("buildCanonicalTemplatePayload (Phase 7 Q-M-UX)", () => {
  it("derives primitiveSlots from primitiveIds when not provided", async () => {
    const { buildCanonicalTemplatePayload, computeTemplateContentHash } =
      await import("@/lib/publishing/hash-content");
    const payload = buildCanonicalTemplatePayload({
      kind: "LINEAGE",
      name: "Elf",
      description: "",
      suggestedTraits: "",
      isPublic: false,
      primitiveIds: [1, 2, 3],
      capabilityIds: [],
    });
    expect(payload.primitiveIds).toEqual([1, 2, 3]);
    expect(payload.primitiveSlots).toEqual([
      { primitiveId: 1, isMirrored: false },
      { primitiveId: 2, isMirrored: false },
      { primitiveId: 3, isMirrored: false },
    ]);
    void computeTemplateContentHash;
  });

  it("uses provided primitiveSlots when given (mirrored slots preserved)", async () => {
    const { buildCanonicalTemplatePayload, computeTemplateContentHash } =
      await import("@/lib/publishing/hash-content");
    const payload = buildCanonicalTemplatePayload({
      kind: "LINEAGE",
      name: "Elf",
      description: "",
      suggestedTraits: "",
      isPublic: false,
      primitiveIds: [1, 2],
      primitiveSlots: [
        { primitiveId: 1, isMirrored: true },
        { primitiveId: 2, isMirrored: false },
      ],
      capabilityIds: [],
    });
    expect(payload.primitiveSlots).toEqual([
      { primitiveId: 1, isMirrored: true },
      { primitiveId: 2, isMirrored: false },
    ]);
    // Hash differs from the non-mirrored version of the same template.
    const mirroredHash = await computeTemplateContentHash({
      kind: "LINEAGE",
      name: "Elf",
      description: "",
      suggestedTraits: "",
      isPublic: false,
      primitiveIds: [1, 2],
      primitiveSlots: [
        { primitiveId: 1, isMirrored: true },
        { primitiveId: 2, isMirrored: false },
      ],
      capabilityIds: [],
    });
    const plainHash = await computeTemplateContentHash({
      kind: "LINEAGE",
      name: "Elf",
      description: "",
      suggestedTraits: "",
      isPublic: false,
      primitiveIds: [1, 2],
      capabilityIds: [],
    });
    expect(mirroredHash).not.toBe(plainHash);
  });
});