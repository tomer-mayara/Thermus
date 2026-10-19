import { loaderCaptureFiles, loaderEntryWith, loaderEvents, loaderStep } from './ast-metrics-coverage-loader.ts';

export function asynchronousRequireLoaderFiles(preload: string): Readonly<Record<string, string>> {
  return {
    ...loaderCaptureFiles(preload, loaderEvents, { entry: 'async-bootstrap.mjs', disableCache: true }),
    'async-bootstrap.mjs': [
      "import { register } from 'node:module';",
      // Keep the measured application URL canonical while typed entries use the public namespace.
      "globalThis.loaderApplication = await import('./dist/src/sample.js');",
      "register('tsx/esm', import.meta.url, { data: { namespace: 'capture-loader' } });",
      "await import('./test/loader-entry.ts?tsx-namespace=capture-loader');",
      '',
    ].join('\n'),
    'test/loader-entry.ts': loaderEntryWith('const { early } = globalThis.loaderApplication;'),
    'test/loader-after-exit.ts': loaderStep('afterEmittedExit', 'const { afterEmittedExit } = globalThis.loaderApplication;'),
    'test/loader-cleanup.ts': loaderStep('cleanup', 'const { cleanup } = globalThis.loaderApplication;'),
  };
}
