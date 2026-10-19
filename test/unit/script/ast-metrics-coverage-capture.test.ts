import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
const script = pathToFileURL(astMetricsCoverageScript);
const { collectCoverage } = await import(new URL('coverage/capture.ts', script).href) as typeof import('../../../script/code-quality/coverage/capture.ts');
const { importedCoverage } = await import(new URL('coverage/import.ts', script).href) as typeof import('../../../script/code-quality/coverage/import.ts');
import { writeV8Coverage } from '../../support/fixtures/v8-coverage.ts';

function rootOf(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'coverage-capture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 1;');
  return root;
}
function runner(t: TestContext, root: string, change?: (call: number) => void): string[][] {
  const calls: string[][] = [];
  t.mock.method(childProcess, 'spawnSync', (_file: string, args: string[], options: childProcess.SpawnSyncOptions) => {
    calls.push(args);
    if (args[0] === 'run') { mkdirSync(join(root, 'dist/src'), { recursive: true }); writeFileSync(join(root, 'dist/src/a.js'), ' '.repeat(10)); }
    else writeV8Coverage(options.env?.NODE_V8_COVERAGE as string, root, [{ 'dist/src/a.js': [['a', [0, 10, 1]]] }]);
    change?.(calls.length);
    return { status: 0, signal: null, output: [], pid: 0, stdout: null, stderr: null };
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  return calls;
}
test('Given a stable tree, when capture runs, then build precedes both unit parts and reimport retains the original commit', (t) => {
  const root = rootOf(t);
  const calls = runner(t, root);
  const result = collectCoverage(root, { commit: 'a'.repeat(40), noBuild: false });
  assert.deepEqual(calls.map((args) => args[0]), ['run', '--test', '--test']);
  assert.equal(result.provenance.status, 'verified');
  const imported = importedCoverage(root, { folder: result.folder, allowUnverified: false });
  assert.deepEqual(imported.provenance, result.provenance);
  assert.equal(imported.commit, 'a'.repeat(40));
});
for (const stage of [1, 2, 3]) {
  test(`Given input mutation at stage ${stage}, when capture runs, then it refuses publication`, (t) => {
    const root = rootOf(t);
    runner(t, root, (call) => { if (call === stage) writeFileSync(join(root, 'src/a.ts'), 'changed'); });
    assert.throws(() => collectCoverage(root, { commit: 'a'.repeat(40), noBuild: false }), /inputs changed/);
  });
}
test('Given changed emitted output, when --no-build reuses its manifest, then it rejects the stale build', (t) => {
  const root = rootOf(t);
  runner(t, root);
  collectCoverage(root, { commit: 'a'.repeat(40), noBuild: false });
  writeFileSync(join(root, 'dist/src/a.js'), 'changed');
  assert.throws(() => collectCoverage(root, { commit: 'a'.repeat(40), noBuild: true }), /build manifest/);
});

test('Given changed raw data after capture, when imported, then verification fails and explicit inspection retains the original evidence', (t) => {
  const root = rootOf(t);
  runner(t, root);
  const result = collectCoverage(root, { commit: 'a'.repeat(40), noBuild: false });
  const manifest = JSON.parse(readFileSync(join(result.folder, 'capture-manifest.json'), 'utf8'));
  writeV8Coverage(result.folder, root, [{ 'dist/src/a.js': [['a', [0, 10, 0]]] }]);
  assert.throws(() => importedCoverage(root, { folder: result.folder, allowUnverified: false }), /raw V8 data/);
  const inspected = importedCoverage(root, { folder: result.folder, allowUnverified: true });
  assert.equal(inspected.commit, 'a'.repeat(40));
  assert.deepEqual(inspected.provenance, { status: 'unverified', reason: 'Cannot verify the original capture manifest: The capture manifest does not match the raw V8 data.', original: manifest });
});
test('Given a valid build manifest, when --no-build captures again, then it skips build but runs both unit parts', (t) => {
  const root = rootOf(t);
  const calls = runner(t, root);
  collectCoverage(root, { commit: 'a'.repeat(40), noBuild: false });
  calls.length = 0;
  collectCoverage(root, { commit: 'b'.repeat(40), noBuild: true });
  assert.deepEqual(calls.map((args) => args[0]), ['--test', '--test']);
});

test('Given raw data changes while archived, when capture finishes, then no verified capture survives', (t) => {
  const root = rootOf(t);
  runner(t, root);
  const copy = fs.cpSync;
  t.mock.method(fs, 'cpSync', (source: string, destination: string, options: fs.CopySyncOptions) => {
    copy(source, destination, options);
    writeV8Coverage(source, root, [{ 'dist/src/a.js': [['a', [0, 10, 0]]] }]);
  });
  assert.throws(() => collectCoverage(root, { commit: 'a'.repeat(40), noBuild: false }), /Raw V8 data changed/);
  assert.deepEqual(fs.readdirSync(join(root, 'ast-report/coverage-captures')), []);
});

test('Given conflicting script evidence in a capture manifest, when inspection is explicit, then it labels the original evidence unverified', (t) => {
  const root = rootOf(t);
  runner(t, root);
  const result = collectCoverage(root, { commit: 'a'.repeat(40), noBuild: false });
  const file = join(result.folder, 'capture-manifest.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.scripts[0].contentIdentity = 'f'.repeat(64);
  writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => importedCoverage(root, { folder: result.folder, allowUnverified: false }), /identified scripts/);
  assert.equal(importedCoverage(root, { folder: result.folder, allowUnverified: true }).provenance.status, 'unverified');
});
