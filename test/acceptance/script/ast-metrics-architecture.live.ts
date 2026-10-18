import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript, astMetricsCoverageScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { bandsNeedTheCoverage, noProductionFile } from './fixtures/ast-metrics-architecture-snapshots.ts';

// These checks run the real ast-metrics on this repository. They need the executable on PATH; the guide is
// docs/implementation/ast-metrics-review.md. Without it, Node reports the checks as skipped. With --base HEAD, the base
// is the commit of HEAD, so the checks need a src/ without changes that are not committed.
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const skip = installed ? false : 'ast-metrics is not on PATH';
const root = fileURLToPath(repositoryRoot);
const coverageReport = join(root, 'ast-report', 'coverage.json');

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

// TMPDIR names a folder of the test, so that the check sees each folder that the command leaves there. With --base HEAD,
// the changed files are the files of the working tree that differ from HEAD, and src/ has none of them. A coverage
// report of an earlier run gives the summary line its count of the functions at CRAP 30 or more; without one, the line
// after the summary says that the bands need it.
test('Given the real ast-metrics and a src/ without uncommitted changes, when the architecture delta runs with --base HEAD, then both sides of each number of the summary line are equal, the map did not change, and no production file changed, within 30 seconds, and no worktree stays', { timeout: 30_000, skip }, async (t) => {
  assert.equal(git('status', '--porcelain', '--', 'src'), '', 'The check needs a src/ without uncommitted changes.');
  const folder = dataDirectory(t);
  const banded = existsSync(coverageReport);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD'], cwd: root, env: { TMPDIR: folder } });

  assert.equal(result.code, 0, result.stderr);
  const [header, , summary] = result.stdout.split('\n');
  assert.equal(header, `## Architecture of src/: base ${git('rev-parse', 'HEAD').slice(0, 8)} → head`);
  const sides = [...summary.matchAll(/(\S+) → (\S+)/g)].map(([, before, after]) => [before, after]);
  assert.equal(sides.length, banded ? 5 : 4, summary);
  assert.deepEqual(sides.filter(([before, after]) => before !== after), [], summary);
  const coverageNote = banded ? [] : [bandsNeedTheCoverage, ''];
  assert.ok(result.stdout.endsWith([summary, '', ...coverageNote, 'The map did not change.', '', ...noProductionFile, ''].join('\n')), result.stdout);
  assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith('thermus-snapshot-base-')), []);
  const worktrees = git('worktree', 'list', '--porcelain');
  assert.equal(worktrees.includes(realpathSync(folder)), false, worktrees);
});

// The coverage run is the real unit suite of dist/, about 90 seconds on a developer Mac: run npm run build first, and on
// a shared host run no other suite at the same time. --touched names each src/ file, so that each community is touched
// and the graph shows every node. Both sides are the same tree, so no count changes and no function is added or worse.
test('Given the coverage report of the real unit suite, when the architecture delta runs with --base HEAD and each src/ file touched, then the summary line ends with the same count of the functions at CRAP 30 or more on both sides, each node has the band good or warning without a change, each row has a CRAP cell with equal sides, and the list names no function, within 5 minutes', { timeout: 300_000, skip }, async (t) => {
  assert.equal(git('status', '--porcelain', '--', 'src'), '', 'The check needs a src/ without uncommitted changes.');
  t.after(() => rmSync(coverageReport, { force: true }));
  const coverage = await runScript(t, astMetricsCoverageScript, { cwd: root });
  // The output of the suite is long; its end holds the summary and the diagnostic.
  assert.equal(coverage.code, 0, coverage.stderr.slice(-4000));
  const touched = git('ls-files', '--', 'src/*.ts').trim().split('\n');

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD', '--touched', touched.join(',')], cwd: root, env: { TMPDIR: dataDirectory(t) } });

  assert.equal(result.code, 0, result.stderr);
  const lines = result.stdout.split('\n');
  assert.match(lines[2], / · functions ≥ 30: (\d+) → \1$/);
  const nodes = lines.filter((line) => /^ {2}c_\w+\["/.test(line));
  assert.ok(nodes.length > 0, result.stdout);
  assert.deepEqual(nodes.filter((line) => !/<br\/>(● good|▲ warning): \d+ fn ≥ 30"\]$/.test(line)), [], result.stdout);
  const cells = lines.filter((line) => line.startsWith('| src/')).map((row) => row.split(' | ')[3]);
  assert.equal(cells.length, touched.length, result.stdout);
  assert.deepEqual(cells.filter((cell) => !/^(\d+) → \1$|^not measured$/.test(cell)), [], result.stdout);
  assert.ok(result.stdout.includes('\n### Functions at CRAP 30 or more, added or worse\n\nNone.\n\nUnmatched functions: '), result.stdout);
});
