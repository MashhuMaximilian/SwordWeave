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
    // Phase 8.M: engine now exposes SINGLE attack_bonus / save_dc
    // targets derived from proficientAttribute (or physical fallback).
    // These start at 0 when no primitives are slotted.
    expect(r.totals).toEqual({ attack_bonus: 0, save_dc: 0 });
    expect(r.byTarget.attack_bonus).toEqual([]);
    expect(r.byTarget.save_dc).toEqual([]);
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
      [1, { heritageName: "Mystic", capabilityName: "Aura Detective", effectName: null, accordion: null }],
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


// =============================================================================
// Phase 8.I i2.5 (Mashu 2026-08-05): runtime token resolution
// =============================================================================

describe("resolveModifiers — i2.5 — runtime token resolution", () => {
  it("set behavior:blockValue=6 + add 1 to /blockValue/ — end-to-end", () => {
    // Primitive 1: set blockValue to 6
    const setBlock: HardModifier = {
      kind: "modify",
      target: "behavior",
      operation: "set",
      value: 6,
      metadata: { behaviorName: "blockValue" },
    };
    // Primitive 2: add /blockValue/ to the action.damage target
    // (the value is a typed token that resolves to 6 at runtime)
    const subBlockToDamage: HardModifier = {
      kind: "modify",
      target: "action.damage",
      operation: "subtract",
      value: { kind: "behavior", name: "blockValue" },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({ primitiveId: 1, hardModifiers: [setBlock] }),
        makeSlot({ primitiveId: 2, hardModifiers: [subBlockToDamage] }),
      ],
    };
    const result = resolveModifiers(input);
    // The behavior variable is set to 6.
    expect(result.totals["behavior.blockValue"]).toBe(6);
    // The second primitive subtracts the resolved value (6) from
    // action.damage — net contribution is -6.
    expect(result.totals["action.damage"]).toBe(-6);
  });

  it("PB chip on + PB to Prowess — engine resolves to character's PB", () => {
    const pbToProwess: HardModifier = {
      kind: "modify",
      target: "skill_practice_check",
      operation: "add",
      value: { kind: "derived", which: "pb" },
      metadata: { targetScope: { layer: "PRACTICE", values: ["PROWESS"] } },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      // BASE_INPUT has pb=3 (L5)
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [pbToProwess] })],
    };
    const result = resolveModifiers(input);
    // The PB token resolves to 3. The byTarget key is the raw
    // target string "skill_practice_check" — sub-targets in
    // metadata.targetScope.values are stored but don't expand
    // the key. The drawer reads this and combines with the
    // practice's per-sub-target contribution elsewhere.
    expect(result.totals["skill_practice_check"]).toBe(3);
  });

  it("/physical/ token resolves to character's physical attribute", () => {
    const selfRefPhys: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      // "+1 to physical attribute, where the value is the
      // physical attribute itself" — useful for clones, mirrors.
      value: { kind: "attribute", attribute: "physical" },
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      // BASE_INPUT has physical=10
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [selfRefPhys] })],
    };
    const result = resolveModifiers(input);
    // The /physical/ token resolves to physical attribute (10), and
    // the modifier adds 10. The byTarget key is the raw target
    // string "attribute" — sub-targets in metadata don't expand
    // the key.
    expect(result.totals["attribute"]).toBe(10);
  });

  it("plain numeric value still works (backwards compat)", () => {
    const add3: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 3,
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [add3] })],
    };
    const result = resolveModifiers(input);
    expect(result.totals["attribute"]).toBe(3);
  });

  it("dice expression #2d6# averages to 7", () => {
    const diceMod: HardModifier = {
      kind: "modify",
      target: "action.damage",
      operation: "add",
      value: { kind: "dice", expression: "2d6" },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [diceMod] })],
    };
    const result = resolveModifiers(input);
    // 2d6 avg = 7. The modifier contributes +7 to action.damage.
    expect(result.totals["action.damage"]).toBe(7);
  });

  it("multiple behavior variables don't collide (each routed to behavior.<name>)", () => {
    const setBlock: HardModifier = {
      kind: "modify",
      target: "behavior",
      operation: "set",
      value: 6,
      metadata: { behaviorName: "blockValue" },
    };
    const setDarkvision: HardModifier = {
      kind: "modify",
      target: "behavior",
      operation: "set",
      value: 60,
      metadata: { behaviorName: "darkvision" },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [
        makeSlot({ primitiveId: 1, hardModifiers: [setBlock] }),
        makeSlot({ primitiveId: 2, hardModifiers: [setDarkvision] }),
      ],
    };
    const result = resolveModifiers(input);
    // Each behavior has its own key.
    expect(result.totals["behavior.blockValue"]).toBe(6);
    expect(result.totals["behavior.darkvision"]).toBe(60);
  });

  it("scoped target routing — modifier on 'attribute' with PHYSICAL scope hits both 'attribute' AND 'attribute.PHYSICAL'", () => {
    // Phase 8.I i2.5 (Mashu 2026-08-05): the form saves the
    // short target 'attribute' with metadata.targetScope.values
    // = ['PHYSICAL']. The resolver emits byTarget entries for
    // both the raw key AND each scoped key, so the fast-path
    // lookups in target-registry (resolveAttributeModifier,
    // resolveSaveDc) find the contribution.
    const add3Phys: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 3,
      metadata: {
        targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] },
      },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [add3Phys] })],
    };
    const result = resolveModifiers(input);
    // Both keys populated. Phase 8.I i2.5c: scoped values
    // normalized to lowercase to match the engine's
    // target-registry lookups (attribute.physical, not
    // attribute.PHYSICAL).
    expect(result.totals["attribute"]).toBe(3);
    expect(result.totals["attribute.physical"]).toBe(3);
  });
});

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

// =============================================================================
// Phase 8.I i1 (Mashu 2026-08-04): engine drop rule + mirror inheritance
// =============================================================================

describe("resolveModifiers — i1 null sub-target drop rule", () => {
  it("drops an attribute modifier with no sub-target", () => {
    // v7-E canonical shape: short target "attribute" with no
    // PHYSICAL/MENTAL/MAGICAL picked in metadata.targetScope.values.
    // Engine should silently drop — does NOT contribute to any
    // attribute.
    const malformed: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 5,
      metadata: { targetScope: { layer: "ATTRIBUTE", values: [] } },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [malformed] })],
    };
    const result = resolveModifiers(input);
    // No contribution to any attribute target.
    expect(result.totals["attribute.physical"]).toBeUndefined();
    expect(result.totals["attribute.mental"]).toBeUndefined();
    expect(result.totals["attribute.magical"]).toBeUndefined();
    expect(result.byTarget["attribute"] ?? []).toHaveLength(0);
  });

  it("drops a defense_dc modifier with no sub-target", () => {
    const malformed: HardModifier = {
      kind: "modify",
      target: "defense_dc",
      operation: "add",
      value: 3,
      metadata: { targetScope: { layer: "METRIC", values: [] } },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [malformed] })],
    };
    const result = resolveModifiers(input);
    expect(result.totals["defense_dc.physical"]).toBeUndefined();
    expect(result.totals["defense_dc.mental"]).toBeUndefined();
    expect(result.totals["defense_dc.magical"]).toBeUndefined();
  });

  it("drops a speed modifier with no locomotion type", () => {
    const malformed: HardModifier = {
      kind: "modify",
      target: "speed",
      operation: "add",
      value: 30,
      metadata: { targetScope: { layer: "METRIC", values: [] } },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [malformed] })],
    };
    const result = resolveModifiers(input);
    expect(result.byTarget["speed"] ?? []).toHaveLength(0);
  });

  it("accepts an attribute modifier with PHYSICAL picked", () => {
    const valid: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 3,
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [valid] })],
    };
    const result = resolveModifiers(input);
    // Should contribute to physical attribute.
    expect(result.byTarget["attribute"]).toHaveLength(1);
  });

  it("accepts attribute modifier with all three checked (any attribute)", () => {
    const broad: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 1,
      metadata: {
        targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL", "MENTAL", "MAGICAL"] },
      },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [broad] })],
    };
    const result = resolveModifiers(input);
    expect(result.byTarget["attribute"]).toHaveLength(1);
  });

  it("accepts a behavior modifier with name set", () => {
    // Phase 8.I i2.5 (Mashu 2026-08-05): behavior modifiers
    // route to byTarget["behavior.<name>"] (not "behavior") so
    // multiple behaviors don't collide.
    const behavior: HardModifier = {
      kind: "modify",
      target: "behavior",
      operation: "set",
      value: 6,
      metadata: { behaviorName: "blockValue" },
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [behavior] })],
    };
    const result = resolveModifiers(input);
    expect(result.byTarget["behavior.blockValue"] ?? []).toHaveLength(1);
  });

  it("drops a behavior modifier with no name", () => {
    const malformed: HardModifier = {
      kind: "modify",
      target: "behavior",
      operation: "set",
      value: 6,
      metadata: {},
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [malformed] })],
    };
    const result = resolveModifiers(input);
    expect(result.byTarget["behavior"] ?? []).toHaveLength(0);
  });

  it("passes through legacy dotted target strings (backward compat)", () => {
    // Legacy "character.attribute.physical" carries the sub-target
    // in the string itself. These should always be considered valid.
    const legacy: HardModifier = {
      kind: "modify",
      target: "character.attribute.physical",
      operation: "add",
      value: 2,
    };
    const input: ResolvedCharacterInput = {
      ...BASE_INPUT,
      slots: [makeSlot({ primitiveId: 1, hardModifiers: [legacy] })],
    };
    const result = resolveModifiers(input);
    expect(result.byTarget["character.attribute.physical"]).toHaveLength(1);
  });
});

describe("resolveModifiers — i1 mirror inheritance through heritage/capability", () => {
  it("mirrored primitive slotted via heritage-bundled cap shows mirrored value", () => {
    // Create a primitive that adds 2 to physical. Mirror it
    // directly. Also bundle it in a heritage (via the
    // originHeritageId / originCapabilityId fields). The engine
    // should produce the same mirrored value regardless of
    // whether the slot is direct or inherited.
    const addTwoPhys: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 2,
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    };
    const directSlot = makeSlot({
      primitiveId: 1,
      hardModifiers: [addTwoPhys],
      isMirrored: true,
      isMirrorable: true,
      mirrorVector: "VARIABLE_VECTOR",
    });
    const heritageSlot = makeSlot({
      primitiveId: 1, // Same primitiveId — same modifier
      hardModifiers: [addTwoPhys],
      isMirrored: true,
      isMirrorable: true,
      mirrorVector: "VARIABLE_VECTOR",
      originHeritageId: "heritage-ironborn",
      originCapabilityId: null,
      originEffectId: null,
    });
    const capSlot = makeSlot({
      primitiveId: 1,
      hardModifiers: [addTwoPhys],
      isMirrored: true,
      isMirrorable: true,
      mirrorVector: "VARIABLE_VECTOR",
      originHeritageId: null,
      originCapabilityId: "cap-blocking",
      originEffectId: null,
    });

    const directResult = resolveModifiers({ ...BASE_INPUT, slots: [directSlot] });
    const heritageResult = resolveModifiers({ ...BASE_INPUT, slots: [heritageSlot] });
    const capResult = resolveModifiers({ ...BASE_INPUT, slots: [capSlot] });

    // Each slot should produce the mirrored value (Add → Subtract 2 → -2)
    expect(directResult.byTarget["attribute"]).toHaveLength(1);
    expect(directResult.byTarget["attribute"]?.[0]?.value).toBe(-2);
    expect(heritageResult.byTarget["attribute"]?.[0]?.value).toBe(-2);
    expect(capResult.byTarget["attribute"]?.[0]?.value).toBe(-2);

    // Provenance kind should differ
    expect(directResult.byTarget["attribute"]?.[0]?.provenance.kind).toBe("direct");
    expect(heritageResult.byTarget["attribute"]?.[0]?.provenance.kind).toBe("heritage");
    expect(capResult.byTarget["attribute"]?.[0]?.provenance.kind).toBe("capability");
  });

  it("NOT mirrored primitive slotted via heritage-bundled cap shows non-mirrored value", () => {
    const addTwoPhys: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 2,
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    };
    const directSlot = makeSlot({
      primitiveId: 1,
      hardModifiers: [addTwoPhys],
      isMirrored: false,
      isMirrorable: true,
      mirrorVector: "VARIABLE_VECTOR",
    });
    const heritageSlot = makeSlot({
      primitiveId: 1,
      hardModifiers: [addTwoPhys],
      isMirrored: false,
      isMirrorable: true,
      mirrorVector: "VARIABLE_VECTOR",
      originHeritageId: "heritage-ironborn",
      originCapabilityId: null,
      originEffectId: null,
    });

    const directResult = resolveModifiers({ ...BASE_INPUT, slots: [directSlot] });
    const heritageResult = resolveModifiers({ ...BASE_INPUT, slots: [heritageSlot] });

    expect(directResult.byTarget["attribute"]?.[0]?.value).toBe(2);
    expect(heritageResult.byTarget["attribute"]?.[0]?.value).toBe(2);
  });

  it("non-mirrorable primitive slotted as mirrored is a safe no-op (pass-through)", () => {
    const addTwoPhys: HardModifier = {
      kind: "modify",
      target: "attribute",
      operation: "add",
      value: 2,
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    };
    const slot = makeSlot({
      primitiveId: 1,
      hardModifiers: [addTwoPhys],
      isMirrored: true,
      isMirrorable: false, // Not mirrorable — but isMirrored is true
      mirrorVector: null,
    });
    const result = resolveModifiers({ ...BASE_INPUT, slots: [slot] });
    // Pass-through: value stays +2, mirror is no-op
    expect(result.byTarget["attribute"]?.[0]?.value).toBe(2);
  });
});
