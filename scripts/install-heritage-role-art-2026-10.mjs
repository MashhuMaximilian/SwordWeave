import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import sharp from 'sharp';
const version=process.argv.includes('--v3')?'v3':'v1';
const manifest=JSON.parse(readFileSync(version==='v3'?'docs/library/heritage-role-art-v3-2026-10.json':'docs/library/heritage-role-art-2026-10.json','utf8'));
if(manifest.records.length!==78||new Set(manifest.records.map(row=>`${row.kind}:${row.name}`)).size!==78)throw Error('Expected 78 distinct complete role portraits before updating the gallery.');
const registry=JSON.parse(readFileSync('scripts/srd-content-registry-2026-10.json','utf8'));
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const art=[];
for(const row of manifest.records){const folder=row.kind==='UPBRINGING'?'upbringings':'manifests';const root=`public/images/heritages/${folder}`;mkdirSync(root,{recursive:true});const file=`${slug(row.name)}-graphic-${version}`;if(!existsSync(`${root}/${file}.png`))copyFileSync(row.sourcePath,`${root}/${file}.png`);if(!existsSync(`${root}/${file}.webp`))await sharp(`${root}/${file}.png`).resize(800,800,{fit:'cover'}).webp({quality:88}).toFile(`${root}/${file}.webp`);const meta=registry.find(x=>String(x.id)===String(row.id));if(!meta)throw Error(`Unregistered heritage ${row.name}`);art.push({id:row.id,name:row.name,kind:row.kind,sourceOrigin:meta.seedOrigin,imageUrl:`/images/heritages/${folder}/${file}.webp`});}
writeFileSync('src/lib/heritage/heritage-role-art.json',JSON.stringify(art,null,2)+'\n');
const cards=art.map(x=>`<article><img loading="lazy" src="${x.imageUrl}" alt="${x.name.replaceAll('"','&quot;')}"><h2>${x.name}</h2><p>${x.kind}</p></article>`).join('');
writeFileSync('public/heritage-role-art-review.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SwordWeave role portraits</title><style>body{background:#101821;color:#e1c08c;font:16px system-ui;padding:24px;margin:0}h1{font-size:26px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}article{border:1px solid #8b713e;border-radius:14px;overflow:hidden;background:#18212c}img{width:100%;aspect-ratio:1;object-fit:cover}h2,p{margin:10px 16px}h2{font-size:18px}p{font-size:12px;color:#8da5b4}</style><h1>SwordWeave · ${art.length} upbringing and manifest portraits</h1><p>Graphic, angular artwork with lineage-neutral shadowed figures.</p><main>${cards}</main></html>`);
console.log(`Installed ${art.length} distinct role portraits.`);
