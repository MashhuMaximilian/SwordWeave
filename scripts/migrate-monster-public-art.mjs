/** Dry-run first. Run with --apply after Wrangler signs into the existing account.
 * The app keeps its static copies until all CDN bytes pass verification.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const bucket = 'swordweave-public-art';
const origin = 'https://swordweave-public-art.ionmariusc97.workers.dev';
const files = readdirSync('public/art/monsters').filter(name => name.endsWith('.webp')).sort();
const assets = files.map(name => {
  const bytes = readFileSync(`public/art/monsters/${name}`);
  return { key: `art/monsters/${name}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
if (assets.length !== 105) throw new Error(`Expected 100 new and 5 established portraits; found ${assets.length}`);
const expected = JSON.parse(readFileSync('docs/library/system-bestiary-art-2026-10.json','utf8'));
const manifest = Array.isArray(expected) ? expected : expected.entries;
if (!manifest || manifest.length !== 100) throw new Error('Expected the audited 100-monster manifest');
for (const entry of manifest) {
  const key = entry.path.replace(/^\//,'');
  const asset = assets.find(row => row.key === key);
  if (!asset || asset.sha256 !== entry.sha256) throw new Error(`Portrait audit mismatch: ${key}`);
}
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', bucket, objects: assets.length, bytes: assets.reduce((total,row)=>total+row.bytes,0) }));
if (!process.argv.includes('--apply')) process.exit(0);
function wrangler(args) {
  const result=spawnSync('pnpm',['dlx','wrangler@4.40.0',...args],{stdio:'inherit',env:process.env});
  if(result.status!==0) throw new Error(`Wrangler failed: ${args[0]}`);
}
wrangler(['deploy','--config','infrastructure/public-art/wrangler.jsonc']);
for (const asset of assets) {
  wrangler(['r2','object','put',`${bucket}/${asset.key}`,'--file',`public/${asset.key}`,'--content-type','image/webp','--remote']);
  const response=await fetch(`${origin}/${asset.key}`,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`CDN verification failed: ${asset.key} HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==asset.bytes || createHash('sha256').update(bytes).digest('hex')!==asset.sha256 || !response.headers.get('content-type')?.startsWith('image/webp'))throw new Error(`CDN bytes or MIME differ: ${asset.key}`);
}
const catalog=JSON.parse(readFileSync('data/public-art-catalog.json','utf8'));
const merged=new Map(catalog.assets.map(asset=>[asset.key,asset]));
for(const asset of assets)merged.set(asset.key,asset);
catalog.assets=[...merged.values()].sort((a,b)=>a.key.localeCompare(b.key));
writeFileSync('data/public-art-catalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log(`Verified ${assets.length}/${assets.length} portraits in R2. Enable /art/monsters redirects and exclude local copies from deployment before publishing.`);
