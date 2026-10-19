import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { astMetricsMcpFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { crapFixture } from './fixtures/ast-metrics-crap.ts';

for (const fault of ['unverified', 'source', 'unit helper', 'build input']) {
  test(`Given ${fault} coverage evidence, when the required assessment runs, then it fails with no measured table or MCP request`, async (t) => {
    const { repository, fake, file, report } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
    if (fault === 'unverified') writeFileSync(file, JSON.stringify({ ...report(), provenance: { status: 'unverified', reason: 'imported raw data' } }));
    else repository.write({ [fault === 'source' ? 'src/a.ts' : fault === 'unit helper' ? 'test/support/fixture.ts' : 'tsconfig.json']: '// changed inputs\n' });
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, fault === 'unverified' ? /no verified provenance/ : /another tree/);
    assert.deepEqual(fake.requests(), []);
  });
}

for (const functions of [undefined, {}, [{ name: 'run', cyclomatic_complexity: -1 }], [{ name: 'run', cyclomatic_complexity: 'four' }], []]) {
  test(`Given incomplete or invalid file metrics ${JSON.stringify(functions)}, when the required assessment runs, then it fails without a measured table`, async (t) => {
    const { repository, file } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
    const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: { 'src/a.ts': { functions } } } });
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
    assert.equal(result.code, 1, result.stdout);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /metrics|source declarations/);
  });
}

for (const share of [-0.1, 1.1]) {
  test(`Given a covered share ${share}, when goals run, then invalid coverage cannot pass`, async (t) => {
    const { repository, fake, file } = crapFixture(t, [{ name: 'run', paths: 4, share }]);
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /covered share/);
    assert.deepEqual(fake.requests(), []);
  });
}

test('Given compatible coverage from an older prose-only commit and no emitted build, when explicit inspection runs, then it uses the original capture without changing the report', async (t) => {
  const { repository, fake, file } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
  const original = readFileSync(file, 'utf8');
  repository.commit('Update prose', { 'README.md': 'Prose only.\n' });
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'HEAD', '--coverage', file, join(repository.root, 'src/a.ts')], cwd: repository.root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /\| unchanged \|/);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('Given invalid source syntax without reported functions, when inspection runs, then missing assessment cannot pass', async (t) => {
  const { repository, file, coverage } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
  repository.write({ 'src/a.ts': 'export const =' });
  coverage();
  const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: { 'src/a.ts': { functions: [] } } } });
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /source evidence/);
});

for (const overload of [false, true]) {
  test(`Given ${overload ? 'an overload signature and implementation' : 'a type-only file'}, when metrics omit nonexecutable declarations, then they are not reported as omitted functions`, async (t) => {
    const { repository, file, coverage } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
    repository.write({ 'src/a.ts': overload ? 'export function run(value: string): string;\nexport function run(value: string) { return value; }' : 'export interface Run { (): number; }' });
    coverage();
    const fake = astMetricsMcpFakeOnPath(t, { answers: { get_file_metrics: { 'src/a.ts': { functions: overload ? [{ name: 'run', cyclomatic_complexity: 1 }] : [] } } } });
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
    assert.equal(result.stderr, '');
    assert.equal(result.code, overload ? 1 : 0, result.stdout);
    if (overload) assert.match(result.stdout, /identity unknown/);
  });
}
