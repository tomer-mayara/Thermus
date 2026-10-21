import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, eligibilityOf, commitsOf, linesUnder, tierOf, snapshotOptions, snapshotText, writeSnapshots } from './fixtures/pr-review-check.ts';
import { measuredFiles } from './fixtures/pr-review-rules.ts';

// The MI rules of check 4 on the two snapshots. pr-review-check-exceptions.test.ts specifies the exceptions file, and
// pr-review-check.test.ts specifies the tier from the changed paths.
const timeout = 30_000;
const newModule = { 'src/alpha/low.ts': 'export const low = 1;\n' };

test('Given a new production file at raw MI 84.96 and one at 85, when the check runs with both snapshots, then the first is blocked and the second is no reason', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Add two modules', { ...newModule, 'src/alpha/even.ts': 'export const even = 1;\n' });
  writeSnapshots(repository, { 'src/alpha/parser.ts': 90 }, { 'src/alpha/even.ts': 85, 'src/alpha/low.ts': 84.96, 'src/alpha/parser.ts': 90 });

  const result = await checkOn(t, repository, ...snapshotOptions);

  assert.equal(result.stderr, '');
  assert.equal(eligibilityOf(result.stdout), 'blocked');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- blocked ratchet.maintainability_index.new_file_below: src/alpha/low.ts: 84.96',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'MI'), ['- new: src/alpha/even.ts: 85', '- new: src/alpha/low.ts: 84.96']);
  assert.equal(result.code, 0);
});

test('Given an existing file at raw MI 90.0 in the base and 85.0 in the head, and one at 85.1, when the check runs, then only the first is T1 Team review with both values', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Change two modules', { 'src/alpha/parser.ts': 'export const parser = 2;\n', 'src/alpha/printer.ts': 'export const printer = 2;\n' });
  writeSnapshots(repository, { 'src/alpha/parser.ts': 90.0, 'src/alpha/printer.ts': 90.0 }, { 'src/alpha/parser.ts': 85.0, 'src/alpha/printer.ts': 85.1 });

  const result = await checkOn(t, repository, ...snapshotOptions);

  assert.equal(result.stderr, '');
  assert.equal(tierOf(result.stdout), 'T1');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- T1 Team review ratchet.maintainability_index.existing_file_drop_read_at: src/alpha/parser.ts: 90 to 85',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'MI'), ['- changed: src/alpha/parser.ts: 90 to 85', '- changed: src/alpha/printer.ts: 90 to 85.1']);
  assert.equal(result.code, 0);
});

test('Given a renamed production file whose raw MI drops by five, when the check runs, then it compares the old path in the base snapshot with the new path in the head snapshot', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.git('mv', 'src/alpha/parser.ts', 'src/alpha/reader.ts');
  repository.commit('Rename the parser');
  writeSnapshots(repository, { 'src/alpha/parser.ts': 92.5 }, { 'src/alpha/reader.ts': 87.5 });

  const result = await checkOn(t, repository, ...snapshotOptions);

  assert.equal(result.stderr, '');
  assert.equal(tierOf(result.stdout), 'T1');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- T1 Team review ratchet.maintainability_index.existing_file_drop_read_at: src/alpha/parser.ts -> src/alpha/reader.ts: 92.5 to 87.5',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'MI'), ['- changed: src/alpha/parser.ts -> src/alpha/reader.ts: 92.5 to 87.5']);
  assert.equal(result.code, 0);
});

test('Given changed and new production files without raw MI in the snapshot that each needs, when the check runs, then the MI section names missing evidence and blocks merge', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, measuredFiles());
  repository.commit('Change two modules and add types', {
    'src/alpha/parser.ts': 'export const parser = 2;\n', 'src/alpha/printer.ts': 'export const printer = 2;\n', 'src/alpha/types.ts': 'export type Value = number;\n',
  });
  writeSnapshots(repository, { 'src/alpha/parser.ts': 90 }, { 'src/alpha/parser.ts': undefined, 'src/alpha/printer.ts': 88, 'src/alpha/types.ts': undefined });

  const result = await checkOn(t, repository, ...snapshotOptions);

  assert.equal(result.stderr, '');
  assert.equal(tierOf(result.stdout), 'T0');
  assert.equal(eligibilityOf(result.stdout), 'blocked');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- blocked ratchet.maintainability_index.missing: src/alpha/parser.ts: no raw MI in the head snapshot',
    '- blocked ratchet.maintainability_index.missing: src/alpha/printer.ts: no raw MI in the base snapshot',
    '- blocked ratchet.maintainability_index.missing: src/alpha/types.ts: no raw MI in the head snapshot',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'MI'), [
    '- unavailable: src/alpha/parser.ts: no raw MI in the head snapshot',
    '- unavailable: src/alpha/printer.ts: no raw MI in the base snapshot',
    '- unavailable: src/alpha/types.ts: no raw MI in the head snapshot',
  ]);
  assert.equal(result.code, 0);
});

for (const snapshot of ['head', 'base'] as const) {
  test(`Given a ${snapshot} snapshot of another commit, when the check runs, then it exits 1 and names the snapshot and both commits`, { timeout }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, measuredFiles());
    repository.commit('Add a module', newModule);
    const { base, head } = commitsOf(repository);
    repository.write({ 'ast-report/snapshot-base.json': snapshotText(snapshot === 'base' ? head : base, {}), 'ast-report/snapshot.json': snapshotText(snapshot === 'head' ? base : head, {}) });

    const result = await checkOn(t, repository, ...snapshotOptions);

    assert.equal(result.stdout, '');
    assert.equal(result.stderr, snapshot === 'head'
      ? `pr-review-check: The head snapshot ast-report/snapshot.json is of commit ${base}, but the candidate is ${head}. Take the snapshot again after the last commit.\n`
      : `pr-review-check: The base snapshot ast-report/snapshot-base.json is of commit ${head}, but the merge base is ${base}. Take the snapshot again with the same --base as the check.\n`);
    assert.equal(result.code, 1);
  });
}

for (const [name, write, diagnostic] of [
  ['without the base snapshot file', (repository: GitRepository) => repository.write({ 'ast-report/snapshot.json': snapshotText(commitsOf(repository).head, {}) }),
    'Cannot read the base snapshot file ast-report/snapshot-base.json.'],
  ['with a raw MI that is a text in the head snapshot', (repository: GitRepository) => repository.write({
    'ast-report/snapshot-base.json': snapshotText(commitsOf(repository).base, {}),
    'ast-report/snapshot.json': JSON.stringify({ version: 1, commit: commitsOf(repository).head, files: [{ path: 'src/alpha/low.ts', maintainabilityRaw: '84.96' }] }),
  }), 'The head snapshot ast-report/snapshot.json has no valid key files[0].maintainabilityRaw: give a finite number.'],
] as const) {
  test(`Given snapshot options ${name}, when the check runs, then it exits 1 and names the file`, { timeout }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, measuredFiles());
    repository.commit('Add a module', newModule);
    write(repository);

    const result = await checkOn(t, repository, ...snapshotOptions);

    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `pr-review-check: ${diagnostic}\n`);
    assert.equal(result.code, 1);
  });
}
