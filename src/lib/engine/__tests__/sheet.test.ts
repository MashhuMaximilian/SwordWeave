import { describe, it, expect } from "vitest";
import {
  aggregateCharacterSheet,
  type CharacterSheetInput,
} from "../sheet";

function baseInput(overrides: Partial<CharacterSheetInput> = {}): CharacterSheetInput {
  return {
    level: 1,
    attrPhysical: 3,
    attrMental: 4,
    attrMagical: 3,
    attrProficient: "PHYSICAL",
    practiceSlices: {},
    startingBu: 25,
    buSpent: 10,
    dmBonusBu: 0,
    currentVitality: 12,
    size: "MEDIUM",
    primitiveLinks: [],
    capabilityLinks: [],
    itemLinks: [],
    ...overrides,
  };
}

describe("aggregateCharacterSheet", () => {
  it("produces 10 practices (3 phys + 4 mental + 3 magical)", () => {
    const sheet = aggregateCharacterSheet(baseInput());
    expect(sheet.practices).toHaveLength(10);
    expect(sheet.practiceAttributeMap.PHYSICAL).toHaveLength(3);
    expect(sheet.practiceAttributeMap.MENTAL).toHaveLength(4);
    expect(sheet.practiceAttributeMap.MAGICAL).toHaveLength(3);
  });

  it("computes BU balance with progression pool = 25 at L1", () => {
    const sheet = aggregateCharacterSheet(baseInput());
    expect(sheet.buBalance.progressionPool).toBe(25);
    expect(sheet.buBalance.progressionSpent).toBe(10);
    expect(sheet.buBalance.progressionRemaining).toBe(15);
  });

  it("computes vitality max at L1 = (10+PB) * 1", () => {
    const sheet = aggregateCharacterSheet(baseInput({ level: 1 }));
    // PB at L1 = 2
    expect(sheet.vitality.max).toBe((10 + 2) * 1);
    expect(sheet.vitality.current).toBe(12);
    expect(sheet.vitality.percent).toBe(100);
  });

  it("computes defensive DCs (5 + attr + PB if proficient)", () => {
    const sheet = aggregateCharacterSheet(baseInput());
    const physical = sheet.defensiveDCs.find((d) => d.attribute === "PHYSICAL");
    const mental = sheet.defensiveDCs.find((d) => d.attribute === "MENTAL");
    // PHYSICAL is proficient attr, gets PB
    expect(physical?.dc).toBe(5 + 3 + 2); // 10
    // MENTAL is not proficient, no PB
    expect(mental?.dc).toBe(5 + 4 + 0); // 9
  });

  it("flags encumbrance when load exceeds capacity", () => {
    const sheet = aggregateCharacterSheet(
      baseInput({
        itemLinks: [
          // 5 slots of MEDIUM items with loadValue=10 each → 50 load
          ...Array.from({ length: 5 }, (_, i) => ({
            itemId: `item-${i}`,
            equipped: true,
            item: {
              id: `item-${i}`,
              name: `Heavy Item ${i}`,
              itemType: "ARMOR" as const,
              rarity: "COMMON" as const,
              slotCost: 1,
              isTwoHanded: false,
              isConsumable: false,
              // Phase 8.4 v24.5: required by ItemLinkSnapshot.
              buCost: 0,
            },
          })),
        ],
      }),
    );
    expect(sheet.encumbrance.load).toBeGreaterThan(0);
    expect(sheet.equippedItemCount).toBe(5);
  });

  it("aggregates capabilities from links", () => {
    const sheet = aggregateCharacterSheet(
      baseInput({
        capabilityLinks: [
          {
            capabilityId: "cap-1",
            acquiredAtLevel: 1,
            capability: {
              id: "cap-1",
              name: "Fire Strike",
              type: "ACTIVE",
              sourceType: "MAGICAL",
            },
          },
          {
            capabilityId: "cap-2",
            acquiredAtLevel: 1,
            capability: {
              id: "cap-2",
              name: "Toughness",
              type: "PASSIVE",
              sourceType: "PHYSICAL",
            },
          },
        ],
      }),
    );
    expect(sheet.capabilityCount).toBe(2);
  });

  it("applies hardModifier-based practice bonuses (not buCost proxy)", () => {
    // Phase 8.I i2 (Mashu 2026-08-04): practice bonuses now come from
    // hardModifiers targeting skill_practice_check, NOT from buCost.
    // The primitive has a real `add 4` modifier to MENTAL practice.
    const sheet = aggregateCharacterSheet(
      baseInput({
        primitiveLinks: [
          {
            primitiveId: 100,
            source: "PERSONAL",
            acquiredAtLevel: 1,
            isMirrored: false,
            primitive: {
              id: 100,
              name: "Sharp Mind",
              category: "CHARACTER_SHEET_AUGMENT",
              buCost: 4, // No longer used as bonus source
              isMirrorable: false,
              mirrorBuCredit: 0,
              hardModifiers: [
                {
                  target: "skill_practice_check",
                  operation: "add",
                  value: 4,
                  metadata: {
                    targetScope: {
                      layer: "PRACTICE",
                      values: ["REASON"], // MENTAL practice
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    // The MENTAL practice (reason) should pick up the +4 from
    // Sharp Mind's hardModifier.
    const reason = sheet.practices.find((p) => p.practice === "reason");
    expect(reason?.primitiveContributions).toHaveLength(1);
    expect(reason?.primitiveContributions[0]?.primitiveName).toBe("Sharp Mind");
    expect(reason?.primitiveContributions[0]?.bonus).toBe(4);
  });

  it("a CHARACTER_SHEET_AUGMENT primitive with NO skill_practice_check modifier contributes 0", () => {
    // The old buCost-proxy would have contributed +2 here. With i2,
    // a primitive with no hardModifier targeting skill_practice_check
    // contributes nothing — the buCost heuristic is gone.
    const sheet = aggregateCharacterSheet(
      baseInput({
        primitiveLinks: [
          {
            primitiveId: 101,
            source: "PERSONAL",
            acquiredAtLevel: 1,
            isMirrored: false,
            primitive: {
              id: 101,
              name: "Generic Sheet Augment",
              category: "CHARACTER_SHEET_AUGMENT",
              buCost: 2,
              isMirrorable: false,
              mirrorBuCredit: 0,
              hardModifiers: [], // No practice modifier
            },
          },
        ],
      }),
    );
    // No practice should have a primitive bonus.
    const withBonus = sheet.practices.filter(
      (p) => p.primitiveContributions.length > 0,
    );
    expect(withBonus).toHaveLength(0);
  });

  it("L5 progression pool = max(25, cumulative(5)) = 69", () => {
    // Phase 8.1 batch 10g: cumulative(5) = 25 + 4*10 + 4 = 69.
    const sheet = aggregateCharacterSheet(baseInput({ level: 5, buSpent: 30 }));
    expect(sheet.buBalance.progressionPool).toBe(69);
    expect(sheet.buBalance.progressionRemaining).toBe(39);
  });

  it("handles null current vitality (sheet shows max only)", () => {
    const sheet = aggregateCharacterSheet(baseInput({ currentVitality: null }));
    expect(sheet.vitality.current).toBeNull();
    expect(sheet.vitality.percent).toBeNull();
  });

  it("computes PB contribution only on proficient practices", () => {
    const sheet = aggregateCharacterSheet(
      baseInput({ level: 4, attrProficient: "MENTAL" }),
    );
    // At L4, PB = 2 + (4-1)/4 = 2 (PB increments every 4 levels, L1, L5, L9...)
    // Mental practices get PB; physical and magical do not
    const mentalPractice = sheet.practices.find((p) => p.practice === "reason");
    const physicalPractice = sheet.practices.find((p) => p.practice === "prowess");
    expect(mentalPractice?.pbContribution).toBe(2);
    expect(physicalPractice?.pbContribution).toBe(0);
  });
});
import type { ConditionContext } from "../condition-evaluator";

describe("aggregateCharacterSheet — i2.6 condition filter", () => {
  function makeInputWithCondition(
    condition: unknown,
    overrides: Partial<CharacterSheetInput> = {},
  ): CharacterSheetInput {
    return baseInput({
      ...overrides,
      primitiveLinks: [
        {
          primitiveId: 11848,
          source: "PERSONAL",
          acquiredAtLevel: 1,
          isMirrored: false,
          primitive: {
            id: 11848,
            name: "Broad Familiarity (fork)",
            category: "SHEET_AUGMENT",
            buCost: 5,
            isMirrorable: false,
            mirrorBuCredit: 0,
            hardModifiers: [
              {
                kind: "modify",
                value: 1, // half PB simplified to +1 for the MVP
                target: "skill_practice_check",
                operation: "add",
                metadata: {
                  targetScope: {
                    layer: "PRACTICE",
                    values: ["FIELDCRAFT"],
                  },
                },
                condition,
              } as unknown,
            ],
          },
        },
      ],
    });
  }

  const conditionContext = (
    overrides: {
      proficient?: "prowess" | "fieldcraft" | null;
      vitality?: number;
      vitalityMax?: number;
      flags?: string[];
    } = {},
  ): ConditionContext => ({
    character: {
      vitality: overrides.vitality ?? 30,
      vitalityMax: overrides.vitalityMax ?? 60,
      saveDc: 14,
      blockValue: 6,
      attributes: { physical: 5, mental: 2, magical: 3 },
      practices: {
        prowess: 5, finesse: 4, fieldcraft: 5, awareness: 4, reason: 3,
        knowledge: 4, influence: 3, mysticism: 4, communion: 3, intuition: 5,
      },
      proficiencies: new Set(
        overrides.proficient === "prowess" ? ["prowess"] :
        overrides.proficient === "fieldcraft" ? ["fieldcraft"] :
        []
      ),
      flags: new Set(overrides.flags ?? []),
      custom: {},
    },
  });

  it("no conditionContext provided → all modifiers fire (legacy default)", () => {
    // Practice 'fieldcraft' should receive +1 from Broad Familiarity.
    const sheet = aggregateCharacterSheet(
      makeInputWithCondition(null) // null condition
    );
    const fc = sheet.practices.find(p => p.practice === "fieldcraft");
    expect(fc).toBeDefined();
    // The primitive contributes its bonus regardless of proficiency
    // (no conditionContext = pre-i2.6 default behavior).
    const bfContribution = fc!.primitiveContributions.find(
      c => c.primitiveName === "Broad Familiarity (fork)"
    );
    expect(bfContribution?.bonus).toBe(1);
  });

  it("actor:not_proficient applies to ALL non-proficient practices, none for proficient", () => {
    // Proficient in prowess only. The fixture covers all 10 practices
    // so we can verify the bonus lands on all 9 non-proficient ones
    // and skips the proficient one.
    const ctx = conditionContext({ proficient: "prowess" });
    const ALL_TEN = [
      "PROWESS", "FIELDCRAFT", "REASON", "INFLUENCE", "COMMUNION",
      "INTUITION", "MYSTICISM", "KNOWLEDGE", "AWARENESS", "FINESSE",
    ];
    const input: CharacterSheetInput = {
      ...baseInput({
        primitiveLinks: [{
          primitiveId: 11848, source: "PERSONAL", acquiredAtLevel: 1,
          isMirrored: false,
          primitive: {
            id: 11848, name: "Broad Familiarity (fork)",
            category: "SHEET_AUGMENT", buCost: 5, isMirrorable: false,
            mirrorBuCredit: 0,
            hardModifiers: [{
              kind: "modify", value: 1, target: "skill_practice_check",
              operation: "add",
              metadata: {
                targetScope: { layer: "PRACTICE", values: ALL_TEN },
              },
              condition: { kind: "tags", customTags: ["actor:not_proficient"] },
            }],
          },
        }],
      }),
      conditionContext: ctx,
    };
    const result = aggregateCharacterSheet(input);
    const allP = ["prowess", "finesse", "fieldcraft", "awareness", "reason",
      "knowledge", "influence", "mysticism", "communion", "intuition"];
    for (const p of allP) {
      const pr = result.practices.find(x => x.practice === p)!;
      const bf = pr.primitiveContributions.find(
        c => c.primitiveName === "Broad Familiarity (fork)"
      );
      if (p === "prowess") {
        expect(bf).toBeUndefined();  // proficient → does NOT fire
      } else {
        expect(bf?.bonus).toBe(1);    // not proficient → fires
      }
    }
  });

  it("actor:not_proficient (dynamic via currentPractice) fires for non-proficient → bonus applies", () => {
    // Character is proficient in prowess, NOT fieldcraft.
    // Condition: "actor:not_proficient" → engine reads
    // currentPractice from the per-practice walk and checks
    // against proficiencies. Fieldcraft fires.
    const ctx = conditionContext({ proficient: "prowess" });
    const input: CharacterSheetInput = {
      ...makeInputWithCondition(
        { kind: "tags", customTags: ["actor:not_proficient"] }
      ),
      conditionContext: ctx,
    };
    const result = aggregateCharacterSheet(input);
    const fc = result.practices.find(p => p.practice === "fieldcraft");
    const bf = fc!.primitiveContributions.find(
      c => c.primitiveName === "Broad Familiarity (fork)"
    );
    expect(bf?.bonus).toBe(1);
  });

  it("actor:not_proficient does NOT fire when proficient → no bonus", () => {
    // Character is proficient in fieldcraft — the bonus does not
    // apply to fieldcraft checks (only to non-proficient ones).
    const ctx = conditionContext({ proficient: "fieldcraft" });
    const input: CharacterSheetInput = {
      ...makeInputWithCondition(
        { kind: "tags", customTags: ["actor:not_proficient"] }
      ),
      conditionContext: ctx,
    };
    const result = aggregateCharacterSheet(input);
    const fc = result.practices.find(p => p.practice === "fieldcraft");
    const bf = fc!.primitiveContributions.find(
      c => c.primitiveName === "Broad Familiarity (fork)"
    );
    // Condition fails when proficient → Broad Familiarity contributes 0
    expect(bf).toBeUndefined();
  });

  it("narrative condition always fires (GM-triggered hint)", () => {
    const ctx = conditionContext({ proficient: "fieldcraft" }); // even if proficient
    const input: CharacterSheetInput = {
      ...makeInputWithCondition(
        { kind: "narrative", text: "when tracking enemies" }
      ),
      conditionContext: ctx,
    };
    const result = aggregateCharacterSheet(input);
    const fc = result.practices.find(p => p.practice === "fieldcraft");
    const bf = fc!.primitiveContributions.find(
      c => c.primitiveName === "Broad Familiarity (fork)"
    );
    expect(bf?.bonus).toBe(1); // narrative always passes
  });
});
