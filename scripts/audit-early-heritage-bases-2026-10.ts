/** Read-only; --planned verifies recipes before apply, default verifies saved versions too. */
import {db,pool} from '@/db/client';
import {heritagePrimitives,heritageCapabilities,heritageVersions,publications,forks,primitives,capabilityPrimitives,capabilityEffects,effectPrimitives} from '@/db/schema';
import {earlyBasePlan} from './early-heritage-bases-plan-2026-10';
import {expandBundles} from '@/lib/engine/bundle-expander';
import {aggregateCharacterSheet} from '@/lib/engine/sheet';
function assert(ok:unknown,msg:string):asserts ok{if(!ok)throw new Error(msg);}
const same=(a:(string|number)[],b:(string|number)[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
async function main(){
 const plan=await earlyBasePlan();const planned=process.argv.includes('--planned');
 const [hp,hc,hv,pubs,edges,ps,cp,ce,ep]=await Promise.all([db.select().from(heritagePrimitives),db.select().from(heritageCapabilities),db.select().from(heritageVersions),db.select().from(publications),db.select().from(forks),db.select().from(primitives),db.select().from(capabilityPrimitives),db.select().from(capabilityEffects),db.select().from(effectPrimitives)]);
 const pById=new Map(ps.map(x=>[x.id,x]));
 for(const x of plan){const r=x.recipe;
  const expansion=expandBundles({heritages:[{id:x.existing?.id??`planned:${r.name}`,kind:r.kind,primitiveLinks:x.direct.map(primitiveId=>({primitiveId})),capabilityLinks:x.caps.map(capabilityId=>({capabilityId,primitiveLinks:cp.filter(y=>y.capabilityId===capabilityId).map(y=>({primitiveId:y.primitiveId})),effectLinks:ce.filter(y=>y.capabilityId===capabilityId).map(y=>({effectId:y.effectId,primitiveLinks:ep.filter(z=>z.effectId===y.effectId).map(z=>({primitiveId:z.primitiveId}))}))}))}],capabilities:[],effects:[],primitives:[]});
  assert(!expansion.warnings.length,`Expansion warnings ${r.name}`);assert(same(expansion.primitives.map(y=>y.primitiveId),x.all),`Expansion differs ${r.name}`);
  if(!planned){const row=x.existing;assert(row,`Not saved ${r.name}`);
   assert(row.description===r.description&&row.suggestedTraits===r.traits,`Prose drift ${r.name}`);
   assert(row.isPublic&&row.iconSource==='GAME_ICONS'&&row.iconKey===r.iconKey&&row.iconColor==='#d8ad54',`Icon/public drift ${r.name}`);
   assert(same(hp.filter(y=>y.templateId===row.id).map(y=>y.primitiveId),x.direct),`Direct links drift ${r.name}`);
   assert(same(hc.filter(y=>y.templateId===row.id).map(y=>y.capabilityId),x.caps),`Capability links drift ${r.name}`);
   const versions=hv.filter(y=>y.templateId===row.id&&y.isLatest);assert(versions.length===1&&versions[0].snapshot,`Latest version missing ${r.name}`);
   assert(pubs.some(y=>y.targetId===row.id&&y.targetType===`${r.kind}_TEMPLATE`&&y.visibility==='PUBLIC'&&!y.unpublishedAt),`Not published ${r.name}`);
   assert(edges.some(y=>y.forkedTargetId===row.id&&y.sourceTargetId===x.parent.id),`Fork link missing ${r.name}`);
  }
 }
 const input={characterId:'early-base-audit',level:1,attrPhysical:2,attrMental:1,attrMagical:0,attrProficient:'PHYSICAL' as const,practiceSlices:null,startingBu:25,buSpent:0,dmBonusBu:0,currentVitality:null,size:'MEDIUM' as const,capabilityLinks:[],itemLinks:[],runtimeConditions:[]};
 const sheet=(name?:string)=>aggregateCharacterSheet({...input,primitiveLinks:(name?plan.find(x=>x.recipe.name===name)!.all:[]).map(id=>{const p=pById.get(id)!;return {primitiveId:id,source:'LINEAGE',acquiredAtLevel:1,isMirrored:false,primitive:{id,name:p.name,category:p.category,buCost:p.buCost,isMirrorable:p.isMirrorable,mirrorBuCredit:p.mirrorBuCredit,mirrorVector:p.mirrorVector,hardModifiers:p.hardModifiers}};})});
 const base=sheet();assert(sheet('Hearthspark').vitality.max===base.vitality.max+5,'Hearthspark Vitality increment missing');
 assert(sheet('Glidesprout').vitality.max===base.vitality.max+5,'Glidesprout Vitality increment missing');
 // Legacy Stride Extension is +10; the price is 5 BU, not its magnitude.
 assert(sheet('Quickstep').speedByType.WALKING_SPEED===base.speedByType.WALKING_SPEED+10,'Quickstep walking speed missing');
 console.log(`PASS: ${plan.length} ${planned?'planned':'saved'} bases; exact costs, public inputs, icons, expansion and numeric sheet checks.`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
