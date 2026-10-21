import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { astMetricsMcpFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { crapFixture } from './fixtures/ast-metrics-crap.ts';
import { requiredGoalsMarkdown } from './fixtures/ast-metrics-crap-goldens.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const script = astMetricsCrapScript;
const jsonOption = ['--json', 'ast-report/crap.json'];

function writtenRows(repository: GitRepository) {
  return JSON.parse(readFileSync(join(repository.root, 'ast-report/crap.json'), 'utf8')) as { version: number; base: string; head: string; rows: Record<string, unknown>[] };
}

// File, Function, Change and Paths of each table row, in the order of the table.
function tableCells(report: string): string[][] {
  return report.split('\n').filter((line) => line.startsWith('| src/')).map((line) => line.slice(2, -2).split(' | ').slice(0, 4));
}

test('Given no changed production file, when the CRAP goal runs, then it passes without coverage or MCP', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'README.md': 'Initial prose.\n' });
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, script, { cwd: repository.root, args: ['--base', 'main', '--coverage', 'missing.json'], env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'No production files to assess.\n');
  assert.deepEqual(fake.requests(), []);
});

test('Given a changed production file without coverage, when the CRAP goal runs, then it fails unresolved without a measured table or MCP', async (t) => {
  const repository = GitRepository.withBranchAdding(t, ['src/new.ts']);
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, script, { cwd: repository.root, args: ['--base', 'main'], env: fake.env });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /No coverage report/);
  assert.deepEqual(fake.requests(), []);
});

test('Given a new measured function and an unmeasured function without identity, when the CRAP goal runs with --json, then the file holds the rows of the table in its order and the table and exit status stay the same', async (t) => {
  const { repository, file, coverage } = crapFixture(t, [{ name: 'run', paths: 20, share: 0.5 }]);
  repository.write({ 'src/b.ts': 'export const tasks = [() => 1];' });
  coverage();
  const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: {
    'src/a.ts': { functions: [{ name: 'run', cyclomatic_complexity: 20 }] },
    'src/b.ts': { functions: [{ name: '', cyclomatic_complexity: 8 }] },
  } } });
  const result = await runScript(t, script, { cwd: repository.root, args: ['--base', 'main', '--coverage', file, ...jsonOption], env: fake.env });
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stdout, requiredGoalsMarkdown);
  const written = writtenRows(repository);
  assert.deepEqual(Object.keys(written), ['version', 'base', 'head', 'rows']);
  assert.equal(written.version, 1);
  assert.equal(written.base, repository.git('merge-base', 'main', 'HEAD').trim());
  assert.equal(written.head, repository.git('rev-parse', 'HEAD').trim());
  assert.deepEqual(written.rows.map((row) => [row.file, row.function, row.change, String(row.paths)]), tableCells(result.stdout));
  const { identity, ...measured } = written.rows[0];
  assert.deepEqual(measured, { file: 'src/a.ts', function: 'run', change: 'new', paths: 20, share: 0.5, crap: 70 });
  assert.equal(typeof identity, 'string');
  assert.deepEqual(written.rows[1], { file: 'src/b.ts', function: '(anonymous)', change: 'unknown', paths: 8 });
});

test('Given no changed production file, when the CRAP goal runs with --json, then the file has no rows and the command passes without coverage or MCP', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'README.md': 'Initial prose.\n' });
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, script, { cwd: repository.root, args: ['--base', 'main', '--coverage', 'missing.json', ...jsonOption], env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'No production files to assess.\n');
  const head = repository.git('rev-parse', 'HEAD').trim();
  assert.deepEqual(writtenRows(repository), { version: 1, base: head, head, rows: [] });
  assert.deepEqual(fake.requests(), []);
});
