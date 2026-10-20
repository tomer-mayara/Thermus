import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseDoublesOnPath, baseRepository, foldersLeftIn, forkedRepository, worktreesOf } from './fixtures/ast-metrics-snapshot-base.ts';

test('Given a dirty branch that diverged from main, when the snapshot requests the exact main commit, then it captures that revision and keeps existing captures and caller files', { timeout: 20_000 }, async (t) => {
  const { repository, mergeBase } = forkedRepository(t);
  const doubles = baseDoublesOnPath(t);
  const commit = repository.git('rev-parse', 'main').trim();
  const head = repository.git('rev-parse', 'HEAD').trim();
  repository.write({
    'src/kernel/ids.ts': 'export const dirty = 99;\n',
    'ast-metrics-fake-report.json': '{}',
    'ast-report/snapshot.json': 'working capture\n',
    'ast-report/snapshot-base.json': 'base capture\n',
  });

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--commit', commit], cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Wrote ast-report/snapshot-commit.json: 3 communities, 4 files, 5 functions.\n');
  const snapshot = JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot-commit.json'), 'utf8'));
  assert.notEqual(commit, mergeBase);
  assert.notEqual(commit, head);
  assert.equal(snapshot.commit, commit);
  assert.equal(snapshot.date, repository.git('show', '-s', '--format=%cI', commit).trim());
  assert.deepEqual(snapshot.files.map(({ path, loc }: { path: string; loc: number }) => [path, loc]), [
    ['src/admin/pages/account.ts', 50], ['src/auth/session.ts', 100], ['src/auth/tokens.ts', 50], ['src/kernel/ids.ts', 12],
  ]);
  assert.equal(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'), 'working capture\n');
  assert.equal(readFileSync(join(repository.root, 'ast-report/snapshot-base.json'), 'utf8'), 'base capture\n');
  assert.equal(readFileSync(join(repository.root, 'src/kernel/ids.ts'), 'utf8'), 'export const dirty = 99;\n');
  assert.equal(readFileSync(join(repository.root, 'ast-metrics-fake-report.json'), 'utf8'), '{}');
  assert.equal(repository.git('rev-parse', 'HEAD').trim(), head);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  assert.deepEqual(await doubles.server.stillRunning(), []);
});

test('Given an exact commit and a nested caller, when --out names a relative file, then the capture goes to that file', { timeout: 20_000 }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t);
  const commit = repository.git('rev-parse', 'main').trim();

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--commit', commit, '--out', '../reports/commit.json'], cwd: join(repository.root, 'src'), env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'Wrote ../reports/commit.json: 3 communities, 4 files, 5 functions.\n');
  assert.equal(JSON.parse(readFileSync(join(repository.root, 'reports/commit.json'), 'utf8')).commit, commit);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});

for (const object of ['unknown', 'blob'] as const) {
  test(`Given a full SHA for an ${object === 'unknown' ? 'unknown object' : 'existing blob'}, when --commit runs, then it fails before tools or publication`, { timeout: 20_000 }, async (t) => {
    const repository = baseRepository(t);
    const doubles = baseDoublesOnPath(t);
    const commit = object === 'unknown' ? 'f'.repeat(40) : repository.git('rev-parse', 'main:src/kernel/ids.ts').trim();

    const result = await runScript(t, astMetricsSnapshotScript, { args: ['--commit', commit], cwd: repository.root, env: doubles.env });

    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^ast-metrics-snapshot: Cannot verify the snapshot commit\./);
    assert.deepEqual(doubles.cli.calls(), []);
    assert.deepEqual(doubles.server.requests(), []);
    assert.equal(existsSync(join(repository.root, 'ast-report')), false);
    assert.deepEqual(worktreesOf(repository), [repository.root]);
    assert.deepEqual(foldersLeftIn(doubles), []);
  });
}

test('Given an exact commit whose analysis fails, when --commit runs, then it removes the worktree and publishes no capture', { timeout: 20_000 }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t, { exitCode: 2 });
  const commit = repository.git('rev-parse', 'main').trim();

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--commit', commit], cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^ast-metrics-snapshot: ast-metrics analyze failed with exit status 2\./);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  assert.deepEqual(await doubles.server.stillRunning(), []);
});
