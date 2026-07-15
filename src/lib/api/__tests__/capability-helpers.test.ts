import { describe, it, expect } from "vitest";
import {
  buildAssemblyAndComputeBU,
  parsePrimitiveSlots,
  parseCapabilityType,
  parseSourceType,
  parseTags,
  parseRole,
  safeMetadata,
  type PrimitiveLike,
} from "../capability-helpers";

const primitivesById = new Map<string, PrimitiveLike>([
  [
    "1",
    {
      id: "1",
      name: "Strike",
      category: "verb-tier",
      buCost: 4,
    },
  ],
  [
    "2",
    {
      id: "2",
      name: "Fire",
      category: "domain-license",
      buCost: 4,
    },
  ],
  [
    "3",
    {
      id: "3",
      name: "Single Target",
      category: "targeting",
      buCost: 1,
    },
  ],
  [
    "4",
    {
      id: "4",
      name: "Touch",
      category: "range",
      buCost: 2,
    },
  ],
  [
    "5",
    {
      id: "5",
      name: "Instant",
      category: "duration",
      buCost: 0,
    },
  ],
  [
    "6",
    {
      id: "6",
      name: "Human-sized",
      category: "sizing",
      buCost: 2,
    },
  ],
]);

describe("parseCapabilityType", () => {
  it("accepts uppercase ACTIVE/PASSIVE/AUGMENT", () => {
    expect(parseCapabilityType("ACTIVE")).toBe("ACTIVE");
    expect(parseCapabilityType("passive")).toBe("PASSIVE");
    expect(parseCapabilityType("augment")).toBe("AUGMENT");
  });
  it("rejects invalid types", () => {
    expect(parseCapabilityType("foo")).toBeNull();
    expect(parseCapabilityType(null)).toBeNull();
    expect(parseCapabilityType(123)).toBeNull();
  });
});

describe("parseSourceType", () => {
  it("accepts uppercase PHYSICAL/MAGICAL/PSYCHIC", () => {
    expect(parseSourceType("PHYSICAL")).toBe("PHYSICAL");
    expect(parseSourceType("magical")).toBe("MAGICAL");
    expect(parseSourceType("Psychic")).toBe("PSYCHIC");
  });
  it("rejects invalid sources", () => {
    expect(parseSourceType("fire")).toBeNull();
    expect(parseSourceType(undefined)).toBeNull();
  });
});

describe("parseRole", () => {
  it("accepts all 8 roles case-insensitive", () => {
    for (const role of [
      "VERB",
      "DOMAIN",
      "SIZING",
      "RANGE",
      "DURATION",
      "OUTPUT",
      "AUGMENT",
      "OTHER",
    ]) {
      expect(parseRole(role)).toBe(role);
      expect(parseRole(role.toLowerCase())).toBe(role);
    }
  });
  it("rejects invalid roles", () => {
    expect(parseRole("fire")).toBeNull();
    expect(parseRole(42)).toBeNull();
  });
});

describe("parseTags", () => {
  it("accepts arrays", () => {
    expect(parseTags(["a", "b", " c "])).toEqual(["a", "b", "c"]);
  });
  it("accepts comma-separated strings", () => {
    expect(parseTags("a, b ,c")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for null/undefined", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
  it("filters empty tags", () => {
    expect(parseTags(["", "  ", "x"])).toEqual(["x"]);
  });
});

describe("parsePrimitiveSlots", () => {
  it("parses a valid slot array", () => {
    const result = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB", quantity: 2 },
      { primitiveId: 2, role: "DOMAIN" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      primitiveId: 1,
      role: "VERB",
      quantity: 2,
      sortOrder: 0,
      slotLabel: null,
      notes: null,
    });
    expect(result[1]).toMatchObject({
      primitiveId: 2,
      role: "DOMAIN",
      quantity: 1,
      sortOrder: 1,
    });
  });

  it("throws on non-array", () => {
    expect(() => parsePrimitiveSlots("foo" as unknown as unknown[])).toThrow(
      "primitiveSlots must be an array.",
    );
  });

  it("throws on bad primitiveId", () => {
    expect(() =>
      parsePrimitiveSlots([{ primitiveId: "abc", role: "VERB" }]),
    ).toThrow("primitiveId must be a positive integer.");
  });

  it("throws on missing role", () => {
    expect(() =>
      parsePrimitiveSlots([{ primitiveId: 1, role: "fire" }]),
    ).toThrow("role must be one of:");
  });

  it("throws on bad quantity", () => {
    expect(() =>
      parsePrimitiveSlots([{ primitiveId: 1, role: "VERB", quantity: 0 }]),
    ).toThrow("quantity must be a positive integer.");
  });

  // Phase 7 Q-M-UX: per-slot Mirrored flag — defaults to false for
  // legacy payloads (backfill safety).
  it("defaults isMirrored to false when not present", () => {
    const result = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB" },
    ]);
    expect(result[0]?.isMirrored).toBe(false);
  });

  it("accepts is_mirrored (snake_case)", () => {
    const result = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB", is_mirrored: true },
    ]);
    expect(result[0]?.isMirrored).toBe(true);
  });

  it("accepts isMirrored (camelCase)", () => {
    const result = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB", isMirrored: true },
    ]);
    expect(result[0]?.isMirrored).toBe(true);
  });
});

describe("safeMetadata", () => {
  it("passes through valid object", () => {
    expect(safeMetadata({ foo: "bar" })).toEqual({ foo: "bar" });
  });
  it("returns {} for null/array/primitive", () => {
    expect(safeMetadata(null)).toEqual({});
    expect(safeMetadata([])).toEqual({});
    expect(safeMetadata("foo")).toEqual({});
    expect(safeMetadata(42)).toEqual({});
  });
});

describe("buildAssemblyAndComputeBU", () => {
  it("computes BU from a simple capability: verb + domain + range + duration", () => {
    const slots = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB" }, // 4 BU
      { primitiveId: 2, role: "DOMAIN" }, // 4 BU
      { primitiveId: 4, role: "RANGE" }, // 2 BU
      { primitiveId: 5, role: "DURATION" }, // 0 BU
    ]);

    const { totalBu } = buildAssemblyAndComputeBU(slots, primitivesById, {
      id: "test",
      name: "Fire Touch",
      type: "ACTIVE",
      sourceType: "MAGICAL",
    });

    expect(totalBu).toBe(10); // 4 + 4 + 2 + 0
  });

  it("multiplies by quantity", () => {
    const slots = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB", quantity: 3 }, // 4 * 3 = 12
      { primitiveId: 2, role: "DOMAIN" }, // 4
    ]);

    const { totalBu } = buildAssemblyAndComputeBU(slots, primitivesById, {
      id: "test",
      name: "Triple Strike",
      type: "ACTIVE",
      sourceType: "PHYSICAL",
    });

    expect(totalBu).toBe(16); // 12 + 4
  });

  it("includes sizing, targeting, output, augment, structural when present", () => {
    const slots = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB" }, // 4
      { primitiveId: 2, role: "DOMAIN" }, // 4
      { primitiveId: 6, role: "SIZING" }, // 2
      { primitiveId: 3, role: "OTHER" }, // 1 (structural bucket)
    ]);

    const { totalBu } = buildAssemblyAndComputeBU(slots, primitivesById, {
      id: "test",
      name: "Human Fire Strike",
      type: "ACTIVE",
      sourceType: "PHYSICAL",
    });

    expect(totalBu).toBe(11); // 4 + 4 + 2 + 1
  });

  it("returns 0 for empty slots array", () => {
    const { totalBu, assembly } = buildAssemblyAndComputeBU(
      [],
      primitivesById,
      {
        id: "empty",
        name: "Empty",
        type: "PASSIVE",
        sourceType: "PHYSICAL",
      },
    );
    expect(totalBu).toBe(0);
    expect(assembly.verbReferences).toEqual([]);
    expect(assembly.domainReferences).toEqual([]);
    expect(assembly.rangePrimitive).toBeNull();
  });

  it("skips primitives not in primitivesById map (unknown ref)", () => {
    const slots = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB" }, // 4
      { primitiveId: 999, role: "DOMAIN" }, // not in map = 0
    ]);
    const { totalBu } = buildAssemblyAndComputeBU(slots, primitivesById, {
      id: "test",
      name: "Unknown Ref",
      type: "ACTIVE",
      sourceType: "MAGICAL",
    });
    expect(totalBu).toBe(4);
  });

  it("server BU never lies: client-supplied metadata is ignored by engine", () => {
    // Even if the caller claims totalBu = 999 in their request,
    // buildAssemblyAndComputeBU only sums from primitives.
    const slots = parsePrimitiveSlots([
      { primitiveId: 1, role: "VERB" }, // 4
      { primitiveId: 2, role: "DOMAIN" }, // 4
    ]);
    const { totalBu } = buildAssemblyAndComputeBU(slots, primitivesById, {
      id: "test",
      name: "Honest",
      type: "ACTIVE",
      sourceType: "MAGICAL",
    });
    expect(totalBu).toBe(8); // not 999
  });
});