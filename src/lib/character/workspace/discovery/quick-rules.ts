import { CANONICAL_EXPRESSIONS, MARKET_TEMPLATES } from "@/lib/primitives/canonical-market";
import { CONDITION_PRESETS, type ConditionPresetKey } from "@/types/condition";
import type { HardModifier } from "@/types/swordweave";
import { mechanicalDescriptionFromModifiers, parseAuthorableCompositionRule, renderMechanicalRule, type CanonicalMechanicalRule } from "@/lib/primitives/mechanical-rule";

/** Only authored, priced Market options are offered. No numeric multiplier invents a BU price. */
export const QUICK_RULE_FAMILIES = [
  { key: "PRACTICES", label: "Practice skills", explanation: "Become trained in Awareness, Fieldcraft, Influence, or another practice." },
  { key: "SAVING_THROWS", label: "Saving throws", explanation: "Use your Proficiency Bonus to resist hazards with a chosen attribute." },
  { key: "PROBABILITY_BIAS", label: "Roll advantages", explanation: "Priced advantages, disadvantages, and roll changes from the Library." },
  { key: "VITALITY", label: "Vitality", explanation: "Existing, priced Vitality improvements. Values keep the source rule’s price." },
  { key: "MOBILITY", label: "Movement", explanation: "Movement, flight, climbing, and other priced ways to travel." },
  { key: "DEFENSES", label: "Defenses", explanation: "Resistance and mitigation rules from the Library, with their exact costs." },
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
  source?: "library";
  consequenceBehavior?: import("@/lib/character/consequences/types").ConsequenceBehavior | null;
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
  if (family === "PRACTICES" || family === "SAVING_THROWS") return MARKET_TEMPLATES.filter(template => template.rule.family === (family === "PRACTICES" ? "PRACTICE_PROFICIENCY" : "DEFENSIVE_SAVE")).flatMap(template => (template.standardBindings ?? []).map(binding => {
    const rule = { ...template.rule, bindings: { ...template.rule.bindings, ...binding.bindings } };
    const practice = binding.bindings["practice"];
    const scope = practice ? { layer: "PRACTICE", values: [practice] } : { layer: "METRIC", values: [`${binding.bindings["attribute"]}_SAVE`] };
    return { key: `${template.key}:${binding.key}`, name: binding.name, category: template.category, familyKey: template.familyKey,
      buCost: template.buCost, costTier: costTier(template.tier), mechanicalOutputText: renderMechanicalRule(rule),
      narrativeRule: binding.verboseDescription ?? template.verboseDescription, mechanicalRule: rule,
      hardModifiers: [{ kind: "modify", target: practice ? "skill_practice_check" : "action_roll", operation: "add", value: { kind: "derived", which: "pb" }, stacking: "highest-only", metadata: { recipient: "SELF", targetScope: scope } }] };
  }));
  if (family === "PRACTICE_PROGRESSION") return MARKET_TEMPLATES.filter(template => template.rule.family === "ATTRIBUTE_INCREMENT").flatMap(template => (template.standardBindings ?? []).map(binding => {
    const rule = { ...template.rule, bindings: { ...template.rule.bindings, ...binding.bindings } };
    return { key: `${template.key}:${binding.key}`, name: binding.name, category: template.category, familyKey: template.familyKey,
      buCost: template.buCost, costTier: costTier(template.tier), mechanicalOutputText: renderMechanicalRule(rule),
      narrativeRule: binding.verboseDescription ?? template.verboseDescription, mechanicalRule: rule,
      hardModifiers: [{ kind: "modify", target: "attribute", operation: "add", value: { kind: "number", value: template.rule.value }, stacking: "stack", metadata: { recipient: "SELF", targetScope: { layer: "ATTRIBUTE", values: [binding.bindings["attribute"]] } } }] };
  }));
  if (family === "DOMAIN_ACCESS") return MARKET_TEMPLATES.filter(template => template.familyKey === family).flatMap(template => (template.standardBindings ?? []).map(binding => {
    const rule = { ...template.rule, bindings: { ...template.rule.bindings, ...binding.bindings } };
    return { key: `${template.key}:${binding.key}`, name: binding.name, category: template.category, familyKey: template.familyKey,
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

/** Copy an authorized Library definition without changing its price or numeric rule. */
export function quickRuleFromLibrary(row: {
  id: number; name: string; category: string; familyKey: string | null; buCost: number;
  costTier: string; mechanicalOutputText: string; narrativeRule: string;
  mechanicalRule: unknown; hardModifiers: unknown; consequenceBehavior?: import("@/lib/character/consequences/types").ConsequenceBehavior | null;
}): QuickRuleSeed | null {
  if (!Number.isFinite(row.buCost) || row.buCost < 0) return null;
  const hardModifiers = Array.isArray(row.hardModifiers) ? row.hardModifiers.filter((value): value is Record<string, unknown> => !!value && typeof value === "object" && value.kind === "modify" && typeof value.target === "string") : [];
  if (Array.isArray(row.hardModifiers) && hardModifiers.length !== row.hardModifiers.length) return null;
  const composition = parseAuthorableCompositionRule(row.mechanicalRule);
  if (!hardModifiers.length && !composition) return null;
  return { key: `library:${row.id}`, name: row.name, category: row.category,
    familyKey: row.familyKey ?? "SHEET_AUGMENT", buCost: row.buCost, costTier: row.costTier,
    mechanicalOutputText: row.mechanicalOutputText || (composition ? renderMechanicalRule(composition) : mechanicalDescriptionFromModifiers(hardModifiers as unknown as HardModifier[])),
    ...(row.consequenceBehavior ? { consequenceBehavior: structuredClone(row.consequenceBehavior) } : {}),
    narrativeRule: row.narrativeRule, hardModifiers: structuredClone(hardModifiers),
    ...(composition ? { mechanicalRule: composition } : {}), source: "library" };
}

export function quickRuleMatchesFamily(seed: QuickRuleSeed, family: QuickRuleFamily): boolean {
  if (seed.familyKey === family) return true;
  const targets = seed.hardModifiers.map(modifier => String(modifier["target"]));
  if (family === "PRACTICES") return targets.some(target => target.startsWith("skill_practice_check"));
  if (family === "SAVING_THROWS") return targets.some(target => target === "action_roll") && /save/i.test(`${seed.name} ${seed.mechanicalOutputText}`);
  if (family === "VITALITY") return targets.some(target => target === "max_vitality" || target.startsWith("max_vitality.")) || seed.category === "VITALITY";
  if (family === "MOBILITY") return targets.some(target => target === "speed" || target.startsWith("speed.")) || seed.category === "MOBILITY_LOCOMOTION";
  if (family === "DEFENSES") return targets.some(target => ["damage_type", "damage_modifier"].some(axis => target === axis || target.startsWith(`${axis}.`))) || ["DEFENSE", "DEFENSIVE"].includes(seed.category);
  if (family === "PROBABILITY_BIAS") return /advantage|disadvantage/i.test(JSON.stringify(seed.hardModifiers)) || seed.category === "PROBABILITY_BIAS";
  return false;
}

export function withQuickRuleCondition(seed: QuickRuleSeed, presetKey: ConditionPresetKey | ""): QuickRuleSeed {
  if (!presetKey || !seed.hardModifiers.length || seed.hardModifiers.some(modifier => modifier["condition"])) return seed;
  const preset = CONDITION_PRESETS.find(item => item.key === presetKey);
  if (!preset) return seed;
  const condition = { kind: "preset", presetKey, customTags: [] };
  return { ...seed, key: `${seed.key}:when:${presetKey}`,
    mechanicalOutputText: `${seed.mechanicalOutputText.replace(/[.\s]+$/, "")} when ${preset.label.toLowerCase()}.`,
    hardModifiers: seed.hardModifiers.map(modifier => ({ ...structuredClone(modifier), condition })),
    narrativeRule: `${seed.narrativeRule}\n\nApplies only when ${preset.label.toLowerCase()}. Confirm the situation at the table. The original BU price is unchanged; review any repricing with your DM.` };
}

/** Explore every eligible option before repeating; All families gives small families a fair chance. */
export function drawQuickRule(options: QuickRuleSeed[], seen: string[], currentKey?: string, random = Math.random): QuickRuleSeed | undefined {
  const unseen = options.filter(option => !seen.includes(option.key) && option.key !== currentKey);
  const fresh = unseen.length ? unseen : options.filter(option => option.key !== currentKey);
  const pool = fresh.length ? fresh : options;
  const families = [...new Set(pool.map(option => option.familyKey))];
  if (!families.length) return undefined;
  const family = families[Math.min(families.length - 1, Math.floor(random() * families.length))];
  const familyPool = pool.filter(option => option.familyKey === family);
  return familyPool[Math.min(familyPool.length - 1, Math.floor(random() * familyPool.length))];
}
