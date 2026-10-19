import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitStubCommit, pathWithGitStub } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { writeV8Coverage, type FunctionRuns, type ProcessRuns } from '../../support/fixtures/v8-coverage.ts';
import { astMetricsCoverageScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript, type ScriptResult } from '../../support/processes/script-command.ts';

// An empty PATH has no git. Thus the cases of the command line also show that the command checks its arguments first.
const noTools = { env: { PATH: '' } };

// Each merge case gives --from a temporary tree with identified script files. No case runs the real suite or a build.
// A range is [start, end, count] in UTF-16 units of the executed representation.
const root = resolve(fileURLToPath(repositoryRoot));

type FunctionEntry = { readonly name: string; readonly start: number; readonly end: number; readonly called: number; readonly coveredShare: number };
type CoverageReport = { readonly commit: string; readonly files: readonly { readonly path: string; readonly functions: readonly FunctionEntry[] }[] };

function temporaryFolder(t: TestContext): string {
  const folder = mkdtempSync(join(tmpdir(), 'thermus-coverage-unit-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}

// The command asks git for the root and the commit of HEAD before it reads the folder. A stub of git answers both from
// a PATH that holds nothing else, so these cases need no git, as the check stage of the hosted image has none.
function runFrom(t: TestContext, folder: string, out: string): Promise<ScriptResult> {
  return runScript(t, astMetricsCoverageScript, { args: ['--from', folder, '--out', out], cwd: dirname(folder), env: { PATH: pathWithGitStub(t, dirname(folder)) } });
}

async function reportOf(t: TestContext, processes: readonly ProcessRuns[]): Promise<CoverageReport> {
  const folder = temporaryFolder(t);
  writeV8Coverage(join(folder, 'v8'), folder, processes);
  const result = await runFrom(t, join(folder, 'v8'), join(folder, 'coverage.json'));
  assert.equal(result.code, 0, result.stderr);
  return JSON.parse(readFileSync(join(folder, 'coverage.json'), 'utf8')) as CoverageReport;
}

function functionsOf(report: CoverageReport, path: string): readonly FunctionEntry[] {
  return report.files.find((file) => file.path === path)?.functions ?? [];
}

test('Given --help, when the coverage command runs, then it explains the run of the unit suite, the options, the report file, and the exit status', async (t) => {
  const result = await runScript(t, astMetricsCoverageScript, { args: ['--help'], ...noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: node script\/code-quality\/ast-metrics-coverage\.ts \[--from DIR\] \[--out FILE\] \[--help\]\n/);
  for (const text of ['NODE_V8_COVERAGE', 'dist/test/unit/**/*.test.js', 'npm run build', 'dist/src/', 'ast-report/coverage.json', '__', 'Exit status 1']) {
    assert.ok(result.stdout.includes(text), `The help does not name ${text}.`);
  }
});

for (const [args, diagnostic] of [
  [['--from'], 'Invalid arguments. Use --help for the supported options.'],
  [['--from', '--out', 'coverage.json'], 'Invalid arguments. Use --help for the supported options.'],
  [['--to', 'coverage.json'], 'Invalid arguments. Use --help for the supported options.'],
  [['coverage-folder'], 'Invalid arguments. Use --help for the supported options.'],
  [['--from='], 'The --from value must name a folder.'],
  [['--out='], 'The --out value must name a file.'],
] as const) {
  test(`Given the arguments ${args.join(' ')}, when the coverage command runs, then it fails with one diagnostic line`, async (t) => {
    const result = await runScript(t, astMetricsCoverageScript, { args, ...noTools });

    assert.equal(result.stderr, `ast-metrics-coverage: ${diagnostic}\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

test('Given scripts in folders of dist/src/, in a sibling folder, of another type, and of tests, when the coverage command merges them, then each JavaScript file under dist/src/ has the path of its source file and source TypeScript is accepted while the others are absent', async (t) => {
  const module: readonly FunctionRuns[] = [['', [0, 10, 1]]];

  const report = await reportOf(t, [{
    'dist/src/auth/session.js': module, 'dist/src/with space/a.js': module, 'dist/src-old/b.js': module,
    'dist/src/data.json': module, 'dist/test/unit/c.test.js': module, 'src/d.ts': module,
  }]);

  assert.deepEqual(report.files.map((file) => file.path), ['src/auth/session.ts', 'src/d.ts', 'src/with space/a.ts']);
});

test('Given zero-count blocks that overlap in one process, when the coverage command merges them, then each uncovered character counts once', async (t) => {
  const report = await reportOf(t, [{ 'dist/src/a.js': [['', [0, 200, 1]], ['run', [0, 100, 1], [10, 50, 0], [30, 70, 0]]] }]);

  // 10..70 is uncovered: 1 - 60 / 100.
  assert.deepEqual(functionsOf(report, 'src/a.ts')[1], { name: 'run', start: 0, end: 100, called: 1, coveredShare: 0.4 });
});

test('Given a function that no process called, when the coverage command merges two processes, then it has no call and a covered share of 0', async (t) => {
  const runs: ProcessRuns = { 'dist/src/a.js': [['', [0, 100, 1]], ['never', [20, 80, 0]]] };

  const report = await reportOf(t, [runs, runs]);

  assert.deepEqual(functionsOf(report, 'src/a.ts')[1], { name: 'never', start: 20, end: 80, called: 0, coveredShare: 0 });
});

test('Given covered shares with more than three decimals, when the coverage command merges them, then each share is rounded to three decimals', async (t) => {
  const report = await reportOf(t, [{ 'dist/src/a.js': [['', [0, 100, 1]], ['third', [10, 13, 1], [12, 13, 0]], ['seventh', [20, 27, 5], [20, 21, 0]]] }]);

  assert.deepEqual(functionsOf(report, 'src/a.ts').map((entry) => entry.coveredShare), [1, 0.667, 0.857]);
});

test('Given compiler helpers, functions inside a helper, and a helper inside a source function, when the coverage command merges them, then only the source functions remain', async (t) => {
  const report = await reportOf(t, [{ 'dist/src/a.js': [
    ['', [0, 500, 1]],
    ['__addDisposableResource', [10, 100, 1]], ['dispose', [50, 90, 0]],
    ['__disposeResources', [110, 200, 1]], ['next', [120, 190, 4]], ['', [150, 160, 1]],
    ['run', [300, 450, 1]], ['__local', [320, 340, 1]],
  ] }]);

  assert.deepEqual(functionsOf(report, 'src/a.ts').map((entry) => entry.name), ['(anonymous)', 'run']);
});

test('Given files and functions in another order, when the coverage command merges them, then the files are in the order of their paths and the functions in the order of their start, the outer one first', async (t) => {
  const report = await reportOf(t, [
    { 'dist/src/b.js': [['', [0, 50, 1]], ['late', [30, 40, 1]], ['early', [10, 20, 1]]], 'dist/src/a-b.js': [['', [0, 10, 1]]] },
    { 'dist/src/a.js': [['', [0, 10, 1]]], 'dist/src/b.js': [['', [0, 50, 1]], ['first', [0, 8, 1]]] },
  ]);

  assert.deepEqual(report.files.map((file) => file.path), ['src/a-b.ts', 'src/a.ts', 'src/b.ts']);
  assert.deepEqual(functionsOf(report, 'src/b.ts').map((entry) => entry.name), ['(anonymous)', 'first', 'early', 'late']);
});

test('Given the stub of git on PATH, when the coverage command merges a folder, then the report names the commit that the stub reports for HEAD', async (t) => {
  const report = await reportOf(t, [{ 'dist/src/a.js': [['', [0, 10, 1]]] }]);

  assert.equal(report.commit, gitStubCommit);
});

test('Given --out with a folder that does not exist, when the coverage command runs, then it makes the folder, writes the report there, and names the file', async (t) => {
  const folder = temporaryFolder(t);
  writeV8Coverage(join(folder, 'v8'), folder, [{ 'dist/src/a.js': [['', [0, 10, 1]]] }]);
  const out = join(folder, 'new', 'deeper', 'report.json');

  const result = await runFrom(t, join(folder, 'v8'), out);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, `Wrote ${out}. Files: 1. Processes: 1.\n`);
  assert.equal(result.code, 0);
  assert.deepEqual(functionsOf(JSON.parse(readFileSync(out, 'utf8')) as CoverageReport, 'src/a.ts'), [{ name: '(anonymous)', start: 0, end: 10, called: 1, coveredShare: 1 }]);
});

const sourceUrl = pathToFileURL(join(root, 'dist/src/a.js')).href;
for (const [name, files, diagnostic] of [
  ['a folder without coverage files', { 'notes.txt': 'not coverage\n' }, (folder: string) => `${folder} holds no V8 coverage file (coverage-*.json).`],
  ['a coverage file that is not JSON', { 'coverage-1-1-0.json': '{"result": [' }, (folder: string) => `${join(folder, 'coverage-1-1-0.json')} is not a V8 coverage file.`],
  ['a coverage file without a result list', { 'coverage-1-1-0.json': '{"timestamp": 1}' }, (folder: string) => `${join(folder, 'coverage-1-1-0.json')} is not a V8 coverage file.`],
  ['a function without ranges', { 'coverage-1-1-0.json': JSON.stringify({ result: [{ url: sourceUrl, functions: [{ functionName: 'a', ranges: [] }] }] }) }, (folder: string) => `${join(folder, 'coverage-1-1-0.json')} is not a V8 coverage file.`],
  ['a range with a count that is not a number', { 'coverage-1-1-0.json': JSON.stringify({ result: [{ url: sourceUrl, functions: [{ functionName: 'a', ranges: [{ startOffset: 0, endOffset: 5, count: '1' }] }] }] }) }, (folder: string) => `${join(folder, 'coverage-1-1-0.json')} is not a V8 coverage file.`],
  ['coverage files without a script under dist/src/', { 'coverage-1-1-0.json': JSON.stringify({ result: [{ url: 'node:fs', functions: [] }] }) }, (folder: string) => `The coverage files in ${folder} name no script under dist/src/ or src/ of ${dirname(folder)}.`],
] as const) {
  test(`Given ${name}, when the coverage command reads the folder, then it fails with a diagnostic and writes no report`, async (t) => {
    const folder = join(temporaryFolder(t), 'v8');
    mkdirSync(folder);
    for (const [file, text] of Object.entries(files)) writeFileSync(join(folder, file), text.replaceAll(sourceUrl, pathToFileURL(join(dirname(folder), 'dist/src/a.js')).href));
    const out = join(folder, 'coverage.json');

    const result = await runFrom(t, folder, out);

    assert.equal(result.stderr, `ast-metrics-coverage: ${diagnostic(folder)}\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
    assert.equal(existsSync(out), false);
  });
}

test('Given a folder that does not exist, when the coverage command reads it, then it fails with a diagnostic', async (t) => {
  const folder = join(temporaryFolder(t), 'missing');

  const result = await runFrom(t, folder, join(folder, 'coverage.json'));

  assert.equal(result.stderr, `ast-metrics-coverage: Cannot read the folder ${folder}.\n`);
  assert.equal(result.code, 1);
});
