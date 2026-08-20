// Verify behavior variables work end-to-end
import { describe, it, expect } from "vitest";
import { aggregateCharacterSheet } from "../sheet";

function baselineInput() {
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
    primitiveLinks: [
      {
        primitiveId: 14101,
        source: "MANIFEST",
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
}

describe("Behavior variables from aggregateCharacterSheet", () => {
  it("baseline: Legendary Resistance primitive gives legendary_resistance = 1", () => {
    const r = aggregateCharacterSheet(baselineInput());
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    console.log("baseline legendary_resistance:", lr?.value);
    expect(lr?.value).toBe(1);
  });

  it("condition adding 5 to behavior.legendary_resistance should give 6", () => {
    const r = aggregateCharacterSheet({
      ...baselineInput(),
      runtimeConditions: [
        {
          title: "Boost LR",
          active: true,
          modifiers: [{
            kind: "modify",
            target: "behavior.legendary_resistance",
            operation: "add",
            value: 5,
          }],
        },
      ],
    });
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    console.log("condition +5 legendary_resistance:", lr?.value);
    expect(lr?.value).toBe(6);
  });

  it("condition with canonical target 'behavior' + metadata.behaviorName should create variable", () => {
    // Mimics how the condition composer saves behavior targets.
    const r = aggregateCharacterSheet({
      ...baselineInput(),
      runtimeConditions: [
        {
          title: "Canonical form",
          active: true,
          modifiers: [{
            kind: "modify",
            target: "behavior",  // canonical target, NOT dotted
            operation: "add",
            value: 3,
            metadata: {
              behaviorName: "legendary_resistance",
              freeTextNarrowFocus: "legendary_resistance",
            },
          }],
        },
      ],
    });
    const lr = r.behaviorVariables.find((b) => b.key === "legendary_resistance");
    console.log("canonical form legendary_resistance:", lr?.value);
    // primitive grants 1 + condition adds 3 = 4
    expect(lr?.value).toBe(4);
  });

  it("condition targeting custom behavior 'my_custom_key' should create that variable", () => {
    const r = aggregateCharacterSheet({
      ...baselineInput(),
      runtimeConditions: [
        {
          title: "Custom behavior",
          active: true,
          modifiers: [{
            kind: "modify",
            target: "behavior.my_custom_key",
            operation: "add",
            value: 7,
          }],
        },
      ],
    });
    const custom = r.behaviorVariables.find((b) => b.key === "my_custom_key");
    console.log("custom behavior:", custom?.value);
    expect(custom?.value).toBe(7);
  });
});