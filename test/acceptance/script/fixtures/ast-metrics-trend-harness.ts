import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../../support/processes/module-paths.ts';
import { runScript } from '../../../support/processes/script-command.ts';
import { bandedBase, coverageArguments, unitCoverage } from './ast-metrics-architecture-coverage.ts';
import { baseSnapshot, snapshotArguments } from './ast-metrics-architecture-snapshots.ts';
import { GitRepository } from './git-repository.ts';

const { sourceFingerprintOf } = await import(new URL('provenance/inputs.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  sourceFingerprintOf(root: string): string;
};

function trendRepository(t: TestContext) {
  const repository = GitRepository.create(t);
  repository.commit('Start main', { 'src/example.ts': 'export const example = 1;\n' });
  repository.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const commit = repository.git('rev-parse', 'HEAD').trim();
  const provenance = {
    sourceFingerprint: sourceFingerprintOf(repository.root), inputsFingerprint: 'b'.repeat(64), runtime: 'node-test',
    compiler: 'typescript-test', measurementVersion: 'own-characters-1', suite: 'unit',
  } as const;
  const snapshot = { ...baseSnapshot, commit, date: repository.git('show', '-s', '--format=%cI', commit).trim(), provenance };
  const store = join(repository.root, 'docs', 'metrics');
  return { repository, snapshot, store };
}

type TrendRepository = ReturnType<typeof trendRepository> & { readonly coverage?: typeof unitCoverage };

function runTrend(t: TestContext, fixture: TrendRepository, extra: readonly string[] = []) {
  return runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, fixture.snapshot, fixture.snapshot), '--trend-store', fixture.store, ...extra, ...(fixture.coverage === undefined ? [] : coverageArguments(t, fixture.coverage))],
    cwd: fixture.repository.root,
  });
}

function recordNames(fixture: TrendRepository): string[] {
  try { return readdirSync(fixture.store); } catch { return []; }
}

function recordText(fixture: TrendRepository): string {
  return readFileSync(join(fixture.store, recordNames(fixture)[0]), 'utf8');
}

function storeRecord(fixture: TrendRepository, fields: Readonly<Record<string, unknown>>): string {
  mkdirSync(fixture.store, { recursive: true });
  const name = `${fixture.snapshot.date.slice(0, 10)}-${fixture.snapshot.commit.slice(0, 8)}.json`;
  const path = join(fixture.store, name);
  writeFileSync(path, `${JSON.stringify({ version: 1, ...fixture.snapshot.global, cycles: 0, communities: [],
    commit: fixture.snapshot.commit, date: fixture.snapshot.date, ...fields })}\n`);
  return path;
}

function currentSourceFingerprint(fixture: TrendRepository): string {
  return sourceFingerprintOf(fixture.repository.root);
}

function runTrendWithoutTools(t: TestContext, fixture: TrendRepository) {
  return runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, fixture.snapshot, fixture.snapshot), '--trend-store', fixture.store],
    cwd: dataDirectory(t), env: { PATH: '' },
  });
}

type TrendResult = Awaited<ReturnType<typeof runTrend>>;
type SnapshotCondition = keyof typeof snapshotConditions;
export interface TrendScenario {
  readonly name: string;
  readonly given?: SnapshotCondition;
  readonly history?: 'legacy' | 'malformed';
  readonly run?: 'record' | 'twice' | 'concurrent' | 'without-tools';
  readonly expected: {
    readonly code: number;
    readonly stderr?: RegExp | ((fixture: TrendRepository) => string);
    readonly stdout?: RegExp | '';
    readonly records: number;
    readonly worktrees?: number;
    readonly record?: (fixture: TrendRepository) => Readonly<Record<string, unknown>>;
    readonly crap?: (fixture: TrendRepository) => Readonly<Record<string, unknown>>;
    readonly communities?: Readonly<Record<string, number>>;
  };
}

const changedCaller = (fixture: TrendRepository): TrendRepository => {
  fixture.repository.write({ 'src/example.ts': 'export const example = 99;\n' });
  return fixture;
};
const snapshotConditions = {
  'missing main': (fixture: TrendRepository) => { fixture.repository.git('update-ref', '-d', 'refs/remotes/origin/main'); return fixture; },
  'missing commit': (fixture: TrendRepository) => ({ ...fixture, snapshot: { ...fixture.snapshot, commit: 'f'.repeat(40) } }),
  'short commit': (fixture: TrendRepository) => ({ ...fixture, snapshot: { ...fixture.snapshot, commit: fixture.snapshot.commit.slice(0, 8) } }),
  'missing provenance': (fixture: TrendRepository) => ({ ...fixture, snapshot: { ...fixture.snapshot, provenance: undefined } } as unknown as TrendRepository),
  'wrong source': (fixture: TrendRepository) => ({ ...fixture, snapshot: { ...fixture.snapshot, provenance: { ...fixture.snapshot.provenance, sourceFingerprint: 'f'.repeat(64) } } }),
  'wrong date': (fixture: TrendRepository) => ({ ...fixture, snapshot: { ...fixture.snapshot, date: '2026-01-01T00:00:00+00:00' } }),
  'changed caller': changedCaller,
  'caller identity': (fixture: TrendRepository) => {
    changedCaller(fixture);
    return { ...fixture, snapshot: { ...fixture.snapshot, provenance: { ...fixture.snapshot.provenance, sourceFingerprint: currentSourceFingerprint(fixture) } } };
  },
  'compatible coverage': (fixture: TrendRepository) => {
    const snapshot = { ...bandedBase, commit: fixture.snapshot.commit, date: fixture.snapshot.date, provenance: fixture.snapshot.provenance };
    const coverage = { ...unitCoverage, commit: snapshot.commit, provenance: { ...unitCoverage.provenance, ...snapshot.provenance, capturedCommit: snapshot.commit } };
    return { ...fixture, snapshot, coverage };
  },
  'feature': (fixture: TrendRepository) => {
    fixture.repository.commit('Feature', { 'src/example.ts': 'export const example = 2;\n' });
    return { ...fixture, snapshot: { ...fixture.snapshot, commit: fixture.repository.git('rev-parse', 'HEAD').trim(), date: fixture.repository.git('show', '-s', '--format=%cI', 'HEAD').trim() } };
  },
};

export async function checkTrendScenario(t: TestContext, scenario: TrendScenario): Promise<void> {
  let fixture = trendRepository(t);
  if (scenario.history !== undefined) {
    const path = storeRecord(fixture, { functionsOver30: 22 });
    if (scenario.history === 'malformed') writeFileSync(path, 'invalid');
  }
  if (scenario.given !== undefined) fixture = snapshotConditions[scenario.given](fixture);
  const before = recordNames(fixture).map((name) => [name, readFileSync(join(fixture.store, name), 'utf8')] as const);
  const results = await scenarioResults(t, fixture, scenario.run);
  for (const result of results) checkScenarioResult(result, scenario, fixture);
  assert.equal(recordNames(fixture).length, scenario.expected.records);
  for (const [name, text] of before) assert.equal(readFileSync(join(fixture.store, name), 'utf8'), text);
  if (scenario.expected.worktrees !== undefined) assert.equal(fixture.repository.git('worktree', 'list', '--porcelain').match(/^worktree /gm)?.length, scenario.expected.worktrees);
  checkRecordedFields(fixture, scenario.expected);
}

async function scenarioResults(t: TestContext, fixture: TrendRepository, run: TrendScenario['run']): Promise<readonly TrendResult[]> {
  if (run === 'concurrent') return Promise.all([runTrend(t, fixture, ['--record']), runTrend(t, fixture, ['--record'])]);
  if (run === 'without-tools') return [await runTrendWithoutTools(t, fixture)];
  if (run === undefined) return [await runTrend(t, fixture)];
  const first = await runTrend(t, fixture, ['--record']);
  if (run !== 'twice') return [first];
  const original = recordText(fixture);
  const second = await runTrend(t, fixture, ['--record']);
  assert.equal(recordText(fixture), original);
  return [first, second];
}

function checkScenarioResult(result: TrendResult, { expected }: TrendScenario, fixture: TrendRepository): void {
  assert.equal(result.code, expected.code, result.stderr);
  if (expected.stderr instanceof RegExp) assert.match(result.stderr, expected.stderr);
  else if (expected.stderr !== undefined) assert.equal(result.stderr, expected.stderr(fixture));
  else if (expected.code === 0) assert.equal(result.stderr, '');
  if (expected.stdout === '') assert.equal(result.stdout, '');
  else if (expected.stdout !== undefined) assert.match(result.stdout, expected.stdout);
}

function checkRecordedFields(fixture: TrendRepository, expected: TrendScenario['expected']): void {
  if (expected.record === undefined) return;
  const record = JSON.parse(recordText(fixture));
  for (const [key, value] of Object.entries(expected.record(fixture))) assert.deepEqual(record[key], value);
  if (expected.crap !== undefined) {
    for (const [key, value] of Object.entries(expected.crap(fixture))) assert.deepEqual(record.crap[key], value);
  }
  for (const [label, count] of Object.entries(expected.communities ?? {})) {
    assert.equal(record.communities.find((community: { label: string }) => community.label === label).functionsOver30, count);
  }
}
