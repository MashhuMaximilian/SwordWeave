import { RULE_STARTERS, ruleStarterPatch, type RuleStarter } from "./rule-starters";
import type { ValueToken } from "@/types/modifier";

/** First-class authoring formats; all compile through the existing modifier editor. */
export const MODIFIER_RULE_FORMATS = [
  { key: "number", label: "Change a number", help: "Add, subtract, multiply, or set a tracked value." },
  { key: "advantage", label: "Advantage", help: "Roll twice and keep the higher result in a chosen scope." },
  { key: "disadvantage", label: "Disadvantage", help: "Roll twice and keep the lower result in a chosen scope." },
  { key: "grant", label: "Grant a feature", help: "Give an entity a named state, permission, or feature." },
  { key: "revoke", label: "Revoke a feature", help: "Remove a named state, permission, or feature." },
  { key: "training", label: "Proficiency", help: "Apply Proficiency Bonus to a named practice." },
  { key: "resistance", label: "Resistance", help: "Take half damage from a named damage type." },
  { key: "vulnerability", label: "Vulnerability", help: "Take double damage from a named damage type." },
  { key: "immunity", label: "Immunity", help: "Take no damage from a named damage type." },
] as const;
export type ModifierRuleFormat = typeof MODIFIER_RULE_FORMATS[number]["key"];
export function modifierRuleFormatPatch(format: ModifierRuleFormat) {
  const id = format === "grant" || format === "revoke" ? "state" : format === "number" ? "roll" : format;
  const starter = RULE_STARTERS.find(item => item.id === id)!;
  return ruleStarterPatch(format === "revoke" ? { ...starter, operation: "revoke" } as RuleStarter : starter);
}
export function identifyModifierRuleFormat(modifier: { target: string; operation: string; tokens: readonly ValueToken[] } | undefined): ModifierRuleFormat {
  if (!modifier) return "number";
  const token = modifier.tokens[0];
  if (modifier.operation === "grant" && token?.kind === "keyword" && (token.text === "advantage" || token.text === "disadvantage")) return token.text;
  if (modifier.target === "damage_modifier" && modifier.operation === "multiply" && token?.kind === "number") {
    if (token.value === 0.5) return "resistance";
    if (token.value === 2) return "vulnerability";
    if (token.value === 0) return "immunity";
  }
  if (modifier.target === "skill_practice_check" && token?.kind === "derived" && token.which === "pb") return "training";
  if (modifier.operation === "grant") return "grant";
  if (modifier.operation === "revoke") return "revoke";
  return "number";
}
