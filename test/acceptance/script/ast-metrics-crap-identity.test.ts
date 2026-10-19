import assert from 'node:assert/strict';
import { readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { astMetricsMcpFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { crapFixture } from './fixtures/ast-metrics-crap.ts';
import { requiredGoalsMarkdown } from './fixtures/ast-metrics-crap-goldens.ts';

for (const scenario of ['same-name unrelated', 'duplicate declaration', 'anonymous', 'removed predecessor']) {
  test(`Given ${scenario} source evidence, when goals run, then identity remains unknown and fails even with full coverage`, async (t) => {
    const { repository, file, coverage } = crapFixture(t, [{ name: 'run', paths: 8, share: 1 }], 'export function old() { return 99; }');
    const source = scenario === 'duplicate declaration' ? 'export function run() { return 1; }\nexport function run() { return 2; }' : scenario === 'anonymous' ? 'export const tasks = [() => 1];' : 'export function run() { return 1; }';
    repository.write({ 'src/a.ts': source });
    if (scenario === 'same-name unrelated') {
      repository.git('mv', 'src/a.ts', 'src/a-moved.ts');
      repository.write({ 'src/a.ts': source });
    }
    coverage();
    const functions = [{ name: scenario === 'anonymous' ? '' : 'run', cyclomatic_complexity: 8 }, ...(scenario === 'duplicate declaration' ? [{ name: 'run', cyclomatic_complexity: 8 }] : [])];
    const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: { 'src/a.ts': { functions } } } });
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file, 'src/a.ts'], cwd: repository.root, env: fake.env });
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stdout, /\| unknown \|/);
    assert.match(result.stdout, /identity unknown/);
  });
}

for (const scenario of ['file rename', 'function move and rename']) {
  test(`Given a proven ${scenario}, when explicit inspection runs, then source continuity keeps unchanged identity`, async (t) => {
    const { repository, file, coverage, report } = crapFixture(t, [{ name: 'run', paths: 4, share: 0 }], 'export function run() { return 1; }');
    if (scenario === 'file rename') renameSync(join(repository.root, 'src/a.ts'), join(repository.root, 'src/b.ts'));
    else repository.write({ 'src/a.ts': '', 'src/b.ts': 'export function renamed() { return 1; }' });
    repository.git('add', '--all');
    coverage();
    const name = scenario === 'file rename' ? 'run' : 'renamed';
    const coverageReport = report();
    repository.write({ 'ast-report/coverage.json': JSON.stringify({ ...coverageReport, files: [{ path: 'src/b.ts', functions: [{ name, coveredShare: 0 }] }] }) });
    const original = readFileSync(file, 'utf8');
    const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: { 'src/b.ts': { functions: [{ name, cyclomatic_complexity: 4 }] } } } });
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file, 'src/b.ts'], cwd: repository.root, env: fake.env });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /\| unchanged \|/);
    assert.equal(readFileSync(file, 'utf8'), original);
  });
}

test('Given a new risk and unknown identity in two selected files, when inspection runs, then one server gives the complete actionable Markdown', async (t) => {
  const { repository, file, coverage } = crapFixture(t, [{ name: 'run', paths: 20, share: 0.5 }]);
  repository.write({ 'src/b.ts': 'export const tasks = [() => 1];' });
  coverage();
  const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: {
    'src/a.ts': { functions: [{ name: 'run', cyclomatic_complexity: 20 }] },
    'src/b.ts': { functions: [{ name: '', cyclomatic_complexity: 8 }] },
  } } });
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stdout, requiredGoalsMarkdown);
  assert.deepEqual(fake.calls().map(({ tool }) => tool), ['get_file_metrics', 'get_file_metrics']);
  assert.equal(new Set(fake.requests().map(({ pid }) => pid)).size, 1);
});
