import { describe, expect, it } from "vitest";
import type { HardModifier } from "@/types/swordweave";
import { resolveModifiers, type ResolvedCharacterInput, type ResolvedPrimitiveSlot } from "../resolve-modifiers";
import { applyOperation } from "../modifiers";
import { sumPrimitiveContributions } from "../primitive-walk";

const attributes = { physical: 4, mental: 3, magical: 2 };

function input(slots: ResolvedPrimitiveSlot[], proficientAttribute: "physical" | "magical" = "magical"): ResolvedCharacterInput {
  return {
    characterId: "library-audit",
    level: 5,
    pb: 3,
    proficientAttribute,
    attributes,
    slots,
    conditionContext: {
      character: {
        vitality: 20,
        vitalityMax: 20,
        saveDc: 13,
        blockValue: 0,
        attributes,
        practices: {} as never,
        proficiencies: new Set([proficientAttribute, "prowess"]),
        flags: new Set(),
        custom: {},
      },
    },
  };
}

function slot(modifier: HardModifier, overrides: Partial<ResolvedPrimitiveSlot> = {}): ResolvedPrimitiveSlot {
  return {
    primitiveId: 1,
    name: "Audit primitive",
    category: "SHEET_AUGMENT",
    hardModifiers: [modifier],
    isMirrored: false,
    isMirrorable: true,
    mirrorVector: "VARIABLE_VECTOR",
    originHeritageId: null,
    originCapabilityId: null,
    originEffectId: null,
    ...overrides,
  };
}

describe("starter primitive resolver contract", () => {
  it("applies, inhibits, and mirrors a typed +1 Physical rule", () => {
    const primitive = slot({
      kind: "modify", target: "attribute", operation: "add",
      value: { kind: "number", value: 1 }, stacking: "stack",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    });
    expect(resolveModifiers(input([primitive])).totals["attribute.physical"]).toBe(5);
    expect(resolveModifiers(input([{ ...primitive, isToggledOff: true }])).totals["attribute.physical"]).toBe(4);
    expect(resolveModifiers(input([{ ...primitive, isMirrored: true }])).totals["attribute.physical"]).toBe(3);
  });

  it("applies a broad half-PB rule only to non-proficient Practices, rounding up", () => {
    const primitive = slot({
      kind: "modify", target: "skill_practice_check", operation: "add",
      value: { kind: "derived", which: "pb_half" }, stacking: "stack",
      metadata: { targetScope: { layer: "PRACTICE", values: ["PROWESS", "AWARENESS"] } },
      condition: { kind: "tags", customTags: ["actor:not_proficient"] },
    });
    const result = resolveModifiers(input([primitive]));
    expect(result.totals["skill_practice_check.prowess"]).toBe(0);
    expect(result.totals["skill_practice_check.awareness"]).toBe(2);
    expect(result.byTarget["skill_practice_check.prowess"]?.[0]?.conditionActive).toBe(false);
    expect(result.byTarget["skill_practice_check.awareness"]?.[0]?.conditionActive).toBe(true);
  });

  it("grants a missing save proficiency once, without doubling primary proficiency", () => {
    const primitive = slot({
      kind: "modify", target: "attribute", operation: "grant",
      value: { kind: "keyword", text: "proficiency" }, stacking: "highest-only",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
      condition: { kind: "tags", customTags: ["actor:not_proficient_in_attribute(physical)"] },
    }, { isMirrorable: false });
    expect(resolveModifiers(input([primitive])).totals["physical_saving_throw"]).toBe(7);
    expect(resolveModifiers(input([primitive], "physical")).totals["physical_saving_throw"]).toBe(7);
    expect(resolveModifiers(input([primitive, { ...primitive, primitiveId: 2 }])).totals["physical_saving_throw"]).toBe(7);
  });

  it("excludes inactive action-roll conditions from the displayed saving throw", () => {
    const primitive = slot({
      kind: "modify", target: "action_roll", operation: "add",
      value: { kind: "number", value: 2 }, stacking: "stack",
      metadata: { targetScope: { layer: "ACTION_ROLL", values: ["PHYSICAL_SAVE"] } },
      condition: { kind: "tags", customTags: ["actor:is_prone"] },
    });
    expect(resolveModifiers(input([primitive])).totals["physical_saving_throw"]).toBe(4);
  });

  it("rounds fractional penalties upward on both sides of zero", () => {
    expect(applyOperation(0, "subtract", 1.5)).toBe(-1);
    expect(applyOperation(0, "multiply", -0.5)).toBe(0);
    expect(applyOperation(-3, "divide", 2)).toBe(-1);
  });

  it("mirrors typed PB values and inverse arithmetic operations", () => {
    const pb = slot({
      kind: "modify", target: "attribute", operation: "add",
      value: { kind: "derived", which: "pb_half" }, stacking: "stack",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    });
    const multiply = slot({
      kind: "modify", target: "attribute", operation: "multiply",
      value: { kind: "number", value: 2 }, stacking: "stack",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    });
    const minimum = slot({
      kind: "modify", target: "attribute", operation: "min",
      value: { kind: "number", value: 3 }, stacking: "stack",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    });
    expect(resolveModifiers(input([pb])).totals["attribute.physical"]).toBe(6);
    expect(resolveModifiers(input([{ ...pb, isMirrored: true }])).totals["attribute.physical"]).toBe(2);
    expect(resolveModifiers(input([multiply])).totals["attribute.physical"]).toBe(8);
    expect(resolveModifiers(input([{ ...multiply, isMirrored: true }])).totals["attribute.physical"]).toBe(2);
    expect(resolveModifiers(input([minimum])).totals["attribute.physical"]).toBe(4);
    expect(resolveModifiers(input([{ ...minimum, isMirrored: true }])).totals["attribute.physical"]).toBe(3);
  });

  it("honors a modifier's mirror opt-out", () => {
    const primitive = slot({
      kind: "modify", target: "attribute", operation: "add",
      value: { kind: "number", value: 1 }, stacking: "stack",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] }, mirror: { optedOut: true } },
    }, { isMirrored: true });
    expect(resolveModifiers(input([primitive])).totals["attribute.physical"]).toBe(5);
  });

  it("recomputes half-PB contributions after a PB change", () => {
    const halfPb = slot({
      kind: "modify", target: "skill_practice_check", operation: "add",
      value: { kind: "derived", which: "pb_half" }, stacking: "stack",
      metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } },
    });
    const pbBoost = slot({
      kind: "modify", target: "proficiency_bonus", operation: "add",
      value: { kind: "number", value: 2 }, stacking: "stack",
    }, { primitiveId: 2 });
    const result = resolveModifiers(input([halfPb, pbBoost]));
    expect(result.totals["proficiency_bonus"]).toBe(5);
    expect(result.totals["skill_practice_check.awareness"]).toBe(3);
    expect(result.byTarget["skill_practice_check.awareness"]?.[0]?.value).toBe(3);
  });

  it("turns a compiled contribution off with its capability and restores it when active", () => {
    const compiled = slot({
      kind: "modify", target: "action_roll", operation: "add",
      value: { kind: "number", value: 2 }, stacking: "stack",
      metadata: { targetScope: { layer: "ACTION_ROLL", values: ["ATTACK_ROLL"] } },
    }, { originCapabilityId: "cap-a", originEffectId: "effect-a" });
    expect(resolveModifiers(input([compiled])).totals["attack_bonus"]).toBe(7);
    expect(resolveModifiers(input([{ ...compiled, isToggledOff: true }])).totals["attack_bonus"]).toBe(5);
  });

  it("activates an authored tracked condition from sheet state", () => {
    const primitive = slot({
      kind: "modify", target: "attribute", operation: "add",
      value: { kind: "number", value: 2 }, stacking: "stack",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
      condition: { kind: "compound", tokens: ["self:stat|vitality|<|10"] },
    });
    const healthy = input([primitive]);
    expect(resolveModifiers(healthy).totals["attribute.physical"]).toBe(4);
    const wounded = {
      ...healthy,
      conditionContext: {
        ...healthy.conditionContext!,
        character: { ...healthy.conditionContext!.character, vitality: 5 },
      },
    };
    expect(resolveModifiers(wounded).totals["attribute.physical"]).toBe(6);
  });

  it("keeps a bound walking bonus on walking in the sheet's primitive walk", () => {
    const modifier: HardModifier = {
      kind: "modify", target: "speed", operation: "add",
      value: { kind: "number", value: 10 }, stacking: "stack",
      metadata: { targetScope: { layer: "METRIC", values: ["WALKING_SPEED"] } },
    };
    const links = [{ primitive: { id: 218, name: "Stride Extension", hardModifiers: [modifier] }, isMirrored: false }];
    expect(sumPrimitiveContributions(links, "speed", "walking")).toBe(10);
    expect(sumPrimitiveContributions(links, "speed", "swimming")).toBe(0);
  });

  it("keeps a bound Physical increment off Mental and Magical sheet axes", () => {
    const modifier: HardModifier = {
      kind: "modify", target: "attribute", operation: "add",
      value: { kind: "number", value: 1 }, stacking: "stack",
      metadata: { targetScope: { layer: "ATTRIBUTE", values: ["PHYSICAL"] } },
    };
    const links = [{ primitive: { id: 22492, name: "Physical Attribute Increment", hardModifiers: [modifier] }, isMirrored: false }];
    expect(sumPrimitiveContributions(links, "attribute", "physical")).toBe(1);
    expect(sumPrimitiveContributions(links, "attribute", "mental")).toBe(0);
    expect(sumPrimitiveContributions(links, "attribute", "magical")).toBe(0);
  });
});
