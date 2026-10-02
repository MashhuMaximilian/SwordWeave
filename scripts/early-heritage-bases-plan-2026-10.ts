/** Shared read-only preflight: resolve exact public inputs and deduplicate budgets. */
import {db} from '@/db/client';
import {primitives,capabilities,capabilityPrimitives,capabilityEffects,effectPrimitives,heritage,heritageVersions} from '@/db/schema';
import icons from '@/lib/icons/game-icons-index.json';
import {earlyHeritageBases} from './early-heritage-bases-data-2026-10';
export const earlyBasePrefix='system:v14:early-heritage-base:';
export async function earlyBasePlan(){
 const [ps,cs,cp,ce,ep,hs,hv]=await Promise.all([db.select().from(primitives),db.select().from(capabilities),db.select().from(capabilityPrimitives),db.select().from(capabilityEffects),db.select().from(effectPrimitives),db.select().from(heritage),db.select().from(heritageVersions)]);
 const keys=new Set(icons.icons.map(x=>x.key));
 const pByName=new Map<string,typeof ps[number]>();
 for(const p of ps.filter(x=>x.isPublic))if(!pByName.has(p.name)||p.sourceOrigin?.startsWith('system')&&!pByName.get(p.name)!.sourceOrigin?.startsWith('system'))pByName.set(p.name,p);
 const cByName=new Map(cs.filter(x=>x.isPublic&&x.userId===null).map(x=>[x.name,x]));
 const pById=new Map(ps.map(x=>[x.id,x]));
 return earlyHeritageBases.map(recipe=>{
  if(!keys.has(recipe.iconKey))throw new Error(`Invalid icon ${recipe.name}`);
  const direct=recipe.primitives.map(name=>{const p=pByName.get(name);if(!p)throw new Error(`Missing primitive ${name}`);return p.id;});
  const caps=recipe.capabilities.map(name=>{const c=cByName.get(name);if(!c)throw new Error(`Missing capability ${name}`);return c.id;});
  const all=new Set(direct);
  for(const id of caps){for(const x of cp.filter(x=>x.capabilityId===id))all.add(x.primitiveId);for(const e of ce.filter(x=>x.capabilityId===id))for(const x of ep.filter(x=>x.effectId===e.effectId))all.add(x.primitiveId);}
  for(const id of all)if(!pById.get(id)?.isPublic)throw new Error(`Nonpublic component ${id}`);
  const cost=[...all].reduce((sum,id)=>sum+pById.get(id)!.buCost,0);
  if(cost!==recipe.bu)throw new Error(`Budget drift ${recipe.name}: ${cost} expected ${recipe.bu}`);
  const [lo,hi]=recipe.kind==='LINEAGE'?[6,10]:recipe.kind==='UPBRINGING'?[4,8]:[6,12];if(cost<lo||cost>hi)throw new Error(`Out of band ${recipe.name}`);
  const parent=hs.find(x=>x.kind===recipe.kind&&x.name===recipe.parent&&x.isPublic&&x.userId===null);if(!parent)throw new Error(`Missing source heritage ${recipe.parent}`);
  const parentVersion=hv.find(x=>x.templateId===parent.id&&x.isLatest);if(!parentVersion)throw new Error(`Missing source version ${recipe.parent}`);
  const sourceOrigin=`${earlyBasePrefix}${recipe.kind.toLowerCase()}:${recipe.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
  const existing=hs.find(x=>x.sourceOrigin===sourceOrigin);
  if(hs.some(x=>x.name===recipe.name&&x.kind===recipe.kind&&x.sourceOrigin!==sourceOrigin))throw new Error(`Name collision ${recipe.name}`);
  return {recipe,direct,caps,all:[...all],cost,parent,parentVersion,sourceOrigin,existing};
 });
}
