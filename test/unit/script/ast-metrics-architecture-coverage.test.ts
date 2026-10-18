import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// The coverage file of the architecture command: a file that the command cannot read, and files that are not coverage
// reports of version 1. An empty PATH has no git and no ast-metrics, so these cases also show that the command reads a
// coverage file next to two snapshot files without either tool. ast-metrics-architecture.test.ts specifies the command
// line and the snapshot files.
const noTools = { env: { PATH: '' } };

// The parts of a snapshot that the command reads, as script/ast-metrics-snapshot.ts writes them.
const snapshot = JSON.stringify({
  version: 1,
  commit: 'c0ffee00c0ffee00',
  global: { modularity: 0.5, crossShare: 0.25, cycles: [] },
  communities: [{ id: '0', label: 'a', members: ['src/a/0.ts'], files: 1, paths: 10, edges: [] }],
  files: [{ path: 'src/a/0.ts', maintainability: 70, paths: 10, functions: [{ name: 'run', paths: 10 }] }],
});

// Writes two snapshot files and gives the arguments that name them and the coverage file.
function argumentsWith(t: TestContext, coverage: string): string[] {
  const folder = dataDirectory(t);
  writeFileSync(join(folder, 'head.json'), snapshot);
  writeFileSync(join(folder, 'base.json'), snapshot);
  return ['--head', join(folder, 'head.json'), '--base-snapshot', join(folder, 'base.json'), '--coverage', coverage];
}

test('Given a --coverage file that does not exist, when the architecture command runs, then it fails with one diagnostic line that names the file', async (t) => {
  const missing = join(dataDirectory(t), 'missing.json');

  const result = await runScript(t, astMetricsArchitectureScript, { args: argumentsWith(t, missing), ...noTools });

  assert.equal(result.stderr, `ast-metrics-architecture: Cannot read the coverage file ${missing}.\n`);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

// The parts of a coverage report that the command reads, as script/ast-metrics-coverage.ts writes them.
const valid = { version: 1, suite: 'unit', files: [{ path: 'src/a/0.ts', functions: [{ name: 'run', start: 0, end: 10, called: 1, coveredShare: 0.5 }] }] };

for (const [name, text] of [
  ['text that is not JSON', 'Coverage'],
  ['a JSON array', '[]'],
  ['a report of version 2', JSON.stringify({ ...valid, version: 2 })],
  ['a snapshot', snapshot],
  ['a report without files', JSON.stringify({ ...valid, files: undefined })],
  ['a file without a path', JSON.stringify({ ...valid, files: [{ functions: [] }] })],
  ['a file without functions', JSON.stringify({ ...valid, files: [{ path: 'src/a/0.ts' }] })],
  ['a function without a name', JSON.stringify({ ...valid, files: [{ path: 'src/a/0.ts', functions: [{ coveredShare: 0.5 }] }] })],
  ['a covered share that is text', JSON.stringify({ ...valid, files: [{ path: 'src/a/0.ts', functions: [{ name: 'run', coveredShare: '0.5' }] }] })],
] as const) {
  test(`Given a --coverage file with ${name}, when the architecture command runs, then it fails with one diagnostic line that names the file`, async (t) => {
    const coverage = join(dataDirectory(t), 'coverage.json');
    writeFileSync(coverage, text);

    const result = await runScript(t, astMetricsArchitectureScript, { args: argumentsWith(t, coverage), ...noTools });

    assert.equal(result.stderr, `ast-metrics-architecture: The file ${coverage} is not a valid coverage report of version 1.\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

test('Given a valid --coverage file, when the architecture command runs, then it prints the report with the bands and exits 0', async (t) => {
  const coverage = join(dataDirectory(t), 'coverage.json');
  writeFileSync(coverage, JSON.stringify(valid));

  const result = await runScript(t, astMetricsArchitectureScript, { args: argumentsWith(t, coverage), ...noTools });

  assert.equal(result.stderr, '');
  assert.match(result.stdout, / · functions ≥ 30: 0 → 0\n/);
  assert.equal(result.code, 0);
});
