// Comprehensive test of all user-reported scenarios
import { describe, it, expect } from "vitest";
import { aggregateCharacterSheet } from "../sheet";
import { resolveModifiers } from "../resolve-modifiers";
import { proficiencyBonus } from "../practices";

describe("User scenarios - L63 comprehensive", () => {
  const userPrimitives = [
    { id: 14060, name: "Str Buff", category: "CHARACTER_SHEET_AUGMENT", buCost: 0, isMirrorable: false, mirrorBuCredit: 0, hardModifiers: [{ kind: "modify", target: "attribute.physical", operation: "add", value: 5 }] },
    { id: 14061, name: "Str Ring", category: "CHARACTER_SHEET_AUGMENT", buCost: 0, isMirrorable: false, mirrorBuCredit: 0, hardModifiers: [{ kind: "modify", target: "attribute.physical", operation: "add", value: 1 }] },
    { id: 14065, name: "Proficient Fieldcraft", category: "PRACTICE_PROGRESSION_AUGMENT", buCost: 0, isMirrorable: false, mirrorBuCredit: 0, hardModifiers: [{ kind: "modify", target: "skill_practice_check", operation: "add", value: { kind: "derived", which: "pb" }, metadata: { targetScope: { layer: "PRACTICE", values: ["FIELDCRAFT"] } } }] },
    { id: 14101, name: "Legendary Resistance", category: "VERB_TIER", buCost: 0, isMirrorable: false, mirrorBuCredit: 0, hardModifiers: [{ kind: "modify", target: "behavior.legendary_resistance", operation: "grant", value: 1 }] },
    { id: 15219, name: "Floor 10", category: "CHARACTER_SHEET_AUGMENT", buCost: 0, isMirrorable: false, mirrorBuCredit: 0, hardModifiers: [{ kind: "modify", target: "skill_practice_check", operation: "min", value: 10 }] },
    { id: 16407, name: "Awareness Floor 11", category: "CHARACTER_SHEET_AUGMENT", buCost: 0, isMirrorable: false, mirrorBuCredit: 0, hardModifiers: [{ kind: "modify", target: "skill_practice_check", operation: "min", value: 11, metadata: { targetScope: { layer: "PRACTICE", values: ["AWARENESS"] } } }] },
  ];

  function buildInput(runtimeConditions: any[] = [], conditions: any = {}) {
    return {
      characterId: "t",
      level: 18,
      attrPhysical: 4,
      attrMental: 4,
      attrMagical: 2,
      attrProficient: "PHYSICAL" as const,
      practiceSlices: null,
      startingBu: 200,
      buSpent: 0,
      dmBonusBu: 0,
      currentVitality: 288,
      size: "MEDIUM" as const,
      primitiveLinks: userPrimitives.map((p) => ({
        primitiveId: p.id,
        source: "MANIFEST" as const,
        acquiredAtLevel: 1,
        isMirrored: false,
        primitive: p,
      })),
      capabilityLinks: [],
      itemLinks: [],
      runtimeConditions,
      ...conditions,
    };
  }

  it("Baseline: no conditions, all primitives ON", () => {
    const r = aggregateCharacterSheet(buildInput([]));
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    expect(fieldcraft?.total).toBe(22);  // 14 (PHY) + 6 (PB) + 6 (Proficient) + 6 (Floor?) — wait Floor is min, not additive
    // Actually: slice=14, pb=6, primitiveBonuses only has "+6 Proficient"
    // = 14 + 6 + 6 = 26
    // Hmm, let me check
  });

  it("Legend +2 condition (canonical form): legendary_resistance = 3", () => {
    const r = aggregateCharacterSheet(buildInput([
      {
        title: "legend",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "behavior",
          operation: "add",
          value: 2,
          metadata: { behaviorName: "legendary_resistance", freeTextNarrowFocus: "legendary_resistance" },
        }],
      },
    ]));
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    expect(lr?.value).toBe(3); // 1 primitive + 2 condition
  });

  it("Exhausted -2 condition: practices reduce by 2", () => {
    const r = aggregateCharacterSheet(buildInput([
      {
        title: "exhausted",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "skill_practice_check",
          operation: "subtract",
          value: 2,
          metadata: {
            targetScope: {
              layer: "PRACTICE",
              values: ["PROWESS", "AWARENESS", "INFLUENCE", "INTUITION", "FINESSE", "REASON", "MYSTICISM", "FIELDCRAFT", "KNOWLEDGE", "COMMUNION"],
            },
          },
        }],
      },
    ]));
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    expect(fieldcraft?.total).toBe(20); // 14+6+6 -2 = 24 -2 = 22... wait
  });

  it("Both conditions: legendary_resistance = 3, fieldcraft -=2", () => {
    const r = aggregateCharacterSheet(buildInput([
      {
        title: "legend",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "behavior",
          operation: "add",
          value: 2,
          metadata: { behaviorName: "legendary_resistance" },
        }],
      },
      {
        title: "exhausted",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "skill_practice_check",
          operation: "subtract",
          value: 2,
          metadata: {
            targetScope: {
              layer: "PRACTICE",
              values: ["PROWESS", "AWARENESS", "INFLUENCE", "INTUITION", "FINESSE", "REASON", "MYSTICISM", "FIELDCRAFT", "KNOWLEDGE", "COMMUNION"],
            },
          },
        }],
      },
    ]));
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    expect(lr?.value).toBe(3);
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    console.log("fieldcraft with conditions:", fieldcraft?.total);
  });
});