import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Snapshot } from '../../../script/code-quality/snapshot/types.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { repositoryFiles, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given a commit with a title and body, when its repository snapshot is captured, then the snapshot keeps the first message line', async (t) => {
  const repository = GitRepository.create(t);
  const title = 'Show component trends (#214)';
  repository.commit(`${title}\n\nKeep the commit body out of the title.`, repositoryFiles);
  const doubles = snapshotDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  const snapshot: Snapshot = JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'));
  assert.equal(snapshot.title, title);
});
