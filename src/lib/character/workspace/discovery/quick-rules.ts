import { CANONICAL_EXPRESSIONS, MARKET_TEMPLATES } from "@/lib/primitives/canonical-market";
import { renderMechanicalRule, type CanonicalMechanicalRule } from "@/lib/primitives/mechanical-rule";

/** Only authored, priced Market options are offered. No numeric multiplier invents a BU price. */
export const QUICK_RULE_FAMILIES = [
  { key: "DOMAIN_ACCESS", label: "A subject", explanation: "What your abilities can affect: fire, metal, memory, and more." },
  { key: "VERB_ACCESS", label: "Actions", explanation: "The kinds of changes you can make to a subject." },
  { key: "RANGE_SCALING", label: "Reach", explanation: "How far an ability can reach." },
  { key: "INTENSITY_DICE", label: "Effect dice", explanation: "Which die an ability can use for damage or healing." },
  { key: "PRACTICE_PROGRESSION", label: "Core attributes", explanation: "A +1 increase to one attribute, using its own Market price and score limits." },
  { key: "SHEET_AUGMENT", label: "Carry & equipment", explanation: "Small, priced improvements to carrying capacity or equipment slots." },
] as const;
export type QuickRuleFamily = (typeof QUICK_RULE_FAMILIES)[number]["key"];
export interface QuickRuleSeed {
  key: string;
  name: string;
  category: string;
  familyKey: string;
  buCost: number;
  costTier: string;
  mechanicalOutputText: string;
  narrativeRule: string;
  mechanicalRule?: CanonicalMechanicalRule;
  hardModifiers: Record<string, unknown>[];
}
function costTier(tier: number | null): string {
  return ["Tier 0: Baseline (0 BU)", "Tier 1: Minor (4 BU anchor)", "Tier 2: Standard (8 BU anchor)", "Tier 3: Major (12 BU anchor)", "Tier 4: Core Axis (16 BU anchor)", "Tier 5: Narrative Layer (32+ BU anchor)"][tier ?? 0]!;
}
export function quickRuleOptions(family: QuickRuleFamily): QuickRuleSeed[] {
  if (family === "PRACTICE_PROGRESSION") return MARKET_TEMPLATES.filter(template => template.rule.family === "ATTRIBUTE_INCREMENT").flatMap(template => (template.standardBindings ?? []).map(binding => {
    const rule = { ...template.rule, bindings: { ...template.rule.bindings, ...binding.bindings } };
    return { key: `${template.key}:${binding.key}`, name: binding.name, category: template.category, familyKey: family,
      buCost: template.buCost, costTier: costTier(template.tier), mechanicalOutputText: renderMechanicalRule(rule),
      narrativeRule: binding.verboseDescription ?? template.verboseDescription, mechanicalRule: rule,
      hardModifiers: [{ kind: "modify", target: "attribute", operation: "add", value: { kind: "number", value: template.rule.value }, stacking: "stack", metadata: { recipient: "SELF", targetScope: { layer: "ATTRIBUTE", values: [binding.bindings["attribute"]] } } }] };
  }));
  if (family === "DOMAIN_ACCESS") return MARKET_TEMPLATES.filter(template => template.familyKey === family).flatMap(template => (template.standardBindings ?? []).map(binding => {
    const rule = { ...template.rule, bindings: { ...template.rule.bindings, ...binding.bindings } };
    return { key: `${template.key}:${binding.key}`, name: binding.name, category: template.category, familyKey: family,
      buCost: template.buCost, costTier: costTier(template.tier), mechanicalOutputText: renderMechanicalRule(rule),
      narrativeRule: binding.verboseDescription ?? template.verboseDescription, mechanicalRule: rule, hardModifiers: [] };
  }));
  return CANONICAL_EXPRESSIONS.filter(expression => expression.familyKey === family).map(expression => ({
    key: expression.key, name: expression.name, category: expression.category, familyKey: family,
    buCost: expression.buCost, costTier: costTier(expression.tier), mechanicalOutputText: expression.rule ? renderMechanicalRule(expression.rule) : expression.mechanicalText,
    narrativeRule: expression.verboseDescription, ...(expression.rule ? { mechanicalRule: expression.rule } : {}),
    hardModifiers: expression.modifier ? [{ ...expression.modifier }] : [],
  }));
}
