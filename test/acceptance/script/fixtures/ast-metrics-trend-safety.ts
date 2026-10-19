import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../../support/processes/module-paths.ts';
import { runScript } from '../../../support/processes/script-command.ts';
import { baseSnapshot, snapshotArguments } from './ast-metrics-architecture-snapshots.ts';
import { GitRepository } from './git-repository.ts';

const { sourceFingerprintOf } = await import(new URL('provenance/inputs.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  sourceFingerprintOf(root: string): string;
};

export function trendRepository(t: TestContext) {
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

export type TrendRepository = ReturnType<typeof trendRepository>;

export function runTrend(t: TestContext, fixture: TrendRepository, extra: readonly string[] = []) {
  return runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, fixture.snapshot, fixture.snapshot), '--trend-store', fixture.store, ...extra],
    cwd: fixture.repository.root,
  });
}

export function recordNames(fixture: TrendRepository): string[] {
  try { return readdirSync(fixture.store); } catch { return []; }
}

export function recordText(fixture: TrendRepository): string {
  return readFileSync(join(fixture.store, recordNames(fixture)[0]), 'utf8');
}

export function storeRecord(fixture: TrendRepository, fields: Readonly<Record<string, unknown>>): string {
  mkdirSync(fixture.store, { recursive: true });
  const name = `${fixture.snapshot.date.slice(0, 10)}-${fixture.snapshot.commit.slice(0, 8)}.json`;
  const path = join(fixture.store, name);
  writeFileSync(path, `${JSON.stringify({ version: 1, ...fixture.snapshot.global, cycles: 0, communities: [],
    commit: fixture.snapshot.commit, date: fixture.snapshot.date, ...fields })}\n`);
  return path;
}

export function currentSourceFingerprint(fixture: TrendRepository): string {
  return sourceFingerprintOf(fixture.repository.root);
}

export function runTrendWithoutTools(t: TestContext, fixture: TrendRepository) {
  return runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, fixture.snapshot, fixture.snapshot), '--trend-store', fixture.store],
    cwd: dataDirectory(t), env: { PATH: '' },
  });
}
