import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';

const propagation = new URL('coverage/propagation.ts', pathToFileURL(astMetricsCoverageScript)).href;

function capture(t: TestContext, program: string, realLifecycle = false) {
  const root = dataDirectory(t);
  const raw = join(root, 'raw');
  const alternate = join(root, 'alternate');
  mkdirSync(raw);
  mkdirSync(alternate);
  const preload = join(root, 'lifecycle.mjs');
  writeFileSync(preload, `
    import {writeFileSync} from 'node:fs';
    import {join} from 'node:path';
    import {threadId} from 'node:worker_threads';
    import {propagateCapture} from ${JSON.stringify(propagation)};
    const folder=process.env.NODE_V8_COVERAGE;
    propagateCapture(import.meta.url,folder);
    process.on('exit',()=>writeFileSync(join(folder,'process-'+process.pid+'-'+threadId+'.json'),JSON.stringify({pid:process.pid,threadId,complete:true})));
  `);
  const child = join(root, 'child.mjs');
  writeFileSync(child, `console.log(JSON.stringify({pid:process.pid,args:process.argv.slice(2),keep:process.env.KEEP,coverage:process.env.NODE_V8_COVERAGE,options:process.env.NODE_OPTIONS}));`);
  const main = join(root, 'main.mjs');
  writeFileSync(main, program);
  const stdout = execFileSync(process.execPath, [main, child, alternate], {
    env: { ...process.env, NODE_V8_COVERAGE: raw, NODE_OPTIONS: `--import=${realLifecycle ? new URL('coverage/lifecycle.ts', pathToFileURL(astMetricsCoverageScript)).href : pathToFileURL(preload).href}` }, encoding: 'utf8', timeout: 15_000,
  });
  return { root, raw, alternate, values: JSON.parse(stdout) as Record<string, unknown>[] };
}

function assertComplete(folder: string): void {
  const names = readdirSync(folder);
  const captured = new Set(names.filter((name) => name.startsWith('coverage-')).map((name) => {
    const parts = name.split('-');
    return `${parts[1]}:${parts.at(-1)?.split('.')[0]}`;
  }));
  const completed = new Set(names.filter((name) => name.startsWith('process-')).map((name) => {
    const value = JSON.parse(readFileSync(join(folder, name), 'utf8'));
    assert.equal(value.complete, true);
    return `${value.pid}:${value.threadId}`;
  }));
  assert.ok(captured.size > 0);
  assert.deepEqual(captured, completed);
}

test('Given minimal child environments and replaced Node options, when ESM child-process APIs run real Node children, then only the capture preload is added and each child completes', (t) => {
  const result = capture(t, `
    import assert from 'node:assert/strict';
    import {spawn,spawnSync,execFile,execFileSync,fork,exec,execSync} from 'node:child_process';
    import {promisify} from 'node:util';
    const script=process.argv[2];
    const options={env:{PATH:process.env.PATH,KEEP:'unchanged value',NODE_OPTIONS:'--no-warnings'}};
    const before=JSON.stringify(options);
    const values=[];
    const collect=async(child)=>{let text='';child.stdout.setEncoding('utf8').on('data',part=>text+=part);await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(String(code))))});return JSON.parse(text)};
    values.push(await collect(spawn(process.execPath,[script,'spawn'],options)));
    values.push(JSON.parse(spawnSync(process.execPath,[script,'spawnSync'],{...options,encoding:'utf8'}).stdout));
    values.push(JSON.parse(execFileSync(process.execPath,[script,'execFileSync'],{...options,encoding:'utf8'})));
    values.push(JSON.parse(await new Promise((resolve,reject)=>execFile(process.execPath,[script,'execFile'],options,(error,stdout)=>error?reject(error):resolve(stdout)))));
    values.push(JSON.parse((await promisify(execFile)(process.execPath,[script,'promisified'],options)).stdout));
    values.push(await collect(fork(script,['fork'],{...options,execArgv:[],stdio:['ignore','pipe','pipe','ipc']})));
    const command=JSON.stringify(process.execPath)+' '+JSON.stringify(script)+' shell';
    values.push(JSON.parse(await new Promise((resolve,reject)=>exec(command,options,(error,stdout)=>error?reject(error):resolve(stdout)))));
    values.push(JSON.parse(execSync(command,{...options,encoding:'utf8'})));
    assert.equal(execFileSync('/bin/sh',['-c','printf %s "$KEEP"'],{...options,encoding:'utf8'}),'unchanged value');
    assert.equal(JSON.stringify(options),before);
    console.log(JSON.stringify(values));
  `);
  assert.equal(result.values.length, 8);
  assert.deepEqual(result.values.map(({ args }) => args), [['spawn'], ['spawnSync'], ['execFileSync'], ['execFile'], ['promisified'], ['fork'], ['shell'], ['shell']]);
  for (const value of result.values) {
    assert.equal(value.keep, 'unchanged value');
    assert.equal(value.coverage, result.raw);
    assert.match(String(value.options), /^--no-warnings --import=file:/u);
  }
  assertComplete(result.raw);
});

test('Given children that write raw coverage and kill themselves after their exit markers, when public child-process APIs observe SIGKILL, then the capture remains unverified', async (t) => {
  const result = capture(t, `
    import {writeFileSync} from 'node:fs';
    import {spawn,spawnSync,execFileSync} from 'node:child_process';
    writeFileSync(process.argv[2],"import {takeCoverage} from 'node:v8';process.on('exit',()=>{takeCoverage();process.kill(process.pid,'SIGKILL')});");
    const options={env:{NODE_OPTIONS:'--no-warnings'},encoding:'utf8'};
    const sync=spawnSync(process.execPath,[process.argv[2]],options);
    const values=[{pid:sync.pid,signal:sync.signal}];
    const child=spawn(process.execPath,[process.argv[2]],options);
    const pid=child.pid;
    values.push(await new Promise(resolve=>child.once('close',(_code,signal)=>resolve({pid,signal}))));
    try{execFileSync(process.execPath,[process.argv[2]],options)}catch(error){values.push({pid:error.pid,signal:error.signal})}
    console.log(JSON.stringify(values));
  `, true);
  assert.equal(result.values.length, 3);
  assert.deepEqual(result.values.map(({ signal }) => signal), ['SIGKILL', 'SIGKILL', 'SIGKILL']);
  const signals = readdirSync(result.raw).filter((name) => name.startsWith('signal-')).map((name) => JSON.parse(readFileSync(join(result.raw, name), 'utf8')));
  for (const value of result.values) assert.ok(signals.some(({ pid, signal }) => pid === value.pid && signal === 'SIGKILL'));
  const { assertCompleteCapture } = await import(new URL('coverage/completeness.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/coverage/completeness.ts');
  assert.throws(() => assertCompleteCapture(result.raw), /SIGKILL/u);
});

test('Given a native child that writes no V8 data, when it stops on SIGKILL, then its observed signal does not invalidate Node coverage', async (t) => {
  const result = capture(t, `
    import {spawnSync} from 'node:child_process';
    const result=spawnSync('/bin/sh',['-c','kill -KILL $$'],{env:{NODE_OPTIONS:'--no-warnings'},encoding:'utf8'});
    console.log(JSON.stringify([{pid:result.pid,signal:result.signal}]));
  `, true);
  assert.equal(result.values[0].signal, 'SIGKILL');
  const { assertCompleteCapture } = await import(new URL('coverage/completeness.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/coverage/completeness.ts');
  assert.doesNotThrow(() => assertCompleteCapture(result.raw));
});

test('Given explicit alternate, empty, or undefined coverage folders, when a child starts, then its capture choice and Node options stay unchanged', (t) => {
  const result = capture(t, `
    import {spawnSync} from 'node:child_process';
    const values=[];
    for(const folder of [process.argv[3],'',undefined]){
      const result=spawnSync(process.execPath,[process.argv[2]],{env:{NODE_V8_COVERAGE:folder,NODE_OPTIONS:'--no-warnings'},encoding:'utf8'});
      if(result.status!==0)throw new Error(result.stderr);
      values.push(JSON.parse(result.stdout));
    }
    console.log(JSON.stringify(values));
  `);
  assert.deepEqual(result.values.map(({ coverage }) => coverage), [result.alternate, '', undefined]);
  assert.deepEqual(result.values.map(({ options }) => options), ['--no-warnings', '--no-warnings', '--no-warnings']);
  assertComplete(result.raw);
  assert.ok(readdirSync(result.alternate).some((name) => name.startsWith('coverage-')));
});

test('Given workers with explicit arguments and capture choices, when they start and exit, then current-capture workers complete and active workers are known before startup', (t) => {
  const result = capture(t, `
    import assert from 'node:assert/strict';
    import {Worker} from 'node:worker_threads';
    import {hasActiveCaptureWorkers} from ${JSON.stringify(propagation)};
    const values=[];
    const body="import('node:worker_threads').then(({parentPort,threadId})=>parentPort.postMessage({threadId,coverage:process.env.NODE_V8_COVERAGE,keep:process.env.KEEP,options:process.env.NODE_OPTIONS,execArgv:process.execArgv}))";
    for(const env of [{NODE_V8_COVERAGE:process.env.NODE_V8_COVERAGE,KEEP:'worker',NODE_OPTIONS:'--no-warnings'},{},{NODE_V8_COVERAGE:process.argv[3]},{NODE_V8_COVERAGE:''}]){
      const worker=new Worker(body,{eval:true,execArgv:[],env});
      const exited=new Promise(resolve=>worker.once('exit',resolve));
      assert.equal(hasActiveCaptureWorkers(),true);
      values.push(await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject)}));
      await exited;
      assert.equal(hasActiveCaptureWorkers(),false);
    }
    console.log(JSON.stringify(values));
  `);
  assert.equal(result.values[0].coverage, result.raw);
  assert.equal(result.values[0].keep, 'worker');
  assert.equal(result.values[0].options, '--no-warnings');
  assert.match(String((result.values[0].execArgv as string[])[0]), /^--require=\//u);
  assert.deepEqual(result.values.slice(1).map(({ execArgv }) => execArgv), [[], [], []]);
  assert.deepEqual(result.values.slice(1).map(({ coverage }) => coverage), [undefined, result.alternate, '']);
  assertComplete(result.raw);
  assert.ok(readdirSync(result.alternate).some((name) => name.startsWith('coverage-')));
});

test('Given default Worker arguments under the real test runner, when workers inherit or replace Node options, then Node keeps its default argument filtering and coverage completes', async (t) => {
  const root = dataDirectory(t);
  const raw = join(root, 'raw');
  mkdirSync(raw);
  writeFileSync(join(root, 'worker.mjs'), "import {parentPort} from 'node:worker_threads';parentPort.postMessage('done');\n");
  const script = join(root, 'default-worker.test.mjs');
  writeFileSync(script, `
    import assert from 'node:assert/strict';
    import {test} from 'node:test';
    import {Worker} from 'node:worker_threads';
    for(const replaced of [false,true])test('default worker '+replaced,async()=>{
      const options=replaced?{env:{...process.env,NODE_OPTIONS:'--no-warnings'}}:{};
      const worker=new Worker(new URL('./worker.mjs',import.meta.url),options);
      const exited=new Promise(resolve=>worker.once('exit',resolve));
      assert.equal(await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject)}),'done');
      assert.equal(await exited,0);
    });
  `);
  const lifecycle = new URL('coverage/lifecycle.ts', pathToFileURL(astMetricsCoverageScript)).href;
  const { NODE_TEST_CONTEXT: _context, ...environment } = process.env;
  execFileSync(process.execPath, ['--stack-trace-limit=10', '--test', '--test-concurrency=1', script], {
    env: { ...environment, NODE_V8_COVERAGE: raw, NODE_OPTIONS: `--import=${lifecycle}` }, encoding: 'utf8', timeout: 15_000,
  });
  const { assertCompleteCapture } = await import(new URL('coverage/completeness.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/coverage/completeness.ts');
  assert.doesNotThrow(() => assertCompleteCapture(raw));
});
