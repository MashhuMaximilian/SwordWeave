import type { aggregateCharacterSheet } from "@/lib/engine/sheet";

type Sheet = ReturnType<typeof aggregateCharacterSheet>;
/** Server-derived fields not calculated by the sheet's client stat resolver. */
export type VitalityRuntimeUpdate = Pick<Sheet, "encumbrance" | "carryCapacity" | "speedByType" | "behaviorVariables">;
export function vitalityRuntimeUpdate(sheet: Sheet): VitalityRuntimeUpdate {
  const { encumbrance, carryCapacity, speedByType, behaviorVariables } = sheet;
  return { encumbrance, carryCapacity, speedByType, behaviorVariables };
}
