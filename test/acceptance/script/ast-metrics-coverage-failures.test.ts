import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { writeV8Coverage } from '../../support/fixtures/v8-coverage.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The failures of the coverage command. A failure writes no report and keeps the report of an earlier run.
const timeout = 30_000;
const earlierReport = '{ "version": 1, "files": [] }\n';

function repositoryWithReport(t: TestContext, files: Readonly<Record<string, string>> = {}): GitRepository {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'README.md': '# Test\n', ...files });
  repository.write({ 'ast-report/coverage.json': earlierReport });
  return repository;
}

function reportIn(repository: GitRepository): string {
  return readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8');
}

test('Given no --from and no dist/ folder, when the command runs, then it fails with a diagnostic that says to build first', { timeout }, async (t) => {
  const repository = repositoryWithReport(t);

  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });

  assert.match(result.stderr, /ast-metrics-coverage: The build failed/);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.equal(reportIn(repository), earlierReport);
});

test('Given a build whose unit suite fails, when the command runs, then the test output reaches stderr, the command fails, keeps the earlier report, and removes its temporary folder', { timeout }, async (t) => {
  const repository = repositoryWithReport(t, {
    'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"' } }),
    'dist/src/sample.js': 'export const sample = 1;\n',
    'dist/test/unit/sample.test.js': "import { test } from 'node:test';\ntest('Given a defect, when the test runs, then it fails', () => { throw new Error('defect'); });\n",
  });
  const temporary = mkdtempSync(join(tmpdir(), 'thermus-coverage-test-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));

  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, env: { TMPDIR: temporary } });

  assert.match(result.stderr, /Given a defect, when the test runs, then it fails/);
  assert.match(result.stderr, /\nast-metrics-coverage: The unit suite failed with exit status 1\. No coverage is written\.\n$/);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.equal(reportIn(repository), earlierReport);
  assert.deepEqual(readdirSync(temporary).filter((name) => name.startsWith('thermus-coverage-')), []);
});

test('Given a repository without a commit, when the command runs, then it fails with a diagnostic before it reads any coverage', { timeout }, async (t) => {
  const repository = GitRepository.create(t);

  const result = await runScript(t, astMetricsCoverageScript, { args: ['--from', 'v8-coverage'], cwd: repository.root });

  assert.match(result.stderr, /original capture manifest/);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});

test('Given coverage from two builds whose whole ranges have different lengths, when the current script is shorter, then it rejects the out-of-bounds build and keeps the report', { timeout }, async (t) => {
  const repository = repositoryWithReport(t, { 'dist/src/sample.js': ' '.repeat(400) });
  writeV8Coverage(join(repository.root, 'v8-coverage'), repository.root, [
    { 'dist/src/sample.js': [['', [0, 400, 1]], ['outer', [100, 300, 1]]] },
    { 'dist/src/sample.js': [['', [0, 420, 1]], ['outer', [100, 320, 1]]] },
  ]);
  const result = await runScript(t, astMetricsCoverageScript, { args: ['--allow-unverified', '--from', 'v8-coverage'], cwd: repository.root });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Invalid coverage range.*sample.*length 400/);
  assert.equal(reportIn(repository), earlierReport);
});
