/** Read-only saved links/privacy/budget/pins and production engine checks. --planned skips saved-row requirements. */
import{db,pool}from'@/db/client';
import{characterPrimitives,characterCapabilities,characterHeritages,characterItems,heritageVersions,heritagePrimitives,heritageCapabilities}from'@/db/schema';
import{demoPlan}from'./library-demo-characters-plan-2026-10';
const assert=(ok:unknown,msg:string)=>{if(!ok)throw new Error(msg);};
const same=(a:unknown[],b:unknown[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
async function main(){const plan=await demoPlan();const planned=process.argv.includes('--planned');
 const[ps,cs,hs,is,hvs,hps,hcs]=await Promise.all([db.select().from(characterPrimitives),db.select().from(characterCapabilities),db.select().from(characterHeritages),db.select().from(characterItems),db.select().from(heritageVersions),db.select().from(heritagePrimitives),db.select().from(heritageCapabilities)]);
 for(const x of plan){const r=x.recipe;console.log(`${r.name}: ${x.cost}/${r.budget} BU, DC ${x.sheet.dc}, ${x.expansion.primitives.length} deduplicated primitives`);if(planned)continue;
  const row=x.existing;assert(row,`Missing demo ${r.name}`);if(!row)continue;
  assert(row.userId===null&&row.isPublic&&row.sourceOrigin==='SRD',`System/public/source ${r.name}`);assert(row.startingBu===25&&row.buSpent===x.cost&&row.dmBonusBu===x.bonus&&row.level===r.level,`Budget row ${r.name}`);
  assert(row.attrPhysical===r.attributes[0]&&row.attrMental===r.attributes[1]&&row.attrMagical===r.attributes[2]&&row.attrProficient===r.proficient,`Attributes ${r.name}`);
  const pl=ps.filter(y=>y.characterId===row.id);assert(same(pl.map(y=>y.primitiveId),x.expansion.primitives.map(y=>y.primitiveId)),`Primitive links ${r.name}`);
  for(const p of pl){assert(p.slotSource==='PINNED'&&p.versionId===x.pLatest.get(p.primitiveId)&&!p.isMirrored,`Primitive pin ${r.name}/${p.primitiveId}`);const expected=x.expansion.primitives.find(y=>y.primitiveId===p.primitiveId)!;assert(p.source===expected.source&&p.originHeritageId===expected.originHeritageId&&p.originCapabilityId===expected.originCapabilityId&&p.originEffectId===expected.originEffectId,`Primitive provenance ${r.name}`);}
  const cl=cs.filter(y=>y.characterId===row.id);assert(same(cl.map(y=>y.capabilityId),x.expansion.capabilities.map(y=>y.capabilityId)),`Capability links ${r.name}`);for(const c of cl)assert(c.slotSource==='PINNED'&&c.versionId===x.cLatest.get(c.capabilityId),`Capability pin ${r.name}`);
  const hl=hs.filter(y=>y.characterId===row.id);assert(same(hl.map(y=>y.heritageId),x.expansion.heritages.map(y=>y.heritageId)),`Heritage links ${r.name}`);for(const h of hl){
   // Existing characters retain valid older pins when a lineage gains size metadata.
   const version=hvs.find(v=>v.id===h.versionId&&v.templateId===h.heritageId);
   assert(h.slotSource==='PINNED'&&version,`Heritage pin ${r.name}`);
   if(!version)continue;
   const snapshot=version.snapshot;
   assert(Array.isArray(snapshot.primitiveIds)&&same(snapshot.primitiveIds,hps.filter(p=>p.templateId===h.heritageId).map(p=>p.primitiveId)),`Pinned heritage primitives ${r.name}`);
   assert(Array.isArray(snapshot.capabilityIds)&&same(snapshot.capabilityIds,hcs.filter(c=>c.templateId===h.heritageId).map(c=>c.capabilityId)),`Pinned heritage capabilities ${r.name}`);
  }
  const il=is.filter(y=>y.characterId===row.id);assert(same(il.map(y=>y.itemId),x.inventory.map(y=>y.row.id)),`Item links ${r.name}`);for(const i of il)assert(i.slotSource==='PINNED'&&i.versionId===x.iLatest.get(i.itemId)&&i.quantity===1&&i.equipped===x.inventory.find(y=>y.row.id===i.itemId)!.equipped,`Item pin ${r.name}`);
 }
 console.log(`PASS: ${plan.length} ${planned?'planned':'saved'} SRD characters; legal budgets/slots/load, pinned components, dedup and matching sheet/DC resolver.`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
