import type { ConditionContext } from "@/lib/engine/condition-evaluator";
import type { ConsequenceBehavior } from "@/lib/character/consequences/types";
import { resolveModifiers, type ResolvedPrimitiveSlot } from "@/lib/engine/resolve-modifiers";
import { computeAllPracticeModifiers } from "@/lib/engine/practices";
import { SIZE_BASE_SPEED, SIZE_CAPACITY } from "@/lib/engine/encumbrance";
import { monsterBaselines, clampMonsterVitality, type MonsterDefinition } from "./model";
export type MonsterSlot = ResolvedPrimitiveSlot & { buCost: number; quantity: number; dependencyKey: string; item: boolean; supplyKeys?: string[][]; supplyNames?:Record<string,string>; dependencyVersions?: string[]; consequenceBehavior?: ConsequenceBehavior | null };
export function monsterCost(slots: readonly MonsterSlot[]) {
  const seen = new Set<string>(); let spent = 0, itemBu = 0;
  for (const s of slots) { if (seen.has(s.dependencyKey)) continue; seen.add(s.dependencyKey); const cost = s.isMirrored ? 0 : Math.max(0,s.buCost) * s.quantity; if (s.item) itemBu += cost; else spent += cost; }
  return { spent, itemBu };
}
export function resolveMonster(definition: MonsterDefinition, slots: readonly MonsterSlot[], currentVitality?: number, conditionContext?: ConditionContext) {
  const base = monsterBaselines(definition.budget);
  if(slots.reduce((total,s)=>total+s.quantity,0)>10000)throw new Error("This composition expands beyond 10,000 runtime primitive instances. Reduce reference quantities or split it into smaller play copies.");
  const expanded = slots.flatMap(s => Array.from({ length: s.quantity }, (_, i) => ({ ...s, instanceId: `${s.dependencyKey}:${i}` })));
  const baselinePractices = computeAllPracticeModifiers(definition.attributes, definition.practiceSlices, definition.proficientAttribute.toUpperCase() as "PHYSICAL" | "MENTAL" | "MAGICAL", base.rank, new Map(), base.pb);
  const practiceSeeds = Object.fromEntries(baselinePractices.map(p=>[`skill_practice_check.${p.practice}`,p.total]));
  const resolved = resolveModifiers({ characterId: "monster", level: base.rank, pb: base.pb, attributes: definition.attributes, proficientAttribute: definition.proficientAttribute, slots: expanded, ...(conditionContext?{conditionContext}:{}), metricBaselines: { ...practiceSeeds, max_vitality: definition.baselineVitality ?? base.vitality, speed: SIZE_BASE_SPEED[definition.size], carry_capacity: SIZE_CAPACITY[definition.size] + definition.attributes.physical * 5 } });
  const maximum = Math.max(1, Math.ceil((resolved.totals["max_vitality"] ?? base.vitality)));
  if(!Number.isSafeInteger(maximum))throw new Error("Resolved Vitality exceeds numeric safety. Reduce the modifier magnitude.");
  const attributes = { physical: (resolved.totals["attribute.physical"] ?? definition.attributes.physical), mental: (resolved.totals["attribute.mental"] ?? definition.attributes.mental), magical: (resolved.totals["attribute.magical"] ?? definition.attributes.magical) };
  const finalPractices = computeAllPracticeModifiers(attributes, definition.practiceSlices, definition.proficientAttribute.toUpperCase() as "PHYSICAL" | "MENTAL" | "MAGICAL", base.rank, new Map(), resolved.totals["proficiency_bonus"]);
  const practices = finalPractices.map((p,i)=>({...p,total:p.total + (resolved.totals[`skill_practice_check.${p.practice}`] ?? baselinePractices[i]!.total) - baselinePractices[i]!.total}));
  return { ...base, ...monsterCost(slots), maximum, currentVitality: clampMonsterVitality(currentVitality ?? maximum, maximum), attributes, practices, resolved };
}
