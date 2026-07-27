/**
 * Phase 8.3d commit 1 (Mashu 2026-07-27): regression test for the
 * primitive hard_modifiers pipeline.
 *
 * Before commit 1, the character sheet's primitive row had no
 * place to read the authored `hard_modifiers` JSONB column. The
 * `aggregateCharacterSheet` aggregator's PrimitiveLinkSnapshot
 * didn't include the field, so it was silently dropped at the
 * sheet → view boundary.
 *
 * This commit wires the array through. The aggregator itself
 * doesn't USE the modifiers (the BU ledger still passes [] for
 * stacking evaluation — modifier evaluation is a separate,
 * future piece of work). The point of this commit is just
 * pipeline: the array survives aggregation so the UI can render
 * conditions in commit 2.
 */
import { describe, expect, it } from "vitest";

import { aggregateCharacterSheet } from "../sheet";
import type { PrimitiveLinkSnapshot } from "../sheet";

function makeLink(
  id: number,
  name: string,
  hardModifiers: readonly unknown[] = [],
): PrimitiveLinkSnapshot {
  return {
    primitiveId: id,
    source: "PERSONAL",
    acquiredAtLevel: 1,
    isMirrored: false,
    primitive: {
      id,
      name,
      category: "CHARACTER_SHEET_AUGMENT",
      buCost: 4,
      isMirrorable: false,
      mirrorBuCredit: 0,
      hardModifiers,
    },
  };
}

const BASE_INPUT = {
  level: 1,
  attrPhysical: 10,
  attrMental: 10,
  attrMagical: 10,
  attrProficient: null,
  practiceSlices: null,
  startingBu: 0,
  buSpent: 0,
  dmBonusBu: 0,
  currentVitality: null,
  size: "MEDIUM",
  capabilityLinks: [],
  itemLinks: [],
};

describe("sheet aggregator — primitive hard_modifiers pipeline (Phase 8.3d)", () => {
  it("accepts a primitive with hardModifiers: []", () => {
    const links = [makeLink(1, "Plain Primitive")];
    const result = aggregateCharacterSheet({
      ...BASE_INPUT,
      primitiveLinks: links,
    });
    expect(result).toBeDefined();
  });

  it("accepts a primitive with hardModifiers carrying a v1 condition", () => {
    // V1 condition shape: {kind: "preset", presetKey: "prone", ...}
    const v1Mod = {
      target: "character.attack",
      operation: "add",
      value: -2,
      condition: { kind: "preset", presetKey: "prone" },
      stacking: "stack",
    };
    const links = [makeLink(1, "Hobble", [v1Mod])];
    const result = aggregateCharacterSheet({
      ...BASE_INPUT,
      primitiveLinks: links,
    });
    expect(result).toBeDefined();
    // The aggregator doesn't surface hardModifiers in its return
    // shape today (BU ledger evaluates by primitive id, not by
    // modifier conditions). The point of this commit is that the
    // array survives without throwing.
  });

  it("accepts a primitive with hardModifiers carrying a legacy condition", () => {
    // Legacy condition shape: {key, operator, value}
    const legacyMod = {
      target: "character.attack",
      operation: "add",
      value: 3,
      condition: { key: "stance", operator: "equals", value: "mounted" },
      stacking: "stack",
    };
    const links = [makeLink(1, "Mounted Bonus", [legacyMod])];
    const result = aggregateCharacterSheet({
      ...BASE_INPUT,
      primitiveLinks: links,
    });
    expect(result).toBeDefined();
  });

  it("accepts multiple primitives, each with its own hardModifiers", () => {
    const mod1 = {
      target: "a",
      operation: "add",
      value: 1,
      condition: { kind: "preset", presetKey: "prone" },
      stacking: "stack",
    };
    const mod2 = {
      target: "b",
      operation: "add",
      value: 2,
      condition: {
        kind: "tags",
        customTags: ["target:in melee", "actor:mounted"],
      },
      stacking: "stack",
    };
    const mod3 = {
      target: "c",
      operation: "add",
      value: 3,
      condition: { kind: "narrative", text: "While singing" },
      stacking: "stack",
    };
    const links = [
      makeLink(1, "Prone Bonus", [mod1]),
      makeLink(2, "Mounted + Melee", [mod2]),
      makeLink(3, "Bardic Song", [mod3]),
    ];
    const result = aggregateCharacterSheet({
      ...BASE_INPUT,
      primitiveLinks: links,
    });
    expect(result).toBeDefined();
  });

  it("accepts a primitive with hardModifiers containing compound conditions", () => {
    // Compound: tokens array like ["Prone", "OR", "Stance", "AND", "Holding Torch"]
    const compoundMod = {
      target: "character.attack",
      operation: "add",
      value: 5,
      condition: {
        kind: "compound",
        tokens: ["Prone", "OR", "Stance", "AND", "Holding Torch"],
      },
      stacking: "stack",
    };
    const links = [makeLink(1, "Compound Bonus", [compoundMod])];
    const result = aggregateCharacterSheet({
      ...BASE_INPUT,
      primitiveLinks: links,
    });
    expect(result).toBeDefined();
  });

  it("accepts primitive rows where hardModifiers is undefined (defensive)", () => {
    // If a primitive row somehow has hardModifiers === undefined,
    // the page.tsx code defaults it to []. We test that the
    // aggregator doesn't choke on this edge case.
    const links = [
      {
        ...makeLink(1, "Plain"),
        primitive: {
          ...makeLink(1, "Plain").primitive,
          hardModifiers: undefined as unknown as readonly unknown[],
        },
      },
    ];
    const result = aggregateCharacterSheet({
      ...BASE_INPUT,
      primitiveLinks: links,
    });
    expect(result).toBeDefined();
  });
});