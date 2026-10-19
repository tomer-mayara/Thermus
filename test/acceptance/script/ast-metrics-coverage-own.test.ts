import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { writeV8Coverage } from '../../support/fixtures/v8-coverage.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const timeout = 30_000;
const earlierReport = '{ "version": 1, "files": [] }\n';

test('Given called factories with uncalled and partly called nested functions, when coverage is read, then each share measures only its own characters', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'dist/src/sample.js': ' '.repeat(300) });
  writeV8Coverage(join(repository.root, 'v8'), repository.root, [{ 'dist/src/sample.js': [
    ['A', [0, 100, 1]], ['B', [40, 90, 0]],
    ['C', [100, 200, 1]], ['D', [140, 190, 1], [150, 160, 0]],
    ['empty', [200, 300, 1]], ['left', [200, 250, 0]], ['right', [250, 300, 1]],
  ] }]);

  const result = await runScript(t, astMetricsCoverageScript, { args: ['--allow-unverified', '--from', 'v8'], cwd: repository.root });

  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'));
  assert.equal(report.version, 2);
  assert.equal(report.measurementVersion, 'own-characters-1');
  assert.deepEqual(report.files[0].functions.map(({ name, coveredShare }: { name: string; coveredShare: number }) => [name, coveredShare]), [
    ['A', 1], ['B', 0], ['C', 1], ['D', 0.8], ['left', 0], ['right', 1],
  ]);
  assert.deepEqual(report.unmeasuredFunctions, [{ path: 'src/sample.ts', name: 'empty', start: 200, end: 300, reason: 'no-own-characters' }]);
});

const typedSource = [
  'const greeting: string = "hé😀";',
  'export function typed(flag: boolean): string {',
  '  if (flag) return greeting;',
  '  return "未使用";',
  '}',
  '',
].join('\n');

test('Given emitted and typed portal unit tests with non-ASCII text, when coverage runs, then both suites run and typed offsets and shares match UTF-16 source text', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', {
    'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"' } }),
    'dist/src/emitted.js': 'export function emitted() { return 1; }\n',
    'dist/test/unit/emitted.test.js': "import { emitted } from '../../src/emitted.js'; emitted();\n",
    'src/user-portal/typed.ts': typedSource,
    'test/unit/user-portal/typed.test.ts': "import { typed } from '../../../src/user-portal/typed.ts'; typed(true);\n",
  });

  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });

  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'));
  assert.equal(report.suite, 'unit');
  assert.deepEqual(report.files.map(({ path }: { path: string }) => path), ['src/emitted.ts', 'src/user-portal/typed.ts']);
  const file = report.files[1];
  assert.equal(file.representation, 'source-typescript');
  assert.equal(file.contentIdentity, createHash('sha256').update(typedSource).digest('hex'));
  const module = file.functions.find(({ name }: { name: string }) => name === '(anonymous)');
  const url = pathToFileURL(join(repository.root, 'src/user-portal/typed.ts')).href;
  assert.equal(module.end, typedSource.length + `\n\n//# sourceURL=${url}`.length);
  const typed = file.functions.find(({ name }: { name: string }) => name === 'typed');
  const start = typedSource.indexOf('function typed');
  const end = typedSource.lastIndexOf('}') + 1;
  const missedStart = typedSource.indexOf('\n  return "未使用";');
  assert.deepEqual(typed, { name: 'typed', start, end, called: 1, coveredShare: Math.round((1 - (end - 1 - missedStart) / (end - start)) * 1000) / 1000 });
});

for (const [label, ranges] of [
  ['empty whole', [[20, 20, 1]]], ['empty block', [[0, 100, 1], [20, 20, 0]]],
  ['outside block', [[20, 80, 1], [10, 30, 0]]], ['out-of-bounds', [[0, 101, 1]]],
  ['negative count', [[0, 100, -1]]], ['fractional offset', [[0.5, 100, 1]]],
  ['unsafe count', [[0, 100, Number.MAX_SAFE_INTEGER + 1]]],
] as const) {
  test(`Given ${label} raw coverage, when the command reads it, then it fails and keeps the earlier report`, async (t) => {
    const repository = GitRepository.create(t);
    repository.commit('Start', { 'dist/src/sample.js': ' '.repeat(100), 'ast-report/coverage.json': 'earlier\n' });
    const [whole, ...blocks] = ranges;
    writeV8Coverage(join(repository.root, 'v8'), repository.root, [{ 'dist/src/sample.js': [['run', whole, ...blocks]] }]);
    const result = await runScript(t, astMetricsCoverageScript, { args: ['--allow-unverified', '--from', 'v8'], cwd: repository.root });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /range|count|integer|offset/i);
    assert.equal(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'), 'earlier\n');
  });
}

test('Given emitted and source coordinates for the same logical file, when the command reads them, then it rejects incompatible representations', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'README.md': 'fixture\n' });
  writeV8Coverage(join(repository.root, 'v8'), repository.root, [
    { 'dist/src/sample.js': [['run', [0, 100, 1]]] }, { 'src/sample.ts': [['run', [0, 100, 1]]] },
  ]);
  const result = await runScript(t, astMetricsCoverageScript, { args: ['--allow-unverified', '--from', 'v8'], cwd: repository.root });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /representation|incompatible/i);
});

test('Given summed calls that exceed a safe integer, when the command reads them, then it fails and keeps the earlier report', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'ast-report/coverage.json': 'earlier\n' });
  writeV8Coverage(join(repository.root, 'v8'), repository.root, [
    { 'dist/src/sample.js': [['run', [0, 100, Number.MAX_SAFE_INTEGER]]] }, { 'dist/src/sample.js': [['run', [0, 100, 1]]] },
  ]);
  const result = await runScript(t, astMetricsCoverageScript, { args: ['--allow-unverified', '--from', 'v8'], cwd: repository.root });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /safe|overflow/i);
  assert.equal(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'), 'earlier\n');
});

test('Given two processes with crossing function ranges, when the command reads them, then it fails with a diagnostic and keeps the earlier report', { timeout }, async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'ast-report/coverage.json': earlierReport });
  writeV8Coverage(join(repository.root, 'v8-coverage'), repository.root, [
    { 'dist/src/sample.js': [['', [0, 400, 1]], ['outer', [100, 300, 1]]] },
    { 'dist/src/sample.js': [['', [0, 400, 1]], ['other', [200, 350, 1]]] },
  ]);

  const result = await runScript(t, astMetricsCoverageScript, { args: ['--allow-unverified', '--from', 'v8-coverage'], cwd: repository.root });

  assert.match(result.stderr, /ast-metrics-coverage: .*cross.*src\/sample\.ts/i);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.equal(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'), earlierReport);
});

test('Given emitted tests that pass and portal tests that fail, when collection runs, then it keeps the earlier report and removes the capture folder', { timeout }, async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', {
    'ast-report/coverage.json': earlierReport,
    'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"' } }),
    'dist/src/sample.js': 'export const value = 1;\n',
    'dist/test/unit/sample.test.js': "import '../../src/sample.js';\n",
    'test/unit/user-portal/sample.test.ts': "import { test } from 'node:test'; test('portal failure', () => { throw Error('defect'); });\n",
  });
  const temporary = mkdtempSync(join(tmpdir(), 'thermus-coverage-test-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, env: { TMPDIR: temporary } });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /portal failure/);
  assert.equal(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'), earlierReport);
  assert.deepEqual(readdirSync(temporary).filter((name) => name.startsWith('thermus-coverage-')), []);
});
