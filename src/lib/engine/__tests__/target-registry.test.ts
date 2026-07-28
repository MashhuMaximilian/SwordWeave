/**
 * target-registry.test.ts — Phase 8.3f S2 (Mashu 2026-07-28)
 *
 * Tests for the canonical target registry + the per-attribute
 * helpers (resolveAttributeModifier / resolveSaveValue /
 * resolveSaveDc / resolveAllSaves / resolveMaxVitality).
 */

import { describe, expect, it } from "vitest";
import type { HardModifier } from "@/types/swordweave";
import {
  type ResolvedCharacterInput,
  type ResolvedPrimitiveSlot,
} from "../resolve-modifiers";
import {
  ATTR_TARGETS,
  SAVE_TARGETS,
  VITALITY_TARGETS,
  resolveAllSaves,
  resolveAttributeModifier,
  resolveBestPracticeTotal,
  resolveMaxVitality,
  resolveSaveDc,
  resolveSaveValue,
  contributionsForTarget,
} from "../target-registry";

// =============================================================================
// Fixtures
// =============================================================================

// Phase 8.3g (Mashu 2026-07-28): Tessy now uses REAL slice values
// from her character sheet, not D&D scores. The DB stores slices
// in [-1, +5] (sum = 10). Earlier test data (14, 14, 10) was
// based on the wrong D&D-style formula.
const TESSY: ResolvedCharacterInput = {
  characterId: "tessy",
  level: 18,
  pb: 6,
  proficientAttribute: "mental",
  // From the edit-modal screenshot: P=+5, M=+5, MG=+0 (sum 10/10).
  // Sheet shows final PHYS +2, MENT +8, MAGI +0 — so primitive
  // contributions are: PHYS -3, MENT +3, MAGI 0. The TESTS for
  // primitive contributions add their own slots on top of TESSY.
  attributes: { physical: 5, mental: 5, magical: 0 },
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

// =============================================================================
// Target constants
// =============================================================================

describe("target constants", () => {
  it("ATTR_TARGETS maps to canonical short axis 'attribute'", () => {
    expect(ATTR_TARGETS.physical).toBe("attribute");
    expect(ATTR_TARGETS.mental).toBe("attribute");
    expect(ATTR_TARGETS.magical).toBe("attribute");
  });

  it("SAVE_TARGETS maps to canonical short axis 'defense_dc'", () => {
    expect(SAVE_TARGETS.physical).toBe("defense_dc");
    expect(SAVE_TARGETS.mental).toBe("defense_dc");
    expect(SAVE_TARGETS.magical).toBe("defense_dc");
  });

  it("VITALITY_TARGETS exposes max + current (snake_case)", () => {
    // Phase 8.3g v2: the resolver uses the canonical short
    // axis names (snake_case). The DB stores target as
    // `max_vitality`, not `character.maxVitality`.
    expect(VITALITY_TARGETS.max).toBe("max_vitality");
    expect(VITALITY_TARGETS.current).toBe("current_vitality");
  });
});

// =============================================================================
// Attribute modifier
// =============================================================================

describe("resolveAttributeModifier", () => {
  it("returns the slice value directly with no primitive slots", () => {
    // Phase 8.3g: slices ARE the modifier (no D&D transform).
    expect(resolveAttributeModifier(TESSY, "physical").total).toBe(5);
    expect(resolveAttributeModifier(TESSY, "mental").total).toBe(5);
    expect(resolveAttributeModifier(TESSY, "magical").total).toBe(0);
  });

  it("adds primitive contributions on top of the raw modifier", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [
            {
              kind: "modify",
              target: `${ATTR_TARGETS.physical}.physical`,
              operation: "add",
              value: 2,
            },
          ],
        }),
      ],
    };
    // Phase 8.3g: PHYS slice 5 + 2 primitive = 7 (was 4 with old D&D formula).
    expect(resolveAttributeModifier(input, "physical").total).toBe(7);
  });

  it("returns attribution list with provenance", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [
        makeSlot({
          primitiveId: 172,
          name: "Systemic Resonance Qualifier",
          hardModifiers: [
            {
              kind: "modify",
              target: `${ATTR_TARGETS.physical}.physical`,
              operation: "add",
              value: 2,
            },
          ],
          originHeritageId: "h-mystic",
          originCapabilityId: "c-auradet",
        }),
      ],
    };
    const r = resolveAttributeModifier(input, "physical");
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0]?.primitiveName).toBe("Systemic Resonance Qualifier");
    // sourceNames aren't passed in this test, so heritageName falls
    // back to null. provenance.kind still derives correctly from
    // the slot's origin fields.
    expect(r.contributions[0]?.provenance.heritageName).toBe(null);
    expect(r.contributions[0]?.provenance.kind).toBe("capability");
  });
});

// =============================================================================
// Save value
// =============================================================================

describe("resolveSaveValue", () => {
  it("does NOT add PB for non-proficient attributes", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      proficientAttribute: "mental",
      slots: [],
    };
    // Phase 8.3g: PHYS slice is 5, not the old D&D-style 2.
    // PHYS: mod 5, no PB (not proficient), 0 primitives = 5
    expect(resolveSaveValue(input, "physical").total).toBe(5);
    // MAGI: mod 0, no PB, 0 primitives = 0
    expect(resolveSaveValue(input, "magical").total).toBe(0);
  });

  it("adds PB for the proficient attribute", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      proficientAttribute: "mental",
      slots: [],
    };
    // MENT: mod 5, PB 6 (proficient), 0 primitives = 11
    expect(resolveSaveValue(input, "mental").total).toBe(11);
  });

  it("does NOT add PB if proficientAttribute is null", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      proficientAttribute: null,
      slots: [],
    };
    expect(resolveSaveValue(input, "mental").total).toBe(5);
    expect(resolveSaveValue(input, "physical").total).toBe(5);
  });

  it("adds primitive contributions targeting the save target", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [
        makeSlot({
          primitiveId: 99,
          hardModifiers: [
            {
              kind: "modify",
              target: `${SAVE_TARGETS.magical}.magical`,
              operation: "add",
              value: 3,
            },
          ],
        }),
      ],
    };
    // MAGI: mod 0, no PB (not proficient), +3 from primitive = 3
    expect(resolveSaveValue(input, "magical").total).toBe(3);
  });
});

// =============================================================================
// Save DC
// =============================================================================

describe("resolveSaveDc", () => {
  it("returns 5 + PB + attr modifier + primitives", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [],
    };
    // Phase 8.3g: slice IS the modifier (no D&D transform).
    // PHYS: 5 + 6 + 5 + 0 = 16
    expect(resolveSaveDc(input, "physical").total).toBe(16);
    // MENT: 5 + 6 + 5 + 0 = 16
    expect(resolveSaveDc(input, "mental").total).toBe(16);
    // MAGI: 5 + 6 + 0 + 0 = 11
    expect(resolveSaveDc(input, "magical").total).toBe(11);
  });

  it("includes primitive contributions", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [
        makeSlot({
          primitiveId: 99,
          hardModifiers: [
            {
              kind: "modify",
              target: `${SAVE_TARGETS.magical}.magical`,
              operation: "add",
              value: 3,
            },
          ],
        }),
      ],
    };
    // MAGI DC: 5 + 6 + 0 + 3 = 14
    expect(resolveSaveDc(input, "magical").total).toBe(14);
  });
});

// =============================================================================
// resolveAllSaves
// =============================================================================

describe("resolveAllSaves", () => {
  it("returns total + DC for all three attributes", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [],
    };
    const r = resolveAllSaves(input);
    // Phase 8.3g: slice IS the modifier.
    // PHYS: mod 5, no PB, SV 5; DC 5+6+5 = 16
    expect(r.physical).toEqual({ total: 5, dc: 16 });
    // MENT: mod 5, +PB 6 (proficient), SV 11; DC 5+6+5 = 16
    expect(r.mental).toEqual({ total: 11, dc: 16 });
    // MAGI: mod 0, SV 0; DC 5+6+0 = 11
    expect(r.magical).toEqual({ total: 0, dc: 11 });
  });
});

// =============================================================================
// resolveMaxVitality
// =============================================================================

describe("resolveMaxVitality", () => {
  it("returns (10 + PB) × level as baseline", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      level: 18,
      pb: 6,
      slots: [],
    };
    // (10 + 6) × 18 = 16 × 18 = 288
    expect(resolveMaxVitality(input).total).toBe(288);
  });

  it("adds primitive contributions targeting maxVitality", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [
            {
              kind: "modify",
              target: VITALITY_TARGETS.max,
              operation: "add",
              value: 12,
            },
          ],
        }),
      ],
    };
    expect(resolveMaxVitality(input).total).toBe(300);
  });

  it("mirrored primitive with VARIABLE_VECTOR flips sign", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [
        makeSlot({
          primitiveId: 301,
          hardModifiers: [
            {
              kind: "modify",
              target: VITALITY_TARGETS.max,
              operation: "add",
              value: 8,
            },
          ],
          isMirrored: true,
          isMirrorable: true,
          mirrorVector: "VARIABLE_VECTOR",
        }),
      ],
    };
    // baseline 288, mirrored +8 → -8 → 280
    expect(resolveMaxVitality(input).total).toBe(280);
  });
});

// =============================================================================
// resolveBestPracticeTotal
// =============================================================================

describe("resolveBestPracticeTotal", () => {
  it("returns attr mod + PB (if proficient) + best practice slice", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      proficientAttribute: "physical",
      slots: [],
    };
    const r = resolveBestPracticeTotal(input, "physical", {
      physical: 4,
      mental: 2,
      magical: 1,
    });
    // Phase 8.3g: PHYS slice 5 + PB 6 + best phys slice 4 = 15
    expect(r.total).toBe(15);
  });

  it("does NOT add PB when not proficient", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      proficientAttribute: "mental",
      slots: [],
    };
    const r = resolveBestPracticeTotal(input, "physical", {
      physical: 4,
      mental: 2,
      magical: 1,
    });
    // PHYS slice 5 + 0 PB (not proficient) + 4 = 9
    expect(r.total).toBe(9);
  });
});

// =============================================================================
// contributionsForTarget
// =============================================================================

describe("contributionsForTarget", () => {
  it("returns the contributions list for a specific target", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      slots: [
        makeSlot({
          primitiveId: 1,
          hardModifiers: [
            {
              kind: "modify",
              target: `${ATTR_TARGETS.physical}.physical`,
              operation: "add",
              value: 2,
            },
          ],
        }),
        makeSlot({
          primitiveId: 2,
          hardModifiers: [
            {
              kind: "modify",
              target: `${SAVE_TARGETS.magical}.magical`,
              operation: "add",
              value: 3,
            },
          ],
        }),
      ],
    };
    expect(contributionsForTarget(input, `${ATTR_TARGETS.physical}.physical`)).toHaveLength(1);
    expect(contributionsForTarget(input, `${SAVE_TARGETS.magical}.magical`)).toHaveLength(1);
    expect(contributionsForTarget(input, "character.attribute.nonexistent")).toEqual([]);
  });
});