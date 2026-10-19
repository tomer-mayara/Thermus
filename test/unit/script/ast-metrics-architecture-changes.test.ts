import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { changesInFile } from '../../../script/code-quality/architecture/changes.ts';
import { commandOf } from '../../../script/code-quality/architecture/command-line.ts';
import { mapSourcesOf } from '../../../script/code-quality/architecture/input.ts';
import type { MapSnapshot } from '../../../script/code-quality/architecture/types.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';

const identity = { sourceFingerprint: 'a'.repeat(64), inputsFingerprint: 'b'.repeat(64), runtime: 'node:test', compiler: 'typescript:test', measurementVersion: 'own-characters-1', suite: 'unit' } as const;
function snapshot(commit: string, sourceFingerprint: string, paths: readonly string[]): MapSnapshot {
  return { commit, provenance: { ...identity, sourceFingerprint }, date: '2026-10-18T00:00:00Z', communities: [],
    global: { modularity: 0, crossShare: 0, cycles: [], paths: 0, files: paths.length, functions: 0 },
    files: paths.map((path) => ({ path, maintainability: undefined, risk: undefined })),
  };
}
const base = snapshot('1'.repeat(40), identity.sourceFingerprint, ['src/old.ts', 'src/edit.ts', 'src/delete.ts']);
const head = snapshot('2'.repeat(40), 'c'.repeat(64), ['src/new.ts', 'src/edit.ts', 'src/add.ts']);
const metadata = { version: 1, base: { commit: base.commit, sourceFingerprint: identity.sourceFingerprint }, head: { commit: head.commit, sourceFingerprint: 'c'.repeat(64) }, files: [
  { status: 'R', oldPath: 'src/old.ts', path: 'src/new.ts' }, { status: 'M', path: 'src/edit.ts' }, { status: 'D', path: 'src/delete.ts' }, { status: 'A', path: 'src/add.ts' },
] };

function fileOf(t: TestContext, value: unknown): string {
  const path = join(dataDirectory(t), 'changes.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
}

test('Given valid change metadata, when it is read, then each status and rename endpoint stays available', (t) => {
  assert.deepEqual(changesInFile(fileOf(t, metadata), base, head), metadata.files);
});

for (const [name, value] of [
  ['wrong version', { ...metadata, version: 2 }],
  ['wrong base commit', { ...metadata, base: { ...metadata.base, commit: head.commit } }],
  ['same commit with wrong head content', { ...metadata, head: { ...metadata.head, sourceFingerprint: 'd'.repeat(64) } }],
  ['path outside src', { ...metadata, files: [{ status: 'A', path: 'test/add.ts' }] }],
  ['path traversal', { ...metadata, files: [{ status: 'A', path: 'src/../add.ts' }] }],
  ['unsupported extension', { ...metadata, files: [{ status: 'A', path: 'src/add.js' }] }],
  ['missing rename predecessor', { ...metadata, files: [{ status: 'R', path: 'src/new.ts' }] }],
  ['conflicting predecessor', { ...metadata, files: [...metadata.files, { status: 'R', oldPath: 'src/old.ts', path: 'src/add.ts' }] }],
  ['addition present in base', { ...metadata, files: [{ status: 'A', path: 'src/edit.ts' }] }],
  ['deletion present in head', { ...metadata, files: [{ status: 'D', path: 'src/edit.ts' }] }],
  ['modification missing in head', { ...metadata, files: [{ status: 'M', path: 'src/delete.ts' }] }],
  ['rename into an existing base path', { ...metadata, files: [{ status: 'R', oldPath: 'src/old.ts', path: 'src/edit.ts' }] }],
] as const) {
  test(`Given change metadata with ${name}, when it is read, then it rejects invalid evidence`, (t) => {
    assert.throws(() => changesInFile(fileOf(t, value), base, head), /change|identit|snapshot/i);
  });
}

test('Given a legacy snapshot without a content fingerprint, when offline changes are supplied, then commit equality cannot validate them', (t) => {
  assert.throws(() => changesInFile(fileOf(t, metadata), { ...base, provenance: undefined }, head), /identit|provenance/i);
});

test('Given --changes in repository mode or an empty file value, when options are read, then it fails before Git can run', () => {
  assert.throws(() => commandOf(['--changes', 'changes.json']), /--changes.*--head/);
  assert.throws(() => commandOf(['--changes=']), /--changes value/);
});

test('Given offline rename evidence and a path-only override, when sources are read, then evidence stays independent of the touched selection', async (t) => {
  const changes = fileOf(t, metadata);
  const folder = dataDirectory(t);
  const before = join(folder, 'base.json');
  const after = join(folder, 'head.json');
  writeFileSync(before, JSON.stringify({ version: 1, ...base }));
  writeFileSync(after, JSON.stringify({ version: 1, ...head }));
  const command = commandOf(['--head', after, '--base-snapshot', before, '--changes', changes, '--no-coverage']);
  assert.equal(command.kind, 'report');
  if (command.kind !== 'report') return;
  const defaults = await mapSourcesOf(command);
  assert.deepEqual(defaults.touched, ['src/add.ts', 'src/delete.ts', 'src/edit.ts', 'src/new.ts', 'src/old.ts']);
  const selected = await mapSourcesOf({ ...command, touched: ['src/edit.ts'] });
  assert.deepEqual(selected.touched, ['src/edit.ts']);
  assert.deepEqual(selected.changes, metadata.files);
});
