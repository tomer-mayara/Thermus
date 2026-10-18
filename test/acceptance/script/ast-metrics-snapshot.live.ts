import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsSnapshotScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// This check runs the real ast-metrics on this repository. It needs the executable on PATH; the guide is
// docs/implementation/ast-metrics-review.md. Without it, Node reports the check as skipped. The snapshot goes to a
// temporary folder, so that ast-report/snapshot.json stays as it was.
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const live = { timeout: 60_000, skip: installed ? false : 'ast-metrics is not on PATH' };
const root = fileURLToPath(repositoryRoot);

interface LiveSnapshot {
  readonly commit: string;
  readonly global: { readonly cycles: readonly (readonly string[])[]; readonly files: number };
  readonly communities: readonly { readonly id: string; readonly label: string; readonly members: readonly string[] }[];
  readonly files: readonly { readonly path: string; readonly community: string | null }[];
}

// The counts are those of src/ on 2026-10-18. The snapshot analyzes src/ alone, so only a change of src/ can change them;
// then this check names the new counts.
test('Given the real ast-metrics, when the snapshot runs in the repository root, then it has 7 communities and the shared kernel, one cycle, and more than 90 files within 60 seconds', live, async (t) => {
  const out = join(dataDirectory(t), 'snapshot.json');

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--out', out], cwd: root });

  assert.equal(result.code, 0, result.stderr);
  const snapshot = JSON.parse(readFileSync(out, 'utf8')) as LiveSnapshot;
  const labels = snapshot.communities.map(({ label }) => label);
  assert.equal(snapshot.communities.filter(({ id }) => id !== 'shared').length, 7, labels.join(', '));
  assert.ok(labels.includes('shared kernel'), labels.join(', '));
  assert.equal(new Set(labels).size, labels.length, labels.join(', '));
  assert.equal(snapshot.global.cycles.length, 1, JSON.stringify(snapshot.global.cycles));
  assert.ok(snapshot.global.files > 90, `${snapshot.global.files} files`);
  assert.deepEqual(snapshot.communities.flatMap(({ members }) => members).filter((member) => !member.startsWith('src/')), []);
  const ids = new Set(snapshot.communities.map(({ id }) => id));
  assert.deepEqual(snapshot.files.filter(({ community }) => community !== null && !ids.has(community)), []);
  assert.equal(snapshot.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
});
