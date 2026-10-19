import assert from 'node:assert/strict';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { astMetricsMcpFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { crapFixture } from './fixtures/ast-metrics-crap.ts';

for (const path of ['README.md', 'src/missing.ts', 'src/a.js', '../outside.ts', 'src/user-portal/dist/generated.ts', 'src/node_modules/pkg.ts']) {
  test(`Given invalid inspection path ${path}, when goals run, then input validation fails before coverage or MCP`, async (t) => {
    const { repository, fake } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
    repository.write({ 'README.md': '', 'src/a.js': '', 'src/user-portal/dist/generated.ts': '', 'src/node_modules/pkg.ts': '' });
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', 'missing.json', path], cwd: repository.root, env: fake.env });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /must name an existing source file/);
    assert.deepEqual(fake.requests(), []);
  });
}

test('Given a src symlink to a file outside the repository, when inspection runs, then it fails path validation', async (t) => {
  const { repository, fake } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
  symlinkSync(astMetricsCrapScript, join(repository.root, 'src/escape.ts'));
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', 'src/escape.ts'], cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /must name an existing source file/);
  assert.deepEqual(fake.requests(), []);
});

for (const allow of [false, true]) {
  test(`Given an unpinned MCP version and override ${allow}, when goals run, then the version policy controls the result`, async (t) => {
    const { repository, file } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
    const fake = astMetricsMcpFakeOnPath(t, { version: '9.9.9', answers: { get_file_metrics: { 'src/a.ts': { functions: [{ name: 'run', cyclomatic_complexity: 1 }] } } } });
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file, ...(allow ? ['--allow-tool-version'] : [])], cwd: repository.root, env: fake.env });
    assert.equal(result.code, allow ? 0 : 1, result.stderr);
    if (!allow) assert.match(result.stderr, /not the pinned/);
  });
}

test('Given a tracked generated source path in the default delta and a caller below the root, when goals run, then path validation fails before coverage or MCP', async (t) => {
  const { repository, fake } = crapFixture(t, [{ name: 'run', paths: 1, share: 1 }]);
  repository.commit('Track generated source', { 'src/user-portal/dist/generated.ts': 'export function generated() { return 1; }' });
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', 'missing.json'], cwd: join(repository.root, 'src'), env: fake.env });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /generated\.ts must name an existing source file/);
  assert.deepEqual(fake.requests(), []);
});
