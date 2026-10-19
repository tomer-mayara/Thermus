import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { astMetricsMcpFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const script = astMetricsCrapScript;

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
