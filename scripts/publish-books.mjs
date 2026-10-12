/** Publish audited free PDFs and their illustration masters to R2. Dry-run first. */
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
 const key=pdf.r2Key||`${prefix}/${pdf.filename}`;
 if(!/^documents\/swordweave\/v0\.1-alpha\/(print-r2\/)?(players-handbook|game-masters-guide|srd)(-dark)?\.pdf$/.test(key))throw new Error('Unexpected PDF object key');
 return {...pdf,path,key,mime:'application/pdf',publish:pdf.printRevision===2};
});
const art=JSON.parse(readFileSync('docs/publications/expanded/art-manifest.json','utf8'));
if(art.assets.length!==7)throw new Error('Expected seven reviewed book illustrations');
for(const asset of art.assets)for(const master of [false,true]) {
 const path=master?asset.printMaster:`public${asset.webPath}`;
 const bytes=readFileSync(path);const sha256=master?asset.masterSha256:asset.webSha256;
 const key=master?asset.r2MasterKey:asset.r2WebKey;
 if(!/^images\/books\/v0\.1-alpha\/(bridge|workshop|camp|tools|watcher|grazer|custodian)(-master\.png|\.webp)$/.test(key)||createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error(`Unaudited artwork: ${path}`);
 records.push({path,key,filename:key.split('/').at(-1),bytes:bytes.length,sha256,mime:master?'image/png':'image/webp',publish:false});
}
const printArt=JSON.parse(readFileSync('docs/publications/print-edition/new-art.json','utf8'));
if(printArt.assets.length!==8)throw new Error('Expected the eight reviewed print-edition assets');
for(const asset of printArt.assets)for(const master of [false,true]) {
 const path=master?asset.printMaster:`public/${asset.webPath}`;
 const bytes=readFileSync(path);const sha256=master?asset.masterSha256:asset.webSha256;
 const key=master?asset.r2MasterKey:asset.r2WebKey;
 if(!/^images\/books\/v0\.1-alpha\/print-r2\/(phb-cover|gm-cover|party-cutout|custodian-cutout|skyborn-cutout|surgeon-cutout|guardian-cutout|artificer-cutout)(-master\.png|\.webp)$/.test(key)||createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error(`Unaudited new artwork: ${path}`);
 records.push({path,key,filename:key.split('/').at(-1),bytes:bytes.length,sha256,mime:master?'image/png':'image/webp',publish:true});
}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',bucket,prefix,files:records.map(p=>({key:p.key,pages:p.pages,bytes:p.bytes,publish:p.publish}))},null,2));
if(!process.argv.includes('--apply')&&!process.argv.includes('--verify-existing'))process.exit(0);
const wrangler=args=>{const result=spawnSync('pnpm',['dlx','wrangler@4.40.0',...args],{stdio:'inherit',env:process.env});if(result.status!==0)throw new Error('Cloudflare publication failed');};
if(process.argv.includes('--apply')) {
 for(const pdf of records.filter(record=>record.publish))wrangler(['r2','object','put',`${bucket}/${pdf.key}`,'--file',pdf.path,'--content-type',pdf.mime,'--remote']);
 wrangler(['deploy','--config','infrastructure/public-art/wrangler.jsonc']);
}
for(const pdf of records) {
 const response=await fetch(`${origin}/${pdf.key}?audit=${pdf.sha256.slice(0,12)}`,{signal:AbortSignal.timeout(60000)});
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!response.ok||!response.headers.get('content-type')?.startsWith(pdf.mime)||bytes.length!==pdf.bytes||createHash('sha256').update(bytes).digest('hex')!==pdf.sha256)throw new Error(`Remote publication verification failed: ${pdf.filename} (${response.status})`);
 console.log(`Verified bytes and MIME: ${pdf.filename}`);
}
