import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { MapCommunity, MapSnapshot, MapSources, TableFile } from '../../../script/code-quality/architecture/types.ts';
import { completeSourceEvidence, functionIdentityOf } from '../../support/fixtures/ast-metrics-function-identity.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const folder = pathToFileURL(astMetricsArchitectureScript);
const { crapDeltaOf } = await import(new URL('architecture/crap-delta.ts', folder).href) as typeof import('../../../script/code-quality/architecture/crap-delta.ts');
const { architectureReportOf } = await import(new URL('architecture/report.ts', folder).href) as typeof import('../../../script/code-quality/architecture/report.ts');
const { trendRecordsOf } = await import(new URL('architecture/trend-record.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-record.ts');

function fileOf(path: string, functions: readonly (readonly [string, number])[]): TableFile {
  return { path, sourceEvidence: completeSourceEvidence, paths: 40, functions: functions.map(([name, paths]) => ({ name, paths, identity: functionIdentityOf(name, paths) })) };
}

function snapshotOf(files: readonly TableFile[]): MapSnapshot {
  const communities: MapCommunity[] = files.map(({ path }, index) => ({ id: String(index), label: path, members: [path], files: 1, loc: 10, paths: 40, edges: [] }));
  return { commit: 'a'.repeat(40), date: '2026-10-18', communities, files, global: { modularity: 0.5, crossShare: 0.2, cycles: [], files: files.length, functions: files.reduce((sum, file) => sum + (file.functions?.length ?? 0), 0), paths: files.length * 40 } };
}

function sourcesOf(base: readonly TableFile[], head = base): MapSources {
  return { base: snapshotOf(base), head: snapshotOf(head), touched: head.map(({ path }) => path), coverage: { files: head.map(({ path }) => ({ path, functions: [] })) } };
}

test('Given unknown functions below 30, when communities are rendered, then head and gone base show incomplete counts without a good band', () => {
  const sources = sourcesOf([fileOf('src/gone.ts', [['old', 5]])], [fileOf('src/head.ts', [['(anonymous)', 5]])]);
  const report = architectureReportOf(sources, crapDeltaOf(sources));

  assert.equal(report.includes('● good'), true, 'The legend still defines the existing good band.');
  assert.equal(report.includes('classDef good'), false);
  assert.equal(report.split('## Components of src/')[0].split('\n').filter((line) => line.includes('assessment incomplete: 1 unknown; 0 known fn ≥ 30')).length, 2);
});

test('Given both duplicate and anonymous lower bounds, when risk is counted, then each counts once and neither identity is guessed', () => {
  const files = [fileOf('src/a.ts', [['duplicate', 30], ['duplicate', 35], ['(anonymous)', 40], ['(anonymous)', 45]])];
  const sources = sourcesOf([], files);
  const delta = crapDeltaOf(sources);
  const functions = delta?.head.get('src/a.ts')?.functions;

  assert.equal(functions?.length, 4);
  assert.deepEqual(functions?.map(({ base, addedOrWorse, classification }) => ({ base, addedOrWorse, classification })), Array.from({ length: 4 }, () => ({ base: undefined, addedOrWorse: false, classification: 'unknown' })));
  const report = architectureReportOf(sources, delta);
  assert.ok(report.includes('functions ≥ 30: 0 → 4'), report);
  assert.ok(report.includes('▲ warning: 4 fn ≥ 30; assessment incomplete: 4 unknown'), report);
});

test('Given a proven new named lower bound with an unknown small function, when rendered, then its band is critical with an incomplete count', () => {
  const sources = sourcesOf([], [fileOf('src/new.ts', [['fresh', 30], ['(anonymous)', 5]])]);
  const report = architectureReportOf(sources, crapDeltaOf(sources));

  assert.ok(report.includes('■ critical: 1 fn ≥ 30; assessment incomplete: 2 unknown'), report);
  assert.ok(report.includes('`fresh`: paths 30, covered unknown, CRAP ≥ 30 (base new)'), report);
});

test('Given unsorted changed files and unmeasured functions, when rendered, then the list includes every function at five paths or more in path and name order', () => {
  const sources = sourcesOf([], [fileOf('src/z.ts', [['zed', 6], ['tiny', 4]]), fileOf('src/a.ts', [['zulu', 30], ['(anonymous)', 5], ['alpha', 9]])]);
  const report = architectureReportOf(sources, crapDeltaOf(sources));
  const listed = report.slice(report.indexOf('Unmatched functions:')).split('\n').filter((line) => line.startsWith('- '));

  assert.deepEqual(listed, [
    '- `src/a.ts` `(anonymous)`: paths 5, covered unknown, CRAP ≥ 5',
    '- `src/a.ts` `alpha`: paths 9, covered unknown, CRAP ≥ 9',
    '- `src/a.ts` `zulu`: paths 30, covered unknown, CRAP ≥ 30',
    '- `src/z.ts` `zed`: paths 6, covered unknown, CRAP ≥ 6',
  ]);
});

test('Given unmatched lower bounds and verified coverage, when trend records are made, then known violations keep their unknown-share count', () => {
  const sources = sourcesOf([fileOf('src/a.ts', [['refresh', 30], ['(anonymous)', 5]])]);
  const provenance = { status: 'verified', capturedCommit: 'a'.repeat(40), sourceFingerprint: 'b'.repeat(64), inputsFingerprint: 'c'.repeat(64), buildFingerprint: 'd'.repeat(64), captureManifestFingerprint: 'e'.repeat(64), runtime: 'node:test', compiler: 'typescript:test', measurementVersion: 'own-characters-1', suite: 'unit' } as const;
  const coverage = sources.coverage;
  assert.ok(coverage);
  const measured = { ...sources, coverage: { ...coverage, provenance } };
  const records = trendRecordsOf(measured, crapDeltaOf(measured));

  for (const record of [records.base, records.head]) {
    assert.equal(record.functionsOver30, 1);
    assert.equal(record.communities[0].functionsOver30, 1);
    assert.equal(record.crap?.unknownFunctions, 2);
  }
});

test('Given a file without function metrics, when its community is rendered, then assessment is incomplete without a guessed function count or good band', () => {
  const sources = sourcesOf([{ path: 'src/unknown.ts' }]);
  const report = architectureReportOf(sources, crapDeltaOf(sources));

  assert.ok(report.includes('assessment incomplete: 1 unmeasured file; 0 known fn ≥ 30'), report);
  assert.equal(report.includes('classDef good'), false);
});
