/** Dry-run by default. --apply creates versioned, public, fork-linked base bundles. */
import {and,eq} from 'drizzle-orm';
import {db,pool,withDatabaseTransaction} from '@/db/client';
import {heritage,heritagePrimitives,heritageCapabilities,heritageVersions,publications,forks,users} from '@/db/schema';
import {buildCanonicalTemplatePayload,hashTemplateContent} from '@/lib/publishing/hash-content';
import {resolveContentVersionId} from '@/lib/versions/content-hash';
import {resolveVirtualVersionId} from '@/lib/engagement/version-helpers';
import {earlyBasePlan} from './early-heritage-bases-plan-2026-10';
const apply=process.argv.includes('--apply');
async function main(){
 const plan=await earlyBasePlan();
 const pending=[];
 for(const entry of plan){const {recipe,direct,caps,existing}=entry;
  const payload=buildCanonicalTemplatePayload({kind:recipe.kind,name:recipe.name,description:recipe.description,suggestedTraits:recipe.traits,isPublic:true,primitiveIds:direct,primitiveSlots:direct.map(primitiveId=>({primitiveId,isMirrored:false})),capabilityIds:caps,iconSource:'GAME_ICONS',iconKey:recipe.iconKey,iconColor:'#d8ad54'});
  const hash=await hashTemplateContent(payload);
  console.log(`${recipe.kind} ${recipe.name}: ${entry.cost} BU, ${entry.all.length} unique primitives; fork of ${recipe.parent}; ${existing?.contentHash===hash?'current':'pending'}`);
  if(existing?.contentHash!==hash)pending.push({...entry,payload,hash});
 }
 console.log(`${plan.length} bases checked; ${pending.length} pending. ${apply?'APPLY':'DRY RUN: no database writes'}`);
 if(!apply||pending.length===0)return;
 const [actor]=await db.select().from(users).where(eq(users.isAdmin,true)).limit(1);if(!actor)throw new Error('No admin fork actor');
 await withDatabaseTransaction(async()=>{for(const x of pending){
  const {recipe,direct,caps,existing,sourceOrigin,payload,hash}=x;
  const values={name:recipe.name,kind:recipe.kind,description:recipe.description,suggestedTraits:recipe.traits,isPublic:true,sourceOrigin,contentHash:hash,iconSource:'GAME_ICONS' as const,iconKey:recipe.iconKey,iconColor:'#d8ad54',tags:['curated','base','early-play','expandable']};
  const [row]=existing?await db.update(heritage).set({...values,updatedAt:new Date()}).where(eq(heritage.id,existing.id)).returning():await db.insert(heritage).values({...values,userId:null}).returning();
  await db.delete(heritagePrimitives).where(eq(heritagePrimitives.templateId,row.id));await db.delete(heritageCapabilities).where(eq(heritageCapabilities.templateId,row.id));
  if(direct.length)await db.insert(heritagePrimitives).values(direct.map((primitiveId,sortOrder)=>({templateId:row.id,primitiveId,sortOrder,isMirrored:false})));
  if(caps.length)await db.insert(heritageCapabilities).values(caps.map(capabilityId=>({templateId:row.id,capabilityId})));
  const prior=await db.select().from(heritageVersions).where(eq(heritageVersions.templateId,row.id));
  const versionId=resolveContentVersionId('template',row.id,hash);const found=prior.find(v=>v.id===versionId);const number=found?.versionNumber??Math.max(0,...prior.map(v=>v.versionNumber))+1;
  await db.update(heritageVersions).set({isLatest:false}).where(eq(heritageVersions.templateId,row.id));
  if(found)await db.update(heritageVersions).set({isLatest:true}).where(eq(heritageVersions.id,versionId));else await db.insert(heritageVersions).values({id:versionId,templateId:row.id,versionNumber:number,isLatest:true,deltaKind:'FULL',snapshot:payload as unknown as Record<string,unknown>});
  const targetType=`${recipe.kind}_TEMPLATE` as 'LINEAGE_TEMPLATE'|'UPBRINGING_TEMPLATE'|'MANIFEST_TEMPLATE';
  const [pub]=await db.select().from(publications).where(and(eq(publications.targetType,targetType),eq(publications.targetId,row.id))).limit(1);
  if(pub){if(pub.visibility!=='PUBLIC'||pub.unpublishedAt)throw new Error(`Hidden publication ${recipe.name}`);}else await db.insert(publications).values({targetType,targetId:row.id,versionId:resolveVirtualVersionId(targetType,row.id),versionNumber:1,authorId:null,visibility:'PUBLIC'});
  const [edge]=await db.select().from(forks).where(and(eq(forks.forkedTargetType,targetType),eq(forks.forkedTargetId,row.id))).limit(1);
  if(!edge)await db.insert(forks).values({forkedByUserId:actor.id,sourceTargetType:targetType,sourceTargetId:x.parent.id,sourceVersionId:x.parentVersion.id,sourceAuthorId:null,forkedTargetType:targetType,forkedTargetId:row.id,forkedVersionId:versionId,metadata:{reason:'Reduced base bundle for early play; freely extensible at any level',deduplicatedBu:x.cost}});
 }});
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
