import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { assertArchitectureOfHead } from './fixtures/ast-metrics-live-assertions.ts';

// These checks run the real ast-metrics on this repository. They need the executable on PATH; the guide is
// docs/implementation/ast-metrics-review.md. Without it, Node reports the checks as skipped. With --base HEAD, the base
// is the commit of HEAD, so the checks need a src/ without changes that are not committed. Each check gives the command
// a trend store in a folder of the test with --trend-store, so that no check writes to docs/metrics/ of the repository.
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const skip = installed ? false : 'ast-metrics is not on PATH';
const root = fileURLToPath(repositoryRoot);

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

// A structural run explicitly skips coverage and reads the empty private trend store without recording.
test('Given the real ast-metrics and no source edits, when architecture runs with explicit coverage skip, then equal structure includes every community and populated source component and creates no record or worktree', { timeout: 30_000, skip }, async (t) => {
  assert.equal(git('status', '--porcelain', '--', 'src'), '', 'The check needs a src/ without uncommitted changes.');
  const folder = dataDirectory(t);
  const store = join(folder, 'metrics');
  const args = ['--base', 'HEAD', '--trend-store', store, '--no-coverage'];
  const result = await runScript(t, astMetricsArchitectureScript, { args, cwd: root, env: { TMPDIR: folder } });
  assert.equal(result.code, 0, result.stderr);
  assertArchitectureOfHead(result.stdout, git('rev-parse', 'HEAD').trim(), git('ls-files', '--', 'src'));
  assert.equal(existsSync(store), false);
  assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith('thermus-snapshot-base-')), []);
  const worktrees = git('worktree', 'list', '--porcelain');
  assert.equal(worktrees.includes(realpathSync(folder)), false, worktrees);
});
