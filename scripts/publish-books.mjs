/** Publish audited free PDFs to the existing R2 bucket. Dry-run is the default. */
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const manifest=JSON.parse(readFileSync('docs/publications/release-manifest.json','utf8'));
const bucket='swordweave-public-art';
const prefix='documents/swordweave/v0.1-alpha';
const origin='https://swordweave-public-art.ionmariusc97.workers.dev';
if(manifest.edition!=='v0.1 alpha'||manifest.pdfs.length!==6)throw new Error('Expected the six reviewed alpha PDFs');
const records=manifest.pdfs.map(pdf=>{
 if(!/^(players-handbook|game-masters-guide|srd)(-dark)?\.pdf$/.test(pdf.filename))throw new Error('Unexpected publication filename');
 const path=`output/pdf/${pdf.filename}`;const bytes=readFileSync(path);
 if(bytes.subarray(0,5).toString()!=='%PDF-'||statSync(path).size!==pdf.bytes||createHash('sha256').update(bytes).digest('hex')!==pdf.sha256)throw new Error(`Unaudited PDF: ${path}`);
 if(pdf.pages<20||pdf.links<30)throw new Error(`Incomplete PDF: ${path}`);
 return {...pdf,path,key:`${prefix}/${pdf.filename}`};
});
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',bucket,prefix,files:records.map(p=>({key:p.key,pages:p.pages,bytes:p.bytes}))},null,2));
if(!process.argv.includes('--apply')&&!process.argv.includes('--verify-existing'))process.exit(0);
const wrangler=args=>{const result=spawnSync('pnpm',['dlx','wrangler@4.40.0',...args],{stdio:'inherit',env:process.env});if(result.status!==0)throw new Error('Cloudflare publication failed');};
if(process.argv.includes('--apply')) {
 for(const pdf of records)wrangler(['r2','object','put',`${bucket}/${pdf.key}`,'--file',pdf.path,'--content-type','application/pdf','--remote']);
 wrangler(['deploy','--config','infrastructure/public-art/wrangler.jsonc']);
}
for(const pdf of records) {
 const response=await fetch(`${origin}/${pdf.key}?audit=${pdf.sha256.slice(0,12)}`,{signal:AbortSignal.timeout(60000)});
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!response.ok||!response.headers.get('content-type')?.startsWith('application/pdf')||bytes.length!==pdf.bytes||createHash('sha256').update(bytes).digest('hex')!==pdf.sha256)throw new Error(`Remote PDF verification failed: ${pdf.filename} (${response.status})`);
 console.log(`Verified PDF bytes and MIME: ${pdf.filename}`);
}
