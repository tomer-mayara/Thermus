import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, linesUnder, routeOf, snapshotOptions, writeSnapshots } from './fixtures/pr-review-check.ts';
import { measuredFiles, rulesYaml } from './fixtures/pr-review-rules.ts';

// The exceptions file of check 4. The rules list it under read_paths, as the rules file of the repository does.
// pr-review-check-ratchet.test.ts specifies the MI rules.
const timeout = 30_000;
const exceptionsPath = '.code-quality-exceptions.yaml';
const startFiles = measuredFiles(rulesYaml((document) => { document.read_paths.paths.push(exceptionsPath); }));
const newModule = { 'src/alpha/low.ts': 'export const low = 1;\n' };

function exceptionsFile(path: string, expires: string): string {
  return ['exceptions:', `  - path: ${path}`, '    metric: mi', '    bound: 80', '    reason: The parser keeps one table of rules.', `    expires: ${expires}`, ''].join('\n');
}

test('Given an exception entry with a bound of 80 and a future date for a new file at raw MI 82, when the check runs, then the FIX becomes a READ reason that names the entry', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, startFiles);
  repository.commit('Add a module and its exception', { ...newModule, [exceptionsPath]: exceptionsFile('src/alpha/low.ts', '2999-12-31') });
  writeSnapshots(repository, {}, { 'src/alpha/low.ts': 82 });

  const result = await checkOn(t, repository, ...snapshotOptions);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'READ');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    `- READ read_paths: ${exceptionsPath}`,
    '- READ ratchet.exceptions: src/alpha/low.ts covered by "The parser keeps one table of rules." until 2999-12-31',
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'MI'), ['- new: src/alpha/low.ts: 82']);
  assert.equal(result.code, 0);
});

test('Given the same exception entry with a past date, when the check runs, then the FIX stays and the expired entry is FIX too', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, startFiles);
  repository.commit('Add a module and its exception', { ...newModule, [exceptionsPath]: exceptionsFile('src/alpha/low.ts', '2000-01-01') });
  writeSnapshots(repository, {}, { 'src/alpha/low.ts': 82 });

  const result = await checkOn(t, repository, ...snapshotOptions);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- FIX ratchet.maintainability_index.new_file_below: src/alpha/low.ts: 82',
    '- FIX ratchet.exceptions.expired: src/alpha/low.ts',
    `- READ read_paths: ${exceptionsPath}`,
    '- SHOW scopes.executable: 1 changed file',
  ]);
  assert.equal(result.code, 0);
});

test('Given an expired exception entry for a changed file and no snapshot options, when the check runs, then the expired entry is FIX and the MI section says that MI was not checked', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...startFiles, [exceptionsPath]: exceptionsFile('src/alpha/parser.ts', '2000-01-01') });
  repository.commit('Change the parser', { 'src/alpha/parser.ts': 'export const parser = 2;\n' });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'FIX');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- FIX ratchet.exceptions.expired: src/alpha/parser.ts', '- SHOW scopes.executable: 1 changed file']);
  assert.deepEqual(linesUnder(result.stdout, 'MI'), ['- not checked: give --base-snapshot and --head-snapshot']);
  assert.equal(result.code, 0);
});

test('Given an exception entry whose expiry is not a calendar date, when the check runs, then it exits 1 and names the entry and the field', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, startFiles);
  repository.commit('Add an exception', { [exceptionsPath]: exceptionsFile('src/alpha/parser.ts', '2026-02-30') });

  const result = await checkOn(t, repository);

  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `pr-review-check: The exceptions file ${exceptionsPath} at HEAD has no valid key exceptions[0].expires: give a date as YYYY-MM-DD.\n`);
  assert.equal(result.code, 1);
});
