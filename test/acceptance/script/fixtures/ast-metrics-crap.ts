import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { astMetricsMcpFakeOnPath } from '../../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { verifiedCoverageFor } from './ast-metrics-verified-coverage.ts';
import { GitRepository } from './git-repository.ts';

interface FunctionFixture { readonly name: string; readonly paths: number; readonly share?: number }
export function crapFixture(t: TestContext, functions: readonly FunctionFixture[], before = '') {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': before });
  const source = functions.map(({ name }, index) => `export function ${name}() { return ${index + 1}; }`).join('\n');
  repository.write({ 'src/a.ts': source });
  const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: {
    'src/a.ts': { functions: functions.map(({ name, paths }) => ({ name, cyclomatic_complexity: paths })) },
  } } });
  repository.write({ 'ast-report/.keep': '' });
  const file = join(repository.root, 'ast-report/coverage.json');
  const report = verifiedCoverageFor(repository, { version: 2, suite: 'unit', files: [{ path: 'src/a.ts', functions: functions.flatMap(({ name, share }) => share === undefined ? [] : [{ name, coveredShare: share }]) }] });
  const coverage = () => writeFileSync(file, JSON.stringify(verifiedCoverageFor(repository, report)));
  coverage();
  return { repository, fake, file, coverage, report: () => verifiedCoverageFor(repository, report) };
}
