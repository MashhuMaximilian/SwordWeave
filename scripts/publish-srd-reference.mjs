/** Publish only the unchanged founder-supplied SRD Reference PDF. Dry-run by default. */
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
const manifest = JSON.parse(readFileSync('docs/publications/srd-reference-release-manifest.json', 'utf8'));
const key = 'documents/swordweave/v0.1-alpha/reference-2026-10-21/srd.pdf';
const bucket = 'swordweave-public-art';
const origin = 'https://swordweave-public-art.ionmariusc97.workers.dev';
const checkedJson = (path, expected) => {
  const bytes = readFileSync(resolve(sourceRoot, path));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Changed source review: ${path}`);
  return JSON.parse(bytes);
};
if (manifest.edition !== 'v0.1 alpha' || manifest.revision !== 'reference-2026-10-21' || !manifest.releaseAuthority || manifest.sourceEvidence.length !== 2) throw new Error('Unexpected release manifest');
const [verification, visual] = manifest.sourceEvidence.map(record => checkedJson(record.path, record.sha256));
const pdf = manifest.pdf;
if (verification.status !== 'PASS' || verification.text_outside_trim.length || verification.table_word_overflows.length || visual.unresolved_layout_defects.length || !visual.status.startsWith('PASS')) throw new Error('Existing technical/visual checks are incomplete');
if (pdf.filename !== 'srd.pdf' || pdf.sourcePath !== 'output/pdf/swordweave-system-reference-document-v0.1-alpha-reference-edition.pdf' || pdf.key !== key || pdf.pages !== 78 || verification.pages !== 78 || pdf.sha256 !== verification.sha256 || pdf.sha256 !== visual.sha256) throw new Error('Unexpected PDF or review identity');
const sourcePath = resolve(sourceRoot, pdf.sourcePath);
const descriptor = openSync(sourcePath, 'r');
const signature = Buffer.alloc(5);
try { readSync(descriptor, signature, 0, 5, 0); } finally { closeSync(descriptor); }
const sourceHash = createHash('sha256');
for await (const chunk of createReadStream(sourcePath)) sourceHash.update(chunk);
if (signature.toString() !== '%PDF-' || statSync(sourcePath).size !== pdf.bytes || sourceHash.digest('hex') !== pdf.sha256) throw new Error('Changed source SRD');
console.log(JSON.stringify({ mode: modes[0]?.slice(2) ?? 'dry-run', bucket, key, reviewScope: manifest.reviewScope, pdf }, null, 2));
if (!modes.length) process.exit(0);
const wrangler = args => {
  const result = spawnSync('npx', ['--yes', 'pnpm@10', 'dlx', 'wrangler@4.40.0', ...args], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error('Cloudflare publication failed; the original PDF was not rewritten');
};
if (modes[0] === '--apply') {
  wrangler(['r2', 'object', 'put', `${bucket}/${key}`, '--file', sourcePath, '--content-type', 'application/pdf', '--remote']);
  wrangler(['deploy', '--config', 'infrastructure/public-art/wrangler.jsonc']);
}
const url = `${origin}/${key}?audit=${pdf.sha256.slice(0, 12)}`;
const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf') || !response.body) throw new Error(`Public SRD failed (${response.status})`);
const hash = createHash('sha256'); let bytes = 0;
for await (const chunk of response.body) { hash.update(chunk); bytes += chunk.length; }
const sha256 = hash.digest('hex');
if (bytes !== pdf.bytes || sha256 !== pdf.sha256) throw new Error('Public SRD bytes differ');
const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
if (!head.ok || Number(head.headers.get('content-length')) !== pdf.bytes || !head.headers.get('content-type')?.startsWith('application/pdf')) throw new Error('Public SRD HEAD failed');
const result = { passed: true, verifiedAt: new Date().toISOString(), reviewScope: manifest.reviewScope, verified: { filename: pdf.filename, url: `${origin}/${key}`, bytes, sha256, mime: response.headers.get('content-type'), headStatus: head.status } };
mkdirSync('output/publications/srd-reference-release', { recursive: true });
writeFileSync('output/publications/srd-reference-release/remote-verification.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
