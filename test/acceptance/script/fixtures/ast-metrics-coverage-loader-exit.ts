import { loaderCaptureFiles, loaderEntry } from './ast-metrics-coverage-loader.ts';

export const nestedExitEvents = 'early\nexit-2\nexit-1\nafter-emitted-exit\ncleanup\nlate-register\nexit-3\n';

export function nestedExitLoaderFiles(preload: string): Readonly<Record<string, string>> {
  return {
    ...loaderCaptureFiles(preload, nestedExitEvents),
    'test/loader-entry.ts': [
      "import { register } from 'node:module';",
      'let exits = 0;',
      "process.on('exit', () => {",
      '  const current = ++exits;',
      "  if (current === 1) process.emit('exit', 0);",
      "  if (current === 3) register(new URL('./loader-late-hooks.mjs', import.meta.url));",
      "  appendFileSync('ast-report/loader-events.log', 'exit-' + current + '\\n');",
      '});',
      loaderEntry,
    ].join('\n'),
    'test/loader-late-hooks.mjs': [
      "import { appendFileSync } from 'node:fs';",
      "export function initialize() { appendFileSync('ast-report/loader-events.log', 'late-register\\n'); }",
      '',
    ].join('\n'),
  };
}

export function workerLoaderFiles(preload: string): Readonly<Record<string, string>> {
  return {
    ...loaderCaptureFiles(preload),
    'test/loader-entry.ts': [
      "import { once } from 'node:events';",
      "import { Worker } from 'node:worker_threads';",
      "const worker = new Worker(new URL('./loader-worker.ts', import.meta.url), { execArgv: ['--import', 'tsx'] });",
      "const [code] = await once(worker, 'exit');",
      "if (code !== 0) throw new Error('The loader owner worker failed: ' + code);",
      '',
    ].join('\n'),
    'test/loader-worker.ts': loaderEntry,
  };
}
