/**
 * fail-closed.test.ts — Phase 9.5 follow-up (Mashu 2026-09-07)
 *
 * Regression: the resolver used to silently INCLUDE a modifier
 * when its condition referenced an axis the sheet didn't carry
 * (e.g. target:exposed when no target context was present).
 * That meant Enfeebling Envenom's "target:exposed" gate would
 * fire on every roll. Mashu wanted fail-CLOSED instead — if we
 * can't prove the predicate, suppress the bonus.
 *
 * This file pins that contract. Save DC seed is 8 + PB(3) +
 * chosenAttr(physical=10) = 21.
 */

import { describe, expect, it } from "vitest";
import type { HardModifier } from "@/types/swordweave";
import {
  type ResolvedCharacterInput,
  type ResolvedPrimitiveSlot,
  resolveModifiers,
} from "@/lib/engine/resolve-modifiers";

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

describe("resolveModifiers — fail closed on non-computable conditions", () => {
  it("suppresses target:exposed modifier when no target context is present", () => {
    const mod: HardModifier = {
      kind: "modify",
      target: "save_dc",
      operation: "add",
      value: -5,
      condition: {
        kind: "tags",
        customTags: ["target:exposed"],
      },
    };
    const input: ResolvedCharacterInput = {
      characterId: "c1",
      level: 1,
      pb: 3,
      proficientAttribute: null,
      attributes: { physical: 10, mental: 10, magical: 10 },
      slots: [makeSlot({ primitiveId: 9999, hardModifiers: [mod] })],
      conditionContext: {
        character: {
          flags: new Set(),
          custom: {},
          practices: new Map(),
          proficiencies: new Set(),
          vitality: 10,
          vitalityMax: 10,
        },
        // intentionally NO `target` — fail-closed path
      },
    };

    const result = resolveModifiers(input);

    // Without fail-closed: save_dc = 21 + (-5) = 16.
    // With fail-closed: save_dc stays at 21 because the
    // engine can't prove target:exposed and refuses to apply
    // the unverified modifier.
    expect(result.totals["save_dc"]).toBe(21);
  });

  it("applies target:exposed modifier when target context with the tag IS present", () => {
    const mod: HardModifier = {
      kind: "modify",
      target: "save_dc",
      operation: "add",
      value: -5,
      condition: {
        kind: "tags",
        customTags: ["target:exposed"],
      },
    };
    const input: ResolvedCharacterInput = {
      characterId: "c1",
      level: 1,
      pb: 3,
      proficientAttribute: null,
      attributes: { physical: 10, mental: 10, magical: 10 },
      slots: [makeSlot({ primitiveId: 9997, hardModifiers: [mod] })],
      conditionContext: {
        character: {
          flags: new Set(),
          custom: {},
          practices: new Map(),
          proficiencies: new Set(),
          vitality: 10,
          vitalityMax: 10,
        },
        target: {
          custom: {},
          tags: new Set(["exposed"]),
        },
      },
    };

    const result = resolveModifiers(input);

    // target:exposed evaluates TRUE — save_dc = 21 + (-5) = 16.
    expect(result.totals["save_dc"]).toBe(16);
  });
});
