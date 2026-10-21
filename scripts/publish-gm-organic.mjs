/** Publish exactly the founder-supplied GM Guide files, unchanged. Dry-run by default. */
import { createReadStream, readFileSync, statSync, openSync, readSync, closeSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--source-root');
const sourceRoot = resolve(rootIndex === -1 ? '.' : args[rootIndex + 1] ?? '');
const modes = args.filter(arg => ['--apply', '--verify-existing'].includes(arg));
if (modes.length > 1 || args.some((arg, i) => !['--apply', '--verify-existing', '--source-root'].includes(arg) && !(rootIndex !== -1 && i === rootIndex + 1))) throw new Error('Use --source-root PATH and at most one of --apply / --verify-existing');
if (rootIndex !== -1 && (!args[rootIndex + 1] || args[rootIndex + 1].startsWith('--'))) throw new Error('Missing source root');
const manifest = JSON.parse(readFileSync('docs/publications/gm-organic-release-manifest.json', 'utf8'));
const prefix = 'documents/swordweave/v0.1-alpha/organic-2026-10-20/';
const bucket = 'swordweave-public-art';
const origin = 'https://swordweave-public-art.ionmariusc97.workers.dev';
const hashFile = async path => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
};
const checkedJson = (path, expected) => {
  const bytes = readFileSync(resolve(sourceRoot, path));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Changed source review: ${path}`);
  return JSON.parse(bytes);
};
if (manifest.edition !== 'v0.1 alpha' || manifest.revision !== 'organic-2026-10-20' || manifest.pdfs.length !== 2 || !manifest.releaseAuthority) throw new Error('Unexpected release manifest');
if (manifest.sourceEvidence.length !== 2) throw new Error('Missing review records');
const [preservation, visual] = manifest.sourceEvidence.map(record => checkedJson(record.path, record.sha256));
if (!preservation.passed || !preservation.master?.passed || !preservation.reading?.passed || preservation.mask_failures.length || preservation.master.failures.length || preservation.reading.failures.length || visual.known_blockers.length) throw new Error('Existing preservation/visual checks are incomplete');
const filenames = ['game-masters-guide.pdf', 'game-masters-guide-full.pdf'];
const sourcePaths = ['output/pdf/swordweave-game-masters-guide-v0.1-alpha-organic-edges-compressed.pdf', 'output/pdf/swordweave-game-masters-guide-v0.1-alpha-organic-edges.pdf'];
for (const [index, pdf] of manifest.pdfs.entries()) {
  const expected = index === 0 ? preservation.reading_pdf_sha256 : preservation.pdf_sha256;
  const visualExpected = index === 0 ? visual.reading_pdf_sha256 : visual.pdf_sha256;
  if (pdf.filename !== filenames[index] || pdf.sourcePath !== sourcePaths[index] || pdf.key !== prefix + pdf.filename || pdf.pages !== 268 || pdf.sha256 !== expected || expected !== visualExpected) throw new Error('Unexpected file or review identity');
  const path = resolve(sourceRoot, pdf.sourcePath);
  const descriptor = openSync(path, 'r');
  const signature = Buffer.alloc(5);
  try { readSync(descriptor, signature, 0, 5, 0); } finally { closeSync(descriptor); }
  if (signature.toString() !== '%PDF-' || statSync(path).size !== pdf.bytes || await hashFile(path) !== pdf.sha256) throw new Error(`Changed source PDF: ${pdf.sourcePath}`);
}
console.log(JSON.stringify({ mode: modes[0]?.slice(2) ?? 'dry-run', bucket, prefix, reviewScope: manifest.reviewScope, files: manifest.pdfs.map(({ filename, key, bytes, sha256, pages }) => ({ filename, key, bytes, sha256, pages })) }, null, 2));
if (!modes.length) process.exit(0);
const wrangler = args => {
  const result = spawnSync('npx', ['--yes', 'pnpm@10', 'dlx', 'wrangler@4.40.0', ...args], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error('Cloudflare publication failed; existing files were not rewritten locally');
};
if (modes[0] === '--apply') {
  for (const pdf of manifest.pdfs) wrangler(['r2', 'object', 'put', `${bucket}/${pdf.key}`, '--file', resolve(sourceRoot, pdf.sourcePath), '--content-type', 'application/pdf', '--remote']);
  wrangler(['deploy', '--config', 'infrastructure/public-art/wrangler.jsonc']);
}
const verified = [];
for (const pdf of manifest.pdfs) {
  const url = `${origin}/${pdf.key}?audit=${pdf.sha256.slice(0, 12)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(240000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf') || !response.body) throw new Error(`Public PDF failed: ${pdf.filename} (${response.status})`);
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of response.body) { hash.update(chunk); bytes += chunk.length; }
  const sha256 = hash.digest('hex');
  if (bytes !== pdf.bytes || sha256 !== pdf.sha256) throw new Error(`Public bytes differ: ${pdf.filename}`);
  const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
  if (!head.ok || Number(head.headers.get('content-length')) !== pdf.bytes || !head.headers.get('content-type')?.startsWith('application/pdf')) throw new Error(`Public HEAD failed: ${pdf.filename}`);
  verified.push({ filename: pdf.filename, url: `${origin}/${pdf.key}`, bytes, sha256, mime: response.headers.get('content-type'), headStatus: head.status });
  console.log(`Verified streamed public bytes, MIME and HEAD: ${pdf.filename}`);
}
const result = { passed: true, verifiedAt: new Date().toISOString(), reviewScope: manifest.reviewScope, verified };
mkdirSync('output/publications/gm-organic-release', { recursive: true });
writeFileSync('output/publications/gm-organic-release/remote-verification.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
