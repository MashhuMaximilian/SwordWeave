/** Read-only candidate + optional saved-recipe audit. */
import {strict as assert} from "node:assert";
import {db,pool} from "@/db/client";
import {primitives,effects,capabilities,effectPrimitives,capabilityPrimitives,capabilityEffects,primitiveVersions,effectVersions,capabilityVersions,forks} from "@/db/schema";
import {resolveModifiers,type ResolvedPrimitiveSlot} from "@/lib/engine/resolve-modifiers";
import type {ConditionContext} from "@/lib/engine/condition-evaluator";
import {expansionPrimitives,expansionEffects,expansionCapabilities} from "./phase4-expansion-data-2026-10";
import {expansionCandidate,slug} from "./seed-phase4-expansion-2026-10";
async function main(){
 const rows=await db.select().from(primitives);const byName=new Map(rows.filter(x=>x.isPublic||x.name==="Bounded Practical Permission").map(x=>[x.name,x]));
 // Match the exact canonical parent selected by the seeder, not a later
 // same-name legacy/template row from an unordered query.
 byName.set("Verb Access Tier I", rows.find(x=>x.id===20)!);
 let numericalChecks=0;
 for(const idea of expansionPrimitives){const parent=byName.get(idea.parent);assert(parent,`parent ${idea.parent}`);const row=expansionCandidate(parent,idea);assert(row.narrativeRule?.length&&row.iconKey);if(idea.magnitude===undefined){assert.equal(row.hardModifiers?.length,0);assert.equal(row.isMirrorable,false);continue;}
  const flag=`manual:${slug(idea.condition!).replaceAll("-","_")}`;
  for(const pb of [3,5]){
   const condition=(on:boolean):ConditionContext=>({character:{vitality:20,vitalityMax:40,saveDc:10,blockValue:0,attributes:{physical:2,mental:1,magical:0},practices:{prowess:0,finesse:0,fieldcraft:0,awareness:0,reason:0,knowledge:0,influence:0,mysticism:0,communion:0,intuition:0},proficiencies:new Set(["physical"]),flags:new Set(on?[flag]:[]),custom:{}}});
   const slot=(mirror=false,off=false,compiled=false):ResolvedPrimitiveSlot=>({primitiveId:99999,name:row.name,category:row.category,hardModifiers:row.hardModifiers??[],isMirrored:mirror,isMirrorable:true,mirrorVector:row.mirrorVector,originHeritageId:compiled?"audit-heritage":null,originCapabilityId:compiled?"audit-capability":null,originEffectId:compiled?"audit-effect":null,isToggledOff:off});
   const get=(slots:ResolvedPrimitiveSlot[],on=true)=>resolveModifiers({characterId:"expansion-audit",level:5,pb,proficientAttribute:"physical",attributes:{physical:2,mental:1,magical:0},slots,conditionContext:condition(on)}).totals;
   const base=get([]),normal=get([slot()]),mirror=get([slot(true)]),off=get([slot(false,true)]),unmet=get([slot()],false),compiled=get([slot(false,false,true)]);const changed=Object.keys(normal).filter(k=>normal[k]!==base[k]);assert(changed.length,`${idea.name} must change a displayed resolver total`);const amount=idea.magnitude==="PB"?pb:idea.magnitude;
   for(const k of changed){assert.equal(normal[k],(base[k]??0)+amount,`${idea.name} ${k} normal`);assert.equal(mirror[k],(base[k]??0)-amount,`${idea.name} ${k} mirrored`);assert.equal(off[k]??0,base[k]??0,`${idea.name} ${k} inactive`);assert.equal(unmet[k]??0,base[k]??0,`${idea.name} ${k} condition false`);assert.equal(compiled[k],normal[k],`${idea.name} ${k} compiled`);}
   if(idea.parent.startsWith("Save DC")){assert.equal(normal.physical_saving_throw,base.physical_saving_throw);assert.equal(normal.attack_bonus,base.attack_bonus);}
   numericalChecks+=5;
  }
 }
 console.log(`Candidate audit PASS: ${expansionPrimitives.length} primitives, ${numericalChecks} active/inactive/condition/mirror/compiled cases across odd PB3/PB5.`);
 if(!process.argv.includes("--saved"))return;
 const [es,cs,ep,cp,ce,pv,ev,cv,fs]=await Promise.all([db.select().from(effects),db.select().from(capabilities),db.select().from(effectPrimitives),db.select().from(capabilityPrimitives),db.select().from(capabilityEffects),db.select().from(primitiveVersions),db.select().from(effectVersions),db.select().from(capabilityVersions),db.select().from(forks)]);
 for(const idea of expansionPrimitives){const row=byName.get(idea.name);assert(row,`saved primitive ${idea.name}`);assert.equal(row.narrativeRule,idea.rule);assert.equal(row.buCost,idea.bu);assert.equal(row.iconKey,idea.icon);assert(pv.some(v=>v.primitiveId===row.id&&v.isLatest));assert(fs.some(f=>f.forkedTargetType==="PRIMITIVE"&&f.forkedTargetId===String(row.id)&&f.sourceTargetId===String(byName.get(idea.parent)!.id)));}
 const savedE=new Map(es.map(x=>[x.name,x]));for(const idea of expansionEffects){const row=savedE.get(idea.name);assert(row,`saved effect ${idea.name}`);assert.equal(row.narrativeDescription,idea.text);assert.equal(row.iconKey,idea.icon);const links=ep.filter(x=>x.effectId===row.id);assert.deepEqual(links.map(x=>x.primitiveId).sort((a,b)=>a-b),idea.primitives.map(n=>byName.get(n)!.id).sort((a,b)=>a-b));for(const link of links){assert.equal(link.targetWho,idea.target);assert.equal(link.isMirrored,["Salt-Wet Footing","Fevered Aim","Cracked Plate"].includes(idea.name));}const v=ev.find(x=>x.effectId===row.id&&x.isLatest);assert(v);if(["Salt-Wet Footing","Fevered Aim","Cracked Plate"].includes(idea.name))assert((v.snapshot as {primitiveSlots:{isMirrored?:boolean}[]}).primitiveSlots.every(x=>x.isMirrored));}
 for(const idea of expansionCapabilities){const row=cs.find(x=>x.name===idea.name);assert(row,`saved capability ${idea.name}`);assert.equal(row.verboseDescription,idea.text);assert.equal(row.iconKey,idea.icon);assert.deepEqual(cp.filter(x=>x.capabilityId===row.id).map(x=>x.primitiveId).sort((a,b)=>a-b),idea.primitives.map(n=>byName.get(n)!.id).sort((a,b)=>a-b));assert.deepEqual(ce.filter(x=>x.capabilityId===row.id).map(x=>x.effectId).sort(),idea.effects.map(n=>savedE.get(n)!.id).sort());assert(cv.some(v=>v.capabilityId===row.id&&v.isLatest));}
 console.log(`Saved audit PASS:43 forks/permissions,32 effects,40 capabilities with exact ingredient links, mirrors, recipients, icons and full versions.`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
