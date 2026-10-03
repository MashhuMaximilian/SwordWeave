/** Apply after asset deployment. Preserve explicit artwork; dry run is the default. */
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {eq,and,isNull} from 'drizzle-orm';
import {db,pool,withDatabaseTransaction} from '@/db/client';
import {heritage} from '@/db/schema';
import {curatedLineageArt,curatedHeritageRoleArt} from '@/lib/heritage/lineage-art';
const art=[...curatedLineageArt.map(x=>({...x,kind:'LINEAGE'})),...curatedHeritageRoleArt];
async function main(){
 const rows=await db.select().from(heritage);const plan=art.map(x=>{if(!existsSync(`public${x.imageUrl}`))throw Error(`Missing asset ${x.name}`);const matches=rows.filter(r=>r.kind===x.kind&&r.name===x.name&&r.userId===null&&r.isPublic&&(r.sourceOrigin==='SRD'||r.sourceOrigin===x.sourceOrigin));if(matches.length!==1)throw Error(`Ambiguous curated identity ${x.name}`);return{art:x,row:matches[0]!};});
 const pending=plan.filter(x=>!x.row.imageUrl?.trim());console.log(JSON.stringify({mode:process.argv.includes('--apply')?'APPLY':'DRY RUN',portraits:plan.length,pending:pending.length,explicitArtworkPreserved:plan.length-pending.length}));
 if(!process.argv.includes('--apply')||!pending.length)return;
 const manifestIndex=process.argv.indexOf('--deployment-manifest');
 if(manifestIndex>=0){
  const filename=process.argv[manifestIndex+1];const commitIndex=process.argv.indexOf('--asset-commit');const commit=process.argv[commitIndex+1];
  if(!filename||commitIndex<0||!commit)throw Error('Deployment manifest and its asset commit are required together.');
  const manifest=JSON.parse(readFileSync(filename,'utf8'));
  if(manifest.readyState!=='READY'||manifest.target!=='production'||!manifest.aliases.includes('www.swordweave.quest'))throw Error('Expected the Ready production deployment serving swordweave.quest.');
  for(const x of plan){const bytes=execFileSync('git',['show',`${commit}:public${x.art.imageUrl}`]);if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error(`Asset absent from deployed commit: ${x.art.name}`);}
  console.log(`Verified ${plan.length} committed WEBP assets against Ready production release ${manifest.id}.`);
 }else{
  for(const x of plan){const response=await fetch(`https://www.swordweave.quest${x.art.imageUrl}`,{signal:AbortSignal.timeout(15000)});const bytes=new Uint8Array(await response.arrayBuffer());const signature=new TextDecoder().decode(bytes.slice(0,12));if(!response.ok||!response.headers.get('content-type')?.includes('image/webp')||signature.slice(0,4)!=='RIFF'||signature.slice(8,12)!=='WEBP')throw Error(`Deployment gate failed: ${x.art.name}`);}
 }

 await withDatabaseTransaction(async()=>{for(const x of pending)await db.update(heritage).set({imageUrl:x.art.imageUrl,updatedAt:new Date()}).where(and(eq(heritage.id,x.row.id),eq(heritage.sourceOrigin,x.row.sourceOrigin!),x.row.imageUrl===null?isNull(heritage.imageUrl):eq(heritage.imageUrl,x.row.imageUrl)));});
 console.log(`Attached ${pending.length} portraits; rules, content hashes and version pins unchanged.`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
