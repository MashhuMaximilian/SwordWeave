import type { ConditionAuthoring } from "@/types/condition";

/** Removing a clause removes its preceding join, or the first join for clause zero. */
export function removeConditionClause(value: ConditionAuthoring, index: number): ConditionAuthoring {
  if (index < 0 || index >= value.pills.length) return value;
  return {
    ...value,
    pills: value.pills.filter((_, i) => i !== index),
    operators: value.operators.filter((_, i) => i !== Math.max(0, index - 1)),
  };
}
