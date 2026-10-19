import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { writeV8Coverage } from '../../support/fixtures/v8-coverage.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';

const scriptFolder = pathToFileURL(astMetricsCoverageScript);
const { sourceScriptsIn } = await import(new URL('coverage/input.ts', scriptFolder).href) as typeof import('../../../script/code-quality/coverage/input.ts');
const { withSuiteCoverage } = await import(new URL('coverage/run.ts', scriptFolder).href) as typeof import('../../../script/code-quality/coverage/run.ts');

function rootOf(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'thermus-coverage-input-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('Given both unit parts, when coverage runs, then both Node calls share one capture folder in suite order', (t) => {
  const root = rootOf(t);
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'test:unit': 'npm run build && node --test --test-concurrency=1 "dist/test/unit/**/*.test.js" && node --test "test/unit/user-portal/**/*.test.ts"' } }));
  const calls: { args: readonly string[]; folder: string | undefined }[] = [];
  t.mock.method(childProcess, 'spawnSync', (_file: string, args: readonly string[], options: childProcess.SpawnSyncOptions) => {
    calls.push({ args, folder: options.env?.NODE_V8_COVERAGE });
    assert.equal(options.env?.NODE_TEST_CONTEXT, undefined);
    const folder = options.env?.NODE_V8_COVERAGE as string;
    writeV8Coverage(folder, root, [{ 'dist/src/a.js': [['a', [0, 10, 1]]] }]);
    writeFileSync(join(folder, 'process-4000.json'), JSON.stringify({ pid: 4000, threadId: 0, complete: true }));
    return { status: 0, signal: null, output: [], pid: 0, stdout: null, stderr: null };
  });

  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  withSuiteCoverage(root, { suite: 'unit' }, (folder) => {
    assert.deepEqual(calls, [
      { args: ['--test', '--test-concurrency=1', 'dist/test/unit/**/*.test.js'], folder },
      { args: ['--test', 'test/unit/user-portal/**/*.test.ts'], folder },
    ]);
  });
});

test('Given typed source and test URLs, when coverage is read, then source identity uses actual UTF-16 text and test URLs stay absent', (t) => {
  const root = rootOf(t);
  mkdirSync(join(root, 'src'), { recursive: true });
  const text = 'const value: string = "hé😀";\n';
  writeFileSync(join(root, 'src/a.ts'), text);
  writeV8Coverage(join(root, 'v8'), root, [{ 'src/a.ts': [['a', [0, text.length, 1]]], 'test/a.ts': [['test', [0, 10, 1]]] }]);

  const scripts = [...sourceScriptsIn(join(root, 'v8'), root)].flat();

  assert.deepEqual(scripts.map(({ functions: _functions, ...identity }) => identity), [{ path: 'src/a.ts', representation: 'source-typescript', length: text.length + `\n\n//# sourceURL=${pathToFileURL(join(root, 'src/a.ts')).href}`.length, contentIdentity: createHash('sha256').update(text).digest('hex') }]);
});

test('Given a script file changed between process reads, when coverage is read, then each process carries its actual content identity', (t) => {
  const root = rootOf(t);
  writeV8Coverage(join(root, 'v8'), root, [{ 'dist/src/a.js': [['a', [0, 10, 1]]] }, { 'dist/src/a.js': [['a', [0, 10, 1]]] }]);
  const iterator = sourceScriptsIn(join(root, 'v8'), root);
  const first = iterator.next().value;
  writeFileSync(join(root, 'dist/src/a.js'), 'x'.repeat(10));
  const second = iterator.next().value;
  assert.notEqual(first?.[0].contentIdentity, second?.[0].contentIdentity);
});

test('Given a missing identified script, when coverage is read, then it fails with the script path', (t) => {
  const root = rootOf(t);
  writeV8Coverage(join(root, 'v8'), root, [{ 'dist/src/a.js': [['a', [0, 10, 1]]] }]);
  rmSync(join(root, 'dist/src/a.js'));
  assert.throws(() => [...sourceScriptsIn(join(root, 'v8'), root)], /a\.js/);
});

for (const suffix of ['src/a.ts?alias=1', 'src/a.ts#alias', 'src/%2e%2e/outside.ts', 'src/part%2fa.ts']) {
  test(`Given a noncanonical script URL ${suffix}, when coverage is read, then it does not accept an alias into src`, (t) => {
    const root = rootOf(t);
    writeV8Coverage(join(root, 'v8'), root, [{ 'src/a.ts': [['a', [0, 10, 1]]] }]);
    const file = join(root, 'v8/coverage-4000-1792300000000-0.json');
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    raw.result[0].url = `file://${root}/${suffix}`;
    writeFileSync(file, JSON.stringify(raw));
    assert.throws(() => [...sourceScriptsIn(join(root, 'v8'), root)], /no script|URL|path/i);
  });
}
