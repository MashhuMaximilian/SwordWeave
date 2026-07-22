// =============================================================================
// computeTransitiveBu tests — Phase 8.1 batch 13.1 follow-up
//
// Mashu 2026-07-22: "in atelier preview as well as list I have that total
// BU there up for all mechanics and heritages. However that is only
// calculated from the bundled primitives (direct). It should be total of
// all primitives nested (deduped) from effects and capabilities."
// =============================================================================

import { describe, expect, it } from "vitest";

import { computeTransitiveBu } from "../transitive-bu";

// =============================================================================
// Direct only
// =============================================================================

describe("computeTransitiveBu — direct only", () => {
  it("sums direct primitives with no capabilities or effects", () => {
    const out = computeTransitiveBu({
      primitiveLinks: [
        { primitiveId: 1, quantity: 1, primitive: { id: 1, buCost: 5 } },
        { primitiveId: 2, quantity: 1, primitive: { id: 2, buCost: 3 } },
      ],
    });
    expect(out.transitiveBu).toBe(8);
    expect(out.transitiveCount).toBe(2);
    expect(out.primitiveIds).toEqual([1, 2]);
  });

  it("treats quantity as multiplier", () => {
    const out = computeTransitiveBu({
      primitiveLinks: [
        { primitiveId: 1, quantity: 3, primitive: { id: 1, buCost: 4 } },
      ],
    });
    expect(out.transitiveBu).toBe(12);
  });

  it("handles negative buCost (credit primitives)", () => {
    const out = computeTransitiveBu({
      primitiveLinks: [
        { primitiveId: 1, quantity: 1, primitive: { id: 1, buCost: 5 } },
        { primitiveId: 2, quantity: 1, primitive: { id: 2, buCost: -2 } },
      ],
    });
    expect(out.transitiveBu).toBe(3);
  });
});

// =============================================================================
// Capability primitives
// =============================================================================

describe("computeTransitiveBu — capability primitives", () => {
  it("adds capability's primitives to the total", () => {
    const out = computeTransitiveBu({
      primitiveLinks: [
        { primitiveId: 1, primitive: { id: 1, buCost: 5 } },
      ],
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          primitiveLinks: [
            { primitiveId: 10, primitive: { id: 10, buCost: 3 } },
            { primitiveId: 11, primitive: { id: 11, buCost: 4 } },
          ],
        },
      ],
    });
    expect(out.transitiveBu).toBe(12); // 5 + 3 + 4
    expect(out.transitiveCount).toBe(3);
  });
});

// =============================================================================
// Effect primitives
// =============================================================================

describe("computeTransitiveBu — effect primitives", () => {
  it("adds effect's primitives to the total", () => {
    const out = computeTransitiveBu({
      primitiveLinks: [],
      effectLinks: [
        {
          effectId: "eff-1",
          primitiveLinks: [
            { primitiveId: 20, primitive: { id: 20, buCost: 7 } },
            { primitiveId: 21, primitive: { id: 21, buCost: 2 } },
          ],
        },
      ],
    });
    expect(out.transitiveBu).toBe(9);
  });

  it("adds primitives from capability's effect", () => {
    const out = computeTransitiveBu({
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          primitiveLinks: [{ primitiveId: 30, primitive: { id: 30, buCost: 5 } }],
          effectLinks: [
            {
              effectId: "eff-1",
              primitiveLinks: [{ primitiveId: 31, primitive: { id: 31, buCost: 4 } }],
            },
          ],
        },
      ],
    });
    expect(out.transitiveBu).toBe(9); // 5 + 4
  });
});

// =============================================================================
// Dedup
// =============================================================================

describe("computeTransitiveBu — dedup", () => {
  it("same primitive direct + via capability: counted once", () => {
    const out = computeTransitiveBu({
      primitiveLinks: [{ primitiveId: 7, primitive: { id: 7, buCost: 4 } }],
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          primitiveLinks: [{ primitiveId: 7, primitive: { id: 7, buCost: 4 } }],
        },
      ],
    });
    expect(out.transitiveBu).toBe(4);
    expect(out.transitiveCount).toBe(1);
  });

  it("same primitive in cap + cap's effect: counted once", () => {
    const out = computeTransitiveBu({
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          primitiveLinks: [{ primitiveId: 9, primitive: { id: 9, buCost: 5 } }],
          effectLinks: [
            {
              effectId: "eff-1",
              primitiveLinks: [{ primitiveId: 9, primitive: { id: 9, buCost: 5 } }],
            },
          ],
        },
      ],
    });
    expect(out.transitiveBu).toBe(5);
    expect(out.transitiveCount).toBe(1);
  });

  it("primitive appears 5 times across everything: still counted once", () => {
    const out = computeTransitiveBu({
      primitiveLinks: [{ primitiveId: 1, primitive: { id: 1, buCost: 3 } }],
      effectLinks: [
        {
          effectId: "eff-1",
          primitiveLinks: [{ primitiveId: 1, primitive: { id: 1, buCost: 3 } }],
        },
      ],
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          primitiveLinks: [{ primitiveId: 1, primitive: { id: 1, buCost: 3 } }],
          effectLinks: [
            {
              effectId: "eff-2",
              primitiveLinks: [{ primitiveId: 1, primitive: { id: 1, buCost: 3 } }],
            },
          ],
        },
      ],
    });
    expect(out.transitiveBu).toBe(3);
    expect(out.transitiveCount).toBe(1);
  });
});

// =============================================================================
// The user's worked example
// =============================================================================

describe("computeTransitiveBu — heritage worked example", () => {
  it("Mystic heritage: 3 direct primitives (8+8+4=20) + 13 capability primitives (avg ~3 each = ~39)", () => {
    // Reproducing the user's screenshot numbers: header shows 20 BU from
    // 3 direct primitives. The 'Primitives from capabilities (13)' section
    // has 13 primitives whose costs weren't summed. With Mystic's
    // described licenses (Domain Access Tier II baseline + Fast Execution
    // baseline + 2 spell capabilities), the real total should include
    // those 13 primitives too.
    const directPrims = [
      { primitiveId: 1, primitive: { id: 1, buCost: 8 } },
      { primitiveId: 2, primitive: { id: 2, buCost: 8 } },
      { primitiveId: 3, primitive: { id: 3, buCost: 4 } },
    ];
    const capPrims = Array.from({ length: 13 }, (_, i) => ({
      primitiveId: 100 + i,
      primitive: { id: 100 + i, buCost: 3 },
    }));
    const out = computeTransitiveBu({
      primitiveLinks: directPrims,
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          primitiveLinks: capPrims,
          effectLinks: [],
        },
      ],
    });
    // Direct: 8+8+4 = 20
    // Capability primitives: 13 × 3 = 39
    // Total: 59 (NOT 20 — that's the bug)
    expect(out.transitiveBu).toBe(59);
    expect(out.transitiveCount).toBe(16);
  });
});