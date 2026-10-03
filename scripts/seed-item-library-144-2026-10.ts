import { seedOrigin } from "./srd-seed-identity";
/** Dry-run first. Publish only after the expansion dependency shelf is saved. */
import {and,eq} from "drizzle-orm";
import {db,pool,withDatabaseTransaction} from "@/db/client";
import {items,itemPrimitives,itemCapabilities,itemEffects,itemVersions,publications} from "@/db/schema";
import {buildCanonicalItemPayload,hashItemContent} from "@/lib/publishing/hash-content";
import {resolveContentVersionId} from "@/lib/versions/content-hash";
import {resolveVirtualVersionId} from "@/lib/engagement/version-helpers";
import {planItemShelf} from "./item-library-144-plan";
const apply=process.argv.includes("--apply");
async function main(){
 const {plan,p,e,c,existing,pending,counts}=await planItemShelf();
 const changes=plan.filter(x=>!existing.some(r=>seedOrigin(r)===seedOrigin(x)));
 console.log(JSON.stringify({mode:apply?"APPLY":"DRY RUN",items:plan.length,categories:counts,new:changes.length,pendingExpansionDependencies:pending,budgetRange:[Math.min(...plan.map(x=>x.buCost)),Math.max(...plan.map(x=>x.buCost))]},null,2));
 if(!apply){console.log("No database writes. Apply only after expansion publication.");return;}
 if(pending.length)throw new Error("Save expansion dependencies before applying item shelf");
 await withDatabaseTransaction(async()=>{
 for(const x of plan){
  const primitiveSlots=x.primitives.map(n=>({primitiveId:p.get(n)!.id,isMirrored:false})),capabilityIds=x.capabilities.map(n=>c.get(n)!.id),effectIds=x.effects.map(n=>e.get(n)!.id);
  const membershipOrder=[...primitiveSlots.map(s=>`primitive:${s.primitiveId}`),...capabilityIds.map(id=>`capability:${id}`),...effectIds.map(id=>`effect:${id}`)];
  const fields={name:x.name,itemType:x.itemType,rarity:"COMMON" as const,size:x.size,buCost:x.buCost,description:x.description,slotCost:x.slotCost,quantity:1,isTwoHanded:x.isTwoHanded,isConsumable:x.isConsumable,isNotEquippable:x.isNotEquippable,actsAsFocus:x.itemType==="ARTIFACT",isPublic:true,userId:null,sourceOrigin:seedOrigin(x),tags:["item-shelf-144",x.category.toLowerCase().replaceAll(" ","-"),"original-design"],iconSource:"GAME_ICONS" as const,iconKey:x.iconKey,iconUrl:null,iconColor:"#d8ad54",membershipOrder};
  const payload=buildCanonicalItemPayload({...fields,primitiveIds:primitiveSlots.map(s=>s.primitiveId),primitiveSlots,capabilityIds,effectIds}),hash=await hashItemContent(payload);
  let row=existing.find(r=>seedOrigin(r)===seedOrigin(x));
  if(row&&row.userId!==null)throw new Error(`Refuse personal row ${x.name}`);
  const pubs=row?await db.select().from(publications).where(and(eq(publications.targetType,"ITEM"),eq(publications.targetId,row.id))):[];
  if(pubs.some(r=>r.visibility!=="PUBLIC"||r.unpublishedAt))throw new Error(`Refuse hidden publication ${x.name}`);
  if(row?.contentHash===hash)continue;
  if(row){await db.update(items).set({...fields,contentHash:hash}).where(eq(items.id,row.id));}else{[row]=await db.insert(items).values({...fields,contentHash:hash}).returning();}
  if(!row)throw new Error(`Item insert failed ${x.name}`);
  await db.delete(itemPrimitives).where(eq(itemPrimitives.itemId,row.id));await db.delete(itemCapabilities).where(eq(itemCapabilities.itemId,row.id));await db.delete(itemEffects).where(eq(itemEffects.itemId,row.id));
  if(primitiveSlots.length)await db.insert(itemPrimitives).values(primitiveSlots.map((s,i)=>({...s,itemId:row!.id,sortOrder:i})));
  if(capabilityIds.length)await db.insert(itemCapabilities).values(capabilityIds.map((id,i)=>({itemId:row!.id,capabilityId:id,sortOrder:i})));
  if(effectIds.length)await db.insert(itemEffects).values(effectIds.map((id,i)=>({itemId:row!.id,effectId:id,sortOrder:i})));
  const prior=await db.select().from(itemVersions).where(eq(itemVersions.itemId,row.id));const versionId=resolveContentVersionId("item",row.id,hash),old=prior.find(v=>v.id===versionId);
  await db.update(itemVersions).set({isLatest:false}).where(eq(itemVersions.itemId,row.id));
  if(old)await db.update(itemVersions).set({isLatest:true}).where(eq(itemVersions.id,versionId));else await db.insert(itemVersions).values({id:versionId,itemId:row.id,versionNumber:Math.max(0,...prior.map(v=>v.versionNumber))+1,isLatest:true,deltaKind:"FULL",snapshot:payload as unknown as Record<string,unknown>});
  if(!pubs.length)await db.insert(publications).values({targetType:"ITEM",targetId:row.id,versionId:resolveVirtualVersionId("ITEM",row.id),versionNumber:1,authorId:null,visibility:"PUBLIC"});
 }
 });
 console.log("Saved versioned144-item shelf; character ownership and primitive BU unaffected.");
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>pool.end());
