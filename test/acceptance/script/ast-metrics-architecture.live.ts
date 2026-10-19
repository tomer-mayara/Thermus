import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript, astMetricsCoverageScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { bandsNeedTheCoverage, noProductionFile, trendHeading } from './fixtures/ast-metrics-architecture-snapshots.ts';

// These checks run the real ast-metrics on this repository. They need the executable on PATH; the guide is
// docs/implementation/ast-metrics-review.md. Without it, Node reports the checks as skipped. With --base HEAD, the base
// is the commit of HEAD, so the checks need a src/ without changes that are not committed. Each check gives the command
// a trend store in a folder of the test with --trend-store, so that no check writes to docs/metrics/ of the repository.
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
// after the summary says that the bands need it. The new store gets the record of HEAD, so the trend table has the row
// of HEAD and the row of the head, with the same numbers. The folder of the test, with the store, goes after the test.
test('Given the real ast-metrics, a src/ without uncommitted changes, and an empty trend store, when the architecture delta runs with --base HEAD and --trend-store, then both sides of each number of the summary line are equal, the unchanged map graph has every community, no production file changed, the store holds the record of HEAD, and the trend table ends with the row of HEAD and the row of the head with the same numbers, within 30 seconds, and no worktree stays', { timeout: 30_000, skip }, async (t) => {
  assert.equal(git('status', '--porcelain', '--', 'src'), '', 'The check needs a src/ without uncommitted changes.');
  const folder = dataDirectory(t);
  const store = join(folder, 'metrics');
  const banded = existsSync(coverageReport);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD', '--trend-store', store], cwd: root, env: { TMPDIR: folder } });

  assert.equal(result.code, 0, result.stderr);
  const [header, , summary] = result.stdout.split('\n');
  const [commit, date] = [git('rev-parse', 'HEAD').trim(), git('show', '-s', '--format=%cI', 'HEAD').trim()];
  assert.equal(header, `## Architecture of src/: base ${commit.slice(0, 8)} → head`);
  const sides = [...summary.matchAll(/(\S+) → (\S+)/g)].map(([, before, after]) => [before, after]);
  assert.equal(sides.length, banded ? 5 : 4, summary);
  assert.deepEqual(sides.filter(([before, after]) => before !== after), [], summary);
  const coverageNote = banded ? [] : [bandsNeedTheCoverage, ''];
  assert.ok(result.stdout.includes([summary, '', ...coverageNote, 'The map did not change.', '', '```mermaid', 'flowchart LR'].join('\n')), result.stdout);
  const nodes = result.stdout.split('\n').filter((line) => /^ {2}c_\w+\["/.test(line));
  const communityCount = summary.match(/communities (\d+) → (\d+)/);
  assert.ok(communityCount, summary);
  assert.equal(nodes.length, Number(communityCount[2]), result.stdout);
  assert.ok(result.stdout.includes(['', ...noProductionFile, '', trendHeading, ''].join('\n')), result.stdout);
  assert.match(result.stdout, /\nLegend: /);
  assert.deepEqual(readdirSync(store), [`${date.slice(0, 10)}-${commit.slice(0, 8)}.json`]);
  const [baseRow, headRow] = result.stdout.trimEnd().split('\n').slice(-2);
  assert.equal(headRow, baseRow.replace(`| ${commit.slice(0, 8)} | ${date.slice(0, 10)} |`, '| this pull request | |'), result.stdout);
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
  const folder = dataDirectory(t);
  const args = ['--base', 'HEAD', '--touched', touched.join(','), '--trend-store', join(folder, 'metrics')];

  const result = await runScript(t, astMetricsArchitectureScript, { args, cwd: root, env: { TMPDIR: folder } });

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
