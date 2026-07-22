// =============================================================================
// Bundle expander tests — Phase 8.1 batch 13.1
//
// Per Mashu 2026-07-22: "you only buy primitives. Capabilities are ways to
// compile those primitives for easy access." So:
//   - Capabilities have no separate BU cost.
//   - Effects have no separate BU cost.
//   - Heritages have no separate BU cost.
//   - Items have no separate BU cost.
//   - Only primitives cost BU; their cost is shown via the sum of their
//     buCost on the sheet (transitive, deduped).
//
// The expander is the pure-logic core: takes "what the user picked in the
// modal" and returns the canonical junction rows for character_primitives,
// character_capabilities, character_heritages — with origin metadata
// recording which container brought each primitive in.
//
// These tests cover the dedup rules, source inheritance, origin
// preferences, and recursion sanity. They do NOT touch the DB (the
// expander is pure logic with injected inputs).
// =============================================================================

import { describe, expect, it } from "vitest";

import {
  expandBundles,
  summarizeExpansionCost,
  type BundleExpansionInput,
} from "../bundle-expander";

// =============================================================================
// Helpers
// =============================================================================

function id<T extends Record<string, unknown>>(obj: T): T {
  return obj;
}

// =============================================================================
// Direct slot tests
// =============================================================================

describe("expandBundles — direct slots", () => {
  it("returns direct primitive slots unchanged with all origins null", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [],
      effects: [],
      primitives: [
        { primitiveId: 1, source: "PERSONAL", isMirrored: false },
        { primitiveId: 2, source: "PERSONAL", isMirrored: true },
      ],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(2);
    expect(out.capabilities).toHaveLength(0);
    expect(out.heritages).toHaveLength(0);
    expect(out.warnings).toHaveLength(0);

    const p1 = out.primitives.find((p) => p.primitiveId === 1);
    expect(p1).toEqual({
      primitiveId: 1,
      source: "PERSONAL",
      isMirrored: false,
      originHeritageId: null,
      originCapabilityId: null,
      originEffectId: null,
      originPath: "direct",
    });
    const p2 = out.primitives.find((p) => p.primitiveId === 2);
    expect(p2?.isMirrored).toBe(true);
  });

  it("preserves the user's per-slot source on direct slots", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [],
      effects: [],
      primitives: [
        { primitiveId: 1, source: "TRAINING", isMirrored: false },
        { primitiveId: 2, source: "DM", isMirrored: false },
        { primitiveId: 3, source: "LEVEL_UP", isMirrored: false },
      ],
    };
    const out = expandBundles(input);
    expect(out.primitives.map((p) => p.source)).toEqual([
      "TRAINING",
      "DM",
      "LEVEL_UP",
    ]);
  });
});

// =============================================================================
// Heritage expansion tests
// =============================================================================

describe("expandBundles — heritage expansion", () => {
  it("expands heritage's direct primitives with source = heritage kind", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-elf",
          kind: "LINEAGE",
          primitiveLinks: [
            { primitiveId: 10, isMirrored: false },
            { primitiveId: 11, isMirrored: false },
          ],
          capabilityLinks: [],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.heritages).toHaveLength(1);
    expect(out.heritages[0]).toEqual({
      heritageId: "her-elf",
      source: "LINEAGE",
      isMirrored: false,
    });
    expect(out.primitives).toHaveLength(2);
    for (const p of out.primitives) {
      expect(p.source).toBe("LINEAGE");
      expect(p.originHeritageId).toBe("her-elf");
      expect(p.originCapabilityId).toBeNull();
      expect(p.originEffectId).toBeNull();
    }
  });

  it("expands heritage's capabilities (caps get source = heritage kind)", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-elf",
          kind: "LINEAGE",
          primitiveLinks: [],
          capabilityLinks: [
            {
              capabilityId: "cap-keen-senses",
              primitiveLinks: [{ primitiveId: 20, isMirrored: false }],
              effectLinks: [],
            },
          ],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.capabilities).toHaveLength(1);
    expect(out.capabilities[0]).toEqual({
      capabilityId: "cap-keen-senses",
      source: "LINEAGE",
      originHeritageId: "her-elf",
      originPath: "heritage:her-elf > capability:cap-keen-senses",
    });
    expect(out.primitives).toHaveLength(1);
    expect(out.primitives[0]).toEqual({
      primitiveId: 20,
      source: "LINEAGE",
      isMirrored: false,
      originHeritageId: "her-elf",
      originCapabilityId: "cap-keen-senses",
      originEffectId: null,
      originPath: "heritage:her-elf > capability:cap-keen-senses",
    });
  });

  it("expands heritage's capability's effects' primitives", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-fire-mage",
          kind: "UPBRINGING",
          primitiveLinks: [],
          capabilityLinks: [
            {
              capabilityId: "cap-fireball",
              primitiveLinks: [],
              effectLinks: [
                {
                  effectId: "eff-explosion",
                  primitiveLinks: [
                    { primitiveId: 30, isMirrored: false },
                    { primitiveId: 31, isMirrored: true },
                  ],
                },
              ],
            },
          ],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(2);
    expect(out.primitives.every((p) => p.source === "UPBRINGING")).toBe(true);
    expect(out.primitives.every((p) => p.originHeritageId === "her-fire-mage"))
      .toBe(true);
    expect(
      out.primitives.every((p) => p.originCapabilityId === "cap-fireball"),
    ).toBe(true);
    expect(out.primitives.every((p) => p.originEffectId === "eff-explosion"))
      .toBe(true);

    const mirrored = out.primitives.find((p) => p.isMirrored);
    expect(mirrored?.primitiveId).toBe(31);
  });

  it("respects the per-link mirror flag in the bundle", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-x",
          kind: "MANIFEST",
          primitiveLinks: [
            { primitiveId: 1, isMirrored: true },
            { primitiveId: 2, isMirrored: false },
          ],
          capabilityLinks: [],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    const p1 = out.primitives.find((p) => p.primitiveId === 1);
    const p2 = out.primitives.find((p) => p.primitiveId === 2);
    expect(p1?.isMirrored).toBe(true);
    expect(p2?.isMirrored).toBe(false);
  });
});

// =============================================================================
// Capability expansion tests
// =============================================================================

describe("expandBundles — capability expansion", () => {
  it("expands direct capability's primitives with source = cap's tab", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [
        {
          id: "cap-shield-bash",
          source: "MANIFEST",
          primitiveLinks: [
            { primitiveId: 100, isMirrored: false },
          ],
          effectLinks: [],
        },
      ],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.capabilities).toHaveLength(1);
    expect(out.capabilities[0]).toEqual({
      capabilityId: "cap-shield-bash",
      source: "MANIFEST",
      originHeritageId: null,
      originPath: "direct:capability:cap-shield-bash",
    });
    expect(out.primitives[0]).toEqual({
      primitiveId: 100,
      source: "MANIFEST",
      isMirrored: false,
      originHeritageId: null,
      originCapabilityId: "cap-shield-bash",
      originEffectId: null,
      originPath: "direct:capability:cap-shield-bash",
    });
  });

  it("expands direct capability's effects", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [
        {
          id: "cap-fireball",
          source: "PERSONAL",
          primitiveLinks: [],
          effectLinks: [
            {
              effectId: "eff-boom",
              primitiveLinks: [{ primitiveId: 50, isMirrored: false }],
            },
          ],
        },
      ],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.primitives[0]).toEqual({
      primitiveId: 50,
      source: "PERSONAL",
      isMirrored: false,
      originHeritageId: null,
      originCapabilityId: "cap-fireball",
      originEffectId: "eff-boom",
      originPath: "direct:capability:cap-fireball > effect:eff-boom",
    });
  });

  it("direct capability overrides heritage-owned capability with PERSONAL", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-elf",
          kind: "LINEAGE",
          primitiveLinks: [],
          capabilityLinks: [
            {
              capabilityId: "cap-keen-senses",
              primitiveLinks: [],
              effectLinks: [],
            },
          ],
        },
      ],
      capabilities: [
        {
          id: "cap-keen-senses",
          source: "PERSONAL",
          primitiveLinks: [],
          effectLinks: [],
        },
      ],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    // Only one capability row (PK is character + capability_id, not unique
    // on input side, but our map dedupes by capabilityId)
    expect(out.capabilities).toHaveLength(1);
    expect(out.capabilities[0]?.source).toBe("PERSONAL");
    expect(out.capabilities[0]?.originHeritageId).toBeNull();
  });
});

// =============================================================================
// Effect expansion tests
// =============================================================================

describe("expandBundles — effect expansion", () => {
  it("expands direct effect's primitives with source = effect's tab", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [],
      effects: [
        {
          id: "eff-heal",
          source: "MANIFEST",
          primitiveLinks: [{ primitiveId: 200, isMirrored: false }],
        },
      ],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.primitives[0]).toEqual({
      primitiveId: 200,
      source: "MANIFEST",
      isMirrored: false,
      originHeritageId: null,
      originCapabilityId: null,
      originEffectId: "eff-heal",
      originPath: "direct:effect:eff-heal",
    });
  });
});

// =============================================================================
// Dedup tests — the critical correctness property
// =============================================================================

describe("expandBundles — dedup", () => {
  it("same primitive slotted directly AND in heritage: direct wins", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-elf",
          kind: "LINEAGE",
          primitiveLinks: [{ primitiveId: 42, isMirrored: false }],
          capabilityLinks: [],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [
        { primitiveId: 42, source: "PERSONAL", isMirrored: false },
      ],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(1);
    const p = out.primitives[0];
    expect(p?.primitiveId).toBe(42);
    expect(p?.source).toBe("PERSONAL");
    expect(p?.originHeritageId).toBeNull();
    expect(p?.originPath).toBe("direct");
  });

  it("same primitive in heritage AND capability: capability origin wins (more specific)", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-x",
          kind: "LINEAGE",
          primitiveLinks: [],
          capabilityLinks: [
            {
              capabilityId: "cap-x",
              primitiveLinks: [{ primitiveId: 99, isMirrored: false }],
              effectLinks: [],
            },
          ],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [],
    };
    // First call: only heritage, expect heritage origin.
    const out1 = expandBundles(input);
    expect(out1.primitives[0]?.originHeritageId).toBe("her-x");
    expect(out1.primitives[0]?.originCapabilityId).toBe("cap-x");

    // Now ALSO slot the same primitive as direct (PERSONAL):
    const out2 = expandBundles({
      ...input,
      primitives: [{ primitiveId: 99, source: "PERSONAL", isMirrored: false }],
    });
    expect(out2.primitives).toHaveLength(1);
    const p = out2.primitives[0];
    expect(p?.source).toBe("PERSONAL");
    expect(p?.originPath).toBe("direct");
  });

  it("same primitive via capability AND effect of same capability: effect wins (most specific)", () => {
    const input: BundleExpansionInput = {
      heritages: [],
      capabilities: [
        {
          id: "cap-x",
          source: "PERSONAL",
          primitiveLinks: [{ primitiveId: 77, isMirrored: false }],
          effectLinks: [
            {
              effectId: "eff-x",
              primitiveLinks: [{ primitiveId: 77, isMirrored: false }],
            },
          ],
        },
      ],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(1);
    const p = out.primitives[0];
    expect(p?.primitiveId).toBe(77);
    expect(p?.originEffectId).toBe("eff-x");
    expect(p?.originCapabilityId).toBe("cap-x");
  });

  it("same primitive in two different heritages: first-wins (deterministic)", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-first",
          kind: "LINEAGE",
          primitiveLinks: [{ primitiveId: 55, isMirrored: false }],
          capabilityLinks: [],
        },
        {
          id: "her-second",
          kind: "UPBRINGING",
          primitiveLinks: [{ primitiveId: 55, isMirrored: false }],
          capabilityLinks: [],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(1);
    const p = out.primitives[0];
    expect(p?.originHeritageId).toBe("her-first");
    expect(p?.source).toBe("LINEAGE");
  });

  it("primitive appearing 5 times across many bundles stays a single row", () => {
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-1",
          kind: "LINEAGE",
          primitiveLinks: [{ primitiveId: 7, isMirrored: false }],
          capabilityLinks: [],
        },
      ],
      capabilities: [
        {
          id: "cap-1",
          source: "PERSONAL",
          primitiveLinks: [{ primitiveId: 7, isMirrored: false }],
          effectLinks: [
            {
              effectId: "eff-1",
              primitiveLinks: [{ primitiveId: 7, isMirrored: false }],
            },
          ],
        },
      ],
      effects: [
        {
          id: "eff-direct",
          source: "PERSONAL",
          primitiveLinks: [{ primitiveId: 7, isMirrored: false }],
        },
      ],
      primitives: [{ primitiveId: 7, source: "PERSONAL", isMirrored: false }],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(1);
  });
});

// =============================================================================
// summarizeExpansionCost tests
// =============================================================================

describe("summarizeExpansionCost", () => {
  it("sums positive BU and mirror credit separately", () => {
    const expansion = {
      primitives: [
        {
          primitiveId: 1,
          source: "PERSONAL" as const,
          isMirrored: false,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          originPath: "direct",
        },
        {
          primitiveId: 2,
          source: "PERSONAL" as const,
          isMirrored: false,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          originPath: "direct",
        },
        {
          primitiveId: 3,
          source: "PERSONAL" as const,
          isMirrored: true,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          originPath: "direct",
        },
      ],
      capabilities: [],
      heritages: [],
      warnings: [],
    };
    const bu = new Map([
      [1, 4],
      [2, 3],
      [3, 5],
    ]);
    const mirror = new Map([
      [1, 4],
      [2, 3],
      [3, 5],
    ]);
    const cost = summarizeExpansionCost(expansion, bu, mirror);
    expect(cost.positiveCost).toBe(7); // 4 + 3
    expect(cost.mirrorCredit).toBe(5); // primitive 3
    expect(cost.netCost).toBe(2);
    expect(cost.primitiveCount).toBe(3);
  });

  it("mirror credit defaults to buCost when mirrorBuCredit missing", () => {
    const expansion = {
      primitives: [
        {
          primitiveId: 1,
          source: "PERSONAL" as const,
          isMirrored: true,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          originPath: "direct",
        },
      ],
      capabilities: [],
      heritages: [],
      warnings: [],
    };
    const bu = new Map([[1, 4]]);
    const mirror = new Map<number, number>(); // empty
    const cost = summarizeExpansionCost(expansion, bu, mirror);
    expect(cost.mirrorCredit).toBe(4); // falls back to buCost
  });

  it("capabilities/heritages do NOT contribute to BU cost", () => {
    // Even with 5 capabilities and 3 heritages slotted, the BU cost
    // is just the sum of bundled primitives.
    const expansion = {
      primitives: [
        {
          primitiveId: 1,
          source: "LINEAGE" as const,
          isMirrored: false,
          originHeritageId: "h",
          originCapabilityId: null,
          originEffectId: null,
          originPath: "heritage:h",
        },
      ],
      capabilities: Array.from({ length: 5 }, (_, i) => ({
        capabilityId: `c${i}`,
        source: "LINEAGE" as const,
        originHeritageId: "h",
        originPath: "h",
      })),
      heritages: [
        {
          heritageId: "h",
          source: "LINEAGE" as const,
          isMirrored: false,
        },
      ],
      warnings: [],
    };
    const bu = new Map([[1, 8]]);
    const mirror = new Map<number, number>();
    const cost = summarizeExpansionCost(expansion, bu, mirror);
    expect(cost.positiveCost).toBe(8); // only the primitive counts
    expect(cost.primitiveCount).toBe(1);
  });
});

// =============================================================================
// Integration scenario: the user's example
// =============================================================================

describe("expandBundles — user's worked example", () => {
  it("heritage with 3 primitives + 3 caps × 2 primitives + 1 effect × 3 primitives = 12 primitives, deduped", () => {
    // Per Mashu 2026-07-22:
    // "I have a lineage for example with 3 primitives, 3 capabilities,
    // each capability has 2 primitives, and one capability has an effect
    // with 3 primitives. In that case, the total cost is still the sum
    // of all those primitives (i guess sum of those 12 primitives.
    // Of course, deduped so if there is same primitive twice, we need
    // to treat it as such, no double cost as you also said before)."
    const input: BundleExpansionInput = {
      heritages: [
        {
          id: "her-lineage",
          kind: "LINEAGE",
          primitiveLinks: [
            { primitiveId: 1, isMirrored: false },
            { primitiveId: 2, isMirrored: false },
            { primitiveId: 3, isMirrored: false },
          ],
          capabilityLinks: [
            {
              capabilityId: "cap-1",
              primitiveLinks: [
                { primitiveId: 4, isMirrored: false },
                { primitiveId: 5, isMirrored: false },
              ],
              effectLinks: [],
            },
            {
              capabilityId: "cap-2",
              primitiveLinks: [
                { primitiveId: 6, isMirrored: false },
                { primitiveId: 7, isMirrored: false },
              ],
              effectLinks: [],
            },
            {
              capabilityId: "cap-3",
              primitiveLinks: [
                { primitiveId: 8, isMirrored: false },
                { primitiveId: 9, isMirrored: false },
              ],
              effectLinks: [
                {
                  effectId: "eff-3a",
                  primitiveLinks: [
                    { primitiveId: 10, isMirrored: false },
                    { primitiveId: 11, isMirrored: false },
                    { primitiveId: 12, isMirrored: false },
                  ],
                },
              ],
            },
          ],
        },
      ],
      capabilities: [],
      effects: [],
      primitives: [],
    };
    const out = expandBundles(input);
    expect(out.primitives).toHaveLength(12);
    // Use numeric sort — default Array.sort() does string sort which
    // puts "10" before "2" lexicographically.
    const ids = out.primitives
      .map((p) => p.primitiveId)
      .sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // All under the heritage's source
    expect(out.primitives.every((p) => p.source === "LINEAGE")).toBe(true);
    expect(
      out.primitives.every((p) => p.originHeritageId === "her-lineage"),
    ).toBe(true);
    // The 3 effect primitives should have originEffectId set
    const effectPrims = out.primitives.filter(
      (p) => p.originEffectId === "eff-3a",
    );
    expect(effectPrims).toHaveLength(3);
  });
});