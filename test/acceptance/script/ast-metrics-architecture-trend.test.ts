import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { bandedBase, coverageArguments } from './fixtures/ast-metrics-architecture-coverage.ts';
import { bandsNeedTheCoverage, baseSnapshot, edited, noProductionFile, noTrend, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';
import { commitCells, emptyStore, recordText, trendSection, writeRecords, type TrendRecordShape } from './fixtures/ast-metrics-architecture-trend.ts';
import { baseDoublesOnPath, baseRepository } from './fixtures/ast-metrics-snapshot-base.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The trend of src/ on main after the complexity section: the last ten records of the trend store by date, oldest
// first, and the head as the last row. Before the output, the command writes the record of the base commit to the
// store when the store has no record of that commit. With --head and --base-snapshot, only --trend-store names a store,
// and these cases run with an empty PATH. The last case runs both doubles in a repository, whose store is docs/metrics/
// of its root. Each expected text is the complete output.
const timeout = 20_000;
const noTools = { PATH: '' };

const header = '## Architecture of src/: base a1b2c3d4 → head';
const baseCommit = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

// The output of two equal base snapshots without coverage, up to the trend section.
const unchanged = [header, '', 'Modularity 0.52 → 0.52 · cross share 0.26 → 0.26 · cycles 0 → 0 · communities 4 → 4', '', bandsNeedTheCoverage, '', 'The map did not change.', '', ...noProductionFile];
const headRow = '| this pull request | | 0.52 | 0.26 | 0 | 62.1 | – |';

function markdown(before: readonly string[], trend: readonly string[]): string {
  return [...before, '', ...trend, ''].join('\n');
}

// With the coverage report of the banded fixtures, the base has four functions at CRAP 30 or more: one in auth, two in
// hosted-admin, and one in src. The head has other global numbers, but the same communities, dependencies, and
// functions, so the map did not change.
const trendBase = edited(bandedBase, { global: { functions: 14 } });
const trendHead = edited(trendBase, { global: { modularity: 0.55, crossShare: 0.25, maintainability: 61.5 } });

test('Given an empty store and a coverage report, when the command runs with --trend-store, then it writes the record of the base commit to <date>-<commit8>.json with the global numbers and the numbers of each community and nothing for each file, and the trend table has the row of that record and the row of the head', { timeout }, async (t) => {
  const store = emptyStore(t);
  const args = [...snapshotArguments(t, trendBase, trendHead), ...coverageArguments(t), '--trend-store', store];

  const result = await runScript(t, astMetricsArchitectureScript, { args, env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(
    [header, '', 'Modularity 0.52 → 0.55 · cross share 0.26 → 0.25 · cycles 0 → 0 · communities 4 → 4 · functions ≥ 30: 4 → 4', '', 'The map did not change.', '', ...noProductionFile],
    trendSection(['| a1b2c3d4 | 2026-10-18 | 0.52 | 0.26 | 0 | 62.1 | 4 |', '| this pull request | | 0.55 | 0.25 | 0 | 61.5 | 4 |']),
  ));
  assert.equal(result.code, 0);
  assert.deepEqual(readdirSync(store), ['2026-10-18-a1b2c3d4.json']);
  assert.equal(readFileSync(join(store, '2026-10-18-a1b2c3d4.json'), 'utf8'), recordText({
    version: 1, commit: baseCommit, date: '2026-10-18T09:00:00+02:00',
    modularity: 0.52, crossShare: 0.26, cycles: 0, maintainability: 62.1, paths: 275, files: 12, functions: 14, functionsOver30: 4,
    communities: [
      { label: 'auth', files: 4, loc: 400, maintainability: 58.6, paths: 110, functionsOver30: 1 },
      { label: 'hosted-admin', files: 2, loc: 200, maintainability: 66.6, paths: 75, functionsOver30: 2 },
      { label: 'shared kernel', files: 1, loc: 100, maintainability: 77, paths: 18, functionsOver30: 0 },
      { label: 'src', files: 2, loc: 200, maintainability: 56, paths: 40, functionsOver30: 1 },
    ],
  }));
});

// An earlier pull request without coverage wrote the record of the same commit, under another date and with other
// numbers.
const earlierRecord: TrendRecordShape = {
  version: 1, commit: baseCommit, date: '2026-10-17T21:00:00+02:00',
  modularity: 0.4, crossShare: 0.3, cycles: 2, maintainability: 55.5, paths: 300, files: 13, functions: 20, communities: [],
};

test('Given a store with a file of the base commit under another date and with other numbers, when the command runs, then that file stays unchanged, no file is added, and the trend table shows the numbers of that file, with – for a count that the file does not have', { timeout }, async (t) => {
  const store = emptyStore(t);
  writeRecords(store, [earlierRecord]);

  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, baseSnapshot, baseSnapshot), '--trend-store', store], env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(unchanged, trendSection(['| a1b2c3d4 | 2026-10-17 | 0.40 | 0.30 | 2 | 55.5 | – |', headRow])));
  assert.equal(result.code, 0);
  assert.deepEqual(readdirSync(store), ['2026-10-17-a1b2c3d4.json']);
  assert.equal(readFileSync(join(store, '2026-10-17-a1b2c3d4.json'), 'utf8'), recordText(earlierRecord));
});

// The last record is of the base commit, so the command writes no file. Two records have the same date: the record of
// the morning comes first, though its file name comes after the other one.
const twelveRecords = [
  ['07070707', '2026-10-07T12:00:00+02:00'], ['08080808', '2026-10-08T12:00:00+02:00'], ['09090909', '2026-10-09T12:00:00+02:00'],
  ['ffff0001', '2026-10-10T08:00:00+02:00'], ['00000002', '2026-10-10T18:00:00+02:00'], ['11111111', '2026-10-11T12:00:00+02:00'],
  ['12121212', '2026-10-12T12:00:00+02:00'], ['13131313', '2026-10-13T12:00:00+02:00'], ['14141414', '2026-10-14T12:00:00+02:00'],
  ['15151515', '2026-10-15T12:00:00+02:00'], ['16161616', '2026-10-16T12:00:00+02:00'], [baseCommit, '2026-10-18T09:00:00+02:00'],
].map(([commit, date], index): TrendRecordShape => ({
  version: 1, commit, date, modularity: (40 + index) / 100, crossShare: 0.3, cycles: index % 3, maintainability: 50 + index / 2,
  paths: 200, files: 10, functions: 30, functionsOver30: index, communities: [],
}));

test('Given a store with twelve files, when the command runs, then the trend table shows the last ten by date, oldest first, with the head as the last row', { timeout }, async (t) => {
  const store = emptyStore(t);
  writeRecords(store, [...twelveRecords].reverse());

  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, baseSnapshot, baseSnapshot), '--trend-store', store], env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(unchanged, trendSection([
    '| 09090909 | 2026-10-09 | 0.42 | 0.30 | 2 | 51.0 | 2 |',
    '| ffff0001 | 2026-10-10 | 0.43 | 0.30 | 0 | 51.5 | 3 |',
    '| 00000002 | 2026-10-10 | 0.44 | 0.30 | 1 | 52.0 | 4 |',
    '| 11111111 | 2026-10-11 | 0.45 | 0.30 | 2 | 52.5 | 5 |',
    '| 12121212 | 2026-10-12 | 0.46 | 0.30 | 0 | 53.0 | 6 |',
    '| 13131313 | 2026-10-13 | 0.47 | 0.30 | 1 | 53.5 | 7 |',
    '| 14141414 | 2026-10-14 | 0.48 | 0.30 | 2 | 54.0 | 8 |',
    '| 15151515 | 2026-10-15 | 0.49 | 0.30 | 0 | 54.5 | 9 |',
    '| 16161616 | 2026-10-16 | 0.50 | 0.30 | 1 | 55.0 | 10 |',
    '| a1b2c3d4 | 2026-10-18 | 0.51 | 0.30 | 2 | 55.5 | 11 |',
    headRow,
  ])));
  assert.equal(result.code, 0);
  assert.equal(readdirSync(store).length, 12);
});

test('Given a --trend-store path that is a file, so that the store cannot be written, when the command runs, then it fails with one diagnostic line that names the file of the record, prints no Markdown, and leaves the file as it was', { timeout }, async (t) => {
  const store = join(dataDirectory(t), 'metrics');
  writeFileSync(store, 'Not a folder.\n');

  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, baseSnapshot, baseSnapshot), '--trend-store', store], env: noTools });

  assert.equal(result.stderr, `ast-metrics-architecture: Cannot write the trend file ${join(store, '2026-10-18-a1b2c3d4.json')}.\n`);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.equal(readFileSync(store, 'utf8'), 'Not a folder.\n');
});

test('Given two snapshot files without --trend-store, when the command runs in the root of a repository, then the trend section says No trend store, and the command writes nothing in the repository', { timeout }, async (t) => {
  const repository = GitRepository.create(t);

  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, baseSnapshot), cwd: repository.root, env: noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdown(unchanged, noTrend));
  assert.equal(result.code, 0);
  assert.deepEqual(readdirSync(repository.root), ['.git']);
});

// The doubles give the merge base and the working tree the same numbers: auth and admin in a cycle, and the shared
// kernel, whose file has no maintainability. The coverage report of the second run has no file, so each named function
// is uncovered, and none of them reaches CRAP 30.
function repositoryMarkdown(repository: GitRepository, summary: readonly string[], rows: readonly string[]): string {
  const head = [`## Architecture of src/: base ${repository.git('rev-parse', 'HEAD').slice(0, 8)} → head`, '', ...summary, '', 'The map did not change.', '', ...noProductionFile];
  return markdown(head, trendSection(rows));
}

test('Given a repository and both doubles on PATH, when the command runs with --base main and then once more with a coverage report, then the first run writes docs/metrics/<date>-<commit8>.json of the root with the numbers of the merge base, and the second run leaves that file unchanged: its row has no count, and the row of the head has the count of the coverage', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t);
  const commit = repository.git('rev-parse', 'HEAD').trim();
  const date = repository.git('show', '-s', '--format=%cI', 'HEAD').trim();
  const store = join(repository.root, 'docs', 'metrics');
  const summary = 'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3';
  const baseRow = `${commitCells(repository, 'HEAD')} 0.42 | 0.33 | 1 | 70.3 | – |`;

  const first = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(first.stderr, '');
  assert.equal(first.stdout, repositoryMarkdown(repository, [summary, '', bandsNeedTheCoverage], [baseRow, '| this pull request | | 0.42 | 0.33 | 1 | 70.3 | – |']));
  assert.equal(first.code, 0);
  const name = `${date.slice(0, 10)}-${commit.slice(0, 8)}.json`;
  assert.deepEqual(readdirSync(store), [name]);
  const record = readFileSync(join(store, name), 'utf8');
  assert.equal(record, recordText({
    version: 1, commit, date, modularity: 0.42, crossShare: 0.33, cycles: 1, maintainability: 70.3, paths: 13, files: 4, functions: 5,
    communities: [
      { label: 'admin', files: 1, loc: 50, maintainability: 70.1, paths: 4 },
      { label: 'auth', files: 2, loc: 150, maintainability: 70.4, paths: 9 },
      { label: 'shared kernel', files: 1, loc: 10, paths: 0 },
    ],
  }));

  repository.write({ 'ast-report/coverage.json': `${JSON.stringify({ version: 1, suite: 'unit', files: [] })}\n` });
  const second = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(second.stderr, '');
  assert.equal(second.stdout, repositoryMarkdown(repository, [`${summary} · functions ≥ 30: 0 → 0`], [baseRow, '| this pull request | | 0.42 | 0.33 | 1 | 70.3 | 0 |']));
  assert.equal(second.code, 0);
  assert.deepEqual(readdirSync(store), [name]);
  assert.equal(readFileSync(join(store, name), 'utf8'), record);
});
