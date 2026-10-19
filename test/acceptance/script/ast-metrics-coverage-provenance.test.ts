import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { writeV8Coverage } from '../../support/fixtures/v8-coverage.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given raw data without original capture evidence, when imported, then publication fails unless inspection is explicit', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start', { 'README.md': '# Start\n' });
  writeV8Coverage(join(repository.root, 'raw'), repository.root, [{ 'dist/src/a.js': [['run', [0, 10, 1]]] }]);
  const failed = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, args: ['--from', 'raw'] });
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /capture manifest/);
  const inspected = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, args: ['--from', 'raw', '--allow-unverified'] });
  assert.equal(inspected.code, 0, inspected.stderr);
  const report = JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'));
  assert.equal(report.provenance.status, 'unverified');
  assert.equal(report.commit, null);
});
