import type { MapCommunity as Community, MapSnapshot as Snapshot } from '../../../script/code-quality/architecture/types.ts';
import type { CoverageReport as Coverage } from '../../../script/code-quality/architecture/coverage.ts';
import type { CrapDelta } from '../../../script/code-quality/architecture/crap-delta.ts';
import type { TrendNumbers } from '../../../script/code-quality/architecture/trend-record.ts';
import type { VerifiedCoverageProvenance } from '../../../script/code-quality/provenance/types.ts';
import { functionIdentityOf } from '../../support/fixtures/ast-metrics-function-identity.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// These pure cases check the trend record and the trend section after the complexity table.
// Load the source modules next to the command, as the command does.
// ast-metrics-architecture-trend-store.test.ts covers the store.
const scriptFolder = pathToFileURL(astMetricsArchitectureScript);
const { trendRecordsOf } = await import(new URL('architecture/trend-record.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/trend-record.ts');
const { crapDeltaOf } = await import(new URL('architecture/crap-delta.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/crap-delta.ts');
const { trendSectionOf } = await import(new URL('architecture/trend-table.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/trend-table.ts');

// The id is the label, and each file has 40 lines.
function community(label: string, members: readonly string[], maintainability?: number): Community {
  return { id: label, label, members, files: members.length, loc: 40 * members.length, maintainability, paths: 12, edges: [{ to: 'alpha', references: 3, inCycle: true }] };
}

// The communities come in the order zulu, alpha, so that the record has to sort them. src/z/two.ts is not in the
// coverage, so its function counts as uncovered.
const snapshot: Snapshot = {
  commit: 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00',
  date: '2026-10-18T09:00:00+02:00',
  global: { modularity: 0.47, crossShare: 0.31, cycles: [['alpha', 'zulu'], ['alpha', 'beta']], maintainability: 64.2, paths: 30, files: 2, functions: 3 },
  communities: [community('zulu', ['src/z/two.ts'], 70.5), community('alpha', ['src/a/one.ts'], 58.1)],
  files: [
    { path: 'src/a/one.ts', maintainability: 58.1, paths: 12, functions: [{ name: 'run', paths: 10, identity: functionIdentityOf('run', 10) }, { name: 'helper', paths: 2, identity: functionIdentityOf('helper', 2) }] },
    { path: 'src/z/two.ts', maintainability: 70.5, paths: 18, functions: [{ name: 'big', paths: 6, identity: functionIdentityOf('big', 6) }] },
  ],
};

// run has 10 decision paths and the share 0: CRAP 110. helper has full coverage: CRAP 2. big is uncovered: CRAP 42.
const coverage: Coverage = { files: [{ path: 'src/a/one.ts', functions: [{ name: 'run', coveredShare: 0 }, { name: 'helper', coveredShare: 1 }] }] };

function crapOf(tree: Snapshot): CrapDelta {
  const delta = crapDeltaOf({ base: tree, head: tree, touched: [], coverage });
  assert.ok(delta !== undefined);
  return delta;
}

const provenance: VerifiedCoverageProvenance = { status: 'verified', capturedCommit: 'a'.repeat(40), sourceFingerprint: 'b'.repeat(64), inputsFingerprint: 'c'.repeat(64), buildFingerprint: 'd'.repeat(64), measurementVersion: 'own-characters-1', runtime: 'node-24', compiler: 'typescript', suite: 'unit', captureManifestFingerprint: 'e'.repeat(64) };
const crapBasis = { kind: 'head-derived-estimate', coverageCommit: provenance.capturedCommit, sourceFingerprint: provenance.sourceFingerprint, inputsFingerprint: provenance.inputsFingerprint, buildFingerprint: provenance.buildFingerprint, measurementVersion: provenance.measurementVersion, unknownFunctions: 0 };

test('Given a snapshot and the CRAP of its files, when the record is made, then it holds, in this order, the version, the commit, the date, the global numbers with the count of the cycles and the count of the functions at CRAP 30 or more, and each community sorted by label with its numbers and its count, and nothing for each file', () => {
  const crap = crapOf(snapshot);
  const record = trendRecordsOf({ base: snapshot, head: snapshot, touched: [], coverage: { ...coverage, provenance } }, crap).base;

  assert.equal(JSON.stringify(record), JSON.stringify({
    version: 1, commit: 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00', date: '2026-10-18T09:00:00+02:00',
    modularity: 0.47, crossShare: 0.31, cycles: 2, maintainability: 64.2, paths: 30, files: 2, functions: 3, functionsOver30: 2,
    communities: [
      { label: 'alpha', files: 1, loc: 40, maintainability: 58.1, paths: 12, functionsOver30: 1 },
      { label: 'zulu', files: 1, loc: 40, maintainability: 70.5, paths: 12, functionsOver30: 1 },
    ],
    crap: crapBasis,
  }));
});

test('Given no CRAP, and a snapshot and a community without maintainability, when the record is made, then the record and its communities have no count of the functions at CRAP 30 or more, and neither has a maintainability', () => {
  const plain: Snapshot = { ...snapshot, global: { ...snapshot.global, maintainability: undefined }, communities: [community('types', ['src/types.d.ts'])] };

  const record = trendRecordsOf({ base: plain, head: plain, touched: [] }, undefined).base;

  assert.equal(JSON.stringify(record), JSON.stringify({
    version: 1, commit: 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00', date: '2026-10-18T09:00:00+02:00',
    modularity: 0.47, crossShare: 0.31, cycles: 2, paths: 30, files: 2, functions: 3,
    communities: [{ label: 'types', files: 1, loc: 40, paths: 12 }],
  }));
});

const head: TrendNumbers = { commit: 'feed0000feed0000', date: '2026-10-19T10:00:00+02:00', modularity: 0.5, crossShare: 0.25, cycles: 3, maintainability: 57, functionsOver30: 22 };

test('Given two stored records and the head, when the trend section is made, then it has the heading and the table with one row for each record, with the first eight characters of its commit and the day of its date, and the head last as this pull request, without a date', () => {
  const stored: TrendNumbers[] = [
    { commit: '1a2b3c4d5e6f7a8b', date: '2026-10-12T23:30:00-06:00', modularity: 0.52, crossShare: 0.26, cycles: 1, maintainability: 57.4, functionsOver30: 20 },
    { commit: '8437236c9d0e1f2a', date: '2026-10-18T09:00:00+02:00', modularity: 0.55, crossShare: 0.25, cycles: 2, maintainability: 56.94, functionsOver30: 22 },
  ];

  assert.deepEqual(trendSectionOf(stored, head).slice(0, 7), [
    '## Trend of src/ on main',
    '',
    '| Commit | PR | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 1a2b3c4d | – | 2026-10-12 | 0.52 | 0.26 | 1 | 57.4 | 20 (legacy unknown) |',
    '| 8437236c | – | 2026-10-18 | 0.55 | 0.25 | 2 | 56.9 | 22 (legacy unknown) |',
    '| this pull request | – | | 0.50 | 0.25 | 3 | 57.0 | 22 (legacy unknown) |',
  ]);
});

test('Given a stored record and a head without maintainability and without the count of the functions at CRAP 30 or more, when the trend section is made, then each of those cells has an en dash', () => {
  const stored: TrendNumbers = { commit: '1a2b3c4d5e6f7a8b', date: '2026-10-12T12:00:00+02:00', modularity: 0.52, crossShare: 0.26, cycles: 0 };

  assert.deepEqual(trendSectionOf([stored], { ...head, maintainability: undefined, functionsOver30: undefined }).filter((line) => line.startsWith('|')).slice(-2), [
    '| 1a2b3c4d | – | 2026-10-12 | 0.52 | 0.26 | 0 | – | – |',
    '| this pull request | – | | 0.50 | 0.25 | 3 | – | – |',
  ]);
});

test('Given an empty trend store, when the trend section is made, then it names the empty store and has no table or row of the head', () => {
  assert.deepEqual(trendSectionOf([], head), ['## Trend of src/ on main', '', 'No snapshot of main in the trend store yet.']);
});
