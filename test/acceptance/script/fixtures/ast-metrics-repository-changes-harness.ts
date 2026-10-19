import { type TestContext } from 'node:test';
import { baseDoublesOnPath } from './ast-metrics-snapshot-base.ts';
import { communityOf } from './ast-metrics-snapshot-answers.ts';
import { verifiedCoverageFor } from './ast-metrics-verified-coverage.ts';
import { GitRepository } from './git-repository.ts';

export const oldPath = 'src/core/old.ts';
export const newPath = 'src/core/new.ts';
export const functionSource = 'export function work(value: number) { return value > 0 ? value : -value; }\n';
const kept = ['src/core/keep-a.ts', 'src/core/keep-b.ts'];
const reportPath = 'ast-metrics-fake-report.json';

function report(paths: readonly string[]): string {
  return JSON.stringify({ concernedFiles: [...paths, ...kept].map((path) => ({
    path: `{root}/${path}`, complexity: { cyclomatic: kept.includes(path) ? 0 : 6 }, volume: { loc: kept.includes(path) ? 1 : 10 },
    maintainability: { maintainabilityIndex: kept.includes(path) ? 100 : 90 }, risk: kept.includes(path) ? {} : { score: 0.5 },
  })) });
}

export function changesRepository(t: TestContext) {
  const repository = GitRepository.onFeatureBranch(t, {
    [oldPath]: functionSource, ...Object.fromEntries(kept.map((path) => [path, 'export const kept = 1;\n'])), [reportPath]: report([oldPath]),
  });
  const doubles = baseDoublesOnPath(t, {}, {
    get_communities: { modularity: 0.5, crossShare: 0, cycles: [], communities: [
      { ...communityOf('core', [oldPath, newPath, ...kept].map((path) => path.slice(0, -3)), { 'src/core': 4 }), name: 'src/core', internalReferences: 0, inboundReferences: 0, outboundReferences: 0 },
    ], edges: [] },
    get_file_metrics: Object.fromEntries([oldPath, newPath, ...kept].map((path) => [path, { path, language: 'TypeScript', functions: kept.includes(path) ? [] : [
      { name: 'work', cyclomatic_complexity: 6, volume: { loc: 1 }, maintainability: { maintainability_index: 90 } },
    ] }])),
  });
  return { repository, doubles };
}

export function headReport(paths: readonly string[]): Readonly<Record<string, string>> {
  return { [reportPath]: report(paths) };
}

export function coverageForChanges(repository: GitRepository, path?: string) {
  return verifiedCoverageFor(repository, { version: 2, suite: 'unit', processes: 1, scripts: path === undefined ? 0 : 1,
    files: path === undefined ? [] : [{ path, functions: [{ name: 'work', start: 0, end: functionSource.length, called: 0, coveredShare: 0 }] }],
  });
}
