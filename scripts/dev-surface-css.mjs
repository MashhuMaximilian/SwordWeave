#!/usr/bin/env node
/**
 * Generated surface CSS is a delivery artifact, not an authoring source.
 * Keep it in sync during Next development so canonical CSS and reader JSX
 * changes still trigger HMR. Generated writes are ignored and unchanged files
 * keep their timestamps, avoiding a regeneration/reload feedback loop.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const generatedPrefix = 'src/app/generated/';

export function createDevelopmentGenerator({
  readContract = () => fs.readFileSync(path.join(project, 'src/lib/styles/surface-contract.json'), 'utf8'),
  loadGenerator = url => import(url),
} = {}) {
  let version = null;
  let current;
  return async () => {
    const contract = readContract();
    if (contract !== version) {
      // The generator reads the shared marker contract at module initialization.
      // Reload only when that policy changes; ordinary CSS/JSX edits reuse the
      // module and do not accumulate an import-cache entry per keystroke.
      const hash = createHash('sha256').update(contract).digest('hex');
      current = (await loadGenerator(`${new URL('./generate-surface-css.mjs', import.meta.url).href}?contract=${hash}`)).generate;
      version = contract;
    }
    return current({ measure: false });
  };
}

const generateForDevelopment = createDevelopmentGenerator();

export function isRelevantSource(filename) {
  const normalized = String(filename).replaceAll('\\', '/');
  return normalized.startsWith('src/') && !normalized.startsWith(generatedPrefix)
    && !normalized.split('/').some(part => ['.next', 'node_modules', '.git'].includes(part))
    && /\.(?:css|[jt]sx?|json)$/.test(normalized);
}

export function writeChangedOutputs(outputs, root = project) {
  const changed = [];
  for (const [filename, content] of Object.entries(outputs)) {
    if (!filename.startsWith(generatedPrefix)) throw new Error(`Unexpected generated output path: ${filename}`);
    const target = path.resolve(root, filename);
    const relative = path.relative(path.resolve(root, generatedPrefix), target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Output escaped generated directory: ${filename}`);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}`;
    try {
      fs.writeFileSync(temporary, content);
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    changed.push(filename);
  }
  return changed;
}

export function createRegenerator({ generateCss = generateForDevelopment, write = writeChangedOutputs,
  delayMs = 150, onError = error => console.error('[surface-css]', error),
  schedule = setTimeout, cancel = clearTimeout } = {}) {
  let timer = null;
  let running = false;
  let dirty = false;
  let closed = false;
  async function run() {
    timer = null;
    if (closed) return;
    if (running) { dirty = true; return; }
    running = true;
    dirty = false;
    try {
      const result = await generateCss();
      if (!closed) await write(result.outputs);
    } catch (error) { onError(error); }
    finally {
      running = false;
      if (dirty && !closed) request();
    }
  }
  function request() {
    if (closed) return;
    dirty = true;
    if (timer !== null) cancel(timer);
    timer = schedule(() => { void run(); }, delayMs);
  }
  function close() {
    closed = true;
    dirty = false;
    if (timer !== null) cancel(timer);
    timer = null;
  }
  return { request, close };
}

export async function startDevelopment({ args = [], root = project, generateCss = generateForDevelopment,
  spawnChild = spawn, watchSource = fs.watch, processTarget = process,
  log = message => console.log(message), reportError = error => console.error('[surface-css]', error) } = {}) {
  // Generate once before Next reads/imports the ignored stylesheet artifacts.
  const initial = await generateCss();
  writeChangedOutputs(initial.outputs, root);
  const nextCli = require.resolve('next/dist/bin/next');
  const child = spawnChild(process.execPath, [nextCli, 'dev', ...args], {
    cwd: root, stdio: 'inherit', env: processTarget.env ?? process.env,
  });
  let watcher;
  let stopped = false;
  let stopSignal = null;
  let killTimer = null;
  const signalCodes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
  const regenerator = createRegenerator({ generateCss, onError: reportError,
    write: outputs => {
      const changed = writeChangedOutputs(outputs, root).filter(file => file.endsWith('.css'));
      if (changed.length) log(`[surface-css] Updated ${changed.map(file => path.basename(file)).join(', ')}`);
    },
  });
  function clean() {
    if (stopped) return;
    stopped = true;
    regenerator.close();
    watcher?.close();
    for (const [signal, listener] of Object.entries(listeners)) processTarget.removeListener(signal, listener);
  }
  function stop(signal = 'SIGTERM') {
    if (stopped) return;
    stopSignal = signal;
    clean();
    // Next's CLI owns and cleans up its worker process on these signals.
    child.kill(signal);
    killTimer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000);
    killTimer.unref();
  }
  const listeners = Object.fromEntries(Object.keys(signalCodes).map(signal => [signal, () => stop(signal)]));
  child.once('error', error => {
    clean();
    processTarget.exitCode = 1;
    reportError(error);
  });
  child.once('exit', (code, signal) => {
    clean();
    if (killTimer) clearTimeout(killTimer);
    processTarget.exitCode = stopSignal ? signalCodes[stopSignal]
      : code ?? signalCodes[signal] ?? 1;
  });
  for (const [signal, listener] of Object.entries(listeners)) processTarget.on(signal, listener);
  try {
    // Recursive src watching includes new imports/files, JSON route/marker
    // policies and all canonical CSS. Dependency/generator upgrades need a
    // normal dev-process restart; node_modules and generated files are ignored.
    watcher = watchSource(path.join(root, 'src'), { recursive: true }, (_event, filename) => {
      if (filename === null || isRelevantSource(`src/${String(filename)}`)) regenerator.request();
    });
    watcher.on?.('error', error => { reportError(error); stop('SIGTERM'); });
  } catch (error) {
    reportError(error);
    stop('SIGTERM');
  }
  return { child, stop };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  startDevelopment({ args: process.argv.slice(2) }).catch(error => {
    console.error('[surface-css] Initial generation failed:', error);
    process.exitCode = 1;
  });
}
