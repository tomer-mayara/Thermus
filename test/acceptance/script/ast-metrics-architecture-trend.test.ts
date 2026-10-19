import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { coverageArguments, bandedBase, unitCoverage } from './fixtures/ast-metrics-architecture-coverage.ts';
import { test } from 'node:test';
import { currentSourceFingerprint, recordNames, recordText, runTrend, runTrendWithoutTools, storeRecord, trendRepository } from './fixtures/ast-metrics-trend-safety.ts';

const timeout = 20_000;

test('Given snapshot files and an empty store, when architecture runs without --record, then the store stays empty', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  const result = await runTrend(t, fixture);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(recordNames(fixture), []);
  assert.match(result.stdout, /No snapshot of main in the trend store yet/);
});

test('Given a verified ancestor snapshot, when --record runs twice, then one immutable record is kept', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  const first = await runTrend(t, fixture, ['--record']);
  assert.equal(first.stderr, '');
  assert.equal(first.code, 0);
  const original = recordText(fixture);
  const second = await runTrend(t, fixture, ['--record']);
  assert.equal(second.code, 0);
  assert.equal(recordNames(fixture).length, 1);
  assert.equal(recordText(fixture), original);
  assert.equal(JSON.parse(original).sourceFingerprint, fixture.snapshot.provenance.sourceFingerprint);
  assert.equal(JSON.parse(original).functionsOver30, undefined);
});

test('Given a feature commit outside origin/main, when --record runs, then it explains the refusal and renders existing history', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  storeRecord(fixture, { functionsOver30: 22 });
  fixture.repository.commit('Feature', { 'src/example.ts': 'export const example = 2;\n' });
  const snapshot = { ...fixture.snapshot, commit: fixture.repository.git('rev-parse', 'HEAD').trim(), date: fixture.repository.git('show', '-s', '--format=%cI', 'HEAD').trim() };
  const result = await runTrend(t, { ...fixture, snapshot }, ['--record']);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, `No record: ${snapshot.commit.slice(0, 8)} is not on origin/main.\n`);
  assert.match(result.stdout, /22 \(legacy unknown\)/);
  assert.equal(recordNames(fixture).length, 1);
});

for (const condition of ['missing main', 'missing commit', 'short commit', 'missing provenance', 'wrong source', 'wrong date'] as const) {
  test(`Given ${condition}, when offline --record runs, then no record is written`, { timeout }, async (t) => {
    const fixture = trendRepository(t);
    let snapshot: object = fixture.snapshot;
    if (condition === 'missing main') fixture.repository.git('update-ref', '-d', 'refs/remotes/origin/main');
    if (condition === 'missing commit') snapshot = { ...fixture.snapshot, commit: 'f'.repeat(40) };
    if (condition === 'short commit') snapshot = { ...fixture.snapshot, commit: fixture.snapshot.commit.slice(0, 8) };
    if (condition === 'missing provenance') snapshot = { ...fixture.snapshot, provenance: undefined };
    if (condition === 'wrong date') snapshot = { ...fixture.snapshot, date: '2026-01-01T00:00:00+00:00' };
    if (condition === 'wrong source') snapshot = { ...fixture.snapshot, provenance: { ...fixture.snapshot.provenance, sourceFingerprint: 'f'.repeat(64) } };
    const result = await runTrend(t, { ...fixture, snapshot: snapshot as typeof fixture.snapshot }, ['--record']);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(recordNames(fixture), []);
    assert.equal(fixture.repository.git('worktree', 'list', '--porcelain').match(/^worktree /gm)?.length, 1);
  });
}

test('Given changed caller source and a snapshot of the immutable base, when offline --record runs, then verification uses the base content', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  fixture.repository.write({ 'src/example.ts': 'export const example = 99;\n' });
  const result = await runTrend(t, fixture, ['--record']);
  assert.equal(result.code, 0);
  assert.equal(recordNames(fixture).length, 1);
});

test('Given a snapshot that claims current caller source belongs to an older commit, when offline --record runs, then it refuses', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  fixture.repository.write({ 'src/example.ts': 'export const example = 99;\n' });
  const snapshot = { ...fixture.snapshot, provenance: { ...fixture.snapshot.provenance, sourceFingerprint: currentSourceFingerprint(fixture) } };
  const result = await runTrend(t, { ...fixture, snapshot }, ['--record']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /source does not match its commit/);
  assert.deepEqual(recordNames(fixture), []);
});

test('Given malformed existing history, when --record runs, then the whole store is rejected before publication', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  const path = storeRecord(fixture, {});
  writeFileSync(path, 'invalid');
  const result = await runTrend(t, fixture, ['--record']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /not a valid trend file/);
  assert.equal(readFileSync(path, 'utf8'), 'invalid');
  assert.equal(recordNames(fixture).length, 1);
});

test('Given concurrent recording requests for the same commit, when both complete, then one complete record wins', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  const results = await Promise.all([runTrend(t, fixture, ['--record']), runTrend(t, fixture, ['--record'])]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  assert.equal(recordNames(fixture).length, 1);
  assert.equal(JSON.parse(recordText(fixture)).commit, fixture.snapshot.commit);
});


test('Given stored legacy data outside a repository, when snapshots render with no tools, then history remains readable and unchanged', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  const path = storeRecord(fixture, { functionsOver30: 22 });
  const original = readFileSync(path, 'utf8');
  const result = await runTrendWithoutTools(t, fixture);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /22 \(legacy unknown\)/);
  assert.equal(readFileSync(path, 'utf8'), original);
});


test('Given compatible head coverage, when recording an ancestor, then history says estimate and the head says measured', { timeout }, async (t) => {
  const fixture = trendRepository(t);
  const snapshot = { ...bandedBase, commit: fixture.snapshot.commit, date: fixture.snapshot.date, provenance: fixture.snapshot.provenance };
  const coverage = { ...unitCoverage, commit: snapshot.commit, provenance: {
    ...unitCoverage.provenance, ...snapshot.provenance, capturedCommit: snapshot.commit,
  } };
  const result = await runTrend(t, { ...fixture, snapshot }, ['--record', ...coverageArguments(t, coverage)]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /4 \(estimate\)/);
  assert.match(result.stdout, /4 \(measured\)/);
  const stored = JSON.parse(recordText(fixture));
  assert.equal(stored.functionsOver30, 4);
  assert.equal(stored.crap.kind, 'head-derived-estimate');
  assert.equal(stored.crap.coverageCommit, snapshot.commit);
  assert.equal(stored.crap.sourceFingerprint, snapshot.provenance.sourceFingerprint);
  assert.equal(stored.crap.unknownFunctions, 2);
  assert.equal(stored.communities.find((community: { label: string }) => community.label === 'auth').functionsOver30, 1);
});
