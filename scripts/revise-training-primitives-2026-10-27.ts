/** Reviewed data repair. Dry-run is read-only; --apply uses one checked transaction.
 * Run with the project's configured database environment. No credentials are logged.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, pool, withExistingTransaction } from '../src/db/client';
import { characters, characterPrimitives, primitiveVersions, primitives, users } from '../src/db/schema';
import { buildCanonicalPrimitivePayload, canonicalJsonStringify, hashPrimitiveContent } from '../src/lib/publishing/hash-content';
import { recordVersion } from '../src/lib/versions/auto-snapshot';
import { getVersionPayload } from '../src/lib/versions/version-payload';
import { captureCharacterSnapshot } from '../src/lib/character/capture-character-snapshot';
import { bumpSlotVersion } from '../src/lib/character/bump-slot-version';
import { loadCharacterPdfSnapshot } from '../src/lib/character-pdf/snapshot';
import { resolveModifiers, type ResolvedPrimitiveSlot } from '../src/lib/engine/resolve-modifiers';
import { FUTOSHI_RULE_IDS, REVISION_IDS, revisedPrimitive, type PrimitiveRow } from './lib/training-revisions-2026-10-27';

const FUTOSHI='8a59f8f3-e157-4b6c-8fc8-ec95352948ff';
const apply=process.argv.includes('--apply');
const expectedOwner=process.argv.find(a=>a.startsWith('--expected-futoshi-owner='))?.slice('--expected-futoshi-owner='.length);
const directory=resolve(process.argv.find(a=>a.startsWith('--output='))?.slice('--output='.length) ?? 'tmp/training-versions-2026-10-27');
function assert(ok:unknown,message:string):asserts ok {if(!ok)throw new Error(message);}
const canonical=(p:PrimitiveRow)=>buildCanonicalPrimitivePayload({ ...p, mirrorEligibilityNotes:p.mirrorEligibilityNotes??'' });

function slot(p:PrimitiveRow):ResolvedPrimitiveSlot {
 return {primitiveId:p.id,name:p.name,category:p.category,isMirrored:false,isMirrorable:false,mirrorVector:null,
  originCapabilityId:null,originEffectId:null,originHeritageId:null,hardModifiers:p.hardModifiers};
}
function checkTraining(proposals:PrimitiveRow[]) {
 const find=(id:number)=>{const p=proposals.find(p=>p.id===id);assert(p,`Missing proposal ${id}`);return p;};
 const input={characterId:'repair-verification',level:18,pb:6,attributes:{physical:15,mental:8,magical:5},
  proficientAttribute:'physical' as const,slots:[slot(find(14065)),slot(find(14066))]};
 const r=resolveModifiers(input);
 assert(15+6+(r.totals['skill_practice_check.fieldcraft']??0)===27,'Revised Fieldcraft must total 27');
 const untrained=resolveModifiers({...input,proficientAttribute:null});
 assert(15+(untrained.totals['skill_practice_check.fieldcraft']??0)===27,'Proficiency + Expertise must also work without attribute proficiency');
 const expertiseAlone=resolveModifiers({...input,proficientAttribute:null,slots:[slot(find(14066))]});
 assert((expertiseAlone.totals['skill_practice_check.fieldcraft']??0)===0,'Expertise cannot supply its own proficiency');
 return {fieldcraftWithPhysicalProficiency:27,fieldcraftWithSeparateTraining:27,expertiseWithoutProficiency:0};
}

async function main(){
 await mkdir(directory,{recursive:true});
 const result=await db.transaction(async tx=>{
  if(!apply)await tx.execute(sql`SET TRANSACTION READ ONLY`);
  return withExistingTransaction(tx,async()=>{
   const actor=await db.query.users.findFirst({where:and(eq(users.username,'mashu'),eq(users.isAdmin,true))});
   assert(actor&&!actor.deletedAt,'Expected the project creator account');
   if(apply){
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'character:'+FUTOSHI}))`);
    for(const id of [...REVISION_IDS,21348].sort((a,b)=>a-b))
     await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'primitive:'+id}))`);
   }
   const character=await db.query.characters.findFirst({where:eq(characters.id,FUTOSHI)});
   assert(character&&character.name==='Futoshi','Unexpected target character');
   // This is the creator-authorized repair of this exact named character,
   // retained under its original account. Never transfer ownership or apply
   // this maintenance operation to other characters. Require the audited
   // owner on apply to catch a transfer between dry-run and mutation.
   if(apply)assert(expectedOwner===(character.userId??'null'),'Futoshi owner differs from the audited owner');
   const before=await db.select().from(primitives).where(inArray(primitives.id,[...REVISION_IDS,21348]));
   assert(before.length===REVISION_IDS.length+1,'A reviewed definition is missing');
   for(const p of before)assert(p.userId===actor.clerkUserId,`Definition ${p.id} has a different author`);
   const beforeSlots=await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId,FUTOSHI));
   const beforeSnapshot=await loadCharacterPdfSnapshot(FUTOSHI,character.userId);
   const proposals=before.filter(p=>p.id!==21348).map(revisedPrimitive);
   const checks=checkTraining(proposals);
   const latest=await db.select().from(primitiveVersions).where(and(inArray(primitiveVersions.primitiveId,[...REVISION_IDS,21348]),eq(primitiveVersions.isLatest,true)));
   const innate=latest.find(v=>v.primitiveId===21348);
   assert(innate,'Innate Instinct needs an existing correct version');
   const innatePayload=await getVersionPayload('PRIMITIVE','21348',innate.versionNumber);
   assert(innatePayload&&JSON.stringify(innatePayload.payload.hardModifiers).includes('"min"')&&String(innatePayload.payload.mechanicalOutputText).includes('minimum 10'),'Innate Instinct latest version is not the reviewed floor');
   const changes=[];
   for(const after of proposals){
    const old=before.find(p=>p.id===after.id)!;
    const payload=canonical(after);const hash=await hashPrimitiveContent(payload);
    // jsonb reorders object keys. Compare content canonically rather than
    // interpreting a storage round-trip as another definition change.
    const changed=canonicalJsonStringify(payload)!==canonicalJsonStringify(canonical(old));
    changes.push({id:after.id,name:after.name,changed,hash,payload,before:old,after});
   }
   const publicSummary={mode:apply?'APPLY':'DRY_RUN',changes:changes.map(c=>({id:c.id,name:c.name,changed:c.changed,
    costBefore:c.before.buCost,costAfter:c.after.buCost,mechanicalOutput:c.after.mechanicalOutputText,narrativeRule:c.after.narrativeRule,
    hardModifiers:c.after.hardModifiers})),innateReusesVersion:innate.versionNumber,checks,
    futoshiSlotsToAdvance:beforeSlots.filter(s=>(FUTOSHI_RULE_IDS as readonly number[]).includes(s.primitiveId)).map(s=>({primitiveId:s.primitiveId,versionId:s.versionId})),
    otherCharacterPins:'Retained; their owners can use Updates available.'};
   if(!apply)return {...publicSummary,applied:false};

   await writeFile(directory+'/before-apply-private.json',JSON.stringify({character,beforeSlots,definitions:before,beforeSnapshot,latest},null,2));
   const beforeCharacterVersion=await captureCharacterSnapshot({characterId:FUTOSHI,publishedByUserId:actor.clerkUserId});
   const versions=new Map<number,{versionId:string;versionNumber:number}>();
   versions.set(21348,{versionId:innate.id,versionNumber:innate.versionNumber});
   for(const change of changes){
    if(!change.changed){
     const current=latest.find(v=>v.primitiveId===change.id);
     assert(current,`No saved version for unchanged definition ${change.id}`);
     const saved=await getVersionPayload('PRIMITIVE',String(change.id),current.versionNumber);
     assert(saved&&canonicalJsonStringify(saved.payload)===canonicalJsonStringify(change.payload),`Latest version differs from unchanged definition ${change.id}`);
     versions.set(change.id,{versionId:current.id,versionNumber:current.versionNumber});
     continue;
    }
    if(change.changed){
     const updated=await db.update(primitives).set({hardModifiers:change.after.hardModifiers,
      mechanicalRule:change.after.mechanicalRule,mechanicalOutputText:change.after.mechanicalOutputText,
      narrativeRule:change.after.narrativeRule,contentHash:change.hash,updatedAt:new Date()})
      .where(and(eq(primitives.id,change.id),eq(primitives.userId,actor.clerkUserId),eq(primitives.updatedAt,change.before.updatedAt))).returning({id:primitives.id});
     assert(updated.length===1,`Definition ${change.id} changed concurrently`);
    }
    const version=await recordVersion({entityKind:'primitive',entityId:change.id,contentHash:change.hash,
     snapshot:change.payload as unknown as Record<string,unknown>,publishedByUserId:actor.clerkUserId});
    versions.set(change.id,version);
   }
   for(const primitiveId of FUTOSHI_RULE_IDS){
    const slots=beforeSlots.filter(s=>s.primitiveId===primitiveId);assert(slots.length===1,`Unexpected Futoshi occurrences for ${primitiveId}`);
    const version=versions.get(primitiveId)!;
    if(slots[0]!.versionId!==version.versionId)
     await bumpSlotVersion({characterId:FUTOSHI,kind:'primitive',entityId:slots[0]!.instanceId,toVersionId:version.versionId});
   }
   const afterSnapshot=await loadCharacterPdfSnapshot(FUTOSHI,character.userId);
   const afterSlots=await db.select().from(characterPrimitives).where(eq(characterPrimitives.characterId,FUTOSHI));
   const afterCharacter=await db.query.characters.findFirst({where:eq(characters.id,FUTOSHI)});
   assert(afterCharacter,'Futoshi missing after update');
   for(const [key,value] of Object.entries(character))if(key!=='updatedAt')
    assert(JSON.stringify(value)===JSON.stringify(afterCharacter[key as keyof typeof afterCharacter]),`Unrelated character field changed: ${key}`);
   assert(afterSlots.length===beforeSlots.length,'Character acquisitions changed');
   for(const old of beforeSlots){
    const next=afterSlots.find(s=>s.instanceId===old.instanceId);assert(next,'Character occurrence removed');
    for(const [key,value] of Object.entries(old))if(key!=='versionId'&&key!=='updatedAt')
     assert(JSON.stringify(value)===JSON.stringify(next[key as keyof typeof next]),`Occurrence ${old.instanceId} changed outside its version pin`);
    if(!(FUTOSHI_RULE_IDS as readonly number[]).includes(old.primitiveId))assert(next.versionId===old.versionId,'Unrelated pin changed');
   }
   for(const primitiveId of FUTOSHI_RULE_IDS){
    const version=versions.get(primitiveId)!;
    const links=afterSnapshot.primitiveLinks.filter(l=>l.primitiveId===primitiveId);
    assert(links.length===1,`Unexpected exported occurrences for ${primitiveId}`);
    assert(links[0]!.versionId===version.versionId,`Export did not use updated pin ${primitiveId}`);
    if(primitiveId!==21348)assert(links[0]!.primitive.hardModifiers?.length===0,`Old automatic modifier remains on ${primitiveId}`);
   }
   assert(afterSnapshot.buSpent===beforeSnapshot.buSpent,'Futoshi BU changed');
   const afterCharacterVersion=await captureCharacterSnapshot({characterId:FUTOSHI,publishedByUserId:actor.clerkUserId});
   await writeFile(directory+'/after-apply-private.json',JSON.stringify({afterCharacter,afterSlots,afterSnapshot},null,2));
   return {...publicSummary,applied:true,versions:[...versions].map(([primitiveId,v])=>({primitiveId,...v})),
    characterHistory:{before:beforeCharacterVersion,after:afterCharacterVersion},futoshi:{level:afterSnapshot.level,buSpent:afterSnapshot.buSpent,
     primitives:FUTOSHI_RULE_IDS.map(id=>{const p=afterSnapshot.primitiveLinks.find(l=>l.primitiveId===id)!.primitive;
      return {id,name:p.name,mechanicalOutput:p.mechanicalOutputText,narrativeRule:p.narrativeRule,hardModifiers:p.hardModifiers};})}};
  });
 });
 const filename=apply?'applied.json':'dry-run.json';await writeFile(directory+'/'+filename,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1}).finally(()=>pool.end());
