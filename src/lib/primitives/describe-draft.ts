import { tokenLabel, renderEquation, type ValueToken, type Operand } from "@/types/modifier";
import type { ConditionAuthoring } from "@/types/condition";
import { MODIFIER_TARGET_SPEC, type ModifierTarget } from "./modifier-scope";
import { renderMechanicalRule } from "./mechanical-rule";

export interface PrimitiveSentenceDraft {
  target: string; operation: string; targetValues: string[]; freeTextNarrowFocus: string;
  valueKind: string; value: string; tokens: ValueToken[]; operands: Operand[]; v1Condition: ConditionAuthoring;
}

/** The visible phrase and saved description must describe the same resolver input. */
export function primitiveSentenceParts(draft: PrimitiveSentenceDraft) {
  const target = draft.targetValues.join(" / ") || draft.freeTextNarrowFocus || MODIFIER_TARGET_SPEC[draft.target as ModifierTarget]?.label || draft.target;
  const value = draft.valueKind === "equation" ? renderEquation(draft.operands) : draft.tokens.map(tokenLabel).join(" + ") || draft.value;
  const condition = draft.v1Condition;
  const expression = condition.pills.map((pill, index) => `${index ? ` ${condition.operators[index - 1] ?? "AND"} ` : ""}${pill.label}`).join("");
  const when = [expression, condition.narrative].filter(Boolean).join("; ");
  const operations:Record<string,{lead:string;join:string;label:string}> = {
    add:{lead:"Change",join:"by",label:"adding"}, subtract:{lead:"Change",join:"by",label:"subtracting"},
    multiply:{lead:"Change",join:"by",label:"multiplying by"}, divide:{lead:"Change",join:"by",label:"dividing by"},
    min:{lead:"Set",join:"to",label:"minimum"}, max:{lead:"Set",join:"to",label:"maximum"},
    set:{lead:"Set",join:"to",label:"exactly"}, grant:{lead:"Change",join:"by",label:"granting"}, revoke:{lead:"Change",join:"by",label:"revoking"},
  };
  return {target,value,when,...(operations[draft.operation] ?? {lead:"Change",join:"using",label:draft.operation})};
}

export function describePrimitiveDraft(draft: PrimitiveSentenceDraft): string {
  const parts = primitiveSentenceParts(draft);
  return renderMechanicalRule({
    family: "GENERIC",
    operation: draft.operation,
    target: parts.target,
    value: parts.value,
    conditionText: parts.when,
  });
}
