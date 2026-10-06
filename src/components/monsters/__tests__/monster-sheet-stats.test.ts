import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { monsterDefinitionSchema } from "@/lib/monsters/model";
import { resolveMonster, type MonsterSlot } from "@/lib/monsters/resolve";
import { MonsterSheetStats, monsterFormulaSteps, monsterPracticeSteps } from "../monster-sheet-stats";

const definition = monsterDefinitionSchema.parse({
  name: "Trace check", budget: 25, attributes: { physical: 3, mental: 0, magical: 0 },
});
function source(target: string, operation: "add" | "subtract" | "multiply" | "divide" | "set" | "max", value: number, id: number): MonsterSlot {
  return {
    primitiveId: id, name: `Source ${id}`, category: "METRIC",
    hardModifiers: [{ kind: "modify", target, operation, value, stacking: "stack" }],
    isMirrored: false, isMirrorable: true, mirrorVector: null,
    originHeritageId: null, originCapabilityId: null, originEffectId: null,
    buCost: 1, quantity: 1, dependencyKey: String(id), item: false,
  };
}
const scenarios = [
  { name: "baseline", slots: [] },
  { name: "attribute, proficiency and subtraction", slots: [source("attribute.physical", "add", 2, 1), source("proficiency_bonus", "add", 1, 2), source("skill_practice_check.prowess", "subtract", 2, 3)] },
  { name: "nonlinear and attack selector operations", slots: [source("skill_practice_check.prowess", "multiply", 2, 1), source("speed", "divide", 2, 2), source("carry_capacity", "set", 10, 3), source("attack_bonus.physical", "add", 2, 4), source("attack_bonus", "multiply", 2, 5)] },
  { name: "attribute scaling and bounds", slots: [source("attribute.physical", "multiply", 2, 1), source("skill_practice_check.prowess", "max", 2, 2), source("speed", "subtract", 4, 3)] },
];
describe("creature formula provenance", () => {
  it.each(scenarios)("reconciles every practice and metric: $name", ({ slots }) => {
    const sheet = resolveMonster(definition, slots);
    for (const practice of sheet.practices) {
      const steps = monsterPracticeSteps(sheet, practice, definition);
      expect(steps.reduce((sum, step) => sum + (step.value ?? 0), 0)).toBe(practice.total);
      const sources = steps.flatMap(step => step.contribution ? [step.contribution] : []);
      expect(new Set(sources).size).toBe(sources.length);
    }
    for (const [target, baseline] of [["attack_bonus", 5], ["speed", 30], ["carry_capacity", 55]] as const) {
      const total = sheet.resolved.totals[target] ?? 0;
      const steps = monsterFormulaSteps(target, sheet, [{ label: "Baseline", value: baseline }], total);
      expect(steps.reduce((sum, step) => sum + (step.value ?? 0), 0)).toBe(total);
    }
  });
  it("shows subtract operations with their negative contribution", () => {
    const sheet = resolveMonster(definition, [source("speed", "subtract", 4, 1)]);
    const steps = monsterFormulaSteps("speed", sheet, [{ label: "Size", value: 30 }], sheet.resolved.totals["speed"]!);
    expect(steps.find(step => step.contribution)?.value).toBe(-4);
  });
});

it("renders resolved modifiers, saves and vitality without reapplying player baselines", () => {
  const custom = { ...definition, baselineVitality: 20 };
  const sheet = resolveMonster(custom, [source("attribute.physical", "add", 2, 1), source("proficiency_bonus", "add", 1, 2)], 7);
  const html = renderToStaticMarkup(createElement(MonsterSheetStats, {sheet, definition: custom, proficientAttribute: "physical", showPractices: false}));
  expect(html).toContain("35%");
  expect(html).toContain(" / 20");
  expect(html).toContain("Mods + saves");
  expect(html).toContain(">PB</span><strong>+3");
  expect(html).toContain(`>ATK</span><strong>+${sheet.resolved.totals["attack_bonus"]}`);
  expect(html).toContain(`>Save DC</span><strong>${sheet.resolved.totals["save_dc"]}`);
  expect(html).toContain("Show PHYS save provenance");
});
