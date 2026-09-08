import type { RuntimeCondition } from "@/lib/hooks/use-runtime-conditions";

/** Refresh source metadata without resetting a user's explicit override. */
export function reconcileSheetConditions(
  existing: readonly RuntimeCondition[],
  desired: readonly RuntimeCondition[],
): RuntimeCondition[] {
  const result = existing.filter((c) => c.source === "custom");
  const seen = new Set<string>();
  for (const condition of desired) {
    if (seen.has(condition.id)) continue;
    seen.add(condition.id);
    const previous =
      existing.find((c) => c.id === condition.id) ??
      existing.find(
        (c) =>
          c.source !== "custom" &&
          c.sourceEntityId === condition.sourceEntityId &&
          c.sourceEntityType === condition.sourceEntityType &&
          JSON.stringify(c.modifiers) === JSON.stringify(condition.modifiers),
      );
    result.push(
      previous
        ? {
            ...previous,
            ...condition,
            active: previous.active,
            manualOverride: previous.manualOverride,
            createdAt: previous.createdAt,
          }
        : condition,
    );
  }
  return result;
}
