import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { AstMetricsCliAnswers } from '../../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsProcessScript } from '../../../support/processes/module-paths.ts';
import { runScript } from '../../../support/processes/script-command.ts';
import { repositoryGraph } from './ast-metrics-architecture-goldens.ts';
import { noProductionFile } from './ast-metrics-architecture-snapshots.ts';
import { baseDoublesOnPath, baseRepository } from './ast-metrics-snapshot-base.ts';
import type { GitRepository } from './git-repository.ts';

export const noFinding = '## AST Metrics review\n\nNo new or worsened finding.\n';
export const missingCoverage = 'No coverage report: the bands are withheld. Run the coverage command when the test selection permits it.';

export function processFixture(t: TestContext, answers: AstMetricsCliAnswers = {}) {
  const repository = baseRepository(t);
  repository.git('update-ref', 'refs/remotes/origin/main', 'main');
  repository.write({ 'README.md': '# Changed\n', '.ast-metrics-baseline.yaml': 'ignored: []\n' });
  const doubles = baseDoublesOnPath(t, { review: noFinding, ...answers });
  const run = (args: readonly string[] = [], cwd = repository.root) => runScript(t, astMetricsProcessScript, { args, cwd, env: doubles.env });
  return { repository, doubles, run };
}

export function recordsIn(repository: GitRepository): readonly Record<string, unknown>[] {
  try { return readdirSync(join(repository.root, 'docs/metrics')).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(readFileSync(join(repository.root, 'docs/metrics', name), 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export function documentProcessMarkdown(repository: GitRepository): string {
  const commit = repository.git('rev-parse', 'main').trim();
  const date = repository.git('show', '-s', '--format=%cI', 'main').trim().slice(0, 10);
  return [
    '# Code quality process', '', '## Delta', '', 'Status: passed.', '', 'No TypeScript file is added or changed against origin/main.', '',
    '## Review', '', 'Status: passed.', '', noFinding.trim(), '',
    '## CRAP', '', 'Status: passed.', '', missingCoverage, '', 'No production files to assess.', '',
    '## Architecture', '', 'Status: passed.', '', `## Architecture of src/: base ${commit.slice(0, 8)} → head`, '',
    'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3', '', missingCoverage, '',
    'The map did not change.', '', ...repositoryGraph(), '', ...noProductionFile, '',
    'Unknown function identity: 5 (no proven declaration or unique unchanged body/signature correspondence).', '',
    '## Trend of src/ on main', '',
    '| Commit | Date | Modularity | Cross share | Cycles | Maintainability | Functions ≥ 30 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| ${commit.slice(0, 8)} | ${date} | 0.42 | 0.33 | 1 | 70.3 | – |`,
    '| this pull request | | 0.42 | 0.33 | 1 | 70.3 | – |', '',
  ].join('\n');
}
