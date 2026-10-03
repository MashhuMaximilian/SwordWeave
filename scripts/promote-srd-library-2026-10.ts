/** Metadata promotion only. Dry run first; stable seed keys live in the registry. */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { eq, and, sql } from 'drizzle-orm';
import { db, pool, withDatabaseTransaction } from '@/db/client';
import { primitives,effects,capabilities,heritage,items,characters,publications,primitiveVersions } from '@/db/schema';
import { resolveVirtualVersionId } from '@/lib/engagement/version-helpers';
import { captureCharacterSnapshot } from '@/lib/character/capture-character-snapshot';
import { buildCanonicalPrimitivePayload,hashPrimitiveContent } from '@/lib/publishing/hash-content';
import { recordVersion } from '@/lib/versions/auto-snapshot';
import registry from './srd-content-registry-2026-10.json';
import { demoCharacters } from './library-demo-characters-data-2026-10';
const tables={primitive:primitives,effect:effects,capability:capabilities,heritage,item:items,character:characters};
const names:Record<string,string>={'25-blade':'Tarn Emberpost','25-beacon':'Veyra Lanternwake','50-guard':'Korr Tidefast','50-surveyor':'Sill Underbough','100-medic':'Neris Cinderthread','100-scout':'Ivara Mossveil','200-architect':'Orren Vaultwright','200-sky':'Aster Farwake'};
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['sourceOrigin','userId','isPublic','name','updatedAt','contentHash','backstory','notes'].includes(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
async function main(){
 const entries=[];
 for(const [kind,table]of Object.entries(tables)){const rows=await db.select().from(table);for(const spec of registry.filter(x=>x.kind===kind)){const row=rows.find(x=>String(x.id)===String(spec.id));if(!row)throw Error(`Missing ${kind}:${spec.id}`);if(row.sourceOrigin!==spec.seedOrigin&&row.sourceOrigin!=='SRD')throw Error(`Identity changed ${spec.name}`);entries.push({kind,table,spec,row});}}
 const playable=entries.filter(x=>x.row.isPublic||x.kind==='character');
 const duplicate=entries.find(x=>x.kind==='primitive'&&x.spec.id===22352);
 const pending=entries.filter(x=>x.row.sourceOrigin!=='SRD'||x.row.userId!==null||(x.kind==='character'&&(!x.row.isPublic||x.row.name!==names[x.spec.seedOrigin.split(':').at(-1)!])));
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'APPLY':'DRY RUN',metadataRecords:entries.length,pending:pending.length,publicPlayable:playable.length,retiredOrConstructionParentsPreserved:entries.length-playable.length,characters:entries.filter(x=>x.kind==='character').map(x=>({id:x.row.id,name:names[x.spec.seedOrigin.split(':').at(-1)!]})),duplicateNameRepair:duplicate?.row.name==='Verb Access Tier I'?'22352 → Verb Access Tier I — Standard Expression':'already resolved'},null,2));
 if(!process.argv.includes('--apply'))return;
 writeFileSync('tmp/srd-promotion-before.json',JSON.stringify(entries.map(x=>({kind:x.kind,row:x.row})),null,2));
 await withDatabaseTransaction(async()=>{
  const duplicates=await db.execute(sql`select character_id,version_number,count(*) from character_versions group by character_id,version_number having count(*) > 1`);
  if(duplicates.rows.length)throw Error("Duplicate character version numbers require review before adding the expected uniqueness index.");
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS character_versions_id_version_unique_idx ON character_versions (character_id, version_number)`);
  for(const entry of entries){const {kind,table,row,spec}=entry;const fields:Record<string,unknown>={sourceOrigin:'SRD',userId:null,updatedAt:new Date()};
   if(kind==='character'){const key=spec.seedOrigin.split(':').at(-1)!;const recipe=demoCharacters.find(x=>x.key===key);if(!recipe||!names[key])throw Error(`Unknown character ${key}`);fields.name=names[key];fields.isPublic=true;fields.backstory={origin:recipe.concept,motivation:'Find a place for these talents while protecting the people who rely on them.',ties:'Traveling companions, former teachers, and a home worth returning to.',flaw:'A familiar duty can become harder to set aside than a dangerous road.'};fields.notes=`${recipe.budget} BU character build; item BU is separate. ${recipe.concept}`;}
   if(kind==='primitive'&&row.id===22352&&row.name==='Verb Access Tier I'){fields.name='Verb Access Tier I — Standard Expression';const payload=buildCanonicalPrimitivePayload({...row,name:fields.name as string} as Parameters<typeof buildCanonicalPrimitivePayload>[0]);const hash=await hashPrimitiveContent(payload);fields.contentHash=hash;await recordVersion({entityKind:'primitive',entityId:String(row.id),contentHash:hash,snapshot:payload as unknown as Record<string,unknown>,publishedByUserId:null});}
   await db.update(table as typeof primitives).set(fields).where(eq(table.id as typeof primitives.id,row.id as never));
   if(!row.isPublic&&kind!=='character')continue;
   const targetType=(kind==='heritage'?`${(row as typeof heritage.$inferSelect).kind}_TEMPLATE`:kind.toUpperCase()) as typeof publications.$inferInsert.targetType;
   const old=await db.select().from(publications).where(and(eq(publications.targetType,targetType),eq(publications.targetId,String(row.id))));
   let versionId=resolveVirtualVersionId(targetType,String(row.id)),versionNumber=1;
   if(kind==='character'){const version=await captureCharacterSnapshot({characterId:String(row.id),publishedByUserId:null});versionId=version.versionId;versionNumber=version.versionNumber;}
   if(old.length){for(const pub of old)await db.update(publications).set({authorId:null,visibility:'PUBLIC',unpublishedAt:null,...kind==='character'?{versionId,versionNumber}:{} }).where(eq(publications.id,pub.id));}
   else await db.insert(publications).values({targetType,targetId:String(row.id),authorId:null,visibility:'PUBLIC',versionId,versionNumber});
  }
 });
 for(const entry of entries){const [after]=await db.select().from(entry.table).where(eq(entry.table.id as typeof primitives.id,entry.row.id as never));if(!after||after.sourceOrigin!=='SRD'||after.userId!==null||fingerprint(after)!==fingerprint(entry.row))throw Error(`Postcheck ${entry.kind}:${entry.row.id}`);}
 console.log('PASS: SRD/System metadata saved; numerical rules and character mechanics unchanged.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
