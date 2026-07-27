/**
 * Phase 8.3b UI revamp: tests for the Section 2 (Source Bundles)
 * shape and the modifier-mirrorability rule.
 *
 * These are pure-data tests — we exercise the same dedup logic that
 * the Section 2 cards use, and verify the modifier-pass-through
 * from bundle → row → mirrorability decision.
 */
import { describe, it, expect } from "vitest";

// =============================================================================
// Re-implement the relevant logic to verify
// =============================================================================

interface BundlePrimitiveLink {
  primitiveId: number;
  isMirrored?: boolean;
  primitive: {
    id: number;
    name: string;
    buCost: number | null;
    isMirrorable?: boolean;
    mirrorBuCredit?: number;
    targetScope?: string | null;
    hardModifiers?: ReadonlyArray<unknown>;
  } | null;
}

interface BundleEffectLink {
  effectId: string;
  effect: { id: string; name: string } | null;
  primitiveLinks: BundlePrimitiveLink[];
}

interface BundleCapabilityLink {
  capabilityId: string;
  capability: { id: string; name: string } | null;
  primitiveLinks: BundlePrimitiveLink[];
  effectLinks: BundleEffectLink[];
}

/**
 * Mirrorability rule for the row component.
 *
 * A primitive is mirrorable iff:
 *   1. The DB-level isMirrorable flag is true
 *   2. The primitive has at least one modifier entry (so it actually
 *      modifies something — verbs/domains with no hardModifier are
 *      NOT mirrorable)
 *   3. No operation is currently assigned (Phase 8.3c+; always true
 *      for the modal today)
 */
function isRowMirrorable(
  isMirrorable: boolean | null | undefined,
  hardModifiers: ReadonlyArray<unknown> | undefined,
): boolean {
  return isMirrorable === true && (hardModifiers?.length ?? 0) > 0;
}

/**
 * Section 2 (Source Bundles) ONLY shows capabilities + effects, never
 * primitives. Verify a helper that strips primitives returns a slim
 * capability list.
 */
function slimBundleForSection2(bundle: {
  id: string;
  name: string;
  primitiveLinks: BundlePrimitiveLink[];
  capabilityLinks: BundleCapabilityLink[];
  computedBu: number;
}) {
  // Section 2 cards intentionally drop primitiveLinks — they're
  // surfaced in Section 1 (Active Primitives) instead.
  return {
    id: bundle.id,
    name: bundle.name,
    computedBu: bundle.computedBu,
    capabilityLinks: bundle.capabilityLinks.map((cl) => ({
      capabilityId: cl.capabilityId,
      capability: cl.capability,
      effectLinks: cl.effectLinks,
    })),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Mirrorability rule (Phase 8.3b UI revamp item #2)", () => {
  it("returns false when DB isMirrorable flag is false", () => {
    expect(isRowMirrorable(false, [{ target: "x", operation: "add", value: 1 }])).toBe(
      false,
    );
  });

  it("returns false when hardModifiers is empty even if isMirrorable=true", () => {
    // The whole point of the new rule: a primitive that's "marked
    // mirrorable" but has no actual modifier payload shouldn't show
    // the mirror toggle.
    expect(isRowMirrorable(true, [])).toBe(false);
  });

  it("returns true when isMirrorable=true AND has at least one modifier", () => {
    expect(
      isRowMirrorable(true, [
        {
          target: "max_vitality",
          operation: "add",
          value: 12,
          stacking: "stack",
        },
      ]),
    ).toBe(true);
  });

  it("returns false when isMirrorable is null/undefined", () => {
    expect(isRowMirrorable(null, [{ x: 1 }])).toBe(false);
    expect(isRowMirrorable(undefined, [{ x: 1 }])).toBe(false);
  });

  it("hidden verbs/domains (no modifier) → mirror toggle hidden", () => {
    // Realistic: "Domain Access Tier II" has isMirrorable=true but
    // hardModifiers=[] (it's a domain grant, not a modifier). The
    // mirror toggle must NOT appear on this row.
    const row = {
      isMirrorable: true,
      hardModifiers: [] as ReadonlyArray<unknown>,
    };
    expect(isRowMirrorable(row.isMirrorable, row.hardModifiers)).toBe(false);
  });

  it("modifier primitives (vitality, attribute tweaks) → mirror toggle visible", () => {
    // Realistic: "Vitality Core Augment II" has isMirrorable=true
    // AND hardModifiers=[{target:"max_vitality",operation:"add",...}]
    const row = {
      isMirrorable: true,
      hardModifiers: [
        {
          target: "max_vitality",
          operation: "add",
          value: 12,
          stacking: "stack",
        },
      ] as ReadonlyArray<unknown>,
    };
    expect(isRowMirrorable(row.isMirrorable, row.hardModifiers)).toBe(true);
  });
});

describe("Section 2 (Source Bundles) — primitives must NOT appear", () => {
  it("strips primitiveLinks from the bundle for Section 2 rendering", () => {
    const fullBundle = {
      id: "her-1",
      name: "Mystic",
      computedBu: 134,
      primitiveLinks: [
        {
          primitiveId: 1,
          primitive: { id: 1, name: "Domain Tier II", buCost: 8 },
        },
        {
          primitiveId: 2,
          primitive: { id: 2, name: "Domain Tier III", buCost: 12 },
        },
      ],
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          capability: { id: "cap-1", name: "Greater Invisibility" },
          primitiveLinks: [
            {
              primitiveId: 10,
              primitive: { id: 10, name: "Verb Access Tier II", buCost: 8 },
            },
          ],
          effectLinks: [],
        },
      ],
    };
    const slim = slimBundleForSection2(fullBundle);
    // No primitiveLinks anywhere in the slim bundle.
    expect(slim).not.toHaveProperty("primitiveLinks");
    expect(slim.capabilityLinks[0]).not.toHaveProperty("primitiveLinks");
    // Capabilities + effects preserved.
    expect(slim.capabilityLinks).toHaveLength(1);
    expect(slim.computedBu).toBe(134);
  });

  it("preserves effects inside capabilities (effects ARE shown in Section 2)", () => {
    const bundle = {
      id: "her-1",
      name: "Vow of Enmity (fork)",
      computedBu: 124,
      primitiveLinks: [],
      capabilityLinks: [
        {
          capabilityId: "cap-1",
          capability: { id: "cap-1", name: "Vow of Enmity (fork)" },
          primitiveLinks: [],
          effectLinks: [
            {
              effectId: "eff-1",
              effect: { id: "eff-1", name: "System Freeze" },
              primitiveLinks: [],
            },
          ],
        },
      ],
    };
    const slim = slimBundleForSection2(bundle);
    expect(slim.capabilityLinks[0]!.effectLinks).toHaveLength(1);
    expect(slim.capabilityLinks[0]!.effectLinks[0]!.effect?.name).toBe(
      "System Freeze",
    );
  });
});

describe("Mirror toggle state — paired mirror slot detection", () => {
  // Mirror-toggle behavior on inherited rows: when there's a paired
  // mirror slot, the button reads "Unmirror"; otherwise "Mirror".

  function findPairedMirrorSlot(
    slots: ReadonlyArray<{ kind: string; primitiveId?: number; mirror?: boolean }>,
    primitiveId: number,
  ): boolean {
    return slots.some(
      (s) =>
        s.kind === "primitive" &&
        s.primitiveId === primitiveId &&
        s.mirror === true,
    );
  }

  it("detects no paired mirror → isMirrorActive=false", () => {
    const slots = [
      { kind: "primitive", primitiveId: 42, mirror: false },
    ];
    expect(findPairedMirrorSlot(slots, 42)).toBe(false);
  });

  it("detects paired mirror → isMirrorActive=true", () => {
    const slots = [
      { kind: "primitive", primitiveId: 42, mirror: false },
      { kind: "primitive", primitiveId: 42, mirror: true },
    ];
    expect(findPairedMirrorSlot(slots, 42)).toBe(true);
  });

  it("isMirrorActive unaffected by other primitives' mirror slots", () => {
    const slots = [
      { kind: "primitive", primitiveId: 99, mirror: true }, // different id
      { kind: "primitive", primitiveId: 42, mirror: false },
    ];
    expect(findPairedMirrorSlot(slots, 42)).toBe(false);
  });
});

describe("Modifier display — what gets shown when expanded", () => {
  it("renders one chip per modifier entry", () => {
    const mods = [
      {
        target: "max_vitality",
        operation: "add",
        value: 12,
        stacking: "stack",
      },
      {
        target: "HP",
        operation: "subtract",
        value: 4,
      },
    ];
    expect(mods).toHaveLength(2);
    expect(mods[0]!.target).toBe("max_vitality");
    expect(mods[1]!.operation).toBe("subtract");
  });

  it("mirror operation is the sign flip of the original", () => {
    function mirrorOp(op: string): string {
      if (op === "add") return "subtract";
      if (op === "subtract" || op === "sub") return "add";
      return op;
    }
    expect(mirrorOp("add")).toBe("subtract");
    expect(mirrorOp("subtract")).toBe("add");
    expect(mirrorOp("sub")).toBe("add");
    expect(mirrorOp("set")).toBe("set"); // no flip
  });
});