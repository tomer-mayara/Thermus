import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript, astMetricsCoverageScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// This check builds and collects emitted Node and source portal unit coverage. Run it only when both complete unit
// groups are selected or src/ changed. On a shared host run no other suite at the same time. It needs ast-metrics on
// PATH and uses private coverage and trend reports. The default coverage report stays as it was.
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const skip = installed ? false : 'ast-metrics is not on PATH';
const root = fileURLToPath(repositoryRoot);

// --base HEAD needs a src/ without uncommitted edits. --touched names each src/ file so that every community appears.
// Unknown function identity can withhold a base estimate, even when both snapshots have the same source.
test('Given the coverage report of the real unit suite and no source edits, when architecture runs with --base HEAD and each src/ file touched, then head risk counts bound base estimates, every node has an assessable band or an incomplete note, no function is added or worse, and the default report stays unchanged within 5 minutes', { timeout: 300_000, skip }, async (t) => {
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }), '', 'The check needs a src/ without uncommitted changes.');
  const folder = dataDirectory(t);
  const coverageReport = join(folder, 'coverage.json');
  const defaultReport = join(root, 'ast-report', 'coverage.json');
  const defaultCoverage = existsSync(defaultReport) ? readFileSync(defaultReport) : undefined;
  t.after(() => assert.deepEqual(existsSync(defaultReport) ? readFileSync(defaultReport) : undefined, defaultCoverage, 'The default coverage report changed.'));
  const coverage = await runScript(t, astMetricsCoverageScript, { args: ['--out', coverageReport], cwd: root });
  // The output of the suite is long; its end holds the summary and the diagnostic.
  assert.equal(coverage.code, 0, coverage.stderr.slice(-4000));
  const touched = execFileSync('git', ['ls-files', '--', 'src/*.ts'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  const args = ['--base', 'HEAD', '--touched', touched.join(','), '--trend-store', join(folder, 'metrics'), '--coverage', coverageReport];

  const result = await runScript(t, astMetricsArchitectureScript, { args, cwd: root, env: { TMPDIR: folder } });

  assert.equal(result.code, 0, result.stderr);
  const lines = result.stdout.split('\n');
  const counts = / · functions ≥ 30: (\d+) → (\d+)$/.exec(lines[2]);
  assert.ok(counts, result.stdout);
  assert.ok(Number(counts[1]) <= Number(counts[2]), lines[2]);
  const nodes = lines.filter((line) => /^ {2}c_\w+\["/.test(line));
  assert.ok(nodes.length > 0, result.stdout);
  assert.deepEqual(nodes.filter((line) => !/<br\/>(?:(?:● good|▲ warning): \d+ fn ≥ 30(?: \(\+\d+\))?(?:; assessment incomplete: \d+ unknown)?|assessment incomplete: \d+ unknown; 0 known fn ≥ 30)"\]$/.test(line)), [], result.stdout);
  const cells = lines.filter((line) => line.startsWith('| src/')).map((row) => row.split(' | ')[3]);
  assert.equal(cells.length, touched.length, result.stdout);
  for (const cell of cells) {
    if (cell === 'not measured') continue;
    const sides = /^(not measured|\d+) → (\d+)(?: ↑\d+)?$/.exec(cell);
    assert.ok(sides, cell);
    if (sides[1] !== 'not measured') assert.ok(Number(sides[1]) <= Number(sides[2]), cell);
  }
  assert.ok(result.stdout.includes('\n### Functions at CRAP 30 or more, added or worse\n\nNone.\n\nUnmatched functions: '), result.stdout);
});
