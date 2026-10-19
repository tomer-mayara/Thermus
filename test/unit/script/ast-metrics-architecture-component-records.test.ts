import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import type { MapSnapshot } from '../../../script/code-quality/architecture/types.ts';

const folder = new URL('architecture/', pathToFileURL(astMetricsArchitectureScript));
const { trendRecordsOf } = await import(new URL('trend-record.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-record.ts');
const { validTrendRecord } = await import(new URL('trend-validation.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-validation.ts');

const provenance = {
  status: 'verified', capturedCommit: 'a'.repeat(40), sourceFingerprint: 'b'.repeat(64), inputsFingerprint: 'c'.repeat(64),
  buildFingerprint: 'd'.repeat(64), runtime: 'node-test', compiler: 'typescript-test', measurementVersion: 'own-characters-1',
  suite: 'unit', captureManifestFingerprint: 'e'.repeat(64),
} as const;
const snapshot: MapSnapshot = {
  commit: 'a'.repeat(40), date: '2026-10-19T00:00:00Z',
  global: { modularity: 0, crossShare: 0, cycles: [], files: 2, functions: 2, paths: 4 }, communities: [],
  files: [{ path: 'src/mcp/a.ts', loc: 10, paths: 2, maintainability: 80 }, { path: 'src/auth/b.ts', loc: 30, paths: 2, maintainability: 60 }],
};
const files = new Map([
  ['src/mcp/a.ts', { functions: [], unmatched: 2 }], ['src/auth/b.ts', { functions: [], unmatched: 1 }],
]);
const delta = { base: files, head: files, unknownIdentity: 0 };

test('Given stable component metrics and verified coverage, when records form, then sorted components retain individual count provenance and unknown counts', () => {
  const { base, head } = trendRecordsOf({ base: snapshot, head: snapshot, touched: [], coverage: { files: [], provenance } }, delta);
  assert.deepEqual(head.components?.map(({ name }) => name), ['auth', 'mcp']);
  assert.deepEqual(head.components?.map(({ crap }) => crap?.unknownFunctions), [1, 2]);
  assert.equal(head.components?.[0].crap?.kind, 'measured');
  assert.equal(base.components?.[0].crap?.kind, 'head-derived-estimate');
  assert.equal(head.components?.[0].functionsOver30, 0);
  assert.equal(head.components?.[0].loc, 30);
  assert.ok(validTrendRecord(JSON.parse(JSON.stringify(head))));
});

test('Given unverified coverage or an absent CRAP file, when records form, then component count provenance is absent rather than a fabricated zero', () => {
  const unverified = trendRecordsOf({ base: snapshot, head: snapshot, touched: [] }, delta).head;
  assert.equal(unverified.components?.[0].functionsOver30, undefined);
  const missing = trendRecordsOf({ base: snapshot, head: snapshot, touched: [], coverage: { files: [], provenance } }, { ...delta, head: new Map() }).head;
  assert.equal(missing.components?.[0].functionsOver30, undefined);
  assert.equal(missing.components?.[0].crap, undefined);
});

test('Given legacy files without LOC, when records form, then the whole component field stays absent', () => {
  const legacy = { ...snapshot, files: snapshot.files.map(({ loc: _loc, ...file }) => file) };
  assert.equal(trendRecordsOf({ base: legacy, head: legacy, touched: [] }, undefined).head.components, undefined);
});

for (const components of [[{ name: 'auth', files: 1, loc: 1, paths: 0, functionsOver30: 1 }], null, {}, [{ name: 'auth', files: 1, loc: -1, paths: 0 }], [{ name: '', files: 1, loc: 1, paths: 0 }], [{ name: 'auth', files: 1, loc: 1, paths: 0, crap: {} }], [{ name: 'auth', files: 1, loc: 1, paths: 0, functionsOver30: -1 }]]) {
  test('Given malformed new components, when the record validates, then it is rejected', () => {
    const record = trendRecordsOf({ base: snapshot, head: snapshot, touched: [] }, undefined).head;
    assert.equal(validTrendRecord(JSON.parse(JSON.stringify({ ...record, components }))), false);
  });
}
