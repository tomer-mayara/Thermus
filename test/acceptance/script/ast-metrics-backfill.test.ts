import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { astMetricsBackfillScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseDoublesOnPath, foldersLeftIn, forkedRepository, pathWithGitThatKeepsWorktrees, worktreesOf } from './fixtures/ast-metrics-snapshot-base.ts';

const timeout = 20_000;

function repositoryForBackfill(t: TestContext) {
  const fixture = forkedRepository(t);
  fixture.repository.git('update-ref', 'refs/remotes/origin/main', 'main');
  return fixture;
}

test('Given main moved after a branch fork, when manual backfill selects two commits and then repeats, then it records each exact main tree once without coverage or changes to existing records', { timeout }, async (t) => {
  const { repository, mergeBase } = repositoryForBackfill(t);
  const tip = repository.git('rev-parse', 'main').trim();
  const doubles = baseDoublesOnPath(t);
  const options = { args: ['--count', '2'], cwd: repository.root, env: doubles.env };

  const first = await runScript(t, astMetricsBackfillScript, options);

  assert.equal(first.code, 0, first.stderr);
  const folder = join(repository.root, 'docs', 'metrics');
  const names = readdirSync(folder).filter((name) => name.endsWith('.json'));
  const records = names.map((name) => JSON.parse(readFileSync(join(folder, name), 'utf8')) as Record<string, unknown>);
  assert.deepEqual(records.map(({ commit }) => commit).sort(), [mergeBase, tip].sort());
  assert.equal(new Set(records.map(({ sourceFingerprint }) => sourceFingerprint)).size, 2);
  assert.ok(records.every((record) => record.functionsOver30 === undefined && record.crap === undefined));
  assert.equal(doubles.cli.calls().filter(({ argv }) => argv[0] === 'analyze').length, 2);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  const preserved = `${JSON.stringify({ ...records[0], maintainability: 12 }, null, 2)}\n`;
  writeFileSync(join(folder, names[0]), preserved);

  const callsBeforeRepeat = doubles.cli.calls();
  const repeated = await runScript(t, astMetricsBackfillScript, options);

  assert.equal(repeated.code, 0, repeated.stderr);
  assert.equal(readFileSync(join(folder, names[0]), 'utf8'), preserved);
  assert.deepEqual(doubles.cli.calls(), callsBeforeRepeat);
  assert.equal(doubles.cli.calls().filter(({ argv }) => argv[0] === 'analyze').length, 2);
  assert.match(repeated.stdout, /0 records written; 2 existing records kept/u);
});

test('Given help or an invalid count outside a repository, when manual backfill runs, then help defines the default and bad counts fail before Git or tool access', { timeout }, async (t) => {
  const doubles = baseDoublesOnPath(t);
  const cwd = doubles.temporaryFolder;
  const help = await runScript(t, astMetricsBackfillScript, { args: ['--help'], cwd, env: doubles.env });
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /Usage:.*ast-metrics-backfill.ts/u);
  assert.match(help.stdout, /Options:[\s\S]*--count N[\s\S]*default: 10/u);
  for (const count of ['0', '-1', '1.5', 'NaN', '9007199254740992']) {
    const invalid = await runScript(t, astMetricsBackfillScript, { args: [`--count=${count}`], cwd, env: doubles.env });
    assert.equal(invalid.code, 1);
    assert.match(invalid.stderr, /--count value must be a positive safe integer/u);
  }
  assert.deepEqual(doubles.cli.calls(), []);
});

for (const history of ['missing origin/main', 'shallow'] as const) {
  test(`Given ${history} history, when manual backfill runs, then it explains the unavailable history before analysis and creates no records`, { timeout }, async (t) => {
    const { repository } = forkedRepository(t);
    if (history === 'shallow') {
      repository.git('update-ref', 'refs/remotes/origin/main', 'main');
      writeFileSync(join(repository.root, '.git', 'shallow'), `${repository.git('rev-parse', 'main').trim()}\n`);
    }
    const doubles = baseDoublesOnPath(t);

    const result = await runScript(t, astMetricsBackfillScript, { cwd: repository.root, env: doubles.env });

    assert.equal(result.code, 1);
    assert.match(result.stderr, history === 'shallow' ? /history is shallow/u : /without origin\/main/u);
    assert.equal(result.stdout, '');
    assert.deepEqual(doubles.cli.calls(), []);
    assert.deepEqual(worktreesOf(repository), [repository.root]);
  });
}

test('Given an analysis failure, when backfill stops, then it removes its exact-commit worktree and writes no record for the failed commit', { timeout }, async (t) => {
  const { repository } = repositoryForBackfill(t);
  const doubles = baseDoublesOnPath(t, { exitCode: 2, stderr: 'Backfill analysis failed.\n' });

  const result = await runScript(t, astMetricsBackfillScript, { args: ['--count', '1'], cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Backfill analysis failed/u);
  assert.equal(existsSync(join(repository.root, 'docs', 'metrics')), false);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
});

test('Given failed worktree cleanup, when a backfill snapshot succeeds, then publication fails and the record stays absent', { timeout }, async (t) => {
  const { repository } = repositoryForBackfill(t);
  const doubles = baseDoublesOnPath(t);
  const env = { ...doubles.env, PATH: pathWithGitThatKeepsWorktrees(t, doubles.env.PATH) };

  const result = await runScript(t, astMetricsBackfillScript, { args: ['--count', '1'], cwd: repository.root, env });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /temporary worktree.*stays/u);
  assert.equal(existsSync(join(repository.root, 'docs', 'metrics')), false);
});

test('Given a non-pinned tool version, when backfill is allowed explicitly, then it checks the version once and records that version', { timeout }, async (t) => {
  const { repository } = repositoryForBackfill(t);
  const doubles = baseDoublesOnPath(t, { version: '9.8.7' });
  const refused = await runScript(t, astMetricsBackfillScript, { args: ['--count', '1'], cwd: repository.root, env: doubles.env });
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /not the pinned/u);
  const allowed = await runScript(t, astMetricsBackfillScript, { args: ['--count', '1', '--allow-tool-version'], cwd: repository.root, env: doubles.env });
  assert.equal(allowed.code, 0, allowed.stderr);
  assert.equal(doubles.cli.calls().filter(({ argv }) => argv[0] === 'version').length, 2);
  const store = join(repository.root, 'docs', 'metrics');
  const record = JSON.parse(readFileSync(join(store, readdirSync(store)[0]), 'utf8'));
  assert.equal(record.tool, '9.8.7');
});

test('Given a merge on main with a side-parent commit, when backfill selects two commits, then it records only the latest two first-parent commits', { timeout }, async (t) => {
  const { repository } = forkedRepository(t);
  repository.git('switch', '--quiet', '--create', 'side', 'main');
  repository.commit('Side change', { 'side.md': 'Side branch.\n' });
  const side = repository.git('rev-parse', 'HEAD').trim();
  repository.git('switch', '--quiet', 'main');
  repository.commit('Main change', { 'main.md': 'Main branch.\n' });
  const parent = repository.git('rev-parse', 'HEAD').trim();
  repository.git('merge', '--quiet', '--no-ff', '--message', 'Merge side', 'side');
  const merge = repository.git('rev-parse', 'HEAD').trim();
  repository.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsBackfillScript, { args: ['--count', '2'], cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  const store = join(repository.root, 'docs', 'metrics');
  const commits = readdirSync(store).map((name) => JSON.parse(readFileSync(join(store, name), 'utf8')).commit as string);
  assert.deepEqual(commits.sort(), [parent, merge].sort());
  assert.ok(!commits.includes(side));
});
