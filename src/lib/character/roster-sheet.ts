import { aggregateCharacterSheet, type CharacterSheetInput } from "@/lib/engine/sheet";
import type { ConditionContext } from "@/lib/engine/condition-evaluator";

/** Evaluate saved conditional rules against the same persisted state as the sheet. */
export function aggregateRosterSheet(input: CharacterSheetInput) {
  const base = aggregateCharacterSheet(input);
  const context: ConditionContext = {
    character: {
      vitality: input.currentVitality ?? base.vitality.max,
      vitalityMax: base.vitality.max,
      saveDc: base.dc,
      blockValue: base.behaviorVariables.find(b => b.key === "blockvalue")?.value ?? 0,
      attributes: base.attributes,
      practices: Object.fromEntries(base.practices.map(p => [p.practice, p.total])) as ConditionContext["character"]["practices"],
      proficiencies: new Set([
        ...base.practices.filter(p => p.attribute === (input.attrProficient ?? "PHYSICAL")).map(p => p.practice),
        (input.attrProficient ?? "PHYSICAL").toLowerCase(),
      ]),
      flags: new Set(),
      custom: {
        proficiency_bonus: base.proficiencyBonus,
        ...Object.fromEntries(base.savingThrows.map(save => [`${save.attribute.toLowerCase()}_saving_throw`, save.bonus])),
      },
    },
  };
  return aggregateCharacterSheet({ ...input, conditionContext: context });
}
