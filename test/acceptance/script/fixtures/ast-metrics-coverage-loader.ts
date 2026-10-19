export const loaderEvents = 'early\nafter-emitted-exit\ncleanup\n';
export const loaderEntry = loaderEntryWith("import { early } from '../dist/src/sample.js';");

export function loaderEntryWith(applicationImport: string): string {
  return [
    "import { appendFileSync, mkdirSync } from 'node:fs';",
    "import { setTimeout as delay } from 'node:timers/promises';",
    applicationImport,
    "const first: string = early();",
    "mkdirSync('ast-report', { recursive: true });",
    "appendFileSync('ast-report/loader-events.log', first + '\\n');",
    "process.emit('exit', 0);",
    "await import('./loader-after-exit.ts');",
    "process.once('beforeExit', async () => {",
    '  await delay(25);',
    "  await import('./loader-cleanup.ts');",
    '});',
    '',
  ].join('\n');
}

type LoaderChild = { readonly signal?: 'SIGTERM' | null; readonly disableCache?: boolean; readonly entry?: string };

export function loaderChildTest(preload: string, assertions: readonly string[], options: LoaderChild = {}): string {
  return [
    "import assert from 'node:assert/strict';",
    "import { spawnSync } from 'node:child_process';",
    "import { readFileSync, readdirSync, writeFileSync } from 'node:fs';",
    "import { dirname } from 'node:path';",
    "import { test } from 'node:test';",
    "test('real pnpm and tsx complete typed shutdown work', () => {",
    // env sets the selected preload after the parent applies child propagation.
    `  const child = spawnSync('/usr/bin/env', [${JSON.stringify(`NODE_OPTIONS=${preload}`)}, 'pnpm', '--config.verify-deps-before-run=false', 'exec', 'node', '--import', 'tsx', ${JSON.stringify(options.entry ?? 'test/loader-entry.ts')}], {`,
    `    env: { ...process.env, ${options.disableCache ? "TSX_DISABLE_CACHE: '1', " : ''}PATH: dirname(process.execPath) + ':' + process.env.PATH }, encoding: 'utf8', timeout: 10_000,`,
    '  });',
    "  writeFileSync('ast-report/loader-child-stderr.log', child.stderr ?? '');",
    '  assert.equal(child.error, undefined);',
    `  assert.equal(child.signal, ${JSON.stringify(options.signal ?? null)}, child.stderr);`,
    ...assertions,
    '});',
    '',
  ].join('\n');
}

export function loaderStep(name: 'afterEmittedExit' | 'cleanup', applicationImport = `import { ${name} } from '../dist/src/sample.js';`): string {
  return [
    "import { appendFileSync } from 'node:fs';", applicationImport,
    `const value: string = ${name}();`,
    "appendFileSync('ast-report/loader-events.log', value + '\\n');", '',
  ].join('\n');
}

export function loaderCaptureFiles(preload: string, events = loaderEvents, child: LoaderChild = {}): Readonly<Record<string, string>> {
  const application = [
    "export function early() { return 'early'; }",
    "export function afterEmittedExit() { return 'after-emitted-exit'; }",
    "export function cleanup() { return 'cleanup'; }",
    '',
  ].join('\n');
  return {
    'package.json': JSON.stringify({ type: 'module', scripts: {
      build: 'node -e "process.exit(0)"',
      'test:unit': 'npm run build && node --test "dist/test/unit/**/*.test.js"',
    } }),
    'pnpm-workspace.yaml': 'packages: []\noffline: true\n',
    'src/sample.ts': application,
    'dist/src/sample.js': application,
    'test/loader-entry.ts': loaderEntry,
    'test/loader-after-exit.ts': loaderStep('afterEmittedExit'),
    'test/loader-cleanup.ts': loaderStep('cleanup'),
    'dist/test/unit/loader.test.js': loaderChildTest(preload, [
      '  assert.equal(child.status, 0, child.stderr);',
      "  assert.equal(child.stderr, '');",
      `  assert.equal(readFileSync('ast-report/loader-events.log', 'utf8'), ${JSON.stringify(events)});`,
    ], child),
  };
}
