import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, linesUnder, routeOf } from './fixtures/pr-review-check.ts';
import { mainFiles, rulesYaml, testFile } from './fixtures/pr-review-rules.ts';

// The size and the tests of the review route. pr-review-check.test.ts specifies the route from the changed paths.
const timeout = 30_000;
const lowLimit = rulesYaml((rules) => { rules.size.production_lines_read_above = 5; });
const longModule = Array.from({ length: 8 }, (_, index) => `export const value${index} = ${index};\n`).join('');

test('Given a source change above the production line limit, when the check runs, then the route is ARCHITECT_REVIEW_NEEDED with the count and the limit', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles(lowLimit));
  repository.commit('Add a longer module', { 'src/alpha/more.ts': longModule });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ARCHITECT_REVIEW_NEEDED');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- ARCHITECT_REVIEW_NEEDED size.production_lines_read_above: 8 production lines, above the limit of 5',
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Line counts'), ['- Production: 8 (limit 5)', '- Total without generated files: 8 (limit 1500)']);
  assert.equal(result.code, 0);
});

test('Given a file that moves into src without a change, when the check runs, then all its lines count as production lines', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(lowLimit), 'tools/more.ts': longModule });
  repository.git('mv', 'tools/more.ts', 'src/alpha/more.ts');
  repository.commit('Move the module into alpha');

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ARCHITECT_REVIEW_NEEDED');
  assert.deepEqual(linesUnder(result.stdout, 'Changed paths'), ['- R tools/more.ts -> src/alpha/more.ts']);
  assert.deepEqual(linesUnder(result.stdout, 'Line counts'), ['- Production: 8 (limit 5)', '- Total without generated files: 0 (limit 1500)']);
  assert.equal(result.code, 0);
});

test('Given a branch that removes a test case, when the check runs, then the route is ARCHITECT_REVIEW_NEEDED and the reason names the removed case', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(), 'test/unit/sample.test.ts': testFile(['first', 'second']) });
  repository.commit('Remove a test case', { 'test/unit/sample.test.ts': testFile(['first']) });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ARCHITECT_REVIEW_NEEDED');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    "- ARCHITECT_REVIEW_NEEDED size.test_counts: test/unit/sample.test.ts: test('second', () => {});",
  ]);
  assert.deepEqual(linesUnder(result.stdout, 'Tests'), ['- Added test cases: 0', '- Removed test cases: 1', '- Added skips or todos: none']);
  assert.equal(result.code, 0);
});

test('Given a branch that skips a test with an option shorthand, when the check runs, then the route is ARCHITECT_REVIEW_NEEDED and names the file', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(), 'test/unit/sample.test.ts': testFile(['first']) });
  repository.commit('Skip a test', { 'test/unit/sample.test.ts': "import { test } from 'node:test';\n\nconst skip = true;\ntest('first', { skip }, () => {});\n" });

  const result = await checkOn(t, repository);

  assert.equal(result.stderr, '');
  assert.equal(routeOf(result.stdout), 'ARCHITECT_REVIEW_NEEDED');
  assert.deepEqual(linesUnder(result.stdout, 'Reasons'), [
    '- ARCHITECT_REVIEW_NEEDED size.test_counts: skipped or todo test added in test/unit/sample.test.ts',
  ]);
  assert.equal(result.code, 0);
});
