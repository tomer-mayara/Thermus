import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// This check runs the real ast-metrics on this repository. It needs the executable on PATH; the guide is
// docs/implementation/ast-metrics-review.md. Without it, Node reports the check as skipped. With --base HEAD, the base
// is the commit of HEAD, so the check needs a src/ without changes that are not committed.
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const live = { timeout: 30_000, skip: installed ? false : 'ast-metrics is not on PATH' };
const root = fileURLToPath(repositoryRoot);

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

// TMPDIR names a folder of the test, so that the check sees each folder that the command leaves there.
test('Given the real ast-metrics and a src/ without uncommitted changes, when the architecture delta runs with --base HEAD, then both sides of each number of the summary line are equal and the map did not change, within 30 seconds, and no worktree stays', live, async (t) => {
  assert.equal(git('status', '--porcelain', '--', 'src'), '', 'The check needs a src/ without uncommitted changes.');
  const folder = dataDirectory(t);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'HEAD'], cwd: root, env: { TMPDIR: folder } });

  assert.equal(result.code, 0, result.stderr);
  const [header, , summary] = result.stdout.split('\n');
  assert.equal(header, `## Architecture of src/: base ${git('rev-parse', 'HEAD').slice(0, 8)} → head`);
  const sides = [...summary.matchAll(/(\S+) → (\S+)/g)].map(([, before, after]) => [before, after]);
  assert.equal(sides.length, 4, summary);
  assert.deepEqual(sides.filter(([before, after]) => before !== after), [], summary);
  assert.ok(result.stdout.endsWith(`${summary}\n\nThe map did not change.\n`), result.stdout);
  assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith('thermus-snapshot-base-')), []);
  const worktrees = git('worktree', 'list', '--porcelain');
  assert.equal(worktrees.includes(realpathSync(folder)), false, worktrees);
});
