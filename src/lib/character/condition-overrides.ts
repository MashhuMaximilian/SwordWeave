import type { RuntimeCondition } from "@/lib/hooks/use-runtime-conditions";
import type { HardModifier } from "@/types/swordweave";

/** An absent override means the engine still owns the state. */
export function conditionActive(
  condition: RuntimeCondition,
  evaluated?: { active: boolean; computable: boolean },
): boolean {
  if (condition.status === "resolved") return false;
  if (typeof condition.manualOverride === "boolean")
    return condition.manualOverride;
  if (condition.source === "sheet-auto") return evaluated?.active ?? false;
  if (condition.source === "custom" && evaluated)
    return condition.active && evaluated.active;
  return condition.active;
}

/** Apply a drawer override to the original modifier, keeping its slot/provenance.
 * Sheet conditions must not also become virtual slots: that doubles the bonus.
 */
export function applyConditionOverrides(
  modifiers: readonly HardModifier[],
  conditions: readonly RuntimeCondition[],
  sourceType: "primitive" | "effect",
  sourceId: string,
): HardModifier[] {
  return modifiers.flatMap((modifier, index) => {
    const condition = conditions.find(
      (c) =>
        c.source !== "custom" &&
        c.sourceEntityType === sourceType &&
        c.sourceEntityId === sourceId &&
        (c.id === `sheet-${sourceType}-${sourceId}-${index}` ||
          c.id === `sheet-auto-${sourceType}-${sourceId}-${index}`),
    );
    if (
      !condition ||
      (condition.source === "sheet-auto" &&
        condition.manualOverride === undefined)
    )
      return [modifier];
    const active = condition.manualOverride ?? condition.active;
    if (!active) return [];
    const { condition: _condition, ...unconditional } = modifier;
    return [unconditional];
  });
}

export function runtimeConditionModifiers(
  condition: RuntimeCondition,
): readonly HardModifier[] {
  return condition.manualOverride === true
    ? condition.modifiers.map(
        ({ condition: _condition, ...modifier }) => modifier,
      )
    : condition.modifiers;
}
