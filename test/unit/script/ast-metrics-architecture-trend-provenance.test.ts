import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const folder = new URL('architecture/', pathToFileURL(astMetricsArchitectureScript));
const { trendSectionOf } = await import(new URL('trend-table.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-table.ts');
const { trendNumbersInFile } = await import(new URL('trend-file.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-file.ts');
const measured = {
  kind: 'measured', coverageCommit: 'a'.repeat(40), sourceFingerprint: 'b'.repeat(64),
  inputsFingerprint: 'c'.repeat(64), buildFingerprint: 'd'.repeat(64),
  measurementVersion: 'own-characters-1', unknownFunctions: 3,
} as const;
const numbers = { commit: 'a'.repeat(40), date: '2026-10-18T09:00:00+02:00', modularity: 0.5, crossShare: 0.2, cycles: 0, paths: 30, files: 2, functions: 20, communities: [], functionsOver30: 17 };

test('Given measured, estimated, legacy, and absent counts, when the trend renders, then its cells state their basis', () => {
  const rows = trendSectionOf([
    { ...numbers, crap: { ...measured, kind: 'head-derived-estimate' } }, numbers,
    { ...numbers, functionsOver30: undefined },
  ], { ...numbers, crap: measured });
  assert.ok(rows.includes('| aaaaaaaa | – | 2026-10-18 | 0.50 | 0.20 | 0 | – | 17 (estimate) |'));
  assert.ok(rows.includes('| aaaaaaaa | – | 2026-10-18 | 0.50 | 0.20 | 0 | – | 17 (legacy unknown) |'));
  assert.ok(rows.includes('| aaaaaaaa | – | 2026-10-18 | 0.50 | 0.20 | 0 | – | – |'));
  assert.ok(rows.includes('| this pull request | – | | 0.50 | 0.20 | 0 | – | 17 (measured) |'));
  assert.match(rows.join('\n'), /first recording pull request/);
});

for (const crap of [{ ...measured, unknownFunctions: -1 }, { ...measured, kind: 'base-measured' }, { ...measured, sourceFingerprint: 'bad' }]) {
  test('Given invalid count provenance, when a trend file is read, then it fails', (t) => {
    const path = join(dataDirectory(t), 'record.json');
    writeFileSync(path, JSON.stringify({ ...numbers, version: 1, crap }));
    assert.throws(() => trendNumbersInFile(path), /not a valid trend file/);
  });
}

test('Given valid count provenance, when a trend file is read, then the basis is retained', (t) => {
  const path = join(dataDirectory(t), 'record.json');
  writeFileSync(path, JSON.stringify({ ...numbers, version: 1, crap: measured }));
  assert.deepEqual(trendNumbersInFile(path).crap, measured);
});

const { trendRecordsOf } = await import(new URL('trend-record.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-record.ts');
const provenance = {
  status: 'verified', capturedCommit: measured.coverageCommit, sourceFingerprint: measured.sourceFingerprint,
  inputsFingerprint: measured.inputsFingerprint, buildFingerprint: measured.buildFingerprint,
  runtime: 'node-test', compiler: 'typescript-test', measurementVersion: 'own-characters-1',
  suite: 'unit', captureManifestFingerprint: 'e'.repeat(64),
} as const;
const snapshot = {
  commit: 'a'.repeat(40), date: '2026-10-18T09:00:00+02:00', provenance,
  global: { modularity: 0.5, crossShare: 0.2, cycles: [], files: 2, functions: 3, paths: 6 },
  files: [], communities: [],
};
const unknownFiles = new Map([
  ['src/first.ts', { functions: [], unmatched: 1 }],
  ['src/second.ts', { functions: [], unmatched: 2 }],
]);

test('Given verified coverage with unmatched functions, when base and head records are made, then both retain the total unknown count and their distinct basis', () => {
  const { base, head } = trendRecordsOf(
    { base: snapshot, head: snapshot, touched: [], coverage: { files: [], provenance } },
    { base: unknownFiles, head: unknownFiles, unknownIdentity: 0 },
  );
  assert.equal(base.crap?.unknownFunctions, 3);
  assert.equal(base.crap?.kind, 'head-derived-estimate');
  assert.equal(head.crap?.unknownFunctions, 3);
  assert.equal(head.crap?.kind, 'measured');
  assert.equal(head.functionsOver30, 0);
});

test('Given CRAP values without verified coverage, when a record is made, then coverage counts and basis stay absent', () => {
  const record = JSON.parse(JSON.stringify(trendRecordsOf(
    { base: snapshot, head: snapshot, touched: [] }, { base: unknownFiles, head: unknownFiles, unknownIdentity: 0 },
  ).base));
  assert.equal('functionsOver30' in record, false);
  assert.equal('crap' in record, false);
});

for (const [description, tool, hasTool] of [
  ['tool version 9.8.7', '9.8.7', true],
  ['no tool version', undefined, false],
] as const) {
  test(`Given a trend record with ${description}, when its table numbers are read, then the optional version is preserved`, (t) => {
    const path = join(dataDirectory(t), 'record.json');
    writeFileSync(path, JSON.stringify({ ...numbers, version: 1, tool }));
    const result = trendNumbersInFile(path);
    assert.equal(result.tool, tool);
    assert.equal('tool' in result, hasTool);
  });
}
