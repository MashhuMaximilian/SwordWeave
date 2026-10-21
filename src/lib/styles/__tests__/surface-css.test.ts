import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const project = process.cwd();
const script = path.join(project, 'scripts/generate-surface-css.mjs');
function evaluate(code: string) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import * as surface from ${JSON.stringify(pathToFileURL(script).href)};\n${code}`],
  { cwd: project, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout) as unknown;
}

describe('independent home, reader and tool CSS', () => {
  it('guards the original subject, including html, root, theme ancestors and pseudo-elements', () => {
    expect(evaluate(`
      const values=[':root','html:not(.dark) body','body[data-ui="v12"] .chip::before',
        '.dark body .chip::-webkit-scrollbar-thumb:hover','.a:before','#cc-main .cm__btn'];
      console.log(JSON.stringify(values.map(value=>({original:value,
        guarded:surface.guardSelector(value,'tool'),
        restored:surface.unguardSelector(surface.guardSelector(value,'tool'),'tool')}))));
    `)).toEqual(expect.arrayContaining([
      expect.objectContaining({ original: ':root', restored: ':root', guarded: expect.stringMatching(/^:root:where\(/) }),
      expect.objectContaining({ original: '.a:before', restored: '.a:before', guarded: expect.stringMatching(/^\.a:where\(.*\):before$/) }),
      expect.objectContaining({ original: '#cc-main .cm__btn', restored: '#cc-main .cm__btn' }),
    ]));
  });

  it('uses zero-specificity conditions and excludes reader rules from tool portal subjects', () => {
    const result = evaluate(`
      console.log(JSON.stringify({home:surface.surfaceGuard('home'),reader:surface.surfaceGuard('reader'),tool:surface.surfaceGuard('tool'),contract:surface.contract}));
    `) as { home: string; reader: string; tool: string; contract: { surfaceAttribute: string; overlayAttribute: string } };
    expect(result.reader).toContain(':not(:where(');
    expect(result.reader).toContain(`[${result.contract.overlayAttribute}="tool"]`);
    expect(result.tool).toContain(`[${result.contract.overlayAttribute}="tool"]`);
    expect(result.tool).toContain(`[${result.contract.surfaceAttribute}="tool"]`);
    expect(result.reader).toContain(`[${result.contract.surfaceAttribute}="reader"]`);
    expect(result.reader).not.toContain(':has(');
    expect(result.tool).not.toContain(':has(');
    expect(result.home).toContain(`[${result.contract.surfaceAttribute}="home"]`);
    expect(result.home).toContain(':not(:where(');
    expect(result.home).not.toContain(':has(');
  });

  it('proves every OR branch and ignores negation/descendant queries as ownership evidence', () => {
    const selectors = ['.v12-character-page', '.v12-rule-card,.sw-public-title',
      ':is(.v12-character-page,.v12-rule-card)', ':where(.v12-character-page,.sw-public-title)',
      ':not(.v12-character-page)', 'body:has(.v12-character-page)', '.v12-character-page:has(.x)',
      '.v12-unknown-new-widget', 'body', '.sw-forge-node--gold',
      '.v12-character-page + .sw-public-title', '.sw-public-title + .v12-character-page',
      ':is(.v12-character-page + .sw-public-title,.v12-rule-card)'];
    expect(evaluate(`
      const graph=surface.publicSourceGraph();
      console.log(JSON.stringify(${JSON.stringify(selectors)}.map(value=>surface.requiresTool(value,graph))));
    `)).toEqual([true, false, true, false, false, false, true, false, false, false, false, true, false]);
  });

  it('follows public re-exports and literal lazy imports and protects constructed class prefixes', () => {
    const files = {
      'entry.tsx': 'export { View } from "./barrel"; export const Lazy=()=>import("./lazy");',
      'barrel.tsx': 'export { View } from "./view";',
      'view.tsx': 'export const View=()=> <div className="v12-character-public-example"/>;',
      'lazy.tsx': 'export const Lazy=()=> <div className={`sw-forge-node--${tone}`}/>;',
    };
    expect(evaluate(`
      const files=${JSON.stringify(files)};
      const graph=surface.publicSourceGraph(['entry.tsx'],file=>files[file],(_from,name)=>name.slice(2)+'.tsx');
      console.log(JSON.stringify({files:graph.files,prefixes:[...graph.dynamicPrefixes],
        publicRule:surface.requiresTool('.v12-character-public-example',graph),
        generatedRule:surface.requiresTool('.sw-forge-node--gold',graph)}));
    `)).toEqual({ files: ['barrel.tsx', 'entry.tsx', 'lazy.tsx', 'view.tsx'],
      prefixes: ['sw-forge-node--'], publicRule: false, generatedRule: false });
  });

  it('includes every public source, including the three shared book-reader slugs', () => {
    const result = evaluate(`
      console.log(JSON.stringify({roots:surface.publicSourceRoots(),files:surface.publicSourceGraph().files}));
    `) as { roots: string[]; files: string[] };
    expect(result.roots).toContain('src/app/books/[slug]/page.tsx');
    expect(result.roots).toContain('src/app/creating-a-character/page.tsx');
    expect(result.files).toContain('src/components/publications/book-reader.tsx');
    expect(result.files).not.toContain('src/components/character-modal/tabbed-character-form.tsx');
    expect(result.roots).not.toContain('src/app/characters/[id]/page.tsx');
  });

  it('limits homepage roots and excludes only the unreachable editor/guide lazy edges', () => {
    const result = evaluate(`
      const graph=surface.homeSourceGraph();
      console.log(JSON.stringify({files:graph.files,prefixes:[...graph.dynamicPrefixes]}));
    `) as { files: string[]; prefixes: string[] };
    expect(result.files).toContain('src/app/layout.tsx');
    expect(result.files).toContain('src/app/page.tsx');
    expect(result.files).toContain('src/components/layout/global-controls.tsx');
    expect(result.files).toContain('src/components/publications/book-cards.tsx');
    expect(result.files).not.toContain('src/components/rules/play-guide.tsx');
    expect(result.files).not.toContain('src/components/character-modal/tabbed-character-form.tsx');
    expect(result.files).not.toContain('src/app/books/[slug]/page.tsx');
    expect(result.prefixes).toEqual(expect.arrayContaining(['sw-forge-node--','sw-home-piece--','sw-book-card--']));
  });

  it('prunes home rules only when every selector positively requires an absent owned namespace class', () => {
    const selectors = ['.sw-other-reader','.v12-unknown-new-widget','.third-party-widget',
      '.sw-public-title','.sw-other-reader,.sw-public-title',':is(.sw-other-reader,.sheet-away)',
      ':where(.sw-other-reader,.third-party-widget)',':not(.sw-other-reader)',
      'body:has(.sw-other-reader)','.sw-other-reader + .sw-public-title',
      '.sw-public-title + .sw-other-reader','.sw-forge-node--gold','.sw-book-card--teal'];
    expect(evaluate(`
      const graph=surface.homeSourceGraph();
      console.log(JSON.stringify(${JSON.stringify(selectors)}.map(value=>surface.absentFromHome(value,graph))));
    `)).toEqual([true,true,false,false,false,true,false,false,false,false,true,false,false]);
  });

  it('fails closed when new opaque HTML or nonliteral lazy dependencies enter the homepage graph', () => {
    expect(evaluate(`
      const samples=['export const View=()=> <div dangerouslySetInnerHTML={{__html:content}}/>;',
        'export const View=()=>import(moduleName);'];
      console.log(JSON.stringify(samples.map(source=>{
        try {surface.homeSourceGraph(['entry.tsx'],()=>source,()=>null);return false;}
        catch(error){return /Review/.test(error.message);}
      })));
    `)).toEqual([true,true]);
  });

  it('replays only retained plain homepage component sheets in their import order', () => {
    expect(evaluate(`
      const graph=surface.homeSourceGraph();
      const actual=surface.homeComponentSources(graph);
      // Explicitly include excluded styles in a fixture, without needing an
      // ignored generated file to exist in a fresh clone.
      const fixture=surface.homeComponentSources({cssImports:[
        {from:'src/app/layout.tsx',specifier:'./globals.css'},
        {from:'src/app/layout.tsx',specifier:'./v12.css'},
        {from:'src/app/page.tsx',specifier:'./generated/home-surface.css'},
        {from:'src/app/page.tsx',specifier:'../components/icons/discord-icon.module.css'},
        {from:'src/app/page.tsx',specifier:'./books/books.css'},
        {from:'src/components/home/public-nav.tsx',specifier:'./public-nav.css'},
        {from:'src/app/page.tsx',specifier:'./books/books.css'},
      ]});
      console.log(JSON.stringify({actual:actual.map(source=>source.specifier),fixture:fixture.map(source=>source.specifier),
        relativeUrls:actual.some(source=>[...source.css.matchAll(/url\\(\\s*(['"]?)(.*?)\\1\\s*\\)/g)]
          .some(match=>!/^(?:\\/|#|data:|https?:)/.test(match[2])))}));
    `)).toEqual({ actual: ['src/app/books/books.css','src/components/home/public-nav.css'],
      fixture: ['src/app/books/books.css','src/components/home/public-nav.css'], relativeUrls: false });
  });

  it('retains keyframes, font faces, unknown selectors and conditional context', () => {
    const original = '@font-face{font-family:demo;src:url(/demo.woff2)}@media(max-width:767px){.v12-character-page{padding:9px}.unknown-new{padding:3px}}@keyframes spin{to{transform:rotate(1turn)}}';
    const result = evaluate(`
      const graph={classes:new Set(),dynamicPrefixes:new Set()};
      console.log(JSON.stringify(surface.transformCss(${JSON.stringify(original)},'reader',graph)));
    `) as { css: string; removed: number };
    expect(result.removed).toBe(1);
    expect(result.css).toContain('@font-face{font-family:demo;src:url(/demo.woff2)}');
    expect(result.css).toContain('@keyframes spin{to{transform:rotate(1turn)}}');
    expect(result.css).toMatch(/@media\(max-width:767px\)\{\.unknown-new:where\(/);
  });

  it('preserves all tool declarations and their original context/order while reader declarations form a subsequence', () => {
    const result = evaluate(`
      const {createRequire}=await import('node:module');
      const {createHash}=await import('node:crypto');
      const path=await import('node:path');
      const require=createRequire(path.resolve('package.json'));
      const postcss=createRequire(require.resolve('next/package.json'))('postcss');
      const cheerioRequire=createRequire(require.resolve('cheerio'));
      const selector=createRequire(cheerioRequire.resolve('css-select'))('css-what');
      const result=surface.generate();
      function records(css,kind){
        const records=[];
        postcss.parse(css).walkDecls(declaration=>{
          const context=[];
          for(let node=declaration.parent;node.type!=='root';node=node.parent){
            if(node.type==='rule'){
              let keyframe=false;
              for(let ancestor=node.parent;ancestor;ancestor=ancestor.parent)
                if(ancestor.type==='atrule'&&/(?:^|-)keyframes$/.test(ancestor.name))keyframe=true;
              const value=kind&&!keyframe?surface.unguardSelector(node.selector,kind,kind==='tool'):node.selector;
              context.unshift(['selector',keyframe?value:selector.stringify(selector.parse(value))]);
            }else context.unshift([node.name,node.params]);
          }
          records.push(JSON.stringify([context,declaration.prop,declaration.value,Boolean(declaration.important)]));
        });return records;
      }
      const original=records(surface.canonicalSources().map(source=>source.css).join('\\n'));
      const tool=records(result.outputs['src/app/generated/tool-surface.css'],'tool');
      const readerCss=result.outputs['src/app/generated/reader-surface.css'];
      const boundary=readerCss.indexOf('/* Retained homepage component:');
      const reader=records(readerCss.slice(0,boundary),'reader');
      const componentReplay=records(readerCss.slice(boundary),'reader');
      const componentOriginal=records(surface.homeComponentSources(result.homeGraph).map(source=>source.css).join('\\n'));
      const home=records(result.outputs['src/app/generated/home-surface.css'],'home');
      let at=0;for(const record of original)if(reader[at]===record)at++;
      let homeAt=0;for(const record of original)if(home[homeAt]===record)homeAt++;
      const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
      console.log(JSON.stringify({sources:result.report.sourceCount,originalCount:original.length,
        toolCount:tool.length,originalSha:sha(original),toolSha:sha(tool),
        readerCount:reader.length,readerMatched:at,homeCount:home.length,homeMatched:homeAt,
        componentOriginalCount:componentOriginal.length,componentReplayCount:componentReplay.length,
        componentOriginalSha:sha(componentOriginal),componentReplaySha:sha(componentReplay)}));
    `) as { sources: number; originalCount: number; toolCount: number; originalSha: string; toolSha: string; readerCount: number; readerMatched: number; homeCount: number; homeMatched: number; componentOriginalCount: number; componentReplayCount: number; componentOriginalSha: string; componentReplaySha: string };
    expect(result.sources).toBe(44);
    expect(result.originalCount).toBeGreaterThan(20000);
    expect(result.toolCount).toBe(result.originalCount);
    expect(result.toolSha).toBe(result.originalSha);
    expect(result.readerMatched).toBe(result.readerCount);
    expect(result.readerCount).toBeLessThan(result.originalCount / 2);
    expect(result.homeMatched).toBe(result.homeCount);
    expect(result.homeCount).toBeLessThan(result.readerCount);
    expect(result.componentOriginalCount).toBeGreaterThan(200);
    expect(result.componentReplayCount).toBe(result.componentOriginalCount);
    expect(result.componentReplaySha).toBe(result.componentOriginalSha);
  });

  it('adds no selector specificity for ids, attributes, pseudo-elements or functional selectors', () => {
    expect(evaluate(`
      const {createRequire}=await import('node:module');const path=await import('node:path');
      const require=createRequire(path.resolve('package.json'));
      const cheerioRequire=createRequire(require.resolve('cheerio'));
      const parse=createRequire(cheerioRequire.resolve('css-select'))('css-what').parse;
      function score(tokens){const result=[0,0,0];for(const token of tokens){
        if(token.type==='attribute')result[token.name==='id'&&token.ignoreCase==='quirks'?0:1]++;
        else if(token.type==='tag'||token.type==='pseudo-element')result[2]++;
        else if(token.type==='pseudo'&&token.name!=='where'){
          if(Array.isArray(token.data)&&['is','not','has'].includes(token.name)){
            const alternatives=token.data.map(score).sort((a,b)=>b[0]-a[0]||b[1]-a[1]||b[2]-a[2]);
            alternatives[0]?.forEach((value,index)=>result[index]+=value);
          }else result[1]++;
        }
      }return result;}
      const values=[':root','.dark body .x::before','#cc-main [type="button"]:hover',
        'body :is(.x,#y):not([hidden])','.a:first-letter'];
      console.log(JSON.stringify(values.every(value=>['home','reader','tool'].every(kind=>
        JSON.stringify(parse(value).map(score))===JSON.stringify(parse(surface.guardSelector(value,kind)).map(score))))));
    `)).toBe(true);
  });

  it('keeps globals and Tailwind in the common root rather than replaying them in either bundle', () => {
    const result = evaluate(`
      const result=surface.generate({measure:false});
      console.log(JSON.stringify(['home','reader','tool'].map(kind=>{
        const css=result.outputs['src/app/generated/'+kind+'-surface.css'];
        return {compilerInput:/Canonical source: \\.\\/globals\\.css|@import|@theme\\b|@custom-variant\\b/.test(css),
          sources:[...css.matchAll(/Canonical source:/g)].length};
      })));
    `);
    expect(result).toEqual(Array.from({ length: 3 }, () => ({ compilerInput: false, sources: 44 })));
  });

  it('emits identical CSS without measuring compression during development', () => {
    expect(evaluate(`
      const measured=surface.generate(),quick=surface.generate({measure:false});
      console.log(JSON.stringify({same:['home','reader','tool'].every(kind=>
        measured.outputs['src/app/generated/'+kind+'-surface.css']===quick.outputs['src/app/generated/'+kind+'-surface.css']),
        measured:typeof measured.report.surfaces.reader.gzip,quick:quick.report.surfaces.reader}));
    `)).toEqual({ same: true, measured: 'number', quick: { bytes: expect.any(Number) } });
  });
});
