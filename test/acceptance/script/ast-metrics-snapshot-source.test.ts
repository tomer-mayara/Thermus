import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { repositoryFiles, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given source declarations, when metrics are captured, then the snapshot binds unique names to source identity and leaves unmatched names unknown', async (t) => {
  const repository = GitRepository.create(t);
  const source = 'export function renderAccount(value: string) { return value.trim(); }\n';
  repository.commit('Add source', { ...repositoryFiles, 'src/admin/pages/account.ts': source });
  const doubles = snapshotDoublesOnPath(t);
  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  const snapshot = JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'));
  const file = snapshot.files.find((entry: { path: string }) => entry.path === 'src/admin/pages/account.ts');
  assert.deepEqual(file.sourceEvidence, { version: 'typescript-tokens-v1', coordinates: 'utf16', complete: true });
  assert.deepEqual(Object.keys(file.functions[0].identity).sort(), ['body', 'end', 'kind', 'name', 'owner', 'signature', 'start', 'version']);
  assert.equal(file.functions[0].identity.name, 'renderAccount');
  assert.equal(file.functions[0].identity.kind, 'FunctionDeclaration');
  assert.equal(source.slice(file.functions[0].identity.start, file.functions[0].identity.end), source.trim());
  const unmatched = snapshot.files.find((entry: { path: string }) => entry.path === 'src/auth/tokens.ts');
  assert.equal(unmatched.functions[0].identity, undefined);
  assert.equal(unmatched.sourceEvidence.complete, false);
});
