import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { testCountsOf, testReasons } = await import(new URL('test-counts.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/test-counts.ts');

function diffOf(file: string, lines: readonly string[]): string {
  return [`diff --git ${file} ${file}`, 'index 1..2 100644', `--- ${file}`, `+++ ${file}`, '@@ -1,0 +1,9 @@', ...lines, ''].join('\n');
}

for (const [form, line] of [
  ['an option shorthand', "+test('a', { timeout, skip }, () => {});"],
  ['an option with a reason', "+test('a', { skip: 'not on this host' }, () => {});"],
  ['a todo option with a reason', "+test('a', { todo: 'later' }, () => {});"],
  ['a skip option of true', "+it('a', { skip: true }, () => {});"],
  ['a variable that holds the skip', '+const skip = process.platform === "win32";'],
  ['a call of test.skip', "+test.skip('a', () => {});"],
  ['a call of t.todo', "+  t.todo('a later case');"],
  ['a skip as the last argument', '+run(cases, skip)'],
] as const) {
  test(`Given an added line with ${form}, when the test diff is read, then its file has an added skip or todo`, () => {
    assert.deepEqual(testCountsOf(diffOf('test/a.test.ts', [line])).skippedOrTodo, ['test/a.test.ts']);
  });
}

test('Given added lines that only name skips in other words, when the test diff is read, then no file has an added skip or todo', () => {
  assert.deepEqual(testCountsOf(diffOf('test/a.test.ts', ['+const skipped = 0;', '+// todos come later', '+const skipList = [];'])).skippedOrTodo, []);
});

for (const [form, line] of [
  ['test(', "test('a', () => {});"],
  ['it(', "  it('a', () => {});"],
  ['a subtest', "  await t.test('a', async () => {});"],
  ['test.only(', "test.only('a', () => {});"],
  ['a row of a loop', 'for (const row of rows) test(`case ${row}`, () => {});'],
] as const) {
  test(`Given an added and a removed line with ${form}, when the test diff is read, then each counts as a test case`, () => {
    const counts = testCountsOf(diffOf('test/a.test.ts', [`+${line}`, `-${line}`]));

    assert.equal(counts.added, 1);
    assert.deepEqual(counts.removedCases, [`test/a.test.ts: ${line.trim()}`]);
  });
}

test('Given calls that only end like test or it, when the test diff is read, then they are no test cases', () => {
  const counts = testCountsOf(diffOf('test/a.test.ts', ['+submit(form);', '+const result = latest(values);', "+describe('group', () => {});"]));

  assert.equal(counts.added, 0);
});

test('Given file headers with a quoted path, a trailing tab, and a line of content that starts with +++, when the test diff is read, then the file names and the counts stay right', () => {
  const diff = [
    'diff --git test/my dir/a.test.ts test/my dir/a.test.ts', '--- test/my dir/a.test.ts\t', '+++ test/my dir/a.test.ts\t',
    '@@ -1 +1 @@', "-test('old', () => {});", '+++ a line of content',
    'diff --git test/b.test.ts test/b.test.ts', 'deleted file mode 100644', '--- test/b.test.ts', '+++ /dev/null',
    '@@ -1 +0,0 @@', "-test('gone', () => {});", '',
  ].join('\n');

  assert.deepEqual(testCountsOf(diff), {
    added: 0,
    removedCases: ["test/my dir/a.test.ts: test('old', () => {});", "test/b.test.ts: test('gone', () => {});"],
    skippedOrTodo: [],
  });
});

test('Given more removed test cases than added ones, when the test reasons are made, then each removed case is a READ reason, and each file with a skip or todo too', () => {
  const reasons = testReasons({ added: 1, removedCases: ["test/a.test.ts: test('one', () => {});", "test/a.test.ts: test('two', () => {});"], skippedOrTodo: ['test/b.test.ts'] });

  assert.deepEqual(reasons, [
    { route: 'READ', key: 'size.test_counts', fact: "test/a.test.ts: test('one', () => {});" },
    { route: 'READ', key: 'size.test_counts', fact: "test/a.test.ts: test('two', () => {});" },
    { route: 'READ', key: 'size.test_counts', fact: 'skipped or todo test added in test/b.test.ts' },
  ]);
  assert.deepEqual(testReasons({ added: 2, removedCases: ["test/a.test.ts: test('one', () => {});", "test/a.test.ts: test('two', () => {});"], skippedOrTodo: [] }), []);
});
