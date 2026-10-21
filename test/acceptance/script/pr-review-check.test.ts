import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, linesUnder, manualNote, routeOf } from './fixtures/pr-review-check.ts';
import { guideChange, mainFiles, testFile } from './fixtures/pr-review-rules.ts';

// The route from the changed paths (AGENTS.md, "Review route"). pr-review-check-size.test.ts specifies the size and
// the tests, pr-review-check-facts.test.ts the dependency facts, pr-review-check-record.test.ts the record, and
// pr-review-check-failures.test.ts the failures.
const timeout = 30_000;

test('Given a branch that changes only a document, when the check runs, then the route is SHIP and the report gives every section in order', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Change the guide', guideChange);

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    '## Review route', '',
    'Route: `SHIP`',
    `Candidate: ${repository.git('rev-parse', 'HEAD').trim()}`,
    `Merge base: ${repository.git('rev-parse', 'main').trim()}`, '',
    'Reasons:', '- none', '',
    'Questions to answer:', '- none', '',
    'Changed paths:', '- M docs/guide.md', '',
    'Line counts:', '- Production: 0 (limit 400)', '- Total without generated files: 2 (limit 1500)', '',
    'Tests:', '- Added test cases: 0', '- Removed test cases: 0', '- Added skips or todos: none', '',
    'MI:', '- not checked: give --base-snapshot and --head-snapshot', '',
    'CRAP:', '- not checked: give --crap', '',
    'Facts to declare:', '- none', '',
    'Declared facts:', '- none', '',
    'Surface differences:', '- none', '',
    'Notes:', manualNote, '',
    'Label:', '`gh pr edit <n> --add-label route:ship --remove-label route:fix --remove-label route:ask --remove-label route:read --remove-label route:show`', '',
  ].join('\n'));
  assert.equal(result.code, 0);
});

test('Given a branch that changes a protected policy path, when the check runs with --repo, then the route is ASK with the question of the group and the label command names the repository', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Change the agent rules', { 'AGENTS.md': '# Agents\n\nA new rule.\n' });

  const result = await checkOn(t, repository, '--repo', 'owner/name');

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ASK');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- ASK protected_paths.policy: AGENTS.md']);
  assert.deepEqual(linesUnder(result.stdout, 'Questions to answer'), ['- protected_paths.policy: Does this change what the checks enforce? Record the new rule.']);
  assert.deepEqual(linesUnder(result.stdout, 'Label'), ['`gh pr edit <n> --repo owner/name --add-label route:ask --remove-label route:fix --remove-label route:read --remove-label route:show --remove-label route:ship`']);
  assert.equal(result.code, 0);
});

test('Given a branch that renames a protected file, when the check runs, then the old path gives ASK and the changed paths show the rename', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.git('mv', 'AGENTS.md', 'docs/agents.md');
  repository.commit('Move the agent rules');

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ASK');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- ASK protected_paths.policy: AGENTS.md']);
  assert.deepEqual(linesUnder(result.stdout, 'Changed paths'), ['- R AGENTS.md -> docs/agents.md']);
  assert.equal(result.code, 0);
});

test('Given a change to a module of the public surface, when the check runs, then the route is ASK with the question of the contracts group', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Change alpha', { 'src/alpha/alpha.ts': 'export const alpha = 3;\n' });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ASK');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- ASK public_surface: src/alpha/alpha.ts', '- SHOW scopes.executable: 1 changed file']);
  assert.deepEqual(linesUnder(result.stdout, 'Questions to answer'), ['- protected_paths.contracts: Does a client see a different input or output? Record the promise.']);
  assert.deepEqual(linesUnder(result.stdout, 'Surface differences'), ['- src/alpha/alpha.ts']);
  assert.equal(result.code, 0);
});

test('Given a change to a contract document, when the check runs, then it is a surface difference with the question of the contracts group', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(), 'docs/reference/fetch.md': '# Fetch\n' });
  repository.commit('Change the fetch contract', { 'docs/reference/fetch.md': '# Fetch\n\nA new limit.\n' });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ASK');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- ASK public_surface: docs/reference/fetch.md']);
  assert.deepEqual(linesUnder(result.stdout, 'Questions to answer'), ['- protected_paths.contracts: Does a client see a different input or output? Record the promise.']);
  assert.deepEqual(linesUnder(result.stdout, 'Surface differences'), ['- docs/reference/fetch.md']);
  assert.equal(result.code, 0);
});

test('Given a branch that only adds a test case, when the check runs, then the route is SHOW with one line for the changed executable files', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(), 'test/unit/sample.test.ts': testFile(['first']) });
  repository.commit('Add a test case', { 'test/unit/sample.test.ts': testFile(['first', 'second']) });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'SHOW');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- SHOW scopes.executable: 1 changed file']);
  assert.deepEqual(linesUnder(result.stdout, 'Tests'), ['- Added test cases: 1', '- Removed test cases: 0', '- Added skips or todos: none']);
  assert.equal(result.code, 0);
});

test('Given a branch whose HEAD is the merge base, when the check runs, then the route is SHIP with no changed path', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'SHIP');
  assert.deepEqual(linesUnder(result.stdout, 'Changed paths'), ['- none']);
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), ['- none']);
  assert.equal(result.code, 0);
});
