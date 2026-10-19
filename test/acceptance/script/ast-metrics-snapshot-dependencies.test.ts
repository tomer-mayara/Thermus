import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Snapshot } from '../../../script/code-quality/snapshot/types.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { repositoryFiles, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given local imports and unknown targets, when a snapshot is captured, then it persists normalized file pairs and incomplete evidence', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Add imports', {
    ...repositoryFiles,
    'src/auth/session.ts': 'import type { Id } from "../kernel/ids.js";\nexport { Id } from "../kernel/ids.ts";\nimport "./missing.js";\nconst value = import(target);\n',
    'src/admin/pages/account.ts': 'export const load = () => import("../../auth/session.js");\n',
  });
  const doubles = snapshotDoublesOnPath(t);
  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  const snapshot = JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8')) as Snapshot;
  assert.deepEqual(snapshot.dependencies, {
    version: 1,
    pairs: [
      { from: 'src/admin/pages/account.ts', to: 'src/auth/session.ts', kinds: ['dynamic'] },
      { from: 'src/auth/session.ts', to: 'src/kernel/ids.ts', kinds: ['re-export', 'type'] },
    ],
    issues: [
      { path: 'src/auth/session.ts', reason: 'non-literal-dynamic' },
      { path: 'src/auth/session.ts', specifier: './missing.js', reason: 'unresolved-local' },
    ],
  });
});
