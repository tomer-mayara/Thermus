import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { writeV8Coverage, type ProcessRuns } from '../../support/fixtures/v8-coverage.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The merge of the V8 coverage files into coverage.json, and the default run of the unit suite.
// ast-metrics-coverage-failures.test.ts specifies the failures.
const timeout = 30_000;

type FunctionEntry = { readonly name: string; readonly start: number; readonly end: number; readonly called: number; readonly coveredShare: number };
type CoverageReport = {
  readonly version: number; readonly suite: string; readonly commit: string; readonly processes: number; readonly scripts: number;
  readonly files: readonly { readonly path: string; readonly functions: readonly FunctionEntry[] }[];
};

// Two processes of one build that ran sample.js and other.js differently. Offsets are characters of the compiled
// JavaScript; a range is [start, end, count]. The second process has other block ranges for outer, as V8 gives them:
// V8 reports a block only where its count differs from the count around it.
const firstProcess: ProcessRuns = {
  'dist/src/sample.js': [
    ['', [0, 400, 1]],
    ['__helper', [10, 60, 1], [30, 40, 0]],
    ['next', [20, 50, 1]],
    ['outer', [100, 300, 2], [200, 300, 0]],
    ['inner', [120, 180, 2], [150, 170, 0]],
  ],
  'dist/src/other.js': [['', [0, 100, 1]], ['', [20, 60, 0]]],
  'dist/test/unit/sample.test.js': [['', [0, 50, 1]], ['testCase', [10, 40, 1]]],
};
const secondProcess: ProcessRuns = {
  'dist/src/sample.js': [
    ['', [0, 400, 1]],
    ['__helper', [10, 60, 0]],
    ['outer', [100, 300, 1], [200, 250, 0]],
    ['inner', [120, 180, 0]],
  ],
  'dist/src/other.js': [['', [0, 100, 1]], ['', [20, 60, 3]]],
};

function repositoryWithCoverage(t: TestContext, processes: readonly ProcessRuns[]): GitRepository {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'README.md': '# Test\n' });
  writeV8Coverage(join(repository.root, 'v8-coverage'), repository.root, processes);
  return repository;
}

function reportIn(repository: GitRepository): CoverageReport {
  return JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8')) as CoverageReport;
}

function functionsOf(report: CoverageReport, path: string): readonly FunctionEntry[] {
  return report.files.find((file) => file.path === path)?.functions ?? [];
}

async function runFromFixture(t: TestContext): Promise<{ readonly repository: GitRepository; readonly report: CoverageReport }> {
  const repository = repositoryWithCoverage(t, [firstProcess, secondProcess]);
  const result = await runScript(t, astMetricsCoverageScript, { args: ['--allow-unverified', '--from', 'v8-coverage'], cwd: repository.root });
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Wrote ast-report/coverage.json. Files: 2. Processes: 2.\n');
  assert.equal(result.code, 0);
  return { repository, report: reportIn(repository) };
}

test('Given the coverage files of two processes that ran one build differently, when the command reads them with --from, then coverage.json holds the two src/ files, each call count is the sum of the two processes, and a character counts as covered when one process ran it', { timeout }, async (t) => {
  const { report } = await runFromFixture(t);

  assert.deepEqual({ ...report, provenance: undefined, files: [] }, {
    version: 2, measurementVersion: 'own-characters-1', unmeasuredFunctions: [], suite: 'unit', provenance: undefined, commit: null, processes: 2, scripts: 2, files: [],
  });
  assert.deepEqual(report.files.map((file) => file.path), ['src/other.ts', 'src/sample.ts']);
  // outer has 140 own characters after inner is removed. Only 200..250 stays uncovered.
  assert.deepEqual(functionsOf(report, 'src/sample.ts').find((entry) => entry.name === 'outer'), { name: 'outer', start: 100, end: 300, called: 3, coveredShare: 0.643 });
  // The first process did not call the function at 20, the second did.
  assert.deepEqual(functionsOf(report, 'src/other.ts')[1], { name: '(anonymous)', start: 20, end: 60, called: 3, coveredShare: 1 });
});

test('Given a function with a nested function, when the command reads the coverage, then the outer and the inner function each have an entry with their own share', { timeout }, async (t) => {
  const { report } = await runFromFixture(t);

  // inner has 60 characters. The first process did not run 150..170; the second did not call inner: 1 - 20 / 60.
  assert.deepEqual(functionsOf(report, 'src/sample.ts'), [
    { name: '(anonymous)', start: 0, end: 400, called: 2, coveredShare: 1 },
    { name: 'outer', start: 100, end: 300, called: 3, coveredShare: 0.643 },
    { name: 'inner', start: 120, end: 180, called: 2, coveredShare: 0.667 },
  ]);
});

test('Given a compiler helper with a function inside it and the script of a test file, when the command reads the coverage, then neither the helper, the function inside it, nor the test file is in coverage.json', { timeout }, async (t) => {
  const { report } = await runFromFixture(t);

  assert.deepEqual(functionsOf(report, 'src/sample.ts').map((entry) => entry.name), ['(anonymous)', 'outer', 'inner']);
  assert.deepEqual(report.files.map((file) => file.path), ['src/other.ts', 'src/sample.ts']);
});

// A build of one source file and one unit test file that imports it, as ES modules like the build of this repository.
const build = {
  'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"' } }),
  'dist/src/sample.js': "export function used(flag) {\n  if (flag) {\n    return 'yes';\n  }\n  return 'no';\n}\n\nexport function unused() {\n  return 0;\n}\n",
  'test/unit/user-portal/sample.test.ts': "import { test } from 'node:test'; test('portal part', () => {});\n",
  'dist/test/unit/sample.test.js': [
    "import assert from 'node:assert/strict';",
    "import { test } from 'node:test';",
    "import { used } from '../../src/sample.js';",
    "test('Given true, when used runs, then it gives yes', () => { assert.equal(used(true), 'yes'); });",
    '',
  ].join('\n'),
};

// The command makes its temporary folder in the folder that TMPDIR names. Thus the test sees that it is gone.
function temporaryFolder(t: TestContext): string {
  const folder = mkdtempSync(join(tmpdir(), 'thermus-coverage-test-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}

test('Given a build whose unit suite passes, when the command runs without --from, then it runs the suite with the test output on stderr, writes the coverage of the build of src/, and removes its temporary folder', { timeout }, async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', build);
  const temporary = temporaryFolder(t);

  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, env: { TMPDIR: temporary } });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /Given true, when used runs, then it gives yes/);
  assert.match(result.stdout, /^Wrote ast-report\/coverage\.json\. Files: 1\. Processes: \d+\.\n$/);
  const report = reportIn(repository);
  assert.equal(report.suite, 'unit');
  assert.deepEqual(report.files.map((file) => file.path), ['src/sample.ts']);
  const [module, used, unused] = functionsOf(report, 'src/sample.ts');
  assert.deepEqual([module?.name, module?.called, used?.name, used?.called, unused?.name, unused?.called, unused?.coveredShare], ['(anonymous)', 1, 'used', 1, 'unused', 0, 0]);
  // The test never gives false to used, so its last return stays uncovered.
  assert.ok(used !== undefined && used.coveredShare > 0 && used.coveredShare < 1, JSON.stringify(used));
  assert.deepEqual(readdirSync(temporary).filter((name) => name.startsWith('thermus-coverage-')), []);
});
