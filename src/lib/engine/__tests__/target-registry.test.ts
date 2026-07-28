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

const TESSY: ResolvedCharacterInput = {
  characterId: "tessy",
  level: 18,
  pb: 6,
  proficientAttribute: "mental",
  attributes: { physical: 14, mental: 14, magical: 10 },
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
  it("ATTR_TARGETS matches canonical modifier-target strings", () => {
    expect(ATTR_TARGETS.physical).toBe("character.attribute.physical");
    expect(ATTR_TARGETS.mental).toBe("character.attribute.mental");
    expect(ATTR_TARGETS.magical).toBe("character.attribute.magical");
  });

  it("SAVE_TARGETS maps to character.defense.{attr}Dc", () => {
    expect(SAVE_TARGETS.physical).toBe("character.defense.physicalDc");
    expect(SAVE_TARGETS.mental).toBe("character.defense.mentalDc");
    expect(SAVE_TARGETS.magical).toBe("character.defense.magicalDc");
  });

  it("VITALITY_TARGETS exposes max + current", () => {
    expect(VITALITY_TARGETS.max).toBe("character.maxVitality");
    expect(VITALITY_TARGETS.current).toBe("character.currentVitality");
  });
});

// =============================================================================
// Attribute modifier
// =============================================================================

describe("resolveAttributeModifier", () => {
  it("returns Math.floor((attr - 10) / 2) with no primitive slots", () => {
    expect(resolveAttributeModifier(TESSY, "physical").total).toBe(2); // (14-10)/2 = 2
    expect(resolveAttributeModifier(TESSY, "mental").total).toBe(2);
    expect(resolveAttributeModifier(TESSY, "magical").total).toBe(0); // (10-10)/2 = 0
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
              target: ATTR_TARGETS.physical,
              operation: "add",
              value: 2,
            },
          ],
        }),
      ],
    };
    expect(resolveAttributeModifier(input, "physical").total).toBe(4);
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
              target: ATTR_TARGETS.physical,
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
    // PHYS: mod 2, no PB (not proficient), 0 primitives = 2
    expect(resolveSaveValue(input, "physical").total).toBe(2);
    // MAGI: mod 0, no PB, 0 primitives = 0
    expect(resolveSaveValue(input, "magical").total).toBe(0);
  });

  it("adds PB for the proficient attribute", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      proficientAttribute: "mental",
      slots: [],
    };
    // MENT: mod 2, PB 6 (proficient), 0 primitives = 8
    expect(resolveSaveValue(input, "mental").total).toBe(8);
  });

  it("does NOT add PB if proficientAttribute is null", () => {
    const input: ResolvedCharacterInput = {
      ...TESSY,
      proficientAttribute: null,
      slots: [],
    };
    expect(resolveSaveValue(input, "mental").total).toBe(2);
    expect(resolveSaveValue(input, "physical").total).toBe(2);
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
              target: SAVE_TARGETS.magical,
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
    // PHYS: 5 + 6 + 2 + 0 = 13
    expect(resolveSaveDc(input, "physical").total).toBe(13);
    // MENT: 5 + 6 + 2 + 0 = 13
    expect(resolveSaveDc(input, "mental").total).toBe(13);
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
              target: SAVE_TARGETS.magical,
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
    expect(r.physical).toEqual({ total: 2, dc: 13 });
    expect(r.mental).toEqual({ total: 8, dc: 13 }); // proficient + PB
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
    // mod 2 + PB 6 + best physical slice 4 = 12
    expect(r.total).toBe(12);
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
    // mod 2 + 0 PB (not proficient) + 4 = 6
    expect(r.total).toBe(6);
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
              target: ATTR_TARGETS.physical,
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
              target: SAVE_TARGETS.magical,
              operation: "add",
              value: 3,
            },
          ],
        }),
      ],
    };
    expect(contributionsForTarget(input, ATTR_TARGETS.physical)).toHaveLength(1);
    expect(contributionsForTarget(input, SAVE_TARGETS.magical)).toHaveLength(1);
    expect(contributionsForTarget(input, "character.attribute.nonexistent")).toEqual([]);
  });
});