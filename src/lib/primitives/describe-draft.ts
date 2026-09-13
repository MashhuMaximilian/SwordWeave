import { tokenLabel, renderEquation, type ValueToken, type Operand } from "@/types/modifier";
import type { ConditionAuthoring } from "@/types/condition";
import { MODIFIER_TARGET_SPEC, type ModifierTarget } from "./modifier-scope";
import { OPERATION_LABELS } from "./form-helpers";

export function describePrimitiveDraft(draft: {
  target: string; operation: string; targetValues: string[]; freeTextNarrowFocus: string;
  valueKind: string; value: string; tokens: ValueToken[]; operands: Operand[]; v1Condition: ConditionAuthoring;
}): string {
  const target = draft.targetValues.join(" / ") || draft.freeTextNarrowFocus || MODIFIER_TARGET_SPEC[draft.target as ModifierTarget]?.label || draft.target;
  const operation = OPERATION_LABELS[draft.operation as keyof typeof OPERATION_LABELS] || draft.operation;
  const value = draft.valueKind === "equation" ? renderEquation(draft.operands) : draft.tokens.map(tokenLabel).join(" + ") || draft.value;
  const condition = draft.v1Condition;
  const expression = condition.pills.map((pill, index) => `${index ? ` ${condition.operators[index - 1] ?? "AND"} ` : ""}${pill.label}`).join("");
  const when = [expression, condition.narrative].filter(Boolean).join("; ");
  return `${operation} ${value} ${target}${when ? ` when ${when}` : ""}.`;
}
