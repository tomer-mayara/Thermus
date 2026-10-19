import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const { snapshotInFile } = await import(new URL('architecture/file.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/file.ts');
const identity = { version: 'typescript-tokens-v1', kind: 'FunctionDeclaration', owner: '', name: 'sample', start: 0, end: 30, body: 'a'.repeat(64), signature: 'b'.repeat(64) };
const sourceEvidence = { version: 'typescript-tokens-v1', coordinates: 'utf16', complete: true };
const snapshot = (file: object) => ({ version: 1, commit: 'a'.repeat(40), date: '2026-10-18T00:00:00Z', global: { modularity: 0, crossShare: 0, cycles: [], paths: 1, files: 1, functions: 1 }, communities: [], files: [{ path: 'src/not-in-this-checkout.ts', functions: [{ name: 'sample', paths: 1, identity }], sourceEvidence, ...file }] });

test('Given an offline snapshot with source evidence, when read, then its optional identity is preserved without reading a checkout', (t) => {
  const path = join(dataDirectory(t), 'snapshot.json');
  writeFileSync(path, JSON.stringify(snapshot({})));
  const result = snapshotInFile(path).files[0];
  assert.deepEqual(result?.sourceEvidence, sourceEvidence);
  assert.deepEqual(result?.functions?.[0]?.identity, identity);
});

for (const change of [
  { version: 'old' }, { kind: '' }, { owner: null }, { name: '' }, { name: '(anonymous)' },
  { start: -1 }, { start: 0.5 }, { end: 0 }, { body: 'no hash' }, { signature: undefined },
]) {
  test(`Given malformed optional identity ${JSON.stringify(change)}, when an offline snapshot is read, then it fails`, (t) => {
    const path = join(dataDirectory(t), 'snapshot.json');
    writeFileSync(path, JSON.stringify(snapshot({ functions: [{ name: 'sample', paths: 1, identity: { ...identity, ...change } }] })));
    assert.throws(() => snapshotInFile(path));
  });
}

for (const invalid of [null, [], {}, { ...sourceEvidence, complete: 'yes' }, { ...sourceEvidence, coordinates: 'bytes' }, { ...sourceEvidence, version: 'old' }]) {
  test(`Given malformed source evidence ${JSON.stringify(invalid)}, when an offline snapshot is read, then it fails`, (t) => {
    const path = join(dataDirectory(t), 'snapshot.json');
    writeFileSync(path, JSON.stringify(snapshot({ sourceEvidence: invalid })));
    assert.throws(() => snapshotInFile(path));
  });
}

test('Given complete evidence with an unknown function, when an offline snapshot is read, then it fails', (t) => {
  const path = join(dataDirectory(t), 'snapshot.json');
  writeFileSync(path, JSON.stringify(snapshot({ functions: [{ name: '(anonymous)', paths: 1 }] })));
  assert.throws(() => snapshotInFile(path));
});

for (const functions of [undefined, 'missing', [{ name: 'sample', paths: 1, identity }, { name: 'other', paths: 1, identity }]]) {
  test(`Given complete evidence with missing or repeated declarations ${JSON.stringify(functions)}, when an offline snapshot is read, then it fails`, (t) => {
    const path = join(dataDirectory(t), 'snapshot.json');
    writeFileSync(path, JSON.stringify(snapshot({ functions })));
    assert.throws(() => snapshotInFile(path));
  });
}

for (const complete of [true, false]) {
  test(`Given an identity attached to an unrelated metric with complete ${complete}, when an offline snapshot is read, then it fails`, (t) => {
    const path = join(dataDirectory(t), 'snapshot.json');
    writeFileSync(path, JSON.stringify(snapshot({ sourceEvidence: { ...sourceEvidence, complete }, functions: [{ name: 'unrelated', paths: 1, identity }] })));
    assert.throws(() => snapshotInFile(path));
  });
}

test('Given duplicate identity ranges with incomplete metadata, when an offline snapshot is read, then it fails', (t) => {
  const path = join(dataDirectory(t), 'snapshot.json');
  const other = { ...identity, name: 'other' };
  writeFileSync(path, JSON.stringify(snapshot({ sourceEvidence: { ...sourceEvidence, complete: false }, functions: [{ name: 'sample', paths: 1, identity }, { name: 'other', paths: 1, identity: other }] })));
  assert.throws(() => snapshotInFile(path));
});

test('Given a class-qualified metric and matching lexical owner, when an offline snapshot is read, then its identity is accepted', (t) => {
  const path = join(dataDirectory(t), 'snapshot.json');
  const method = { ...identity, kind: 'MethodDeclaration', owner: 'ClassDeclaration:Store' };
  writeFileSync(path, JSON.stringify(snapshot({ functions: [{ name: 'module\\Store.sample', paths: 1, identity: method }] })));
  assert.deepEqual(snapshotInFile(path).files[0]?.functions?.[0]?.identity, method);
});
