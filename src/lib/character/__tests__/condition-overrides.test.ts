import { describe, expect, it } from "vitest";
import {
  conditionActive,
  applyConditionOverrides,
  runtimeConditionModifiers,
} from "../condition-overrides";
import { reconcileSheetConditions } from "../reconcile-sheet-conditions";
import {
  resolveModifiers,
  type ResolvedPrimitiveSlot,
} from "@/lib/engine/resolve-modifiers";
import type { RuntimeCondition } from "@/lib/hooks/use-runtime-conditions";
import type { HardModifier } from "@/types/swordweave";

const modifier: HardModifier = {
  kind: "modify",
  target: "attribute.physical",
  operation: "add",
  value: 2,
  condition: { kind: "compound", tokens: ["self:is_prone"] },
};
const condition: RuntimeCondition = {
  id: "sheet-auto-primitive-42-0",
  title: "Conditional bonus",
  description: "",
  tags: [],
  modifiers: [modifier],
  durationTier: "manual",
  active: false,
  createdAt: 1,
  source: "sheet-auto",
  sourceEntityId: "42",
  sourceEntityType: "primitive",
};
const context = {
  character: {
    vitality: 20,
    vitalityMax: 20,
    saveDc: 10,
    blockValue: 0,
    attributes: { physical: 3, mental: 1, magical: 1 },
    practices: {
      prowess: 0,
      finesse: 0,
      fieldcraft: 0,
      awareness: 0,
      reason: 0,
      knowledge: 0,
      influence: 0,
      mysticism: 0,
      communion: 0,
      intuition: 0,
    },
    proficiencies: new Set<string>(),
    flags: new Set<string>(),
    custom: {},
  },
};
function total(c: RuntimeCondition, prone: boolean) {
  const slot: ResolvedPrimitiveSlot = {
    primitiveId: 42,
    name: "Bonus",
    category: "TEST",
    hardModifiers: applyConditionOverrides([modifier], [c], "primitive", "42"),
    isMirrored: false,
    isMirrorable: false,
    mirrorVector: null,
    originHeritageId: null,
    originCapabilityId: null,
    originEffectId: null,
  };
  return resolveModifiers({
    characterId: "test",
    level: 1,
    pb: 2,
    proficientAttribute: null,
    attributes: context.character.attributes,
    slots: [slot],
    conditionContext: {
      character: {
        ...context.character,
        flags: new Set(prone ? ["is_prone"] : []),
      },
    },
  }).totals["attribute.physical"];
}
describe("manual condition overrides", () => {
  it("uses automatic state until an override exists", () => {
    expect(conditionActive(condition, { active: true, computable: true })).toBe(
      true,
    );
    expect(
      conditionActive(condition, { active: false, computable: true }),
    ).toBe(false);
  });
  it("can force ON against a false predicate and force OFF against a true one", () => {
    expect(total({ ...condition, manualOverride: true }, false)).toBe(5);
    expect(total({ ...condition, manualOverride: false }, true)).toBe(3);
    expect(
      conditionActive(
        { ...condition, manualOverride: true },
        { active: false, computable: true },
      ),
    ).toBe(true);
    expect(
      conditionActive(
        { ...condition, manualOverride: false },
        { active: true, computable: true },
      ),
    ).toBe(false);
  });
  it("restores engine evaluation when the override is cleared", () => {
    expect(total(condition, false)).toBe(3);
    expect(total(condition, true)).toBe(5);
  });
  it("applies manual sheet triggers once without mutating the source", () => {
    const manual = {
      ...condition,
      id: "sheet-primitive-42-0",
      source: "sheet" as const,
      active: true,
    };
    expect(total(manual, false)).toBe(5);
    expect(modifier.condition).toBeDefined();
  });
  it("can force custom condition modifiers on", () => {
    expect(
      runtimeConditionModifiers({
        ...condition,
        source: "custom",
        manualOverride: true,
      })[0]?.condition,
    ).toBeUndefined();
  });
  it("keeps separate modifiers on the same primitive and removes stale sources", () => {
    const second = {
      ...condition,
      id: "sheet-auto-primitive-42-1",
      title: "Second modifier",
    };
    const custom = { ...condition, id: "custom", source: "custom" as const };
    const next = reconcileSheetConditions(
      [
        custom,
        { ...condition, manualOverride: false },
        { ...second, manualOverride: true },
      ],
      [second],
    );
    expect(next).toHaveLength(2);
    expect(next[1]?.manualOverride).toBe(true);
    expect(next[0]).toEqual(custom);
  });
  it("refreshes source metadata while preserving overrides and deduplicating paths", () => {
    const next = reconcileSheetConditions(
      [{ ...condition, manualOverride: true }],
      [
        { ...condition, title: "Updated" },
        { ...condition, title: "Updated" },
      ],
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.title).toBe("Updated");
    expect(next[0]?.manualOverride).toBe(true);
  });
});

// Exercise the actual React adapter as well as the pure modifier helper:
// a sheet condition must modify its source slot, never append a second slot.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useCharacterResolver } from "@/lib/hooks/use-character-resolver";
it("applies an enabled sheet condition exactly once through the real hook", () => {
  let physical: number | undefined;
  function Probe() {
    const result = useCharacterResolver({
      characterId: "test",
      level: 1,
      pb: 2,
      proficientAttribute: null,
      attributes: context.character.attributes,
      conditionContext: context,
      primitiveLinks: [
        {
          primitiveId: 42,
          isMirrored: false,
          isToggledOff: false,
          originHeritageId: null,
          originCapabilityId: null,
          originEffectId: null,
          primitive: {
            id: 42,
            name: "Bonus",
            category: "TEST",
            isMirrorable: false,
            mirrorVector: null,
            hardModifiers: [modifier],
          },
        },
      ],
      runtimeConditions: [{ ...condition, active: true, manualOverride: true }],
    });
    physical = result.totals["attribute.physical"];
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  expect(physical).toBe(5);
});

describe("condition scope on the character sheet", () => {
  it.each(["target", "scene"])(
    "manual On preserves %s predicates and does not change base totals",
    (axis) => {
      const external = {
        ...modifier,
        condition: { kind: "tags" as const, customTags: [`${axis}:exposed`] },
      };
      const occurrence = {
        ...condition,
        modifiers: [external],
        manualOverride: true,
      };
      const adjusted = applyConditionOverrides(
        [external],
        [occurrence],
        "primitive",
        "42",
      );
      expect(adjusted[0]?.condition).toEqual(external.condition);
      expect(
        runtimeConditionModifiers({ ...occurrence, source: "custom" })[0]
          ?.condition,
      ).toEqual(external.condition);
      const result = resolveModifiers({
        characterId: "test",
        level: 1,
        pb: 2,
        proficientAttribute: null,
        attributes: context.character.attributes,
        conditionContext: context,
        slots: [
          {
            primitiveId: 42,
            name: "External",
            category: "TEST",
            hardModifiers: adjusted,
            isMirrored: false,
            isMirrorable: false,
            mirrorVector: null,
            originHeritageId: null,
            originCapabilityId: null,
            originEffectId: null,
          },
        ],
      });
      expect(result.totals["attribute.physical"]).toBe(3);
    },
  );
  it("preserves target presets and mixed self/scene predicates", () => {
    for (const predicate of [
      {
        kind: "preset" as const,
        presetKey: "target-prone" as const,
        customTags: [],
      },
      {
        kind: "compound" as const,
        tokens: ["self:is_prone", "OR", "scene:dim"],
      },
    ]) {
      const m = { ...modifier, condition: predicate };
      expect(
        runtimeConditionModifiers({
          ...condition,
          modifiers: [m],
          manualOverride: true,
        })[0]?.condition,
      ).toEqual(predicate);
    }
  });
});
