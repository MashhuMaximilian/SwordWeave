/**
 * condition-fail-closed.test.ts — Phase 9.5 follow-up (Mashu 2026-09-07)
 *
 * Pins isConditionComputable's contract for target/scene references
 * without context: false. Used by resolveModifiers to decide
 * whether to apply a modifier when its predicate references an
 * axis we don't have.
 */

import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  isConditionComputable,
  type CharacterConditionState,
  type ConditionContext,
  type TargetConditionState,
} from "@/lib/engine/condition-evaluator";

function makeCharacter(): CharacterConditionState {
  return {
    vitality: 10,
    vitalityMax: 10,
    saveDc: 11,
    blockValue: 10,
    attributes: { physical: 10, mental: 10, magical: 10 } as never,
    practices: {} as never,
    proficiencies: new Set<string>(),
    flags: new Set<string>(),
    custom: {},
  };
}

describe("isConditionComputable — target axis missing", () => {
  it("returns false when condition references target but ctx.target is undefined", () => {
    const cond = { kind: "tags" as const, customTags: ["target:exposed"] };
    const ctx: ConditionContext = {
      character: makeCharacter(),
    };
    expect(isConditionComputable(cond, ctx)).toBe(false);
  });

  it("returns true when condition references target and ctx.target.tags has the tag", () => {
    const cond = { kind: "tags" as const, customTags: ["target:exposed"] };
    const target: TargetConditionState = {
      custom: {},
      tags: new Set<string>(["exposed"]),
    };
    const ctx: ConditionContext = {
      character: makeCharacter(),
      target,
    };
    expect(isConditionComputable(cond, ctx)).toBe(true);
    expect(evaluateCondition(cond, ctx)).toBe(true);
  });
});
