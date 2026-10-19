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

test('Given no package suite selection, when the command runs, then collection is deferred before build', { timeout }, async (t) => {
  const repository = repositoryWithReport(t);

  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });

  assert.match(result.stderr, /ast-metrics-coverage: The package has no test:unit script. Collection is deferred/);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.equal(reportIn(repository), earlierReport);
});

test('Given a build whose unit suite fails, when the command runs, then the test output reaches stderr, the command fails, keeps the earlier report, and removes its temporary folder', { timeout }, async (t) => {
  const repository = repositoryWithReport(t, {
    'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"', 'test:unit': 'npm run build && node --test --test-concurrency=1 "dist/test/unit/**/*.test.js" && node --test "test/unit/user-portal/**/*.test.ts"' } }),
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

for (const failure of ['failed suite', 'killed child', 'representation conflict'] as const) {
  test(`Given selected unit and acceptance runs with a ${failure}, when collection runs, then no union replaces the good report`, { timeout }, async (t) => {
    const childCase = [
      "import assert from 'node:assert/strict'; import { spawn } from 'node:child_process'; import { once } from 'node:events'; import { test } from 'node:test';",
      "test('killed captured child', async () => { const child = spawn(process.execPath, ['--input-type=module', '-e', \"import './dist/src/sample.js'; process.stdout.write('ready'); setInterval(() => {}, 1000);\"], { env: process.env, stdio: ['ignore', 'pipe', 'inherit'] }); await once(child.stdout, 'data'); child.kill('SIGKILL'); await once(child, 'exit'); });",
    ].join('\n');
    const repository = repositoryWithReport(t, {
      'package.json': JSON.stringify({ type: 'module', scripts: {
        build: 'node -e "process.exit(0)"',
        'test:unit': 'npm run build && node --test "dist/test/unit/**/*.test.js"',
        'test:acceptance': 'npm run build && node --test "dist/test/acceptance/**/*.test.js"',
      } }),
      'src/sample.ts': 'export function sample() { return 1; }\n',
      'dist/src/sample.js': 'export function sample() { return 1; }\n',
      'dist/test/unit/sample.test.js': "import { test } from 'node:test'; import { sample } from '../../src/sample.js'; test('first suite', () => sample());\n",
      'dist/test/acceptance/sample.test.js': failure === 'killed child' ? childCase : failure === 'failed suite'
        ? "import { test } from 'node:test'; test('second suite failed', () => { throw Error('failed'); });\n"
        : "import { test } from 'node:test'; import { sample } from '../../../src/sample.ts'; test('source representation', () => sample());\n",
    });
    const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, args: ['--suite', 'unit', '--suite', 'acceptance'] });
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, failure === 'failed suite' ? /acceptance suite failed/ : failure === 'killed child' ? /Incomplete captures are unverified/ : /Incompatible coverage representation/);
    assert.equal(reportIn(repository), earlierReport);
  });
}
