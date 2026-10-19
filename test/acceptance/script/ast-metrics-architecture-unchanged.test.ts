import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { repositoryGraph } from './fixtures/ast-metrics-architecture-goldens.ts';
import { bandsNeedTheCoverage, noProductionFile } from './fixtures/ast-metrics-architecture-snapshots.ts';
import { jsonReport, repositoryFiles } from './fixtures/ast-metrics-snapshot-answers.ts';
import { baseDoublesOnPath, foldersLeftIn, worktreesOf } from './fixtures/ast-metrics-snapshot-base.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// A suite run writes the marker, including the collector's direct node --test call.
const suiteMarker = "require('node:fs').writeFileSync(process.env.CR24_SUITE_MARKER, 'called');\n";

test('Given a branch that changes only a document, no coverage, and both doubles on PATH, when the architecture command runs, then it prints the unchanged-map line, every community and the legend without bands, and invokes no test suite', { timeout: 20_000 }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, {
    ...repositoryFiles,
    'ast-metrics-fake-report.json': jsonReport,
    'README.md': '# Original\n',
    'dist/test/unit/suite-call.test.js': suiteMarker,
    'package.json': JSON.stringify({ scripts: { test: 'node dist/test/unit/suite-call.test.js', 'test:unit': 'node dist/test/unit/suite-call.test.js' } }),
  });
  repository.commit('Update the document', { 'README.md': '# Revised\n' });
  const doubles = baseDoublesOnPath(t);
  const commit = repository.git('rev-parse', 'main').trim();

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: { ...doubles.env, CR24_SUITE_MARKER: join(repository.root, 'suite-called') } });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    `## Architecture of src/: base ${commit.slice(0, 8)} → head`,
    '',
    'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3',
    '',
    bandsNeedTheCoverage,
    '',
    'The map did not change.',
    '',
    ...repositoryGraph(),
    '',
    ...noProductionFile,
    '',
    'Unknown function identity: 5 (no proven declaration or unique unchanged body/signature correspondence).',
    '',
    '## Trend of src/ on main', '', 'No snapshot of main in the trend store yet.',
    '',
  ].join('\n'));
  assert.equal(result.code, 0);
  assert.equal(repository.git('diff', '--name-only', 'main', 'HEAD'), 'README.md\n');
  assert.equal(existsSync(join(repository.root, 'suite-called')), false);
  assert.deepEqual(doubles.cli.calls().map(({ argv }) => argv[0]), ['version', 'analyze', 'mcp', 'analyze', 'mcp']);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  assert.deepEqual(await doubles.server.stillRunning(), []);
});
