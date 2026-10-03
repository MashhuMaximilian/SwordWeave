/** Apply after asset deployment. Preserve explicit artwork; dry run is the default. */
import {existsSync} from 'node:fs';
import {eq,and,isNull} from 'drizzle-orm';
import {db,pool,withDatabaseTransaction} from '@/db/client';
import {heritage} from '@/db/schema';
import {curatedLineageArt,curatedHeritageRoleArt} from '@/lib/heritage/lineage-art';
const art=[...curatedLineageArt.map(x=>({...x,kind:'LINEAGE'})),...curatedHeritageRoleArt];
async function main(){
 const rows=await db.select().from(heritage);const plan=art.map(x=>{if(!existsSync(`public${x.imageUrl}`))throw Error(`Missing asset ${x.name}`);const matches=rows.filter(r=>r.kind===x.kind&&r.name===x.name&&r.userId===null&&r.isPublic&&(r.sourceOrigin==='SRD'||r.sourceOrigin===x.sourceOrigin));if(matches.length!==1)throw Error(`Ambiguous curated identity ${x.name}`);return{art:x,row:matches[0]!};});
 const pending=plan.filter(x=>!x.row.imageUrl?.trim());console.log(JSON.stringify({mode:process.argv.includes('--apply')?'APPLY':'DRY RUN',portraits:plan.length,pending:pending.length,explicitArtworkPreserved:plan.length-pending.length}));
 if(!process.argv.includes('--apply')||!pending.length)return;
 for(const x of plan){const response=await fetch(`https://www.swordweave.quest${x.art.imageUrl}`,{signal:AbortSignal.timeout(15000)});const bytes=new Uint8Array(await response.arrayBuffer());const signature=new TextDecoder().decode(bytes.slice(0,12));if(!response.ok||!response.headers.get('content-type')?.includes('image/webp')||signature.slice(0,4)!=='RIFF'||signature.slice(8,12)!=='WEBP')throw Error(`Deployment gate failed: ${x.art.name}`);}
 await withDatabaseTransaction(async()=>{for(const x of pending)await db.update(heritage).set({imageUrl:x.art.imageUrl,updatedAt:new Date()}).where(and(eq(heritage.id,x.row.id),eq(heritage.sourceOrigin,x.row.sourceOrigin!),x.row.imageUrl===null?isNull(heritage.imageUrl):eq(heritage.imageUrl,x.row.imageUrl)));});
 console.log(`Attached ${pending.length} portraits; rules, content hashes and version pins unchanged.`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
