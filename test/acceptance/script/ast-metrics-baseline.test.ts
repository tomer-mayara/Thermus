import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCliFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsBaselineScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const oneEntry = `# Generated baseline\nignored:
    - rule: max_loc
      file: src/example.ts
      message: 'Too many Lines of code (151 > 150)'
      count: 7
`;

test('Given a baseline and a caller in a subfolder, when baseline runs, then it checks the version once and reports entry counts at the root', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { '.ast-metrics-baseline.yaml': oneEntry, 'nested/README.md': '# Test\n' });
  const fake = astMetricsCliFakeOnPath(t, { baseline: 'ignored: []\n' });
  const result = await runScript(t, astMetricsBaselineScript, { cwd: join(repository.root, 'nested'), env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Ignored entries before: 1.\nIgnored entries after: 0.\n');
  assert.deepEqual(fake.calls(), [{ argv: ['version'], cwd: repository.root }, { argv: ['baseline'], cwd: repository.root }]);
  assert.equal(readFileSync(join(repository.root, '.ast-metrics-baseline.yaml'), 'utf8'), 'ignored: []\n');
});

test('Given no baseline file, when baseline runs, then it reports zero before creating the tool baseline', async (t) => {
  const repository = GitRepository.create(t);
  const fake = astMetricsCliFakeOnPath(t, { baseline: oneEntry });
  const result = await runScript(t, astMetricsBaselineScript, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'Ignored entries before: 0.\nIgnored entries after: 1.\n');
});

test('Given another tool version, when baseline runs, then it refuses mutation until an explicit override', async (t) => {
  const repository = GitRepository.create(t);
  const fake = astMetricsCliFakeOnPath(t, { version: '9.8.7', baseline: 'ignored: []\n' });
  const refused = await runScript(t, astMetricsBaselineScript, { cwd: repository.root, env: fake.env });
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /not the pinned 0\.43\.1/);
  assert.equal(refused.stdout, '');
  assert.deepEqual(fake.calls().map(({ argv }) => argv), [['version']]);
  assert.equal(existsSync(join(repository.root, '.ast-metrics-baseline.yaml')), false);
  const allowed = await runScript(t, astMetricsBaselineScript, { cwd: repository.root, args: ['--allow-tool-version'], env: fake.env });
  assert.equal(allowed.code, 0, allowed.stderr);
  assert.deepEqual(fake.calls().map(({ argv }) => argv), [['version'], ['version'], ['baseline']]);
});

test('Given a failed baseline tool, when the wrapper runs, then it reports failure without a successful after count', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { '.ast-metrics-baseline.yaml': oneEntry });
  const fake = astMetricsCliFakeOnPath(t, { baselineExitCode: 2, baselineStderr: 'baseline failed\n' });
  const result = await runScript(t, astMetricsBaselineScript, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /baseline failed/);
  assert.match(result.stderr, /ast-metrics baseline failed with exit status 2/);
  assert.equal(result.stdout, '');
  assert.equal(readFileSync(join(repository.root, '.ast-metrics-baseline.yaml'), 'utf8'), oneEntry);
});

test('Given invalid existing baseline data, when baseline runs, then it rejects the file before the tool can replace it', async (t) => {
  const original = 'ignored: "- rule: lookalike"\n';
  const repository = GitRepository.onFeatureBranch(t, { '.ast-metrics-baseline.yaml': original });
  const fake = astMetricsCliFakeOnPath(t, { baseline: 'ignored: []\n' });
  const result = await runScript(t, astMetricsBaselineScript, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /not a valid ast-metrics baseline/);
  assert.equal(result.stdout, '');
  assert.equal(fake.calls().some(({ argv }) => argv[0] === 'baseline'), false);
  assert.equal(readFileSync(join(repository.root, '.ast-metrics-baseline.yaml'), 'utf8'), original);
});

test('Given malformed tool output, when baseline finishes, then the wrapper fails without publishing success counts', async (t) => {
  const repository = GitRepository.create(t);
  const fake = astMetricsCliFakeOnPath(t, { baseline: 'ignored: broken\n' });
  const result = await runScript(t, astMetricsBaselineScript, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /not a valid ast-metrics baseline/);
  assert.equal(result.stdout, '');
});
