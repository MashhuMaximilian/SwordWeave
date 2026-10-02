/** Read-only reproduction using saved IDs, version snapshots, real bundle expansion. */
import assert from "node:assert/strict";
import {itemShelf} from "./item-library-144-data";
import {expansionCapabilities} from "./phase4-expansion-data-2026-10";
import {db,pool} from "@/db/client";
import {capabilities,capabilityEffects,capabilityPrimitives,effectPrimitives,effects,primitiveVersions,primitives,capabilityVersions,effectVersions} from "@/db/schema";
import {expandBundles} from "@/lib/engine/bundle-expander";
import {resolveModifiers,type ResolvedPrimitiveSlot} from "@/lib/engine/resolve-modifiers";
import {aggregateCharacterSheet,type CharacterSheetInput} from "@/lib/engine/sheet";
import {effectivePrimitiveLinks} from "@/lib/character/workspace/effective-primitives";
async function main(){
 const [ps,es,cs,ep,cp,ce,pv,ev,cv]=await Promise.all([db.select().from(primitives),db.select().from(effects),db.select().from(capabilities),db.select().from(effectPrimitives),db.select().from(capabilityPrimitives),db.select().from(capabilityEffects),db.select().from(primitiveVersions),db.select().from(effectVersions),db.select().from(capabilityVersions)]);
 const result=[];
 const penaltyNames=new Set(["Salt-Wet Footing","Fevered Aim","Cracked Plate"]);
 const penaltyIds=new Set(es.filter(x=>penaltyNames.has(x.name)).map(x=>x.id));
 const newCaps=cs.filter(x=>expansionCapabilities.some(y=>y.name===x.name));
 const itemCapIds=new Set(itemShelf.flatMap(x=>x.capabilities).map(n=>cs.find(x=>x.name===n&&x.isPublic)?.id).filter(Boolean));
 assert(!ce.some(x=>penaltyIds.has(x.effectId)&&(newCaps.some(c=>c.id===x.capabilityId)||itemCapIds.has(x.capabilityId))),"Target penalty must not be in actor-owned new capability/item recipe");
 assert(!itemShelf.some(x=>x.effects.some(n=>penaltyNames.has(n))),"Target penalty must not be directly attached to new item");
 console.log(`PASS: no three target penalty effects occur inside ${expansionCapabilities.length} new capability or 144 item actor-owned recipes.`);
 const sheetBase:Omit<CharacterSheetInput,"primitiveLinks">={characterId:"recipient-readonly-reproduction",level:5,attrPhysical:2,attrMental:1,attrMagical:0,attrProficient:"PHYSICAL",practiceSlices:null,startingBu:25,buSpent:0,dmBonusBu:0,currentVitality:null,size:"MEDIUM",capabilityLinks:[],itemLinks:[]};
 for(const name of ["Salt-Wet Footing","Fevered Aim","Cracked Plate","Steady Hands","Bound Passage Guard"]){
  const effect=es.find(x=>x.name===name&&x.isPublic);if(!effect)throw new Error(`Missing ${name}`);
  const version=ev.find(x=>x.effectId===effect.id&&x.isLatest);if(!version)throw new Error(`Missing version ${name}`);
  const effectSlots=(version.snapshot as {primitiveSlots:{primitiveId:number;isMirrored?:boolean;targetWho?:string}[]}).primitiveSlots;
  const links=ep.filter(x=>x.effectId===effect.id);const container=ce.find(x=>x.effectId===effect.id);const cap=container?cs.find(x=>x.id===container.capabilityId):undefined;
  const capVersion=cap?cv.find(x=>x.capabilityId===cap.id&&x.isLatest):undefined;
  const capSnapshot=capVersion?.snapshot as {primitiveSlots:{primitiveId:number;isMirrored?:boolean}[];effectIds:string[]}|undefined;
  if(cap){assert(capSnapshot,`Missing pinned capability version ${cap.name}`);assert(capSnapshot.effectIds.includes(effect.id),`Capability snapshot lacks ${name}`)}
  // For an unreferenced published effect, owning it directly is also a supported sheet path.
  const expanded=expandBundles({heritages:[],primitives:[],capabilities:cap?[{id:cap.id,source:"PERSONAL",primitiveLinks:capSnapshot!.primitiveSlots,effectLinks:[{effectId:effect.id,primitiveLinks:effectSlots}]}]:[],effects:cap?[]:[{id:effect.id,source:"PERSONAL",primitiveLinks:effectSlots}]});
  const effective=await effectivePrimitiveLinks(expanded.primitives.map(x=>({primitiveId:x.primitiveId,versionId:pv.find(v=>v.primitiveId===x.primitiveId&&v.isLatest)?.id??null,primitive:ps.find(p=>p.id===x.primitiveId)!})));
  const slots:ResolvedPrimitiveSlot[]=expanded.primitives.map((x,i)=>{const p=effective[i]!.primitive;return{...x,name:p.name,category:p.category,hardModifiers:p.hardModifiers??[],isMirrorable:p.isMirrorable,mirrorVector:p.mirrorVector}});
  // Omitted condition context is the documented always-on resolver mode.
  const input={characterId:"recipient-readonly-reproduction",level:5,pb:3,proficientAttribute:"physical" as const,attributes:{physical:2,mental:1,magical:0},slots};
  const base=resolveModifiers({...input,slots:[]}).totals,actual=resolveModifiers(input).totals;
  const sheet=aggregateCharacterSheet({...sheetBase,primitiveLinks:expanded.primitives.map((x,i)=>{const p=effective[i]!.primitive;return{...x,source:x.source,acquiredAtLevel:1,primitive:{id:p.id,name:p.name,category:p.category,buCost:p.buCost,isMirrorable:p.isMirrorable,mirrorBuCredit:p.mirrorBuCredit,mirrorVector:p.mirrorVector,hardModifiers:p.hardModifiers??[]}}})});
  if(name==="Cracked Plate"){assert.equal(actual["save_dc"],9);assert.equal(sheet.dc,9)}
  if(name==="Fevered Aim")assert.equal(actual["attack_bonus"],3);
  if(name==="Salt-Wet Footing")assert.equal(actual["skill_practice_check.finesse"],-2);
  if(name==="Steady Hands")assert.equal(actual["skill_practice_check.finesse"],2);
  if(name==="Bound Passage Guard"){assert.equal(actual["save_dc"],12);assert.equal(sheet.dc,12)}
  result.push({effect:name,sheetDc:sheet.dc,sheetPractices:sheet.practices.filter(p=>p.practice.toLowerCase()==="finesse"),effectId:effect.id,capability:cap?.name??null,capabilityId:cap?.id??null,capabilityVersion:cap?cv.find(v=>v.capabilityId===cap.id&&v.isLatest)?.id:null,effectVersion:version.id,recipientLinks:links.map(x=>({primitiveId:x.primitiveId,targetWho:x.targetWho,isMirrored:x.isMirrored})),snapshotHasRecipient:effectSlots.some(x=>x.targetWho!==undefined),changedTotals:Object.fromEntries(Object.entries(actual).filter(([k,v])=>v!==(base[k]??0)).map(([k,v])=>[k,{baseline:base[k]??0,actual:v}])),originPaths:expanded.primitives.map(x=>x.originPath)});
 }
 console.log(JSON.stringify(result,null,2));

}
main().catch(err=>{console.error(err);process.exitCode=1}).finally(()=>pool.end());
