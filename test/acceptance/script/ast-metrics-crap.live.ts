import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { astMetricsCrapScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// Reuse compatible coverage. This check starts no build, collector, or nested test suite.
// Missing tools or reports defer the check; a present stale report must fail it.
const root = fileURLToPath(repositoryRoot);
const source = 'src/html-cleaner-pipeline/html-input-limit.ts';
const defaultReport = join(root, 'ast-report', 'coverage.json');
const coverage = resolve(root, process.env.AST_METRICS_CRAP_COVERAGE ?? defaultReport);
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const skip = !installed ? 'ast-metrics is not on PATH; the CRAP live check is deferred'
  : !existsSync(coverage) ? `No existing coverage report at ${coverage}; the CRAP live check is deferred` : false;

interface Row {
  readonly change: string;
  readonly paths: number;
  readonly score: number;
  readonly unmeasured: boolean;
}

function assertMeasuredCoverage(row: Row, covered: string): void {
  assert.match(covered, /^\d+(?:\.\d+)?%$/u);
  const percent = Number(covered.slice(0, -1));
  assert.ok(percent >= 0 && percent <= 100, covered);
  const share = percent / 100;
  const lower = row.paths ** 2 * (1 - Math.min(1, share + 1e-12)) ** 3 + row.paths;
  const upper = row.paths ** 2 * (1 - Math.max(0, share - 1e-12)) ** 3 + row.paths;
  assert.ok(row.score >= lower - 0.05 && row.score <= upper + 0.05, `${covered}: CRAP ${row.score}`);
}

function reportRow(line: string): Row {
  const cells = line.split(' | ');
  assert.equal(cells.length, 7, line);
  const [file, name, change, pathsCell, covered, scoreCell, advice] = cells;
  assert.equal(file, `| ${source}`, line);
  assert.notEqual(name, '', line);
  assert.ok(change === 'unchanged' || change === 'unknown', line);
  const paths = Number(pathsCell);
  assert.ok(Number.isSafeInteger(paths) && paths >= 0, line);
  const unmeasured = scoreCell.startsWith('≥ ');
  const score = Number(unmeasured ? scoreCell.slice(2) : scoreCell);
  const row = { change, paths, score, unmeasured };
  assert.ok(Number.isFinite(score), line);
  assert.ok(score >= paths && score <= paths ** 2 + paths + 0.05, line);
  if (unmeasured) {
    assert.equal(covered, 'unknown', line);
    assert.equal(score, paths, line);
    assert.match(advice, /no coverage data|split/u);
  } else {
    assertMeasuredCoverage(row, covered);
  }
  if (change === 'unknown') assert.match(advice, /identity unknown/u);
  if (change === 'unchanged' && score >= 30) assert.match(advice, /unchanged by this PR/u);
  return row;
}

test('Given real ast-metrics, compatible existing coverage and no source edits, when CRAP inspects a real file against HEAD, then each function has a bounded assessment, scope and consistent goal status without changing reports', { timeout: 60_000, skip }, async (t) => {
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }), '', 'The check needs a src/ without uncommitted changes.');
  const reports = [...new Set([coverage, defaultReport])].map((path) => ({ path, bytes: existsSync(path) ? readFileSync(path) : undefined }));
  t.after(() => {
    for (const { path, bytes } of reports) assert.deepEqual(existsSync(path) ? readFileSync(path) : undefined, bytes, `The coverage report changed: ${path}`);
  });

  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'HEAD', '--coverage', coverage, source], cwd: root });

  assert.equal(result.stderr, '', result.stderr);
  assert.match(result.stdout, /^## CRAP goals\n\nGoals: CRAP < 30; new functions also CRAP ≤ 15\./u);
  assert.ok(result.stdout.includes('| File | Function | Change | Paths | Coverage | CRAP | To do |'), result.stdout);
  const lines = result.stdout.split('\n').filter((line) => line.startsWith('| src/'));
  assert.ok(lines.length > 0, result.stdout);
  assert.ok(lines.some((line) => line.includes(' | assertHtmlInputSize | ')), result.stdout);
  const rows = lines.map(reportRow);
  const counts = /Known limit violations: (\d+)\. Measured target misses: (\d+)\. Unmeasured functions: (\d+)\. Required functions with unknown assessment or identity: (\d+)\./u.exec(result.stdout);
  assert.ok(counts, result.stdout);
  const [, violations, targetMisses, unmeasured, unknownRequired] = counts.map(Number);
  assert.equal(violations, rows.filter(({ score }) => score >= 30).length, result.stdout);
  assert.equal(targetMisses, rows.filter((row) => !row.unmeasured && row.score > 15).length, result.stdout);
  assert.equal(unmeasured, rows.filter((row) => row.unmeasured).length, result.stdout);
  assert.equal(unknownRequired, rows.filter(({ change }) => change === 'unknown').length, result.stdout);
  assert.equal(result.code, violations > 0 || unknownRequired > 0 ? 1 : 0, result.stdout);
  assert.equal(result.stdout.includes('Unmeasured values are lower bounds; the known violation count is not an exact total.'), unmeasured > 0, result.stdout);
});
