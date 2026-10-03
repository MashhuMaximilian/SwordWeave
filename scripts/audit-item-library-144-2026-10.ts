import { seedOrigin } from "./srd-seed-identity";
/** Read-only content integrity audit. --design checks staged recipes before saving. */
import {db,pool} from "@/db/client";
import {items,itemPrimitives,itemCapabilities,itemEffects,itemVersions,publications} from "@/db/schema";
import {buildCanonicalItemPayload,hashItemContent} from "@/lib/publishing/hash-content";
import {planItemShelf} from "./item-library-144-plan";
import {computeLoad,computeEquipSlotsUsed,SIZE_LOAD} from "@/lib/engine/encumbrance";
const assert=(ok:unknown,msg:string)=>{if(!ok)throw new Error(msg)};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
async function main(){
 const {plan,p,e,c,pending,counts}=await planItemShelf();
 const enc=(name:string,quantity=1)=>{const x=plan.find(y=>y.name===name)!;return{size:x.size,loadValue:SIZE_LOAD[x.size],slotCount:x.slotCost,isTwoHanded:x.isTwoHanded,capacityBonus:0,ignoreLoadBonus:0,quantity,equipped:!x.isNotEquippable}};
 assert(computeEquipSlotsUsed([enc("Survey Bow"),enc("Doorbrace Shield")])===3,"Bow+shield slot check");
 assert(computeEquipSlotsUsed([enc("Patchsmith Roll")])===0,"Carried toolkit must not equip");
 assert(computeLoad([enc("Survey Bow"),enc("Patchsmith Roll")])===3,"Carry Load independent from slots");
 assert(computeLoad([enc("Witness Wax Pellet",1000)])===1&&computeLoad([enc("Witness Wax Pellet",1001)])===2,"1000 tiny items per pouch");
 if(process.argv.includes("--design")){console.log(JSON.stringify({validatedRecipes:plan.length,categories:counts,pending:pending.length,manualOutputs:true,characterBuSeparate:true},null,2));return;}
 assert(pending.length===0,"Expansion dependency shelf not saved");
 const [rows,ps,cs,es,vs,pubs]=await Promise.all([db.select().from(items),db.select().from(itemPrimitives),db.select().from(itemCapabilities),db.select().from(itemEffects),db.select().from(itemVersions),db.select().from(publications)]);
 for(const x of plan){
  const row=rows.find(r=>seedOrigin(r)===seedOrigin(x));assert(row,`Missing item ${x.name}`);if(!row)continue;
  assert(row.isPublic&&row.userId===null,`Item ownership ${x.name}`);assert(row.description===x.description&&row.buCost===x.buCost&&row.slotCost===x.slotCost&&row.size===x.size,`Item content drift ${x.name}`);
  assert(row.iconSource==="GAME_ICONS"&&row.iconKey===x.iconKey&&row.iconColor==="#d8ad54",`Icon drift ${x.name}`);
  assert(row.isTwoHanded===x.isTwoHanded&&(!row.isTwoHanded||row.slotCost>=2),`Two-handed minimum ${x.name}`);assert(row.isNotEquippable===x.isNotEquippable&&row.isConsumable===x.isConsumable,`Equipment flags ${x.name}`);
  const actualPs=ps.filter(y=>y.itemId===row.id).sort((a,b)=>a.sortOrder-b.sortOrder),actualCs=cs.filter(y=>y.itemId===row.id).sort((a,b)=>a.sortOrder-b.sortOrder),actualEs=es.filter(y=>y.itemId===row.id).sort((a,b)=>a.sortOrder-b.sortOrder);
  assert(same(actualPs.map(y=>y.primitiveId),x.primitives.map(n=>p.get(n)!.id)),`Primitive linkage ${x.name}`);assert(same(actualCs.map(y=>y.capabilityId),x.capabilities.map(n=>c.get(n)!.id)),`Capability linkage ${x.name}`);assert(same(actualEs.map(y=>y.effectId),x.effects.map(n=>e.get(n)!.id)),`Effect linkage ${x.name}`);
  assert(actualPs.every(y=>!y.isMirrored),`Unexpected mirrored item ingredient ${x.name}`);
  const payload=buildCanonicalItemPayload({...row,primitiveIds:actualPs.map(y=>y.primitiveId),primitiveSlots:actualPs.map(y=>({primitiveId:y.primitiveId,isMirrored:y.isMirrored})),capabilityIds:actualCs.map(y=>y.capabilityId),effectIds:actualEs.map(y=>y.effectId)});
  assert(await hashItemContent(payload)===row.contentHash,`Hash drift ${x.name}`);
  const latest=vs.filter(y=>y.itemId===row.id&&y.isLatest);assert(latest.length===1,`Latest version count ${x.name}`);
  // JSONB reorders both top-level and nested object keys. Rebuild explicit
  // canonical slot fields before the string-based content hash comparison.
  const snapshot=latest[0]!.snapshot as unknown as typeof payload;
  const canonicalSnapshot=buildCanonicalItemPayload({...snapshot,primitiveSlots:snapshot.primitiveSlots.map(slot=>({primitiveId:slot.primitiveId,isMirrored:slot.isMirrored}))});
  assert(await hashItemContent(canonicalSnapshot)===row.contentHash,`Version drift ${x.name}`);
  assert(pubs.some(y=>y.targetType==="ITEM"&&y.targetId===row.id&&y.visibility==="PUBLIC"&&!y.unpublishedAt),`Publication ${x.name}`);
 }
 console.log(`PASS:144 saved original items, recipes, hashes, versions, visibility, icons, two-handed slots, carried flags, and separate item budgets.`);

}
main().catch(err=>{console.error(err);process.exitCode=1}).finally(()=>pool.end());
