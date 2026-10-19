import { loaderCaptureFiles, loaderChildTest, loaderEntry } from './ast-metrics-coverage-loader.ts';

export type LoaderRefusal = 'default SIGTERM' | 'Worker.terminate' | 'stalled loader' | 'thrown exit listener' | 'synchronous tsx worker';

const entryStart = [
  "import { appendFileSync, mkdirSync } from 'node:fs';",
  "import { early } from '../dist/src/sample.js';",
  "mkdirSync('ast-report', { recursive: true });",
  "appendFileSync('ast-report/loader-events.log', early() + '\\n');",
].join('\n');

const programs: Readonly<Record<LoaderRefusal, string>> = {
  'default SIGTERM': "process.kill(process.pid, 'SIGTERM');\n",
  'Worker.terminate': [
    "import { once } from 'node:events';",
    "import { Worker } from 'node:worker_threads';",
    "const worker = new Worker(new URL('./loader-held-worker.ts', import.meta.url), { execArgv: ['--import', 'tsx'] });",
    "await once(worker, 'message');",
    'const code = await worker.terminate();',
    "if (code !== 1) throw new Error('The captured worker did not terminate.');",
    '',
  ].join('\n'),
  'stalled loader': [
    "import { register } from 'node:module';",
    "import { MessageChannel } from 'node:worker_threads';",
    'const ready = new Int32Array(new SharedArrayBuffer(4));',
    'const { port1, port2 } = new MessageChannel();',
    "register(new URL('./loader-stall-hooks.mjs', import.meta.url), { data: { ready: ready.buffer, port: port2 }, transferList: [port2] });",
    'port1.unref();',
    "port1.postMessage('block');",
    'Atomics.wait(ready, 0, 0, 5_000);',
    "if (Atomics.load(ready, 0) !== 1) throw new Error('The loader did not reach the blocked hook.');",
    "appendFileSync('ast-report/loader-events.log', 'loader-blocked\\n');",
    'process.exit(0);',
    '',
  ].join('\n'),
  'thrown exit listener': "process.on('exit', () => { throw new Error('loader-exit-original'); });\n",
  'synchronous tsx worker': loaderEntry,
};

export function refusedLoaderFiles(preload: string, refusal: LoaderRefusal): Readonly<Record<string, string>> {
  const synchronous = refusal === 'synchronous tsx worker';
  const assertions = refusal === 'Worker.terminate' || refusal === 'stalled loader' || synchronous
    ? ['  assert.equal(child.status, 0, child.stderr);', "  assert.equal(child.stderr, '');"]
    : ['  assert.notEqual(child.status, 0, child.stderr);'];
  if (refusal === 'thrown exit listener') assertions.push("  assert.match(child.stderr, /Error: loader-exit-original/);");
  if (synchronous) assertions.push(
    "  const raw = readdirSync(process.env.NODE_V8_COVERAGE).filter((name) => /^coverage-\\d+-\\d+-[1-9]\\d*\\.json$/.test(name));",
    "  assert.ok(raw.some((name) => JSON.parse(readFileSync(process.env.NODE_V8_COVERAGE + '/' + name, 'utf8')).result.some(({ url }) => url.endsWith('/esbuild/lib/main.js'))), 'The synchronous tsx case did not create its esbuild worker.');",
  );
  return {
    ...loaderCaptureFiles(preload),
    'test/loader-entry.ts': synchronous ? loaderEntry : `${entryStart}\n${programs[refusal]}`,
    'dist/test/unit/loader.test.js': loaderChildTest(preload, assertions, { signal: refusal === 'default SIGTERM' ? 'SIGTERM' : null, disableCache: synchronous }),
    'test/loader-held-worker.ts': [
      "import { parentPort } from 'node:worker_threads';",
      "import { early } from '../dist/src/sample.js';",
      'const value: string = early();',
      'parentPort.postMessage(value);',
      'setInterval(() => {}, 1_000);',
      '',
    ].join('\n'),
    'test/loader-stall-hooks.mjs': [
      'export function initialize(data) {',
      '  const ready = new Int32Array(data.ready);',
      "  data.port.on('message', () => {",
      '    Atomics.store(ready, 0, 1);',
      '    Atomics.notify(ready, 0);',
      '    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);',
      '  });',
      '  data.port.unref();',
      '}',
      '',
    ].join('\n'),
  };
}
