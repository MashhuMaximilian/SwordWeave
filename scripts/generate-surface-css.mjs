#!/usr/bin/env node
/** Build independent reader/tool CSS. Canonical sources and their order stay intact. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('next/package.json'))('postcss');
const cheerioRequire = createRequire(require.resolve('cheerio'));
const selector = createRequire(cheerioRequire.resolve('css-select'))('css-what');
const ts = require('typescript');
const read = file => fs.readFileSync(path.join(project, file), 'utf8');
export const contract = JSON.parse(read('src/lib/styles/surface-contract.json'));

const families = [
  'archive', 'atelier', 'author', 'behavior', 'bottom', 'build', 'bundle',
  'calculation', 'canonical', 'capability', 'character', 'compact', 'composed',
  'composite', 'composition', 'condition', 'conditions', 'consequence',
  'contribution', 'core', 'creation', 'creations', 'direct', 'drawer', 'effect',
  'entity', 'entry', 'expression', 'family', 'fetched', 'field', 'formula',
  'heritage', 'identity', 'inspector', 'inventory', 'item', 'library', 'lineage',
  'live', 'market', 'markdown', 'mastery', 'mechanical', 'nested', 'network',
  'practice', 'preview', 'primitive', 'projection', 'recipe', 'reference',
  'roster', 'rule', 'sheet', 'source', 'studio', 'table', 'tag', 'tier',
  'vitality', 'workspace',
];
const toolPrefix = new RegExp(`^v12-(?:${families.join('|')})(?:-|$)`);
const toolAuxiliary = /^(?:sheet-|sw-(?:access-|catalogue-|character-forge(?:__|$)|creation-(?:choice|mode|budget)|discovery(?:-|$)|domain-author(?:__|$)|encounter(?:s|-)|filter-|forge-|library-|live-|mirror-|monster-|player-creation|portrait-input|quickbuild(?:__|$)|quick-library-picker(?:__|$)|roster-)|monster-|procedural-|generated-)/;
const namespaceToken = /\b(?:v12-|sw-|sheet-|monster-|procedural-|generated-)[A-Za-z0-9_-]+\b/g;

export function surfaceGuard(surface) {
  // The RootHtml client component renders this attribute during SSR and
  // client navigation; no relational selector or post-hydration effect.
  const marker = `[${contract.surfaceAttribute}="${surface}"]`;
  const overlay = `[${contract.overlayAttribute}="${contract.tool}"]`;
  return surface === contract.tool
    ? `:where(${marker},${marker} *,${overlay},${overlay} *)`
    : surface === contract.reader
      ? `:where(${marker},${marker} *):not(:where(${overlay},${overlay} *))`
      : (() => { throw new Error(`Unknown CSS surface: ${surface}`); })();
}

const guardTokens = Object.fromEntries([contract.reader, contract.tool].map(surface =>
  [surface, selector.parse(surfaceGuard(surface))[0]]));

export function guardSelector(value, surface) {
  const additions = guardTokens[surface];
  if (!additions) throw new Error(`Unknown CSS surface: ${surface}`);
  const branches = selector.parse(value);
  for (const branch of branches) {
    // The guard constrains the original subject, including html/:root and
    // body portals. A prefix ancestor would break html/.dark body selectors.
    const pseudoElement = branch.findIndex(token => token.type === 'pseudo-element'
      || (token.type === 'pseudo' && ['before', 'after', 'first-line', 'first-letter'].includes(token.name)));
    branch.splice(pseudoElement < 0 ? branch.length : pseudoElement, 0, ...structuredClone(additions));
  }
  return selector.stringify(branches);
}

export function unguardSelector(value, surface, optional = false) {
  const additions = guardTokens[surface];
  const branches = selector.parse(value);
  for (const branch of branches) {
    let removed = 0;
    for (let i = 0; i <= branch.length - additions.length; i++) {
      if (JSON.stringify(branch.slice(i, i + additions.length)) === JSON.stringify(additions)) {
        branch.splice(i, additions.length);
        removed++;
      }
    }
    if (removed !== 1 && !(optional && removed === 0)) throw new Error(`Expected one ${surface} subject guard: ${value}`);
  }
  return selector.stringify(branches);
}

function localModule(from, name) {
  const base = name.startsWith('@/') ? path.join(project, 'src', name.slice(2))
    : name.startsWith('.') ? path.resolve(project, path.dirname(from), name) : null;
  if (!base) return null;
  for (const suffix of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const file = base + suffix;
    if (/\.tsx?$/.test(file) && fs.existsSync(file) && fs.statSync(file).isFile()) return path.relative(project, file);
  }
  return null;
}

export function publicSourceRoots() {
  return ['src/app/layout.tsx', ...Object.keys(JSON.parse(read('src/lib/seo/pages.json'))).map(route =>
    `src/app${route === '/' ? '' : route}/page.tsx`), 'src/app/books/[slug]/page.tsx'];
}

export function publicSourceGraph(roots = publicSourceRoots(), reader = read, resolve = localModule) {
  const files = new Set();
  const classes = new Set();
  const dynamicPrefixes = new Set();
  function visit(file) {
    if (files.has(file)) return;
    files.add(file);
    const text = reader(file);
    for (const match of text.matchAll(namespaceToken)) classes.add(match[0]);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function walk(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const dependency = resolve(file, node.moduleSpecifier.text);
        if (dependency) visit(dependency);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        const dependency = resolve(file, node.arguments[0].text);
        const editorEdge = file === 'src/components/character-modal/character-modal.tsx'
          && dependency === 'src/components/character-modal/tabbed-character-form.tsx';
        if (dependency && !editorEdge) visit(dependency);
      } else if (ts.isTemplateExpression(node)) {
        for (const literal of [node.head, ...node.templateSpans.map(span => span.literal)]) {
          // A namespace fragment immediately before a hole may construct an
          // entire family (e.g. sw-forge-node--${tone}); protect the whole prefix.
          const match = /((?:v12-|sw-|sheet-|monster-|procedural-|generated-)[A-Za-z0-9_-]*)$/.exec(literal.text);
          if (match) dynamicPrefixes.add(match[1]);
        }
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken
        && ts.isStringLiteralLike(node.left)) {
        const match = /((?:v12-|sw-|sheet-|monster-|procedural-|generated-)[A-Za-z0-9_-]*)$/.exec(node.left.text);
        if (match) dynamicPrefixes.add(match[1]);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  roots.forEach(visit);
  return { files: [...files].sort(), classes, dynamicPrefixes };
}

export function requiresTool(value, graph) {
  const tool = token => token.type === 'attribute' && token.name === 'class'
    && token.namespace === null && token.action === 'element'
    && !graph.classes.has(token.value)
    && ![...graph.dynamicPrefixes].some(prefix => token.value.startsWith(prefix))
    && (toolPrefix.test(token.value) || toolAuxiliary.test(token.value));
  const branch = tokens => {
    // A preceding tool sibling does not make the matching public subject a
    // tool descendant. Use only subject/ancestor evidence after the last
    // sibling combinator; discarding earlier evidence is intentionally safe.
    const sibling = tokens.findLastIndex(token => ['sibling', 'adjacent', 'column-combinator', 'parent'].includes(token.type));
    return tokens.slice(sibling + 1).some(token => tool(token)
      || (token.type === 'pseudo' && ['is', 'where'].includes(token.name)
        && Array.isArray(token.data) && token.data.length > 0 && token.data.every(branch)));
  };
  try {
    const alternatives = selector.parse(value);
    return alternatives.length > 0 && alternatives.every(branch);
  } catch { return false; }
}

function keyframeStep(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /(?:^|-)keyframes$/.test(parent.name)) return true;
  }
  return false;
}

export function transformCss(css, surface, graph) {
  if (![contract.reader, contract.tool].includes(surface)) throw new Error(`Unknown CSS surface: ${surface}`);
  const root = postcss.parse(css);
  let removed = 0;
  root.walkRules(rule => {
    if (keyframeStep(rule)) return;
    const owned = requiresTool(rule.selector, graph);
    if (surface === contract.reader && owned) { rule.remove(); removed++; }
    // Tool-only subject/ancestor rules cannot affect public reader subjects.
    // Shared rules need a guard: a retained tool sheet must not replay them
    // after reader page/component CSS and thereby change its source order.
    else if (surface === contract.reader || !owned) rule.selector = guardSelector(rule.selector, surface);
  });
  root.walkAtRules(rule => { if (rule.nodes?.length === 0) rule.remove(); });
  return { css: root.toString(), removed };
}

export function canonicalSources() {
  const imports = [...read('src/app/root-styles.css').matchAll(/@import "([^"]+)";/g)].map(match => match[1]);
  if (imports.length !== 45 || imports[0] !== './globals.css') throw new Error('Review the canonical root CSS order.');
  return imports.slice(1).map(specifier => {
    const filename = specifier.startsWith('.') ? path.resolve(project, 'src/app', specifier) : require.resolve(specifier);
    const css = fs.readFileSync(filename, 'utf8');
    postcss.parse(css).walkAtRules(rule => {
      if (['import', 'theme', 'custom-variant', 'apply'].includes(rule.name)) {
        throw new Error(`Compiler directive needs an explicit common-root owner: ${specifier}: @${rule.name}`);
      }
    });
    for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
      if (!/^(?:\/|#|data:|https?:)/.test(match[2])) throw new Error(`CSS URL requires explicit rebasing: ${specifier}: ${match[2]}`);
    }
    return { specifier, css };
  });
}

export function generate({ measure = true } = {}) {
  const graph = publicSourceGraph();
  const sources = canonicalSources();
  const outputs = {};
  const report = { sourceCount: sources.length, publicFiles: graph.files, protectedClasses: [...graph.classes].sort(),
    dynamicPrefixes: [...graph.dynamicPrefixes].sort(), removedReaderRules: 0, surfaces: {} };
  for (const surface of [contract.reader, contract.tool]) {
    let css = '/* GENERATED by scripts/generate-surface-css.mjs; edit canonical sources. */\n';
    for (const source of sources) {
      const transformed = transformCss(source.css, surface, graph);
      css += `\n/* Canonical source: ${source.specifier} */\n${transformed.css}\n`;
      if (surface === contract.reader) report.removedReaderRules += transformed.removed;
    }
    outputs[`src/app/generated/${surface}-surface.css`] = css;
    report.surfaces[surface] = { bytes: Buffer.byteLength(css),
      ...(measure ? { gzip: gzipSync(css).length, brotli: brotliCompressSync(css).length } : {}) };
  }
  outputs['src/app/generated/surface-report.json'] = JSON.stringify(report, null, 2) + '\n';
  return { outputs, graph, report };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = generate();
  const check = process.argv.includes('--check');
  const stale = [];
  if (!check) fs.mkdirSync(path.join(project, 'src/app/generated'), { recursive: true });
  for (const [filename, content] of Object.entries(result.outputs)) {
    if (check) {
      if (!fs.existsSync(path.join(project, filename)) || read(filename) !== content) stale.push(filename);
    } else fs.writeFileSync(path.join(project, filename), content);
  }
  if (stale.length) throw new Error(`Stale generated surface CSS: ${stale.join(', ')}. Run node scripts/generate-surface-css.mjs.`);
  console.log(JSON.stringify({ checked: check, sourceCount: result.report.sourceCount,
    publicModules: result.graph.files.length, protectedClasses: result.graph.classes.size,
    dynamicPrefixes: result.report.dynamicPrefixes, removedReaderRules: result.report.removedReaderRules,
    surfaces: result.report.surfaces }, null, 2));
}
