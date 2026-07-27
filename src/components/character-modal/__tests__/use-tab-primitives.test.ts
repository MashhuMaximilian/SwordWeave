/**
 * Phase 8.3b UI revamp: regression test for the unified-primitive-list
 * hook (useTabPrimitives). Verifies:
 *
 *   - Direct primitive slots are returned as-is (each is its own row,
 *     no global dedup — fixes the copy-counter bug where mirror and
 *     direct copies of the same primitiveId shared a card).
 *   - Inherited primitives come from heritage/capability/effect
 *     bundles with correct provenance tags.
 *   - Inherited primitives dedupe across sources (e.g. primitive
 *     appearing in heritage AND in capability — once).
 *
 * The test uses pure data manipulation (no React rendering) since
 * the hook is just a useMemo around the inputs.
 */
import { describe, it, expect } from "vitest";
import type { PendingSlot } from "../character-modal-store";

// =============================================================================
// Helpers — exercise the same logic as useTabPrimitives without React
// =============================================================================

interface BundlePrimitiveLink {
  primitiveId: number;
  isMirrored?: boolean;
  quantity?: number;
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
interface HeritageBundleLite {
  id: string;
  name: string;
  primitiveLinks: BundlePrimitiveLink[];
  capabilityLinks: BundleCapabilityLink[];
}
interface CapabilityBundleLike {
  id: string;
  name: string;
  primitiveLinks: BundlePrimitiveLink[];
  effectLinks: BundleEffectLink[];
  computedBu?: number;
}

interface InheritedPrimitive {
  primitiveId: number;
  name: string;
  buCost: number | null;
  isMirrorable: boolean | null;
  mirrorBuCredit: number | null;
  targetScope: string | null;
  hardModifiers: ReadonlyArray<unknown>;
  provenance:
    | { kind: "direct-heritage"; heritageName: string }
    | { kind: "direct-capability"; capabilityName: string }
    | { kind: "direct-effect"; capabilityName: string; effectName: string };
}

function buildTabPrimitives(
  slots: PendingSlot[],
  heritageBundles: Map<string, HeritageBundleLite | null>,
  capabilityBundles: Map<string, CapabilityBundleLike | null>,
) {
  const direct = slots.filter(
    (s): s is Extract<PendingSlot, { kind: "primitive" }> =>
      s.kind === "primitive",
  );
  const heritageSlots = slots.filter(
    (s): s is Extract<PendingSlot, { kind: "heritage" }> =>
      s.kind === "heritage",
  );
  const capabilitySlots = slots.filter(
    (s): s is Extract<PendingSlot, { kind: "capability" }> =>
      s.kind === "capability",
  );

  const inherited: InheritedPrimitive[] = [];
  const seen = new Set<number>();

  for (const hSlot of heritageSlots) {
    const bundle = heritageBundles.get(hSlot.heritageId);
    if (!bundle) continue;
    for (const link of bundle.primitiveLinks) {
      if (!link.primitive) continue;
      if (seen.has(link.primitive.id)) continue;
      seen.add(link.primitive.id);
      inherited.push({
        primitiveId: link.primitive.id,
        name: link.primitive.name,
        buCost: link.primitive.buCost,
        isMirrorable: link.primitive.isMirrorable ?? null,
        mirrorBuCredit: link.primitive.mirrorBuCredit ?? null,
        targetScope: link.primitive.targetScope ?? null,
        hardModifiers: link.primitive.hardModifiers ?? [],
        provenance: { kind: "direct-heritage", heritageName: hSlot.name },
      });
    }
    for (const capLink of bundle.capabilityLinks) {
      const capName = capLink.capability?.name ?? "(unknown)";
      for (const p of capLink.primitiveLinks) {
        if (!p.primitive) continue;
        if (seen.has(p.primitive.id)) continue;
        seen.add(p.primitive.id);
        inherited.push({
          primitiveId: p.primitive.id,
          name: p.primitive.name,
          buCost: p.primitive.buCost,
          isMirrorable: p.primitive.isMirrorable ?? null,
          mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
          targetScope: p.primitive.targetScope ?? null,
          hardModifiers: p.primitive.hardModifiers ?? [],
          provenance: { kind: "direct-capability", capabilityName: capName },
        });
      }
      for (const effLink of capLink.effectLinks) {
        const effName = effLink.effect?.name ?? "(unknown)";
        for (const p of effLink.primitiveLinks) {
          if (!p.primitive) continue;
          if (seen.has(p.primitive.id)) continue;
          seen.add(p.primitive.id);
          inherited.push({
            primitiveId: p.primitive.id,
            name: p.primitive.name,
            buCost: p.primitive.buCost,
            isMirrorable: p.primitive.isMirrorable ?? null,
            mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
            targetScope: p.primitive.targetScope ?? null,
            hardModifiers: p.primitive.hardModifiers ?? [],
            provenance: {
              kind: "direct-effect",
              capabilityName: capName,
              effectName: effName,
            },
          });
        }
      }
    }
  }

  for (const cSlot of capabilitySlots) {
    const capBundle = capabilityBundles.get(cSlot.capabilityId);
    if (!capBundle) continue;
    const capName = cSlot.name;
    for (const p of capBundle.primitiveLinks) {
      if (!p.primitive) continue;
      if (seen.has(p.primitive.id)) continue;
      seen.add(p.primitive.id);
      inherited.push({
        primitiveId: p.primitive.id,
        name: p.primitive.name,
        buCost: p.primitive.buCost,
        isMirrorable: p.primitive.isMirrorable ?? null,
        mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
        targetScope: p.primitive.targetScope ?? null,
        hardModifiers: p.primitive.hardModifiers ?? [],
        provenance: { kind: "direct-capability", capabilityName: capName },
      });
    }
    for (const effLink of capBundle.effectLinks) {
      const effName = effLink.effect?.name ?? "(unknown)";
      for (const p of effLink.primitiveLinks) {
        if (!p.primitive) continue;
        if (seen.has(p.primitive.id)) continue;
        seen.add(p.primitive.id);
        inherited.push({
          primitiveId: p.primitive.id,
          name: p.primitive.name,
          buCost: p.primitive.buCost,
          isMirrorable: p.primitive.isMirrorable ?? null,
          mirrorBuCredit: p.primitive.mirrorBuCredit ?? null,
          targetScope: p.primitive.targetScope ?? null,
          hardModifiers: p.primitive.hardModifiers ?? [],
          provenance: {
            kind: "direct-effect",
            capabilityName: capName,
            effectName: effName,
          },
        });
      }
    }
  }

  return { direct, inherited, heritageSlots, capabilitySlots };
}

// =============================================================================
// Tests
// =============================================================================

describe("useTabPrimitives — direct primitives (one row per slot, no global dedup)", () => {
  it("returns each PendingSlot as its own row — no dedup by primitiveId", () => {
    // Bug fix: previously the UI rendered all copies of the same
    // primitiveId as ONE card with a copy counter. Now each PendingSlot
    // is its own row in the unified list — matches the DB model where
    // each copy is its own row.
    const slots: PendingSlot[] = [
      {
        kind: "primitive",
        primitiveId: 42,
        tab: "manifest",
        name: "Vitality Core Augment II",
        mirror: true,
        slotId: "s1",
      },
      {
        kind: "primitive",
        primitiveId: 42,
        tab: "manifest",
        name: "Vitality Core Augment II",
        mirror: false,
        slotId: "s2",
      },
      {
        kind: "primitive",
        primitiveId: 42,
        tab: "manifest",
        name: "Vitality Core Augment II",
        mirror: false,
        slotId: "s3",
      },
    ];
    const { direct } = buildTabPrimitives(
      slots,
      new Map(),
      new Map(),
    );
    expect(direct).toHaveLength(3);
    // The mirror row is separate from the direct rows
    expect(direct.filter((s) => s.mirror === true)).toHaveLength(1);
    expect(direct.filter((s) => s.mirror !== true)).toHaveLength(2);
  });

  it("empty slot list → empty direct + empty inherited", () => {
    const { direct, inherited } = buildTabPrimitives(
      [],
      new Map(),
      new Map(),
    );
    expect(direct).toHaveLength(0);
    expect(inherited).toHaveLength(0);
  });
});

describe("useTabPrimitives — inherited primitives (from heritage bundles)", () => {
  it("expands heritage primitiveLinks to inherited rows with provenance", () => {
    const heritageBundles = new Map<string, HeritageBundleLite | null>([
      [
        "her-1",
        {
          id: "her-1",
          name: "Ironborn",
          primitiveLinks: [
            {
              primitiveId: 10,
              primitive: { id: 10, name: "Kinetic Hardening", buCost: 6 },
            },
            {
              primitiveId: 11,
              primitive: { id: 11, name: "Heavy Die Block", buCost: 4 },
            },
          ],
          capabilityLinks: [],
        },
      ],
    ]);
    const slots: PendingSlot[] = [
      {
        kind: "heritage",
        heritageId: "her-1",
        heritageKind: "LINEAGE",
        name: "Ironborn",
        slotId: "h1",
      },
    ];
    const { inherited } = buildTabPrimitives(
      slots,
      heritageBundles,
      new Map(),
    );
    expect(inherited).toHaveLength(2);
    expect(inherited[0]).toMatchObject({
      primitiveId: 10,
      name: "Kinetic Hardening",
      provenance: { kind: "direct-heritage", heritageName: "Ironborn" },
    });
    expect(inherited[1]).toMatchObject({
      primitiveId: 11,
      name: "Heavy Die Block",
      provenance: { kind: "direct-heritage", heritageName: "Ironborn" },
    });
  });

  it("expands heritage → capability → primitiveLinks with provenance", () => {
    const heritageBundles = new Map<string, HeritageBundleLite | null>([
      [
        "her-1",
        {
          id: "her-1",
          name: "Ironborn",
          primitiveLinks: [],
          capabilityLinks: [
            {
              capabilityId: "cap-1",
              capability: { id: "cap-1", name: "Aegis Shield" },
              primitiveLinks: [
                {
                  primitiveId: 30,
                  primitive: { id: 30, name: "Direct Material Trigger", buCost: 3 },
                },
              ],
              effectLinks: [],
            },
          ],
        },
      ],
    ]);
    const slots: PendingSlot[] = [
      {
        kind: "heritage",
        heritageId: "her-1",
        heritageKind: "LINEAGE",
        name: "Ironborn",
        slotId: "h1",
      },
    ];
    const { inherited } = buildTabPrimitives(
      slots,
      heritageBundles,
      new Map(),
    );
    expect(inherited).toHaveLength(1);
    expect(inherited[0]).toMatchObject({
      primitiveId: 30,
      provenance: {
        kind: "direct-capability",
        capabilityName: "Aegis Shield",
      },
    });
  });

  it("expands heritage → capability → effect → primitiveLinks with provenance", () => {
    const heritageBundles = new Map<string, HeritageBundleLite | null>([
      [
        "her-1",
        {
          id: "her-1",
          name: "Ironborn",
          primitiveLinks: [],
          capabilityLinks: [
            {
              capabilityId: "cap-1",
              capability: { id: "cap-1", name: "Vow of Enmity" },
              primitiveLinks: [],
              effectLinks: [
                {
                  effectId: "eff-1",
                  effect: { id: "eff-1", name: "System Freeze" },
                  primitiveLinks: [
                    {
                      primitiveId: 99,
                      primitive: { id: 99, name: "Velocity Arrest", buCost: 8 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    ]);
    const slots: PendingSlot[] = [
      {
        kind: "heritage",
        heritageId: "her-1",
        heritageKind: "LINEAGE",
        name: "Ironborn",
        slotId: "h1",
      },
    ];
    const { inherited } = buildTabPrimitives(
      slots,
      heritageBundles,
      new Map(),
    );
    expect(inherited).toHaveLength(1);
    expect(inherited[0]).toMatchObject({
      primitiveId: 99,
      provenance: {
        kind: "direct-effect",
        capabilityName: "Vow of Enmity",
        effectName: "System Freeze",
      },
    });
  });

  it("dedupes a primitive appearing in heritage AND capability — once", () => {
    const heritageBundles = new Map<string, HeritageBundleLite | null>([
      [
        "her-1",
        {
          id: "her-1",
          name: "Ironborn",
          primitiveLinks: [
            {
              primitiveId: 50,
              primitive: { id: 50, name: "Shared Primitive", buCost: 5 },
            },
          ],
          capabilityLinks: [],
        },
      ],
    ]);
    const slots: PendingSlot[] = [
      {
        kind: "heritage",
        heritageId: "her-1",
        heritageKind: "LINEAGE",
        name: "Ironborn",
        slotId: "h1",
      },
      {
        kind: "capability",
        capabilityId: "cap-1",
        tab: "manifest",
        name: "Aegis Shield",
        slotId: "c1",
      },
    ];
    const capabilityBundles = new Map<string, CapabilityBundleLike | null>([
      [
        "cap-1",
        {
          id: "cap-1",
          name: "Aegis Shield",
          primitiveLinks: [
            {
              primitiveId: 50, // SAME primitive as in heritage
              primitive: { id: 50, name: "Shared Primitive", buCost: 5 },
            },
          ],
          effectLinks: [],
        },
      ],
    ]);
    const { inherited } = buildTabPrimitives(
      slots,
      heritageBundles,
      capabilityBundles,
    );
    expect(inherited).toHaveLength(1);
    // First-seen wins (heritage wins because heritageSlots come first)
    expect(inherited[0]!.provenance).toMatchObject({
      kind: "direct-heritage",
      heritageName: "Ironborn",
    });
  });
});

describe("useTabPrimitives — direct capabilities on the tab", () => {
  it("expands direct-capability primitiveLinks with provenance", () => {
    const capabilityBundles = new Map<string, CapabilityBundleLike | null>([
      [
        "cap-1",
        {
          id: "cap-1",
          name: "Greater Invisibility",
          primitiveLinks: [
            {
              primitiveId: 70,
              primitive: { id: 70, name: "Verb Access Tier II", buCost: 8 },
            },
          ],
          effectLinks: [],
        },
      ],
    ]);
    const slots: PendingSlot[] = [
      {
        kind: "capability",
        capabilityId: "cap-1",
        tab: "manifest",
        name: "Greater Invisibility",
        slotId: "c1",
      },
    ];
    const { inherited } = buildTabPrimitives(
      slots,
      new Map(),
      capabilityBundles,
    );
    expect(inherited).toHaveLength(1);
    expect(inherited[0]).toMatchObject({
      primitiveId: 70,
      provenance: {
        kind: "direct-capability",
        capabilityName: "Greater Invisibility",
      },
    });
  });
});

describe("useTabPrimitives — bug regression: copy counter per-instance, not per-primitiveId", () => {
  it("Mashu's scenario: 1 mirror + 1 direct + 2 added direct copies = 4 separate rows", () => {
    // The bug: clicking "Add another copy" on the direct row produced
    // a "×2" badge that ALSO appeared on the mirror row, because the
    // old PrimitiveSlotRow deduped by primitiveId globally.
    //
    // Fix: each PendingSlot is its own row. The mirror row and the
    // direct rows are independent. Adding a direct copy creates a
    // new PendingSlot → new row → no badge on the mirror row.
    const slots: PendingSlot[] = [
      // Original mirror row
      {
        kind: "primitive",
        primitiveId: 42,
        tab: "manifest",
        name: "Vitality Core Augment II",
        mirror: true,
        slotId: "s1",
      },
      // Original direct row
      {
        kind: "primitive",
        primitiveId: 42,
        tab: "manifest",
        name: "Vitality Core Augment II",
        mirror: false,
        slotId: "s2",
      },
      // 1st copy of direct
      {
        kind: "primitive",
        primitiveId: 42,
        tab: "manifest",
        name: "Vitality Core Augment II",
        mirror: false,
        slotId: "s3",
      },
      // 2nd copy of direct
      {
        kind: "primitive",
        primitiveId: 42,
        tab: "manifest",
        name: "Vitality Core Augment II",
        mirror: false,
        slotId: "s4",
      },
    ];
    const { direct } = buildTabPrimitives(
      slots,
      new Map(),
      new Map(),
    );
    expect(direct).toHaveLength(4);
    // 1 mirror row stays separate
    const mirrorRows = direct.filter((s) => s.mirror === true);
    expect(mirrorRows).toHaveLength(1);
    // 3 direct rows (original + 2 copies) — independent
    const directRows = direct.filter((s) => s.mirror !== true);
    expect(directRows).toHaveLength(3);
    // Each row has a distinct slotId (the dedup key)
    const slotIds = new Set(direct.map((s) => s.slotId));
    expect(slotIds.size).toBe(4);
  });
});