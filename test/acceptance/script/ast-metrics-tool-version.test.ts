import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsMcpFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { astMetricsCliFakeOnPath, pathWithoutAstMetrics } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import * as paths from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { snapshotDoublesOnPath, jsonReport, repositoryFiles } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const mismatch = 'ast-metrics 9.8.7 is not the pinned 0.43.1; run with --allow-tool-version to continue.';
const commands = [
  ['delta', paths.astMetricsDeltaScript, ['--base', 'main', '--no-compare']],
  ['review', paths.astMetricsReviewScript, ['--base', 'main']],
  ['snapshot', paths.astMetricsSnapshotScript, []],
  ['architecture', paths.astMetricsArchitectureScript, ['--base', 'main', '--no-coverage', '--record']],
] as const;

for (const [name, script, args] of commands) {
  test(`Given another tool version, when ${name} runs, then it refuses before analysis or record writes and an explicit override runs it once`, { timeout: 30_000 }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, { ...repositoryFiles, '.ast-metrics-baseline.yaml': 'ignored: []\n' });
    repository.commit('Change', { 'src/auth/session.ts': 'export const value = 2;\n' });
    repository.git('update-ref', 'refs/remotes/origin/main', 'main');
    const doubles = snapshotDoublesOnPath(t, { cli: { version: '9.8.7', json: jsonReport, metrics: 'maintainability{path="{root}/src/auth/session.ts"} 90\n' } });
    const refused = await runScript(t, script, { cwd: repository.root, args, env: doubles.env });
    assert.equal(refused.code, 1);
    assert.equal(refused.stdout, '');
    assert.equal(refused.stderr, `ast-metrics-${name}: ${mismatch}\n`);
    assert.deepEqual(doubles.cli.calls().map(({ argv }) => argv), [['version']]);
    assert.equal(existsSync(join(repository.root, 'ast-report')), false);
    assert.equal(existsSync(join(repository.root, 'docs/metrics')), false);
    const allowed = await runScript(t, script, { cwd: repository.root, args: [...args, '--allow-tool-version'], env: doubles.env });
    assert.equal(allowed.code, 0, allowed.stderr);
    assert.equal(doubles.cli.calls().filter(({ argv }) => argv[0] === 'version').length, 2);
    if (name === 'snapshot') assert.equal(JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8')).tool, '9.8.7');
    if (name === 'architecture') {
      const record = JSON.parse(readFileSync(join(repository.root, 'docs/metrics', `${repository.git('show', '-s', '--format=%cI', 'main').slice(0, 10)}-${repository.git('rev-parse', 'main').slice(0, 8)}.json`), 'utf8'));
      assert.equal(record.tool, '9.8.7');
    }
  });
}

test('Given another MCP version, when MCP runs, then it refuses before tool calls and explicit override permits the call', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;' });
  const fake = astMetricsMcpFakeOnPath(t, { version: '9.8.7' });
  const refused = await runScript(t, paths.astMetricsMcpScript, { cwd: repository.root, args: ['overview'], env: fake.env });
  assert.equal(refused.code, 1);
  assert.equal(refused.stderr, `ast-metrics-mcp: ${mismatch}\n`);
  assert.equal(fake.calls().length, 0);
  const allowed = await runScript(t, paths.astMetricsMcpScript, { cwd: repository.root, args: ['overview', '--allow-tool-version'], env: fake.env });
  assert.equal(allowed.code, 0, allowed.stderr);
  assert.equal(fake.calls().length, 1);
});

for (const [name, script] of [...commands, ['mcp', paths.astMetricsMcpScript]] as const) {
  test(`Given help for ${name}, when it runs, then it starts no tool and checks no version`, async (t) => {
    const fake = astMetricsCliFakeOnPath(t, { version: '9.8.7' });
    const result = await runScript(t, script, { args: ['--help'], env: fake.env });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(fake.calls(), []);
    assert.match(result.stdout, /--allow-tool-version/);
  });
}

test('Given coverage data and no installed ast-metrics, when coverage imports it for inspection, then it succeeds', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'README.md': '# Start\n' });
  const { writeV8Coverage } = await import('../../support/fixtures/v8-coverage.ts');
  writeV8Coverage(join(repository.root, 'raw'), repository.root, [{ 'dist/src/a.js': [['run', [0, 10, 1]]] }]);
  const result = await runScript(t, paths.astMetricsCoverageScript, { cwd: repository.root, args: ['--from', 'raw', '--allow-unverified'], env: { PATH: pathWithoutAstMetrics(t) } });
  assert.equal(result.code, 0, result.stderr);
});

test('Given CLI and MCP versions that differ, when an overridden snapshot runs, then it refuses the mixed evidence before MCP calls or publication', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  const doubles = snapshotDoublesOnPath(t, { cli: { version: '9.8.7', json: jsonReport } });
  const result = await runScript(t, paths.astMetricsSnapshotScript, {
    cwd: repository.root, args: ['--allow-tool-version'], env: { ...doubles.env, AST_METRICS_FAKE_MCP_VERSION: '0.43.1' },
  });
  assert.equal(result.code, 1);
  assert.equal(result.stderr, 'ast-metrics-snapshot: ast-metrics MCP version 0.43.1 differs from the checked CLI version 9.8.7.\n');
  assert.equal(doubles.server.calls().length, 0);
  assert.equal(existsSync(join(repository.root, 'ast-report/snapshot.json')), false);
});

test('Given offline snapshots with different tool versions, when architecture renders without installed tools, then it identifies both versions', async (t) => {
  const { baseSnapshot, snapshotArguments } = await import('./fixtures/ast-metrics-architecture-snapshots.ts');
  const base = { ...baseSnapshot, tool: '0.43.1' };
  const head = { ...baseSnapshot, tool: '9.8.7' };
  const args = snapshotArguments(t, base, head);
  const result = await runScript(t, paths.astMetricsArchitectureScript, { args: [...args, '--no-coverage'], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Tool versions: base ast-metrics 0\.43\.1; head ast-metrics 9\.8\.7\./);
});

for (const tool of [43, '', ' ']) test(`Given a snapshot with malformed tool metadata ${JSON.stringify(tool)}, when offline rendering reads it, then it rejects the file`, async (t) => {
  const { baseSnapshot, snapshotArguments } = await import('./fixtures/ast-metrics-architecture-snapshots.ts');
  const invalid = { ...baseSnapshot, tool };
  const args = snapshotArguments(t, invalid, baseSnapshot);
  const result = await runScript(t, paths.astMetricsArchitectureScript, { args: [...args, '--no-coverage'], env: { PATH: '' } });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /not a valid snapshot of version 1/);
});

test('Given a stored trend record from another tool version, when architecture reads it on a later run, then it retains the recorded version without changing the file', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  repository.git('update-ref', 'refs/remotes/origin/main', 'main');
  const previous = snapshotDoublesOnPath(t, { cli: { version: '9.8.7', json: jsonReport } });
  const args = ['--base', 'main', '--no-coverage'];
  const published = await runScript(t, paths.astMetricsArchitectureScript, { cwd: repository.root, args: [...args, '--record', '--allow-tool-version'], env: previous.env });
  assert.equal(published.code, 0, published.stderr);
  const record = join(repository.root, 'docs/metrics', `${repository.git('show', '-s', '--format=%cI', 'main').slice(0, 10)}-${repository.git('rev-parse', 'main').slice(0, 8)}.json`);
  const original = readFileSync(record, 'utf8');
  assert.equal(JSON.parse(original).tool, '9.8.7');
  const current = snapshotDoublesOnPath(t);
  const readOnly = await runScript(t, paths.astMetricsArchitectureScript, { cwd: repository.root, args, env: current.env });
  assert.equal(readOnly.code, 0, readOnly.stderr);
  assert.match(readOnly.stdout, new RegExp(`Trend tool versions: ${repository.git('rev-parse', 'main').slice(0, 8)}: ast-metrics 9\\.8\\.7; this pull request: ast-metrics 0\\.43\\.1\\.`));
  assert.equal(readFileSync(record, 'utf8'), original);
});
