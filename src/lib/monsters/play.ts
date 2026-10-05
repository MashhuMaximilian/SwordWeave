import { reconcileSheetConditions } from "@/lib/character/reconcile-sheet-conditions";
import { isConditionComputable,type ConditionContext } from "@/lib/engine/condition-evaluator";
import { PRACTICE_ATTRIBUTE_MAP } from "@/lib/engine/practices";
import { applyConditionOverrides,runtimeConditionModifiers } from "@/lib/character/condition-overrides";
import { activeRestrictions,occurrenceEnabled,type ConsequenceOccurrence } from "@/lib/character/consequences/types";
import { effectiveAvailability,type SupplyPath,type EntityKey } from "@/lib/character/workspace/model";
import { parseOccurrence } from "@/lib/character/consequences/validation";
import { monsterBaselines,type MonsterDefinition } from "./model";
import { resolveMonster,type MonsterSlot } from "./resolve";
import type { PlayOverrides } from "@/lib/play-state/model";
export function resolveMonsterPlay(definition:MonsterDefinition,slots:readonly MonsterSlot[],overrides:PlayOverrides,currentVitality:number){
 const storedOccurrences=Object.entries(overrides).filter(([k,v])=>k.startsWith("consequence:")&&v!==null).map(([,v])=>parseOccurrence(v));
 const initial=resolveMonster({...definition,baselineVitality:typeof overrides["baselineVitality"]==="number"?overrides["baselineVitality"]:definition.baselineVitality},slots,currentVitality);
 const current=typeof overrides["currentVitality"]==="number"?overrides["currentVitality"]:currentVitality;
 const context:ConditionContext={character:{vitality:current,vitalityMax:initial.maximum,saveDc:initial.resolved.totals["save_dc"]??0,blockValue:initial.resolved.totals["block_value"]??0,attributes:initial.attributes,practices:Object.fromEntries(initial.practices.map(p=>[p.practice,p.total])) as ConditionContext["character"]["practices"],proficiencies:new Set([definition.proficientAttribute,...PRACTICE_ATTRIBUTE_MAP[definition.proficientAttribute.toUpperCase() as "PHYSICAL"|"MENTAL"|"MAGICAL"]]),flags:new Set(storedOccurrences.filter(occurrenceEnabled).flatMap(c=>c.tags)),custom:{size:definition.size,level:initial.rank,pb:initial.resolved.totals["proficiency_bonus"]??initial.pb}}};
 const desired:ConsequenceOccurrence[]=slots.flatMap(slot=>slot.hardModifiers.flatMap((modifier,index)=>modifier.condition?[{id:`sheet-primitive-${slot.primitiveId}-${index}`,title:`${slot.name} condition`,description:typeof modifier.condition==="string"?modifier.condition:JSON.stringify(modifier.condition),tags:[],modifiers:[modifier],durationTier:"manual" as const,active:true,createdAt:0,source:isConditionComputable(modifier.condition as never,context)?"sheet-auto" as const:"sheet" as const,sourceEntityId:String(slot.primitiveId),sourceEntityType:"primitive" as const}]:[]));
 const occurrences=reconcileSheetConditions(storedOccurrences,desired);
 const restrictions=activeRestrictions(occurrences), offCaps=new Set(Object.entries(overrides).filter(([k,v])=>k.startsWith("cap:")&&v===true).map(([k])=>k.slice(4))),offEffects=new Set(Object.entries(overrides).filter(([k,v])=>k.startsWith("eff:")&&v===true).map(([k])=>k.slice(4)));
 const adjusted=slots.map(slot=>{const keys=slot.supplyKeys??[[...(slot.originCapabilityId?[`capability:${slot.originCapabilityId}`]:[]),...(slot.originEffectId?[`effect:${slot.originEffectId}`]:[]),`primitive:${slot.primitiveId}`]];const paths:SupplyPath[]=keys.map(nodes=>({nodes:nodes as EntityKey[],edges:[],item:slot.item}));return {...slot,hardModifiers:slot.consequenceBehavior?[]:applyConditionOverrides(slot.hardModifiers,occurrences,"primitive",String(slot.primitiveId)),isToggledOff:!effectiveAvailability(`primitive:${slot.primitiveId}`,paths,restrictions,offCaps,offEffects).available};});
 const runtime:MonsterSlot[]=occurrences.filter(c=>c.source==="custom"&&occurrenceEnabled(c)).map((c,i)=>({primitiveId:-100000-i,name:c.title,category:"RUNTIME_CONDITION",hardModifiers:runtimeConditionModifiers(c),isMirrored:false,isMirrorable:false,mirrorVector:null,originHeritageId:null,originCapabilityId:null,originEffectId:null,buCost:0,quantity:1,dependencyKey:`consequence:${c.id}`,item:false}));
 const baseline=overrides["baselineVitality"];
 const d={...definition,baselineVitality:typeof baseline==="number"?baseline:definition.baselineVitality};
 return {sheet:resolveMonster(d,[...adjusted,...runtime],typeof overrides["currentVitality"]==="number"?overrides["currentVitality"]:currentVitality,context),occurrences,context,base:monsterBaselines(definition.budget)};
}
export function customMonsterConsequence(title:string,description:string):ConsequenceOccurrence{return {id:crypto.randomUUID(),title,description,tags:[],modifiers:[],durationTier:"manual",active:true,createdAt:Date.now(),source:"custom",status:"active"};}
