import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const project = process.cwd();
const script = path.join(project, 'scripts/dev-surface-css.mjs');
function evaluate(code: string) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import * as dev from ${JSON.stringify(pathToFileURL(script).href)};\n${code}`],
  { cwd: project, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout) as unknown;
}

describe('surface CSS development watcher', () => {
  it('reloads a changed marker contract while reusing the generator for ordinary source edits', () => {
    expect(evaluate(`
      let source='first';const loaded=[],options=[];
      const generate=dev.createDevelopmentGenerator({readContract:()=>source,loadGenerator:async url=>{
        loaded.push(url);const version=source;return{generate:option=>{options.push(option);return{version}}};
      }});
      const first=await generate(),same=await generate();source='second';
      const second=await generate(),sameSecond=await generate();
      console.log(JSON.stringify({first,same,second,sameSecond,loads:loaded.length,unique:new Set(loaded).size,options}));
    `)).toEqual({ first: { version: 'first' }, same: { version: 'first' }, second: { version: 'second' },
      sameSecond: { version: 'second' }, loads: 2, unique: 2,
      options: [{ measure: false }, { measure: false }, { measure: false }, { measure: false }] });
  });

  it('watches source CSS, public graph modules and JSON policies, excluding generated/dependency/build files', () => {
    const filenames = ['src/app/v12.css', 'src/app/root-styles.css', 'src/app/page.tsx',
      'src/lib/styles/surface-contract.json', 'src/components/rules/guide.ts',
      'src/app/generated/reader-surface.css', 'src/app/generated/surface-report.json',
      '.next/static/chunks/test.css', 'node_modules/package/test.css', 'src/node_modules/test.css',
      'src/app/README.md', 'src\\app\\generated\\tool-surface.css'];
    expect(evaluate(`console.log(JSON.stringify(${JSON.stringify(filenames)}.map(dev.isRelevantSource)));`))
      .toEqual([true, true, true, true, true, false, false, false, false, false, false, false]);
  });

  it('writes only changed artifact bytes atomically and rejects paths outside the generated directory', () => {
    expect(evaluate(`
      const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
      const root=fs.mkdtempSync(path.join(os.tmpdir(),'sw-dev-css-test-'));
      try {
        const outputs={'src/app/generated/reader-surface.css':'.reader{}'};
        const first=dev.writeChangedOutputs(outputs,root);
        const target=path.join(root,Object.keys(outputs)[0]);
        fs.utimesSync(target,new Date(0),new Date(0));
        const second=dev.writeChangedOutputs(outputs,root),unchangedTime=fs.statSync(target).mtimeMs;
        const third=dev.writeChangedOutputs({'src/app/generated/reader-surface.css':'.changed{}'},root);
        let rejected=false;try{dev.writeChangedOutputs({'src/app/generated/../escape.css':'x'},root)}catch{rejected=true}
        console.log(JSON.stringify({first:first.length,second:second.length,third:third.length,
          unchangedTime,text:fs.readFileSync(target,'utf8'),rejected,
          temporary:fs.readdirSync(path.dirname(target)).filter(file=>file.includes('.tmp-'))}));
      } finally {fs.rmSync(root,{recursive:true,force:true})}
    `)).toEqual({ first: 1, second: 0, third: 1, unchangedTime: 0, text: '.changed{}', rejected: true, temporary: [] });
  });

  it('coalesces a burst of source events into one regeneration', () => {
    expect(evaluate(`
      const pending=new Map();let serial=0,runs=0,writes=0;
      const controller=dev.createRegenerator({generateCss:()=>{runs++;return{outputs:{}}},write:()=>{writes++},
        schedule:callback=>{pending.set(++serial,callback);return serial},cancel:id=>pending.delete(id)});
      controller.request();controller.request();controller.request();const queued=pending.size;
      const callback=[...pending.values()][0];pending.clear();callback();
      await new Promise(resolve=>setImmediate(resolve));
      controller.close();controller.request();
      console.log(JSON.stringify({queued,runs,writes,remaining:pending.size}));
    `)).toEqual({ queued: 1, runs: 1, writes: 1, remaining: 0 });
  });

  it('queues one follow-up regeneration when files change during in-flight work', () => {
    expect(evaluate(`
      const pending=new Map();let serial=0,runs=0,writes=0,release;
      const controller=dev.createRegenerator({generateCss:()=>{runs++;return runs===1?new Promise(resolve=>release=resolve):{outputs:{}}},
        write:()=>{writes++},schedule:callback=>{pending.set(++serial,callback);return serial},cancel:id=>pending.delete(id)});
      const fire=()=>{const callback=[...pending.values()][0];pending.clear();callback()};
      controller.request();fire();await new Promise(resolve=>setImmediate(resolve));
      controller.request();controller.request();fire();
      release({outputs:{}});await new Promise(resolve=>setImmediate(resolve));const queued=pending.size;
      fire();await new Promise(resolve=>setImmediate(resolve));controller.close();
      console.log(JSON.stringify({queued,runs,writes,remaining:pending.size}));
    `)).toEqual({ queued: 1, runs: 2, writes: 2, remaining: 0 });
  });

  it('stops pending writes when the watcher shuts down', () => {
    expect(evaluate(`
      let callback,release,writes=0;
      const controller=dev.createRegenerator({generateCss:()=>new Promise(resolve=>release=resolve),write:()=>{writes++},
        schedule:fn=>{callback=fn;return 1},cancel:()=>{}});
      controller.request();callback();controller.close();release({outputs:{}});
      await new Promise(resolve=>setImmediate(resolve));console.log(JSON.stringify(writes));
    `)).toBe(0);
  });

  it('reports an invalid generation and recovers after the next source edit', () => {
    expect(evaluate(`
      let callback,runs=0,writes=0;const errors=[];
      const controller=dev.createRegenerator({generateCss:()=>{if(++runs===1)throw Error('bad-css');return{outputs:{}}},
        write:()=>{writes++},onError:error=>errors.push(error.message),schedule:fn=>{callback=fn;return 1},cancel:()=>{}});
      controller.request();callback();await new Promise(resolve=>setImmediate(resolve));
      controller.request();callback();await new Promise(resolve=>setImmediate(resolve));controller.close();
      console.log(JSON.stringify({runs,writes,errors}));
    `)).toEqual({ runs: 2, writes: 1, errors: ['bad-css'] });
  });

  it('forwards Next arguments and closes the watcher and child on a terminal signal', () => {
    expect(evaluate(`
      const {EventEmitter}=await import('node:events');
      const signals=new EventEmitter();signals.env={TEST_ENV:'kept'};
      const child=new EventEmitter();child.exitCode=null;const kills=[];child.kill=signal=>{kills.push(signal);return true};
      let closed=0,spawned,watched,initial=0;
      const controller=await dev.startDevelopment({args:['--port','4321','--hostname','127.0.0.1'],
        generateCss:()=>{initial++;return{outputs:{}}},processTarget:signals,
        spawnChild:(command,args,options)=>{spawned={command,args,options};return child},
        watchSource:(directory,options,callback)=>{watched={directory,options,callback};return{close:()=>{closed++}}},
        log:()=>{},reportError:error=>{throw error}});
      watched.callback('change','app/generated/reader-surface.css');
      watched.callback('change','app/v12.css');
      signals.emit('SIGINT');child.exitCode=0;child.emit('exit',0,null);controller.stop();
      console.log(JSON.stringify({initial,args:spawned.args.slice(1),stdio:spawned.options.stdio,
        recursive:watched.options.recursive,env:spawned.options.env,closed,kills,
        listeners:['SIGINT','SIGTERM','SIGHUP'].map(signal=>signals.listenerCount(signal)),exitCode:signals.exitCode}));
    `)).toEqual({ initial: 1, args: ['dev', '--port', '4321', '--hostname', '127.0.0.1'],
      stdio: 'inherit', recursive: true, env: { TEST_ENV: 'kept' }, closed: 1,
      kills: ['SIGINT'], listeners: [0, 0, 0], exitCode: 130 });
  });

  it('does not spawn Next if initial stylesheet generation fails', () => {
    expect(evaluate(`
      let spawned=0,error;
      try{await dev.startDevelopment({generateCss:()=>{throw Error('initial-css-failed')},spawnChild:()=>{spawned++}})}
      catch(caught){error=caught.message}
      console.log(JSON.stringify({spawned,error}));
    `)).toEqual({ spawned: 0, error: 'initial-css-failed' });
  });
});
