import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const makeEnv = () => ({ ART: { get: async () => ({ body: 'art', size: 3, httpEtag: '"abc"', writeHttpMetadata: h => h.set('Content-Type', 'application/octet-stream') }) } });
test('only catalog images can be read and no mutations are exposed', async () => {
 for (const path of ['/api/icons/blob/private', '/images/private/a.png', '/images/lineages/', '/images/lineages/%2e%2e/private.png']) {
  let read = false;
  const response = await worker.fetch(new Request('https://art.example'+path), { ART: { get: () => {read=true;} } });
  assert.equal(response.status,404); assert.equal(read,false);
 }
 assert.equal((await worker.fetch(new Request('https://art.example/images/lineages/a.png',{method:'PUT'}),makeEnv())).status,405);
});
test('image bytes, MIME, browser cache, HEAD and ETag behave correctly', async () => {
 const url='https://art.example/images/lineages/a.webp';
 const get=await worker.fetch(new Request(url),makeEnv());
 assert.equal(await get.text(),'art'); assert.equal(get.headers.get('Content-Type'),'image/webp');
 assert.equal(get.headers.get('Cache-Control'),'public, max-age=86400');
 const head=await worker.fetch(new Request(url,{method:'HEAD'}),makeEnv());
 assert.equal(await head.text(),''); assert.equal(head.headers.get('Content-Length'),'3');
 assert.equal((await worker.fetch(new Request(url,{headers:{'If-None-Match':'"abc"'}}),makeEnv())).status,304);
 assert.equal((await worker.fetch(new Request(url),{ART:{get:async()=>null}})).status,404);
});

test('public monster portraits are readable while private and malformed keys remain blocked', async () => {
 const response=await worker.fetch(new Request('https://art.example/images/monsters/sinkhole-maw-graphic-v1.webp'),makeEnv());
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');
 for(const path of ['/art/monsters/a.webp','/art/private/a.webp','/images/monsters/private.json','/images/monsters/%2e%2e%2fsecret.webp']) {
  let read=false;const result=await worker.fetch(new Request('https://art.example'+path),{ART:{get:()=>{read=true;}}});
  assert.equal(result.status,404);assert.equal(read,false);
 }
});

test('only the six released core PDFs are exposed with PDF headers', async () => {
 for (const name of ['players-handbook','game-masters-guide','srd']) for (const theme of ['', '-dark']) {
  const url=`https://art.example/documents/swordweave/v0.1-alpha/${name}${theme}.pdf`;
  const response=await worker.fetch(new Request(url),makeEnv());
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');
  assert.match(response.headers.get('Content-Disposition'),/^inline; filename="swordweave-/);
  assert.equal((await worker.fetch(new Request(url,{method:'HEAD'}),makeEnv())).headers.get('Content-Length'),'3');
 }
 for(const path of ['/documents/private/a.pdf','/documents/swordweave/v0.1-alpha/notes.pdf','/documents/swordweave/v0.1-alpha/srd.json','/documents/swordweave/v0.1-alpha/%2e%2e/private.pdf']) {
  let read=false;const response=await worker.fetch(new Request('https://art.example'+path),{ART:{get:()=>{read=true;}}});
  assert.equal(response.status,404);assert.equal(read,false);
 }
});
