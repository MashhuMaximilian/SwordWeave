
import { describe, it, expect } from "vitest";
import { aggregateCharacterSheet } from "../sheet";
import { resolveModifiers } from "../resolve-modifiers";

describe("User-reported scenarios", () => {
  const baseInput = {
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
    primitiveLinks: [
      {
        primitiveId: 14065,
        source: "MANIFEST" as const,
        acquiredAtLevel: 1,
        isMirrored: false,
        primitive: {
          id: 14065,
          name: "Proficient Fieldcraft",
          category: "PRACTICE_PROGRESSION_AUGMENT",
          buCost: 0,
          isMirrorable: false,
          mirrorBuCredit: 0,
          hardModifiers: [{
            kind: "modify" as const,
            target: "skill_practice_check",
            operation: "add" as const,
            value: { kind: "derived", which: "pb" },
            metadata: {
              targetScope: { layer: "PRACTICE", values: ["FIELDCRAFT"] },
            },
          }],
        },
      },
      {
        primitiveId: 14101,
        source: "MANIFEST" as const,
        acquiredAtLevel: 1,
        isMirrored: false,
        primitive: {
          id: 14101,
          name: "Legendary Resistance",
          category: "VERB_TIER",
          buCost: 0,
          isMirrorable: false,
          mirrorBuCredit: 0,
          hardModifiers: [{
            kind: "modify" as const,
            target: "behavior.legendary_resistance",
            operation: "grant" as const,
            value: 1,
          }],
        },
      },
    ],
    capabilityLinks: [],
    itemLinks: [],
    runtimeConditions: [],
  };

  it("Custom behavior condition (canonical form, plain number)", () => {
    const r = aggregateCharacterSheet({
      ...baseInput,
      runtimeConditions: [{
        title: "legend",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "behavior",
          operation: "add",
          value: 2,
          metadata: {
            behaviorName: "legendary_resistance",
            freeTextNarrowFocus: "legendary_resistance",
          },
        }],
      }],
    });
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    expect(lr?.value).toBe(3); // 1 (primitive) + 2 (condition)
  });

  it("Custom behavior condition (canonical form, PB token)", () => {
    const r = aggregateCharacterSheet({
      ...baseInput,
      runtimeConditions: [{
        title: "legend",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "behavior",
          operation: "add",
          value: { kind: "derived", which: "pb" },
          metadata: {
            behaviorName: "legendary_resistance",
            freeTextNarrowFocus: "legendary_resistance",
          },
        }],
      }],
    });
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    expect(lr?.value).toBe(7); // 1 (primitive) + 6 (PB token condition)
  });

  it("+2 PB condition: PB primitives (Proficient Fieldcraft) rescale", () => {
    const r = aggregateCharacterSheet({
      ...baseInput,
      runtimeConditions: [{
        title: "+2 PB",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "proficiency_bonus",
          operation: "add",
          value: 2,
        }],
      }],
    });
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    // PHY=4 (slice) + 8 (final PB if prof) + 8 (rescaled PB primitive) = 20
    expect(fieldcraft?.total).toBe(20);
  });

  it("exhausted (-2) all practices: raw modifier reduced, not clamped", () => {
    const r = aggregateCharacterSheet({
      ...baseInput,
      runtimeConditions: [{
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
      }],
    });
    const fieldcraft = r.practices.find((p) => p.practice === "fieldcraft");
    // PHY=4 + 6 (PB) + 6 (Proficient Fieldcraft primitive) - 2 (exhausted) = 14
    expect(fieldcraft?.total).toBe(14); // raw, NOT clamped
  });

  it("Equation: PB + 2 token in condition value works", () => {
    const r = aggregateCharacterSheet({
      ...baseInput,
      runtimeConditions: [{
        title: "PB+2 to legend",
        active: true,
        modifiers: [{
          kind: "modify",
          target: "behavior",
          operation: "add",
          value: { kind: "equation", operands: [
            { op: "+", value: { kind: "derived", which: "pb" } },
            { op: "+", value: { kind: "number", value: 2 } },
          ]},
          metadata: {
            behaviorName: "legendary_resistance",
            freeTextNarrowFocus: "legendary_resistance",
          },
        }],
      }],
    });
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    expect(lr?.value).toBe(9); // 1 (primitive) + (PB 6 + 2 = 8)
  });
});
