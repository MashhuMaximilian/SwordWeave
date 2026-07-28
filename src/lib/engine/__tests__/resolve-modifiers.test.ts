/**
 * resolve-modifiers.test.ts — Phase 8.3f (Mashu 2026-07-28)
 *
 * Tests for the canonical character modifier resolver. Each test
 * exercises one rule from the resolver's algorithm and asserts
 * both the totals AND the per-target attribution list.
 *
 * The `parityCheck` helper runs the wrapper against the existing
 * `evaluateModifiers()` engine to confirm the totals match.
 */

import { describe, expect, it } from "vitest";
import type { HardModifier } from "@/types/swordweave";
import {
  type ResolvedCharacterInput,
  type ResolvedPrimitiveSlot,
  parityCheck,
  resolveModifiers,
} from "../resolve-modifiers";

// =============================================================================
// Test fixtures
// =============================================================================

const BASE_INPUT: ResolvedCharacterInput = {
  characterId: "char-1",
  level: 5,
  pb: 3,
  proficientAttribute: null,
  attributes: {
    physical: 10,
    mental: 10,
    magical: 10,
  },
  slots: [],
};

function makeSlot(
  overrides: Partial<ResolvedPrimitiveSlot> & {
    primitiveId: number;
    hardModifiers: HardModifier[];
  },
): ResolvedPrimitiveSlot {
  return {
    name: `Primitive ${overrides.primitiveId}`,
    category: "TEST",
    isMirrored: false,
    isMirrorable: false,
    mirrorVector: null,
    originHeritageId: null,
    originCapabilityId: null,
    originEffectId: null,
    ...overrides,
  };
}

const ADD_TO_PHYS: HardModifier = {
  kind: "modify",
  target: "character.attribute.physical",
  operation: "add",
  value: 2,
};
const SUB_TO_MENT: HardModifier = {
  kind: "modify",
  target: "character.attribute.mental",
  operation: "subtract",
  value: 1,
};
const ADD_TO_SAVE_PHYS: HardModifier = {
  kind: "modify",
  target: "character.defense.physicalDc",
  operation: "add",
  value: 1,
};

// =============================================================================
// Resolver behaviour
// =============================================================================

describe("resolveModifiers", () => {
  it("returns empty totals + empty byTarget when no slots are slotted", () => {
    const r = resolveModifiers(BASE_INPUT);
    expect(r.totals).toEqual({});
    expect(r.byTarget).toEqual({});
    expect(r.mirrorCosts).toEqual([]);
  });

  it("sums multiple adds to the same target with stacking=stack", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({ primitiveId: 1, hardModifiers: [ADD_TO_PHYS] }),
        makeSlot({ primitiveId: 2, hardModifiers: [ADD_TO_PHYS] }),
      ],
    };
    const r = resolveModifiers(input);
    expect(r.totals["character.attribute.physical"]).toBe(4);
    expect(r.byTarget["character.attribute.physical"]).toHaveLength(2);
    expect(r.byTarget["character.attribute.physical"]?.[0]?.primitiveId).toBe(1);
    expect(r.byTarget["character.attribute.physical"]?.[1]?.primitiveId).toBe(2);
  });

  it("computes subtract correctly", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({ primitiveId: 1, hardModifiers: [SUB_TO_MENT] }),
      ],
    };
    const r = resolveModifiers(input);
    expect(r.totals["character.attribute.mental"]).toBe(-1);
  });

  it("treats mirrored non-mirrorable as pass-through (safe default)", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [ADD_TO_PHYS],
          isMirrored: true,
          isMirrorable: false, // DB shouldn't allow this, but runtime is defensive
          mirrorVector: "VARIABLE_VECTOR",
        }),
      ],
    };
    const r = resolveModifiers(input);
    // Mirror ignored → contribution stays at +2.
    expect(r.totals["character.attribute.physical"]).toBe(2);
    expect(r.mirrorCosts).toEqual([]);
  });

  it("applies VARIABLE_VECTOR mirror (sign flip)", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [ADD_TO_PHYS],
          isMirrored: true,
          isMirrorable: true,
          mirrorVector: "VARIABLE_VECTOR",
        }),
      ],
    };
    const r = resolveModifiers(input);
    // +2 mirrored → -2.
    expect(r.totals["character.attribute.physical"]).toBe(-2);
    expect(r.byTarget["character.attribute.physical"]?.[0]?.value).toBe(-2);
    expect(r.byTarget["character.attribute.physical"]?.[0]?.preMirrorValue).toBe(2);
  });

  it("applies STRUCTURAL_FAULT mirror (magnitude preserved)", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [ADD_TO_SAVE_PHYS],
          isMirrored: true,
          isMirrorable: true,
          mirrorVector: "STRUCTURAL_FAULT",
        }),
      ],
    };
    const r = resolveModifiers(input);
    expect(r.totals["character.defense.physicalDc"]).toBe(1);
  });

  it("captures COST_INSTABILITY mirror as a user-side cost", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [ADD_TO_PHYS],
          isMirrored: true,
          isMirrorable: true,
          mirrorVector: "COST_INSTABILITY",
        }),
      ],
    };
    const r = resolveModifiers(input);
    // COST_INSTABILITY: target value preserved (magnitude stays),
    // user pays extra strain.
    expect(r.totals["character.attribute.physical"]).toBe(2);
    expect(r.mirrorCosts).toHaveLength(1);
    expect(r.mirrorCosts[0]).toEqual({
      primitiveId: 1,
      primitiveName: "Primitive 1",
      vector: "COST_INSTABILITY",
      magnitude: 2, // mirrors the original value
    });
  });

  it("applies highest-only stacking", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [{ ...ADD_TO_PHYS, stacking: "highest-only" }],
        }),
        makeSlot({
          primitiveId: 2,
          hardModifiers: [{ ...ADD_TO_PHYS, value: 5, stacking: "highest-only" }],
        }),
      ],
    };
    const r = resolveModifiers(input);
    expect(r.totals["character.attribute.physical"]).toBe(5);
  });

  it("applies replace stacking (last wins)", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [{ ...ADD_TO_PHYS, stacking: "replace" }],
        }),
        makeSlot({
          primitiveId: 2,
          hardModifiers: [
            { ...ADD_TO_PHYS, value: 5, stacking: "replace" },
          ],
        }),
      ],
    };
    const r = resolveModifiers(input);
    // Per resolve-modifiers.ts: stacked value = LAST (5) per
    // applyStacking's replace semantics. But our wrapper
    // applied ops sequentially first then stacked, so the
    // sequential sum (2+5=7) and the stacked value (5) differ —
    // we use stacked = 5.
    expect(r.totals["character.attribute.physical"]).toBe(5);
  });

  it("passes v1-shape conditions as active (Phase 7 design)", () => {
    const v1CondMod: HardModifier = {
      kind: "modify",
      target: "character.attribute.physical",
      operation: "add",
      value: 3,
      condition: { kind: "always" } as never, // v1 shape
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({ primitiveId: 1, hardModifiers: [v1CondMod] }),
      ],
    };
    const r = resolveModifiers(input);
    expect(r.totals["character.attribute.physical"]).toBe(3);
    expect(r.byTarget["character.attribute.physical"]?.[0]?.conditionActive).toBe(true);
  });

  it("reports provenance.kind correctly", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        // direct
        makeSlot({ primitiveId: 1, hardModifiers: [ADD_TO_PHYS] }),
        // heritage-direct
        makeSlot({
          primitiveId: 2,
          hardModifiers: [ADD_TO_PHYS],
          originHeritageId: "h-1",
        }),
        // capability
        makeSlot({
          primitiveId: 3,
          hardModifiers: [ADD_TO_PHYS],
          originHeritageId: "h-1",
          originCapabilityId: "c-1",
        }),
        // effect
        makeSlot({
          primitiveId: 4,
          hardModifiers: [ADD_TO_PHYS],
          originHeritageId: "h-1",
          originCapabilityId: "c-1",
          originEffectId: "e-1",
        }),
      ],
    };
    const r = resolveModifiers(input);
    const phys = r.byTarget["character.attribute.physical"];
    expect(phys).toHaveLength(4);
    expect(phys?.[0]?.provenance.kind).toBe("direct");
    expect(phys?.[1]?.provenance.kind).toBe("heritage");
    expect(phys?.[2]?.provenance.kind).toBe("capability");
    expect(phys?.[3]?.provenance.kind).toBe("effect");
  });

  it("includes source names when sourceNames map is provided", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [ADD_TO_PHYS],
          originHeritageId: "h-1",
          originCapabilityId: "c-1",
        }),
      ],
    };
    const sources = new Map([
      [1, { heritageName: "Mystic", capabilityName: "Aura Detective", effectName: null }],
    ]);
    const r = resolveModifiers(input, sources);
    const c = r.byTarget["character.attribute.physical"]?.[0];
    expect(c?.provenance.heritageName).toBe("Mystic");
    expect(c?.provenance.capabilityName).toBe("Aura Detective");
    expect(c?.provenance.effectName).toBe(null);
  });

  it("ignores modifiers with non-numeric values", () => {
    const badMod: HardModifier = {
      kind: "modify",
      target: "character.attribute.physical",
      operation: "add",
      value: "not-a-number",
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [badMod] })],
    };
    const r = resolveModifiers(input);
    expect(r.totals["character.attribute.physical"]).toBeUndefined();
  });
});

// =============================================================================
// Parity check against evaluateModifiers()
// =============================================================================

describe("parityCheck", () => {
  it("matches evaluateModifiers() for a direct slot", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({ primitiveId: 1, hardModifiers: [ADD_TO_PHYS] }),
        makeSlot({ primitiveId: 2, hardModifiers: [ADD_TO_PHYS] }),
      ],
    };
    const p = parityCheck(input);
    expect(p.matches).toBe(true);
  });

  it("matches evaluateModifiers() for mirrored slots", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [ADD_TO_PHYS],
          isMirrored: true,
          isMirrorable: true,
          mirrorVector: "VARIABLE_VECTOR",
        }),
        makeSlot({
          primitiveId: 2,
          hardModifiers: [SUB_TO_MENT],
        }),
      ],
    };
    const p = parityCheck(input);
    expect(p.matches).toBe(true);
  });

  it("matches evaluateModifiers() for mixed target / mixed stacking", () => {
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [ADD_TO_PHYS, ADD_TO_SAVE_PHYS],
        }),
        makeSlot({
          primitiveId: 2,
          hardModifiers: [
            { ...ADD_TO_PHYS, value: 5, stacking: "replace" },
          ],
        }),
      ],
    };
    const p = parityCheck(input);
    expect(p.matches).toBe(true);
  });
});