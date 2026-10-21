#!/usr/bin/env node
/** Build independent home/reader/tool CSS. Canonical source order stays intact. */
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
    : [contract.home, contract.reader].includes(surface)
      ? `:where(${marker},${marker} *):not(:where(${overlay},${overlay} *))`
      : (() => { throw new Error(`Unknown CSS surface: ${surface}`); })();
}

const guardTokens = Object.fromEntries([contract.home, contract.reader, contract.tool].map(surface =>
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

export function publicSourceGraph(roots = publicSourceRoots(), reader = read, resolve = localModule, { home = false } = {}) {
  const files = new Set();
  const classes = new Set();
  const dynamicPrefixes = new Set();
  const cssImports = [];
  function visit(file) {
    if (files.has(file)) return;
    files.add(file);
    const text = reader(file);
    // Home contains authored JSX, not a CMS/Markdown body. A new opaque HTML
    // renderer must be reviewed before absent namespace classes can be pruned.
    // JSON-LD is nonvisual script data and cannot produce element subjects.
    if (home && /dangerouslySetInnerHTML/.test(text)
      && file !== 'src/components/analytics/structured-data.tsx') {
      throw new Error(`Review opaque HTML in the homepage CSS graph: ${file}`);
    }
    for (const match of text.matchAll(namespaceToken)) classes.add(match[0]);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function walk(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        if (ts.isImportDeclaration(node) && /\.css$/.test(node.moduleSpecifier.text)) {
          cssImports.push({ from: file, specifier: node.moduleSpecifier.text });
        }
        const dependency = resolve(file, node.moduleSpecifier.text);
        if (dependency) visit(dependency);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length === 1) {
        if (!ts.isStringLiteralLike(node.arguments[0])) {
          if (home) throw new Error(`Review nonliteral lazy import in the homepage CSS graph: ${file}`);
          return;
        }
        const dependency = resolve(file, node.arguments[0].text);
        const editorEdge = file === 'src/components/character-modal/character-modal.tsx'
          && dependency === 'src/components/character-modal/tabbed-character-form.tsx';
        const guideEdge = home && file === 'src/components/layout/global-controls.tsx'
          && dependency === 'src/components/rules/play-guide.tsx';
        if (dependency && !editorEdge && !guideEdge) visit(dependency);
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
  return { files: [...files].sort(), classes, dynamicPrefixes, cssImports };
}

export function homeSourceGraph(roots = ['src/app/layout.tsx', 'src/app/page.tsx'], reader = read, resolve = localModule) {
  return publicSourceGraph(roots, reader, resolve, { home: true });
}

function requiresAbsentClass(value, graph, eligible) {
  const absent = token => token.type === 'attribute' && token.name === 'class'
    && token.namespace === null && token.action === 'element'
    && !graph.classes.has(token.value)
    && ![...graph.dynamicPrefixes].some(prefix => token.value.startsWith(prefix))
    && eligible(token.value);
  const branch = tokens => {
    // A preceding tool sibling does not make the matching public subject a
    // tool descendant. Use only subject/ancestor evidence after the last
    // sibling combinator; discarding earlier evidence is intentionally safe.
    const sibling = tokens.findLastIndex(token => ['sibling', 'adjacent', 'column-combinator', 'parent'].includes(token.type));
    return tokens.slice(sibling + 1).some(token => absent(token)
      || (token.type === 'pseudo' && ['is', 'where'].includes(token.name)
        && Array.isArray(token.data) && token.data.length > 0 && token.data.every(branch)));
  };
  try {
    const alternatives = selector.parse(value);
    return alternatives.length > 0 && alternatives.every(branch);
  } catch { return false; }
}

export function requiresTool(value, graph) {
  return requiresAbsentClass(value, graph, name => toolPrefix.test(name) || toolAuxiliary.test(name));
}

export function absentFromHome(value, graph) {
  // Only closed, project-owned namespaces qualify. Generic/third-party classes
  // and unknown selector syntax stay present. Every OR branch must prove it.
  return requiresAbsentClass(value, graph, name => /^(?:v12-|sw-|sheet-|monster-|procedural-|generated-)/.test(name));
}

function keyframeStep(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /(?:^|-)keyframes$/.test(parent.name)) return true;
  }
  return false;
}

export function transformCss(css, surface, graph, { retainAll = false } = {}) {
  if (![contract.home, contract.reader, contract.tool].includes(surface)) throw new Error(`Unknown CSS surface: ${surface}`);
  const root = postcss.parse(css);
  let removed = 0;
  root.walkRules(rule => {
    if (keyframeStep(rule)) return;
    const owned = !retainAll && (surface === contract.home ? absentFromHome(rule.selector, graph) : requiresTool(rule.selector, graph));
    if (surface !== contract.tool && owned) { rule.remove(); removed++; }
    // Tool-only subject/ancestor rules cannot affect public reader subjects.
    // Shared rules need a guard: a retained tool sheet must not replay them
    // after reader page/component CSS and thereby change its source order.
    else if (surface !== contract.tool || !owned) rule.selector = guardSelector(rule.selector, surface);
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

export function homeComponentSources(graph = homeSourceGraph()) {
  const canonical = new Set(canonicalSources().map(source => styleFilename('src/app/root-styles.css', source.specifier)));
  const seen = new Set();
  const result = [];
  for (const imported of graph.cssImports) {
    if (/\.module\.css$/.test(imported.specifier)) continue;
    const filename = styleFilename(imported.from, imported.specifier);
    const relative = path.relative(project, filename);
    if (seen.has(filename) || canonical.has(filename) || relative === 'src/app/globals.css'
      || relative.startsWith('src/app/generated/')) continue;
    seen.add(filename);
    const css = fs.readFileSync(filename, 'utf8');
    // These plain component sheets have normal CSS semantics. Replaying them
    // must not relocate compiler inputs or change relative asset resolution.
    postcss.parse(css).walkAtRules(rule => {
      if (['import', 'theme', 'custom-variant', 'apply'].includes(rule.name)) {
        throw new Error(`Review compiler directive in retained homepage CSS: ${relative}: @${rule.name}`);
      }
    });
    for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
      if (!/^(?:\/|#|data:|https?:)/.test(match[2])) throw new Error(`CSS URL requires explicit rebasing: ${relative}: ${match[2]}`);
    }
    result.push({ specifier: relative, css });
  }
  return result;
}

function styleFilename(from, specifier) {
  return specifier.startsWith('@/') ? path.join(project, 'src', specifier.slice(2))
    : specifier.startsWith('.') ? path.resolve(project, path.dirname(from), specifier)
      : require.resolve(specifier);
}

export function generate({ measure = true } = {}) {
  const graph = publicSourceGraph();
  const homeGraph = homeSourceGraph();
  const sources = canonicalSources();
  const retainedComponents = homeComponentSources(homeGraph);
  const outputs = {};
  const report = { sourceCount: sources.length, publicFiles: graph.files, protectedClasses: [...graph.classes].sort(),
    dynamicPrefixes: [...graph.dynamicPrefixes].sort(), removedReaderRules: 0,
    homeFiles: homeGraph.files, homeClasses: [...homeGraph.classes].sort(),
    homeDynamicPrefixes: [...homeGraph.dynamicPrefixes].sort(), removedHomeRules: 0,
    retainedHomeComponents: retainedComponents.map(({ specifier, css }) => ({ specifier, bytes: Buffer.byteLength(css) })),
    readerComponentReplayBytes: 0, surfaces: {} };
  for (const surface of [contract.home, contract.reader, contract.tool]) {
    let css = '/* GENERATED by scripts/generate-surface-css.mjs; edit canonical sources. */\n';
    for (const source of sources) {
      const transformed = transformCss(source.css, surface, surface === contract.home ? homeGraph : graph);
      css += `\n/* Canonical source: ${source.specifier} */\n${transformed.css}\n`;
      if (surface === contract.reader) report.removedReaderRules += transformed.removed;
      if (surface === contract.home) report.removedHomeRules += transformed.removed;
    }
    if (surface === contract.reader) {
      // On the first home→reader navigation, Next retains Books/Nav component
      // sheets already loaded by home, then appends the new reader cascade.
      // Restore canonical→component order inside that new sheet. This repeats
      // only those small plain shared sheets, not a full theme, and keeps their
      // original specificity and declaration order. New page-owned CSS still
      // follows the reader layout as usual. Module sheets keep Next's hashing.
      for (const source of retainedComponents) {
        const replay = `\n/* Retained homepage component: ${source.specifier} */\n${transformCss(source.css, surface, graph, { retainAll: true }).css}\n`;
        css += replay;
        report.readerComponentReplayBytes += Buffer.byteLength(replay);
      }
    }
    outputs[`src/app/generated/${surface}-surface.css`] = css;
    report.surfaces[surface] = { bytes: Buffer.byteLength(css),
      ...(measure ? { gzip: gzipSync(css).length, brotli: brotliCompressSync(css).length } : {}) };
  }
  outputs['src/app/generated/surface-report.json'] = JSON.stringify(report, null, 2) + '\n';
  return { outputs, graph, homeGraph, report };
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
