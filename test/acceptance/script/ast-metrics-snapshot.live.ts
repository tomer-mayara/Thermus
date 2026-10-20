import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Snapshot } from '../../../script/code-quality/snapshot/types.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsSnapshotScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { assertSnapshotOfHead } from './fixtures/ast-metrics-live-assertions.ts';

// This check runs the real ast-metrics on this repository. It needs the executable on PATH; the guide is
// docs/implementation/ast-metrics-review.md. Without it, Node reports the check as skipped. The snapshot goes to a
// temporary folder, so that ast-report/snapshot.json stays as it was.
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const live = { timeout: 60_000, skip: installed ? false : 'ast-metrics is not on PATH' };
const root = fileURLToPath(repositoryRoot);

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function snapshotIn(path: string): Snapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
}

test('Given the real ast-metrics, when the snapshot runs in the repository root, then it keeps native file MI precision and valid source metrics within 60 seconds', live, async (t) => {
  const folder = dataDirectory(t);
  const out = join(folder, 'snapshot.json');

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--out', out], cwd: root });

  assert.equal(result.code, 0, result.stderr);
  const snapshot = snapshotIn(out);
  assertSnapshotOfHead(snapshot, git('rev-parse', 'HEAD').trim());
  const nativePath = join(folder, 'native.json');
  execFileSync('ast-metrics', ['analyze', `--report-json=${nativePath}`, '--report-summary=false', 'src'], { cwd: root, env: { ...process.env, PWD: root }, stdio: 'pipe', timeout: 60_000 });
  const native = JSON.parse(readFileSync(nativePath, 'utf8')) as { concernedFiles: readonly { path: string; maintainability?: { maintainabilityIndex?: number } }[] };
  const indexes = new Map(native.concernedFiles.map((file) => [relative(root, file.path).split(sep).join('/'), file.maintainability?.maintainabilityIndex]));
  for (const file of snapshot.files) {
    assert.ok(indexes.has(file.path), file.path);
    const raw = indexes.get(file.path);
    assert.equal(file.maintainabilityRaw, raw, file.path);
    assert.equal(file.maintainability, raw === undefined ? undefined : Number(raw.toFixed(1)), file.path);
  }
  assert.ok(snapshot.files.some((file) => file.maintainabilityRaw !== undefined && file.maintainabilityRaw !== file.maintainability), 'The native report must include precision beyond the display value.');
});

// HEAD is the merge base of HEAD and HEAD, so the temporary worktree holds the commit of HEAD. TMPDIR names a folder of
// the test, so that the check sees each folder that the command leaves there.
test('Given the real ast-metrics, when the snapshot runs with --base HEAD, then it has valid source communities, dependencies, and counts and names HEAD within 30 seconds, and no worktree stays', { ...live, timeout: 30_000 }, async (t) => {
  const folder = dataDirectory(t);
  const out = join(folder, 'snapshot-base.json');

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'HEAD', '--out', out], cwd: root, env: { TMPDIR: folder } });

  assert.equal(result.code, 0, result.stderr);
  assertSnapshotOfHead(snapshotIn(out), git('rev-parse', 'HEAD').trim());
  assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith('thermus-snapshot-base-')), []);
  const worktrees = git('worktree', 'list', '--porcelain');
  assert.equal(worktrees.includes(realpathSync(folder)), false, worktrees);
});

test('Given the real ast-metrics and a full parent commit SHA, when --commit runs, then the capture names that revision and date and leaves no worktree', live, async (t) => {
  const folder = dataDirectory(t);
  const out = join(folder, 'snapshot-commit.json');
  const commit = git('rev-parse', 'HEAD^').trim();

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--commit', commit, '--out', out], cwd: root, env: { TMPDIR: folder } });

  assert.equal(result.code, 0, result.stderr);
  assert.notEqual(commit, git('rev-parse', 'HEAD').trim());
  const snapshot = snapshotIn(out);
  assertSnapshotOfHead(snapshot, commit);
  assert.equal(snapshot.date, git('show', '-s', '--format=%cI', commit).trim());
  assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith('thermus-snapshot-base-')), []);
  const worktrees = git('worktree', 'list', '--porcelain');
  assert.equal(worktrees.includes(realpathSync(folder)), false, worktrees);
});
