import { parseCondition, conditionToBadges } from "@/lib/primitives/condition";

/** Target/scene predicates belong to an action, never the character's base sheet. */
export function hasExternalCondition(condition: unknown): boolean {
  if (!condition || typeof condition !== "object") return false;
  const raw = condition as Record<string, unknown>;
  if (raw["axis"] === "target" || raw["axis"] === "scene") return true;
  let parsed;
  try {
    parsed = parseCondition(condition);
  } catch {
    return true;
  }
  if (!parsed) return false;
  if (parsed.kind === "preset" && /^(target|scene)-/.test(parsed.presetKey))
    return true;
  return (
    conditionToBadges(parsed).some(
      (b) => b.axis === "target" || b.axis === "scene",
    ) ||
    (parsed.kind === "compound" &&
      parsed.tokens.some((t) => /^stat\|(target|scene)\|/.test(t)))
  );
}
