import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const { snapshotInFile } = await import(new URL('architecture/file.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/file.ts');
const pair = { from: 'src/a.ts', to: 'src/b.ts', kinds: ['static'] };
const evidence = { version: 1, pairs: [pair], issues: [] };
const snapshot = (dependencies: unknown) => ({ version: 1, commit: 'a', date: '2026-10-18T00:00:00Z', global: { modularity: 0, crossShare: 0, cycles: [], paths: 1, files: 2, functions: 0 }, communities: [], files: [{ path: 'src/a.ts', loc: 5 }, { path: 'src/b.ts', loc: 3 }], dependencies });

test('Given offline dependency evidence, when read, then dependencies and optional LOC survive without caller sources', (t) => {
  const path = join(dataDirectory(t), 'snapshot.json');
  writeFileSync(path, JSON.stringify(snapshot(evidence)));
  const result = snapshotInFile(path);
  assert.deepEqual(result.dependencies, evidence);
  assert.equal(result.files[0]?.loc, 5);
});

test('Given legacy snapshots, when read, then missing dependencies stay absent', (t) => {
  const path = join(dataDirectory(t), 'snapshot.json');
  writeFileSync(path, JSON.stringify(snapshot(undefined)));
  assert.equal(snapshotInFile(path).dependencies, undefined);
});

for (const dependencies of [
  null, [], {}, { ...evidence, version: 2 }, { ...evidence, pairs: null }, { ...evidence, issues: {} },
  { ...evidence, pairs: [{ ...pair, from: 'src/../a.ts' }] },
  { ...evidence, pairs: [{ ...pair, to: 'src/absent.ts' }] },
  { ...evidence, pairs: [{ ...pair, to: 'outside.ts' }] },
  { ...evidence, pairs: [{ ...pair, from: 'src\\a.ts' }] },
  { ...evidence, pairs: [{ ...pair, kinds: [] }] },
  { ...evidence, pairs: [{ ...pair, kinds: ['static', 'static'] }] },
  { ...evidence, pairs: [{ ...pair, kinds: ['runtime'] }] },
  { ...evidence, pairs: [pair, pair] },
  { ...evidence, issues: [{ path: 'src/a.ts', reason: 'parse-error' }, { path: 'src/a.ts', reason: 'parse-error' }] },
  { ...evidence, issues: [{ path: 'src/missing.ts', reason: 'parse-error' }] },
  { ...evidence, issues: [{ path: 'src/a.ts', reason: 'other' }] },
  { ...evidence, issues: [{ path: 'src/a.ts', reason: 'unresolved-local' }] },
  { ...evidence, issues: [{ path: 'src/a.ts', reason: 'non-literal-dynamic', specifier: 1 }] },
]) {
  test(`Given malformed dependency evidence ${JSON.stringify(dependencies)}, when read, then it is rejected`, (t) => {
    const path = join(dataDirectory(t), 'snapshot.json');
    writeFileSync(path, JSON.stringify(snapshot(dependencies)));
    assert.throws(() => snapshotInFile(path));
  });
}
